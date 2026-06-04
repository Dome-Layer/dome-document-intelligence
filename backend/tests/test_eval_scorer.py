"""Scorer math on crafted inputs (Layer 1b).

Builds a controlled prediction vs. ground truth with exactly one false-positive, one
false-negative, an alias match, and a fuzzy (deferred) field, and asserts every
derived metric. (An end-to-end run over the committed recordings lives in
``test_eval_recordings.py``, added once recordings are captured.)
"""

from __future__ import annotations

from app.models.schemas import DocumentProfile, ExtractedField, ExtractionResult
from eval import scorer
from eval.types import ExpectedField, ExpectedProfile, GoldenDoc


def _pred() -> ExtractionResult:
    return ExtractionResult(
        fields=[
            ExtractedField(name="vendor_name", value="acme ltd", confidence=0.90, data_type="text"),
            ExtractedField(name="total", value="$1,000.00", confidence=0.80, data_type="currency"),
            ExtractedField(
                name="invoice_date", value="15/01/2024", confidence=0.95, data_type="date"
            ),
            ExtractedField(name="extra_field", value="junk", confidence=0.50, data_type="text"),
        ],
        overall_confidence=0.7875,
        reference_keys={"invoice_number": "INV-1"},
        document_profile=DocumentProfile(doc_type="invoice", language="en", currency="USD"),
    )


def _gold() -> GoldenDoc:
    return GoldenDoc(
        doc_id="t1",
        source="docs/t1.txt",
        modality="text",
        expected_profile=ExpectedProfile(doc_type="invoice", currency="USD"),
        expected_reference_keys={"invoice_number": "INV-1"},
        expected_fields=[
            ExpectedField(name="vendor_name", value="Acme Ltd", data_type="text"),
            ExpectedField(
                name="invoice_total",
                value="1000.00",
                data_type="currency",
                is_critical=True,
                aliases=["total"],
            ),
            ExpectedField(name="invoice_date", value="2024-01-15", data_type="date"),
            ExpectedField(name="tax_id", value="GB123", data_type="identifier"),  # missing → FN
        ],
        expected_human_in_loop="recommended",
    )


def test_score_doc_metrics():
    s = scorer.score_doc(_gold(), _pred())
    # 3 labeled key fields correct, none wrong, tax_id missing; extra_field is over-extraction.
    assert (s.tp, s.fp, s.fn) == (3, 0, 1)
    assert s.extra_field_count == 1
    assert s.precision == 1.0
    assert s.recall == 0.75
    assert abs(s.f1 - 6 / 7) < 1e-9  # harmonic(1.0, 0.75)
    assert (s.value_matches, s.value_total) == (3, 3)
    assert s.value_match_rate == 1.0
    assert s.doc_type_correct is True
    assert (s.reference_keys_correct, s.reference_keys_total) == (1, 1)
    assert s.hitl_predicted == "recommended"  # extra_field @0.50 → low_confidence warning
    assert s.hitl_correct is True


def test_alias_and_extra_classification():
    comps = scorer.compare_fields(_pred(), _gold())
    by_name = {c.name: c for c in comps}
    assert by_name["invoice_total"].present is True  # matched via alias "total"
    assert by_name["tax_id"].method == "missing"
    # an unlabeled prediction is over-extraction, not a false positive
    assert by_name["extra_field"].method == "extra"
    assert by_name["extra_field"].correct is None


def test_fuzzy_field_is_deferred():
    gold = GoldenDoc(
        doc_id="t2",
        source="docs/t2.txt",
        expected_profile=ExpectedProfile(doc_type="invoice"),
        expected_fields=[
            ExpectedField(
                name="summary", value="A one year service contract", data_type="text", match="fuzzy"
            )
        ],
    )
    pred = ExtractionResult(
        fields=[
            ExtractedField(
                name="summary", value="Annual services agreement", confidence=0.7, data_type="text"
            )
        ],
        overall_confidence=0.7,
        reference_keys={},
        document_profile=DocumentProfile(doc_type="invoice"),
    )
    comps = scorer.compare_fields(pred, gold)
    summary = next(c for c in comps if c.name == "summary")
    assert summary.method == "deferred"
    assert summary.correct is None
    # deferred fields are excluded from deterministic value scoring until the judge runs
    s = scorer.summarize_doc(gold, pred, comps)
    assert s.value_total == 0


def test_aggregate_two_docs():
    s1 = scorer.score_doc(_gold(), _pred())
    s2 = scorer.score_doc(_gold(), _pred())
    agg = scorer.aggregate([s1, s2])
    assert agg.n_docs == 2
    assert agg.n_expected_fields == 8  # 4 labeled key fields per doc
    assert agg.micro_precision == 1.0  # no wrong values among produced key fields
    assert agg.micro_recall == 0.75
    assert agg.value_match_rate == 1.0
    assert agg.extra_field_count == 2  # one over-extracted field per doc
    assert agg.doc_type_accuracy == 1.0
    assert agg.hitl_agreement == 1.0
