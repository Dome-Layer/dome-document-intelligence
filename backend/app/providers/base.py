from abc import ABC, abstractmethod
from typing import Optional


class LLMProvider(ABC):
    """Abstract interface for LLM providers. Swap implementations via config."""

    @abstractmethod
    async def generate(self, prompt: str, system: Optional[str] = None) -> str:
        """Generate text completion."""
        ...

    @abstractmethod
    async def generate_structured(self, prompt: str, schema: dict, system: Optional[str] = None) -> dict:
        """Generate structured JSON output matching schema."""
        ...

    @abstractmethod
    async def generate_vision(
        self,
        prompt: str,
        image: bytes,
        media_type: str = "image/png",
        system: Optional[str] = None,
    ) -> str:
        """Generate completion from image input."""
        ...
