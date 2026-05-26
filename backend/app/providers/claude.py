from dome_core.llm.claude import ClaudeProvider

from ..core.config import settings

_provider: ClaudeProvider | None = None


def get_claude_provider() -> ClaudeProvider:
    global _provider
    if _provider is None:
        _provider = ClaudeProvider(
            api_key=settings.anthropic_api_key,
            model=settings.llm_text_model,
        )
    return _provider


__all__ = ["ClaudeProvider", "get_claude_provider"]
