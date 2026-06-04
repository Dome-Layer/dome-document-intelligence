"""End-to-end harness check over the committed recordings (deterministic, no network).

This is the CI-gated proof that the scorer + calibration run cleanly against real,
recorded model outputs — without ever calling a live model. It asserts structural
invariants (counts add up, metrics in range) rather than brittle exact metric values,
so recordings can be refreshed via ``make eval`` without breaking CI.
"""

from __future__ import annotations

from eval import loader, scorer
from eval.calibration import calibration_report


def _pairs():
    golden = loader.load_golden_set()
    pairs = []
    for g in golden:
        assert loader.has_recording(
            g.doc_id
        ), f"missing recording for {g.doc_id}; run `make eval` and commit eval/recordings/"
        pairs.append((g, loader.load_recording(g.doc_id)))
    return pairs


def test_golden_set_size_and_recordings_present():
    golden = loader.load_golden_set()
    assert len(golden) >= 15  # spec: ~15-20 docs
    assert any(g.modality == "image" for g in golden)  # vision path covered
    for g in golden:
        assert loader.has_recording(g.doc_id)


def test_scorer_runs_over_recordings_with_valid_invariants():
    scores = [scorer.score_doc(g, p) for g, p in _pairs()]
    agg = scorer.aggregate(scores)
    for metric in (
        agg.micro_precision,
        agg.micro_recall,
        agg.micro_f1,
        agg.macro_f1,
        agg.value_match_rate,
        agg.doc_type_accuracy,
        agg.hitl_agreement,
        agg.reference_keys_accuracy,
    ):
        assert 0.0 <= metric <= 1.0
    for s in scores:
        # tp+fp = produced & decided key fields; tp+fn = all decided key fields
        decided = [c for c in s.comparisons if c.method != "extra" and c.correct is not None]
        present_decided = [c for c in decided if c.method != "missing"]
        assert s.tp + s.fp == len(present_decided)
        assert s.tp + s.fn == len(decided)
        assert s.extra_field_count == sum(1 for c in s.comparisons if c.method == "extra")
        assert 0.0 <= s.f1 <= 1.0


def test_calibration_over_recordings():
    comps = [c for g, p in _pairs() for c in scorer.compare_fields(p, g)]
    rep = calibration_report(comps)
    assert rep.n > 0
    assert 0.0 <= rep.ece <= 1.0
    assert sum(b.n for b in rep.buckets) == rep.n
