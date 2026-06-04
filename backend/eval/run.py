"""Eval orchestration for ``python -m eval`` / ``make eval``.

Live mode (``--refresh``) re-runs the generator over the golden set and rewrites the
committed recordings; otherwise it scores the existing recordings. The judge
(Layer 3) is on by default and is the only component that calls a second model; it is
validated against ground truth, then resolves fuzzy fields, and logs exactly one
``eval_judgment`` governance event. ``--no-judge --no-refresh`` is fully offline.
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas import ExtractionResult
from app.providers import get_llm_provider
from app.services.extraction import ExtractionService

from . import loader, scorer
from .calibration import calibration_report
from .governance_log import emit_eval_judgment_event
from .judge import build_judge_provider, judge_equivalence, judge_model_name
from .report import build_report, write_report
from .types import EvalReport, FieldComparison, GoldenDoc, JudgeValidation

logger = get_logger(__name__)

JUDGE_TRUST_THRESHOLD = 0.90
DEFAULT_JUDGE_SAMPLE = 40

# Comparison.method values that are NOT a deterministically-decided objective field.
_NON_OBJECTIVE = {"missing", "extra", "deferred", "fuzzy-judge"}

_DocTriple = tuple[GoldenDoc, ExtractionResult, list[FieldComparison]]


async def _get_prediction(gold: GoldenDoc, *, refresh: bool) -> ExtractionResult:
    if not refresh and loader.has_recording(gold.doc_id):
        return loader.load_recording(gold.doc_id)
    ingested = await loader.build_ingest(gold)
    result = await ExtractionService(get_llm_provider()).extract(ingested)
    loader.save_recording(gold.doc_id, result)
    logger.info("recorded_extraction", doc_id=gold.doc_id, fields=len(result.fields))
    return result


async def _run_judge(per_doc: list[_DocTriple], sample_cap: int) -> JudgeValidation:
    provider = build_judge_provider()
    model = judge_model_name()

    # 1) Validate the judge against deterministic ground truth on objective fields.
    objective = [
        c
        for (_, _, comps) in per_doc
        for c in comps
        if c.method not in _NON_OBJECTIVE
        and c.correct is not None
        and c.predicted_value is not None
        and c.expected_value is not None
    ]
    sample = objective[:sample_cap]
    n_agree = 0
    for c in sample:
        verdict, _reason, _conf = await judge_equivalence(
            provider,
            field_name=c.name,
            data_type=c.data_type,
            expected=str(c.expected_value),
            predicted=str(c.predicted_value),
        )
        if verdict == bool(c.correct):
            n_agree += 1
    n_objective = len(sample)
    agreement_rate = n_agree / n_objective if n_objective else 0.0
    trustworthy = agreement_rate >= JUDGE_TRUST_THRESHOLD

    # 2) Resolve fuzzy (deferred) fields the deterministic scorer left open.
    n_fuzzy = 0
    for _, _, comps in per_doc:
        for c in comps:
            if (
                c.method == "deferred"
                and c.predicted_value is not None
                and c.expected_value is not None
            ):
                verdict, reason, _conf = await judge_equivalence(
                    provider,
                    field_name=c.name,
                    data_type=c.data_type,
                    expected=str(c.expected_value),
                    predicted=str(c.predicted_value),
                )
                c.correct = verdict
                c.method = "fuzzy-judge"
                c.note = reason
                n_fuzzy += 1

    # 3) One governance audit row for the whole judge run (satisfies "<=1 judge check").
    emit_eval_judgment_event(
        output_summary=(
            f"Judge {model} validated on {n_objective} objective fields "
            f"({agreement_rate * 100:.1f}% agreement, "
            f"{'trustworthy' if trustworthy else 'below threshold'}); "
            f"resolved {n_fuzzy} fuzzy fields"
        ),
        confidence=agreement_rate,
        metadata={
            "generator_model": settings.llm_text_model,
            "judge_model": model,
            "n_objective": n_objective,
            "n_agree": n_agree,
            "agreement_rate": round(agreement_rate, 4),
            "threshold": JUDGE_TRUST_THRESHOLD,
            "trustworthy": trustworthy,
            "n_fuzzy_judged": n_fuzzy,
            "n_docs": len(per_doc),
        },
    )

    return JudgeValidation(
        judge_model=model,
        n_objective=n_objective,
        n_agree=n_agree,
        agreement_rate=agreement_rate,
        n_fuzzy_judged=n_fuzzy,
        threshold=JUDGE_TRUST_THRESHOLD,
        trustworthy=trustworthy,
    )


async def run_eval(
    *,
    use_judge: bool,
    refresh: bool,
    report_dir: Path,
    judge_sample: int = DEFAULT_JUDGE_SAMPLE,
) -> EvalReport:
    golden = loader.load_golden_set()
    if not golden:
        raise SystemExit("No golden docs found under eval/fixtures/labels/.")

    per_doc: list[_DocTriple] = []
    for gold in golden:
        pred = await _get_prediction(gold, refresh=refresh)
        per_doc.append((gold, pred, scorer.compare_fields(pred, gold)))

    judge_validation = await _run_judge(per_doc, judge_sample) if use_judge else None

    scores = [scorer.summarize_doc(g, p, c) for (g, p, c) in per_doc]
    all_comparisons = [c for (_, _, comps) in per_doc for c in comps]

    report = build_report(
        generator_model=settings.llm_text_model,
        judge_model=judge_model_name() if use_judge else None,
        scores=scores,
        aggregate=scorer.aggregate(scores),
        calibration=calibration_report(all_comparisons),
        judge_validation=judge_validation,
    )
    write_report(report, report_dir)
    return report
