"""ModelProvider abstraction (decision #1).

Returns a LangChain chat model for the agent. Hosted Anthropic model today,
behind this seam so a local model can be swapped in later without touching the
agent code. The model id comes from configuration, never hardcoded.
"""

from __future__ import annotations

from .config import settings


def build_model():
    if not settings.anthropic_model:
        raise RuntimeError(
            "ANTHROPIC_MODEL is not set. Set it to a current Claude model id "
            "(see https://docs.claude.com/en/docs/about-claude/models)."
        )
    from langchain_anthropic import ChatAnthropic  # lazy: heavy dep

    # ANTHROPIC_API_KEY is read from the environment by the Anthropic SDK.
    return ChatAnthropic(model=settings.anthropic_model, max_tokens=settings.max_tokens)
