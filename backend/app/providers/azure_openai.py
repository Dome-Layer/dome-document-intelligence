from typing import Optional
from .base import LLMProvider


class AzureOpenAIProvider(LLMProvider):
    def __init__(self, endpoint: str, api_key: str, deployment: str) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._deployment = deployment

    async def generate(self, prompt: str, system: Optional[str] = None) -> str:
        raise NotImplementedError("AzureOpenAIProvider not yet implemented. Use ClaudeProvider for demos.")

    async def generate_structured(self, prompt: str, schema: dict, system: Optional[str] = None) -> dict:
        raise NotImplementedError("AzureOpenAIProvider not yet implemented. Use ClaudeProvider for demos.")

    async def generate_vision(
        self,
        prompt: str,
        image: bytes,
        media_type: str = "image/png",
        system: Optional[str] = None,
    ) -> str:
        raise NotImplementedError("AzureOpenAIProvider not yet implemented. Use ClaudeProvider for demos.")
