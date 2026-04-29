from typing import Optional
from .base import LLMProvider


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url

    async def generate(self, prompt: str, system: Optional[str] = None) -> str:
        raise NotImplementedError("OllamaProvider not yet implemented. Use ClaudeProvider for demos.")

    async def generate_structured(self, prompt: str, schema: dict, system: Optional[str] = None) -> dict:
        raise NotImplementedError("OllamaProvider not yet implemented. Use ClaudeProvider for demos.")

    async def generate_vision(
        self,
        prompt: str,
        image: bytes,
        media_type: str = "image/png",
        system: Optional[str] = None,
    ) -> str:
        raise NotImplementedError("OllamaProvider not yet implemented. Use ClaudeProvider for demos.")
