"""A *validated* LLM judge (Layer 3).

The honest way to use an LLM judge is to **earn trust before spending it**:
1. Run the judge on *objective* fields (deterministic ground truth known) and measure
   judge↔truth agreement — exposed in the report.
2. Only then use it for *fuzzy* fields (semantic value-equivalence) the deterministic
   normalizer cannot settle.

The judge is **reference-anchored** (it sees the expected value), rubric-bound, and
its model is **distinct from the generator** (``EVAL_JUDGE_MODEL``, default Haiku).
"""

from __future__ import annotations

import os

from app.core.config import settings
from app.providers import ClaudeProvider

# Default judge: a Haiku-tier model, deliberately weaker than (and distinct from) the
# sonnet-tier generator. Override per-run with EVAL_JUDGE_MODEL once the exact
# available snapshot is confirmed.
DEFAULT_JUDGE_MODEL = "claude-haiku-4-5"

_JUDGE_SYSTEM = (
    "You are a strict, literal evaluation judge for a document data-extraction system. "
    "You compare a predicted field value against the known-correct expected value and decide "
    "whether they are semantically equivalent. You are conservative: if the predicted value "
    "omits, adds, or changes meaningful information, it is NOT equivalent. You always respond "
    "with valid JSON only."
)

_VERDICT_SCHEMA = {
    "equivalent": "boolean — true only if predicted conveys the same meaning as expected",
    "reason": "string — one concise sentence justifying the verdict",
    "confidence": "float 0.0-1.0 — your confidence in this verdict",
}


def judge_model_name() -> str:
    return os.getenv("EVAL_JUDGE_MODEL") or DEFAULT_JUDGE_MODEL


def build_judge_provider() -> ClaudeProvider:
    """Construct the judge provider, refusing to reuse the generator model."""
    model = judge_model_name()
    if model == settings.llm_text_model:
        raise ValueError(
            f"Judge model ({model}) must differ from the generator "
            f"({settings.llm_text_model}); set EVAL_JUDGE_MODEL."
        )
    return ClaudeProvider(api_key=settings.anthropic_api_key, model=model)


def _prompt(field_name: str, data_type: str, expected: str, predicted: str) -> str:
    return f"""Judge whether the predicted value of a document field is semantically equivalent
to the expected (ground-truth) value.

Rubric:
- Equivalent: same meaning, allowing for formatting, units, currency symbols, date formats,
  abbreviations, word order, and trivial spelling differences.
- NOT equivalent: a different amount/date/identifier, missing or extra meaningful content, or
  a value that would mislead a downstream reader.

Field name: {field_name}
Field type: {data_type}
Expected value (ground truth): {expected!r}
Predicted value (model output): {predicted!r}

Return JSON only."""


async def judge_equivalence(
    provider: ClaudeProvider,
    *,
    field_name: str,
    data_type: str,
    expected: str,
    predicted: str,
) -> tuple[bool, str, float]:
    """Ask the judge if ``predicted`` ≡ ``expected``. Returns (equivalent, reason, confidence)."""
    data = await provider.generate_structured(
        _prompt(field_name, data_type, expected, predicted),
        schema=_VERDICT_SCHEMA,
        system=_JUDGE_SYSTEM,
    )
    equivalent = bool(data.get("equivalent", False))
    reason = str(data.get("reason", "")).strip()
    try:
        confidence = float(data.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    return (equivalent, reason, confidence)
