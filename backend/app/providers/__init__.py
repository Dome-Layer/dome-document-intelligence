from .base import LLMProvider
from .claude import ClaudeProvider
from .azure_openai import AzureOpenAIProvider
from .ollama import OllamaProvider


def get_llm_provider() -> LLMProvider:
    from ..core.config import settings

    provider = settings.llm_provider
    if provider == "claude":
        return ClaudeProvider(api_key=settings.anthropic_api_key)
    elif provider == "azure_openai":
        return AzureOpenAIProvider(
            endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_key,
            deployment=settings.azure_openai_deployment,
        )
    elif provider == "ollama":
        return OllamaProvider(base_url=settings.ollama_url)
    raise ValueError(f"Unknown LLM provider: {provider}")


__all__ = ["LLMProvider", "ClaudeProvider", "AzureOpenAIProvider", "OllamaProvider", "get_llm_provider"]
