"""Calibration bucketing + ECE math on crafted inputs (Layer 2)."""

from __future__ import annotations

from eval.calibration import calibration_from_outcomes, calibration_report, field_outcomes
from eval.types import FieldComparison


def _cmp(confidence, correct, method="text") -> FieldComparison:
    return FieldComparison(
        doc_id="d",
        name="f",
        data_type="text",
        match_mode="normalized",
        predicted_confidence=confidence,
        correct=correct,
        method=method,
    )


def test_field_outcomes_filters_undecided_unconfident_and_extra():
    comps = [
        _cmp(0.9, True),  # kept
        _cmp(0.8, False),  # kept (produced key field, wrong value)
        _cmp(0.7, None, method="deferred"),  # dropped: not yet judged
        _cmp(None, False, method="missing"),  # dropped: no predicted confidence
        _cmp(0.99, True, method="extra"),  # dropped: over-extraction, unverifiable
    ]
    assert sorted(field_outcomes(comps)) == [(0.8, False), (0.9, True)]


def test_single_band_ece():
    # all in 0.90-1.00 band: mean confidence 1.0, accuracy 0.5 → gap 0.5 → ECE 0.5
    outcomes = [(1.0, True), (1.0, True), (1.0, False), (1.0, False)]
    rep = calibration_from_outcomes(outcomes)
    assert rep.n == 4
    assert rep.ece == 0.5
    top = rep.buckets[0]
    assert (top.band, top.n, top.mean_confidence, top.accuracy) == ("0.90-1.00", 4, 1.0, 0.5)


def test_two_band_ece():
    # top band: gap 0.5 (n=2); 0.50-0.69 band: mean 0.6 acc 1.0 gap 0.4 (n=2)
    # ECE = (2/4)*0.5 + (2/4)*0.4 = 0.45
    outcomes = [(1.0, True), (1.0, False), (0.6, True), (0.6, True)]
    rep = calibration_from_outcomes(outcomes)
    assert rep.n == 4
    assert abs(rep.ece - 0.45) < 1e-9
    bands = {b.band: b for b in rep.buckets}
    assert bands["0.50-0.69"].n == 2
    assert bands["0.50-0.69"].accuracy == 1.0
    assert bands["0.50-0.69"].gap == 0.4


def test_band_edges():
    # 0.90 → top band; 0.70 → second band; 0.50 → third; perfect calibration → ECE 0
    outcomes = [(0.90, True), (0.70, True), (0.50, True)]
    rep = calibration_from_outcomes(outcomes)
    counts = {b.band: b.n for b in rep.buckets}
    assert counts["0.90-1.00"] == 1
    assert counts["0.70-0.89"] == 1
    assert counts["0.50-0.69"] == 1


def test_empty_outcomes():
    rep = calibration_from_outcomes([])
    assert rep.n == 0
    assert rep.ece == 0.0
    assert all(b.n == 0 for b in rep.buckets)


def test_calibration_report_from_comparisons():
    rep = calibration_report([_cmp(1.0, True), _cmp(1.0, False)])
    assert rep.n == 2
    assert rep.ece == 0.5
