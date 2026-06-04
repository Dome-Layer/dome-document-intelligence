"""Extraction scorer (Layer 1b).

Aligns a predicted ``ExtractionResult`` to a ``GoldenDoc`` label by field name
(+ aliases), compares values with type-aware normalization, and derives per-doc and
aggregate metrics.

**Curated-golden-set methodology (important):** the golden labels are a curated set of
*key* fields per document, deliberately **not** an exhaustive list of everything the
model could extract. So predicted fields with no labeled counterpart are reported as an
**over-extraction count** (``extra_field_count``) — *not* counted as false positives,
because we cannot verify them without exhaustive labels — and are excluded from
calibration. P/R/F1 are computed over the labeled key fields only:

- **TP** = labeled field extracted with a correct value,
- **FP** = labeled field produced with a wrong value,
- **FN** = labeled field not correctly extracted (missing, or produced wrong),
- precision = TP/(TP+FP), recall = TP/(TP+FN).

Fuzzy-mode fields are left ``correct=None`` (method ``deferred``) for the judge to
resolve later, so this module is fully deterministic and network-free.
"""

from __future__ import annotations

from app.models.schemas import ExtractedField, ExtractionResult
from app.services.validation import ValidationService

from .normalize import normalize_identifier, values_equivalent
from .rules import default_rules
from .types import AggregateScore, DocScore, FieldComparison, GoldenDoc

_validator = ValidationService()

_MISSING = "missing"  # labeled field with no prediction
_EXTRA = "extra"  # predicted field with no labeled counterpart (over-extraction)


def _safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


def _norm_name(name: str) -> str:
    return name.strip().lower()


def _norm_doctype(s: str) -> str:
    return s.strip().lower().replace("-", "_").replace(" ", "_")


def predicted_hitl(pred: ExtractionResult) -> str:
    """Run the production rules engine over a prediction to get its HITL verdict."""
    return _validator.validate(pred, default_rules()).human_in_loop


def compare_fields(pred: ExtractionResult, gold: GoldenDoc) -> list[FieldComparison]:
    """Align predicted -> expected fields and decide deterministic value matches."""
    pred_by_name: dict[str, ExtractedField] = {}
    for f in pred.fields:
        pred_by_name.setdefault(_norm_name(f.name), f)

    comparisons: list[FieldComparison] = []
    consumed: set[str] = set()

    for exp in gold.expected_fields:
        match: ExtractedField | None = None
        for cand in (exp.name, *exp.aliases):
            key = _norm_name(cand)
            if key in pred_by_name and key not in consumed:
                match = pred_by_name[key]
                consumed.add(key)
                break

        if match is None:
            comparisons.append(
                FieldComparison(
                    doc_id=gold.doc_id,
                    name=exp.name,
                    data_type=exp.data_type,
                    match_mode=exp.match,
                    is_critical=exp.is_critical,
                    expected_value=exp.value,
                    predicted_value=None,
                    present=False,
                    correct=False,
                    method=_MISSING,
                )
            )
            continue

        ok, method = values_equivalent(exp.value, match.value, exp.data_type, exp.match)
        comparisons.append(
            FieldComparison(
                doc_id=gold.doc_id,
                name=exp.name,
                data_type=exp.data_type,
                match_mode=exp.match,
                is_critical=exp.is_critical,
                expected_value=exp.value,
                predicted_value=match.value,
                predicted_confidence=match.confidence,
                present=True,
                correct=None if method == "deferred" else ok,
                method=method,
            )
        )

    # Predicted fields with no labeled counterpart: over-extraction, not a false positive.
    # correct=None so they are excluded from P/R/F1 and from calibration (unknown truth).
    for key, f in pred_by_name.items():
        if key in consumed:
            continue
        comparisons.append(
            FieldComparison(
                doc_id=gold.doc_id,
                name=f.name,
                data_type=f.data_type,
                match_mode="normalized",
                is_critical=f.is_critical,
                expected_value=None,
                predicted_value=f.value,
                predicted_confidence=f.confidence,
                present=True,
                correct=None,
                method=_EXTRA,
            )
        )
    return comparisons


