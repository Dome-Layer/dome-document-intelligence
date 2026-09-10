from __future__ import annotations

import base64
import json
from typing import Optional

import httpx
from dome_core.json_utils import parse_json_response

from ..core.logging import get_logger
from .base import LLMProvider

logger = get_logger(__name__)

_JSON_INSTRUCTION = "\n\nRespond ONLY with valid JSON. No markdown, no code fences, no explanation."
# Local inference is CPU/GPU-bound and the first call after a pull/idle period pays a
# model-load tax — generous on purpose; a timeout here means something is actually wrong.
# qwen3-vl:8b is a "thinking" model that can spend several minutes reasoning before a
# single field-extraction response even on Metal-accelerated hardware (empirically
# observed up to ~300s+ on some documents), so this is deliberately much larger than a
# typical cloud-provider timeout.
_DEFAULT_TIMEOUT = httpx.Timeout(900.0, connect=10.0)
# qwen3-vl:8b malformed-JSON failures are stochastic, not deterministic — an identical
# retry has been observed to succeed (see P3_local_deployment_notes.md §4).
_MAX_JSON_RETRIES = 2
# Separately, qwen3-vl:8b sometimes returns syntactically valid but empty JSON
# (e.g. {"fields": [], ...}) instead of a parse error — also observed to be stochastic
# per-doc, not a genuine "nothing to extract" case (see P3_local_deployment_notes.md §8).
_MAX_EMPTY_RETRIES = 2


class OllamaProvider(LLMProvider):
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout: httpx.Timeout | float = _DEFAULT_TIMEOUT,
    ) -> None:
        self._model = model
        self._client = httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout)

    async def generate(self, prompt: str, system: Optional[str] = None) -> str:
        return await self._chat(self._messages(prompt, system), json_mode=False)

    async def generate_structured(
        self, prompt: str, schema: dict, system: Optional[str] = None
    ) -> dict:
        schema_hint = "\n\nOutput schema — use these exact field names:\n" + json.dumps(
            schema, indent=2
        )
        sys_prompt = (system or "") + _JSON_INSTRUCTION
        messages = self._messages(prompt + schema_hint, sys_prompt)
        text = await self._chat(messages, json_mode=True)
        data = parse_json_response(text)

        # Schema-driven "did it actually try" check: any top-level key the schema declares
        # as a list (e.g. extraction's "fields") coming back empty on every such key is a
        # degenerate response worth reprompting, distinct from the JSON-parse retry above.
        list_keys = [k for k, v in schema.items() if isinstance(v, list)]
        for attempt in range(1, _MAX_EMPTY_RETRIES + 1):
            if not list_keys or any(data.get(k) for k in list_keys):
                break
            logger.warning(
                "ollama_empty_response_retry",
                attempt=attempt,
                model=self._model,
                list_keys=list_keys,
            )
            text = await self._chat(messages, json_mode=True)
            data = parse_json_response(text)
        return data

    async def generate_vision(
        self,
        prompt: str,
        image: bytes,
        media_type: str = "image/png",  # unused by Ollama — kept for interface parity
        system: Optional[str] = None,
    ) -> str:
        messages = self._messages(prompt, system)
        messages[-1]["images"] = [base64.standard_b64encode(image).decode("utf-8")]
        # Every real caller of generate_vision in this codebase (ExtractionService) already
        # instructs `_SYSTEM_ANALYST` to return JSON-only, so request Ollama's JSON mode too.
        return await self._chat(messages, json_mode=True)

    @staticmethod
    def _messages(prompt: str, system: Optional[str]) -> list[dict]:
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return messages

    async def _chat(self, messages: list[dict], *, json_mode: bool) -> str:
        text = await self._post(messages, json_mode=json_mode)
        if not json_mode:
            return text
        for attempt in range(1, _MAX_JSON_RETRIES + 1):
            try:
                parse_json_response(text)
                return text
            except ValueError as exc:
                logger.warning(
                    "ollama_json_parse_retry",
                    attempt=attempt,
                    model=self._model,
                    error=str(exc),
                )
                text = await self._post(messages, json_mode=json_mode)
        return text  # final attempt's text — caller's own parse will raise if still invalid

    async def _post(self, messages: list[dict], *, json_mode: bool) -> str:
        body: dict = {"model": self._model, "messages": messages, "stream": False}
        if json_mode:
            body["format"] = "json"
        try:
            resp = await self._client.post("/api/chat", json=body)
            resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise RuntimeError(
                f"Could not reach Ollama at {self._client.base_url}. Is `ollama serve` running?"
            ) from exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise RuntimeError(
                    f"Model '{self._model}' not found on this Ollama instance. "
                    f"Run: ollama pull {self._model}"
                ) from exc
            raise
        return resp.json()["message"]["content"]
