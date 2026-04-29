import asyncio
import base64
import json
from typing import Optional

import anthropic

from .base import LLMProvider
from ..core.logging import get_logger

logger = get_logger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 16384
_JSON_INSTRUCTION = "\n\nRespond ONLY with valid JSON. No markdown, no code fences, no explanation."


class ClaudeProvider(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=api_key)

    async def generate(self, prompt: str, system: Optional[str] = None) -> str:
        kwargs: dict = {
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system
        for attempt in range(3):
            try:
                response = await self._client.messages.create(**kwargs)
                return response.content[0].text
            except anthropic.RateLimitError:
                if attempt == 2:
                    raise
                await asyncio.sleep(2**attempt)
        raise RuntimeError("Unreachable")

    async def generate_structured(self, prompt: str, schema: dict, system: Optional[str] = None) -> dict:
        sys_prompt = (system or "") + _JSON_INSTRUCTION
        text = await self.generate(prompt, system=sys_prompt)
        return _parse_json(text)

    async def generate_vision(
        self,
        prompt: str,
        image: bytes,
        media_type: str = "image/png",
        system: Optional[str] = None,
    ) -> str:
        image_b64 = base64.standard_b64encode(image).decode("utf-8")
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_b64},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        kwargs: dict = {"model": MODEL, "max_tokens": MAX_TOKENS, "messages": messages}
        if system:
            kwargs["system"] = system
        for attempt in range(3):
            try:
                response = await self._client.messages.create(**kwargs)
                return response.content[0].text
            except anthropic.RateLimitError:
                if attempt == 2:
                    raise
                await asyncio.sleep(2**attempt)
        raise RuntimeError("Unreachable")


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        text = text.rsplit("```", 1)[0]
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("json_parse_error", error=str(e), raw=text[:300])
        raise ValueError(f"LLM returned invalid JSON: {e}")