def _reference_keys_score(pred: ExtractionResult, gold: GoldenDoc) -> tuple[int, int]:
    expected = gold.expected_reference_keys
    if not expected:
        return (0, 0)
    pred_norm = {k.lower(): str(v) for k, v in pred.reference_keys.items()}
    correct = 0
    for k, v in expected.items():
        got = pred_norm.get(k.lower())
        if got is not None and normalize_identifier(got) == normalize_identifier(str(v)):
            correct += 1
    return (correct, len(expected))


def summarize_doc(
    gold: GoldenDoc, pred: ExtractionResult, comparisons: list[FieldComparison]
) -> DocScore:
    """Derive a ``DocScore`` from (possibly judge-resolved) comparisons."""
    labeled = [c for c in comparisons if c.method != _EXTRA]
    decided = [c for c in labeled if c.correct is not None]  # matched-known + missing
    present_decided = [c for c in decided if c.method != _MISSING]

    tp = sum(1 for c in decided if c.correct)
    fp = len(present_decided) - tp  # produced but wrong
    fn = len(decided) - tp  # missing or wrong
    extra = sum(1 for c in comparisons if c.method == _EXTRA)

    precision = _safe_div(tp, tp + fp)
    recall = _safe_div(tp, tp + fn)
    f1 = _safe_div(2 * precision * recall, precision + recall)

    ref_correct, ref_total = _reference_keys_score(pred, gold)
    dt_expected = gold.expected_profile.doc_type
    dt_predicted = pred.document_profile.doc_type
    hitl_pred = predicted_hitl(pred)

    return DocScore(
        doc_id=gold.doc_id,
        modality=gold.modality,
        doc_type_expected=dt_expected,
        doc_type_predicted=dt_predicted,
        doc_type_correct=_norm_doctype(dt_expected) == _norm_doctype(dt_predicted),
        tp=tp,
        fp=fp,
        fn=fn,
        extra_field_count=extra,
        precision=precision,
        recall=recall,
        f1=f1,
        value_matches=tp,
        value_total=len(present_decided),
        value_match_rate=_safe_div(tp, len(present_decided)),
        reference_keys_correct=ref_correct,
        reference_keys_total=ref_total,
        reference_keys_accuracy=_safe_div(ref_correct, ref_total) if ref_total else 1.0,
        hitl_expected=gold.expected_human_in_loop,
        hitl_predicted=hitl_pred,
        hitl_correct=gold.expected_human_in_loop == hitl_pred,
        comparisons=comparisons,
    )


def score_doc(gold: GoldenDoc, pred: ExtractionResult) -> DocScore:
    """Deterministic single-doc score (fuzzy fields left for the judge)."""
    return summarize_doc(gold, pred, compare_fields(pred, gold))


def aggregate(scores: list[DocScore]) -> AggregateScore:
    tp = sum(s.tp for s in scores)
    fp = sum(s.fp for s in scores)
    fn = sum(s.fn for s in scores)
    micro_p = _safe_div(tp, tp + fp)
    micro_r = _safe_div(tp, tp + fn)
    micro_f1 = _safe_div(2 * micro_p * micro_r, micro_p + micro_r)
    macro_f1 = _safe_div(sum(s.f1 for s in scores), len(scores))

    val_matches = sum(s.value_matches for s in scores)
    val_total = sum(s.value_total for s in scores)
    ref_correct = sum(s.reference_keys_correct for s in scores)
    ref_total = sum(s.reference_keys_total for s in scores)

    return AggregateScore(
        n_docs=len(scores),
        n_expected_fields=tp + fn,  # labeled key fields scored (excl. deferred)
        micro_precision=micro_p,
        micro_recall=micro_r,
        micro_f1=micro_f1,
        macro_f1=macro_f1,
        value_match_rate=_safe_div(val_matches, val_total),
        extra_field_count=sum(s.extra_field_count for s in scores),
        doc_type_accuracy=_safe_div(sum(1 for s in scores if s.doc_type_correct), len(scores)),
        hitl_agreement=_safe_div(sum(1 for s in scores if s.hitl_correct), len(scores)),
        reference_keys_accuracy=_safe_div(ref_correct, ref_total) if ref_total else 1.0,
    )
