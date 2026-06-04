"""Confidence calibration (Layer 2).

Buckets predicted fields by the **extraction prompt's own confidence bands** (see
``app.services.extraction._CONFIDENCE_GUIDANCE``) and measures the *actual* accuracy
in each band. Because the prompt claims those bands mean something, this directly
verifies a stated claim — and reports honestly when it is miscalibrated.

A field's outcome is ``(confidence, correct)``: matched fields use the scorer's
value verdict; spurious (hallucinated) fields count as incorrect. Fields still
deferred to the judge (``correct is None``) are excluded until resolved. ECE is the
sample-weighted mean gap between confidence and accuracy across buckets.
"""

from __future__ import annotations

from .types import CalibrationBucket, CalibrationReport, FieldComparison

# (label, lo, hi) — half-open [lo, hi); top band's hi is bumped to include 1.0.
# Mirrors the prompt's 0.90/0.70/0.50/0.30 boundaries exactly.
_BANDS: tuple[tuple[str, float, float], ...] = (
    ("0.90-1.00", 0.90, 1.0001),
    ("0.70-0.89", 0.70, 0.90),
    ("0.50-0.69", 0.50, 0.70),
    ("0.30-0.49", 0.30, 0.50),
    ("0.00-0.29", 0.00, 0.30),
)


def field_outcomes(comparisons: list[FieldComparison]) -> list[tuple[float, bool]]:
    """(confidence, correct) for every predicted field with a decided outcome."""
    outcomes: list[tuple[float, bool]] = []
    for c in comparisons:
        # Over-extracted ("extra") fields have no ground truth, so they cannot be
        # scored for calibration; deferred/missing carry no decided confidence.
        if c.method == "extra" or c.predicted_confidence is None or c.correct is None:
            continue
        outcomes.append((float(c.predicted_confidence), bool(c.correct)))
    return outcomes


def calibration_from_outcomes(outcomes: list[tuple[float, bool]]) -> CalibrationReport:
    n = len(outcomes)
    buckets: list[CalibrationBucket] = []
    ece = 0.0
    for label, lo, hi in _BANDS:
        members = [(conf, ok) for conf, ok in outcomes if lo <= conf < hi]
        cnt = len(members)
        if cnt:
            mean_conf = sum(conf for conf, _ in members) / cnt
            accuracy = sum(1 for _, ok in members if ok) / cnt
        else:
            mean_conf = 0.0
            accuracy = 0.0
        gap = abs(mean_conf - accuracy)
        buckets.append(
            CalibrationBucket(
                band=label,
                lo=lo,
                hi=min(hi, 1.0),
                n=cnt,
                mean_confidence=mean_conf,
                accuracy=accuracy,
                gap=gap,
            )
        )
        if n:
            ece += (cnt / n) * gap
    return CalibrationReport(buckets=buckets, ece=ece, n=n)


def calibration_report(comparisons: list[FieldComparison]) -> CalibrationReport:
    """Reliability table + ECE across all docs' field comparisons."""
    return calibration_from_outcomes(field_outcomes(comparisons))
