"""Layer 1a — deterministic tests for the 16-rule ValidationService.

The "LLM informs, rules engine decides" half of DocI is fully deterministic, so we
cover every rule exactly: each test isolates one rule via ``active_rules=[rule(id)]``
and asserts the resulting flags (rule_id + severity + field_name), ``rules_triggered``
and ``human_in_loop`` — plus boundary cases and exemptions. Two end-to-end tests then
exercise HITL severity mapping and a clean document over the full rule set.

No network, no model — this is the free, always-on quality gate.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.schemas import DocumentProfile, ExtractedField, ExtractionResult
from app.services.validation import RULES_DEFINITIONS, ValidationService
from eval.rules import default_rules, rule

_NOW = datetime.now(timezone.utc)
_validator = ValidationService()


def _d(days: int) -> str:
    return (_NOW + timedelta(days=days)).strftime("%Y-%m-%d")


def _field(
    name: str = "some_field",
    value: str | None = "value",
    confidence: float = 0.95,
    data_type: str = "text",
    is_critical: bool = False,
) -> ExtractedField:
    return ExtractedField(
        name=name, value=value, confidence=confidence, data_type=data_type, is_critical=is_critical
    )


def _result(
    fields: list[ExtractedField] | None = None,
    overall_confidence: float = 0.95,
    reference_keys: dict[str, str] | None = None,
    doc_type: str = "invoice",
    language: str = "en",
    currency: str | None = None,
) -> ExtractionResult:
    return ExtractionResult(
        fields=fields if fields is not None else [_field(), _field("f2"), _field("f3")],
        overall_confidence=overall_confidence,
        reference_keys=reference_keys
        if reference_keys is not None
        else {"invoice_number": "INV-1"},
        document_profile=DocumentProfile(doc_type=doc_type, language=language, currency=currency),
    )


def _eval(result: ExtractionResult, rule_id: str):
    """Validate against a single isolated rule."""
    return _validator.validate(result, [rule(rule_id)])


# ── Meta ──────────────────────────────────────────────────────────────────────


def test_engine_has_sixteen_rules():
    assert len(RULES_DEFINITIONS) == 16
    assert len(default_rules()) == 16
    # every rule_id is unique
    ids = [r.rule_id for r in default_rules()]
    assert len(set(ids)) == 16


# ── 1. low_confidence_field (warning, 0.40 <= c < 0.70) ────────────────────────


def test_low_confidence_field_flags():
    res = _eval(_result([_field("amount", confidence=0.55)]), "low_confidence_field")
    assert [(f.rule_id, f.severity, f.field_name) for f in res.flags] == [
        ("low_confidence_field", "warning", "amount")
    ]
    assert res.rules_triggered == ["low_confidence_field"]
    assert res.human_in_loop == "recommended"


def test_low_confidence_field_boundaries():
    # 0.70 is NOT below threshold; 0.40 is the inclusive low edge; 0.39 belongs to very_low.
    assert _eval(_result([_field(confidence=0.70)]), "low_confidence_field").flags == []
    assert len(_eval(_result([_field(confidence=0.40)]), "low_confidence_field").flags) == 1
    assert _eval(_result([_field(confidence=0.39)]), "low_confidence_field").flags == []


# ── 2. very_low_confidence_field (error, c < 0.40) ─────────────────────────────


def test_very_low_confidence_field_flags():
    res = _eval(_result([_field("amount", confidence=0.30)]), "very_low_confidence_field")
    assert [(f.rule_id, f.severity) for f in res.flags] == [("very_low_confidence_field", "error")]
    assert res.human_in_loop == "required"


def test_very_low_confidence_field_boundaries():
    assert _eval(_result([_field(confidence=0.40)]), "very_low_confidence_field").flags == []
    assert len(_eval(_result([_field(confidence=0.39)]), "very_low_confidence_field").flags) == 1


# ── 3. missing_critical_value (error) ──────────────────────────────────────────


def test_missing_critical_value_flags():
    for missing in (None, "", "   "):
        res = _eval(
            _result([_field("total", value=missing, is_critical=True)]), "missing_critical_value"
        )
        assert [(f.rule_id, f.severity, f.field_name) for f in res.flags] == [
            ("missing_critical_value", "error", "total")
        ]
    # present value, or non-critical missing → no flag
    assert (
        _eval(
            _result([_field("total", value="9", is_critical=True)]), "missing_critical_value"
        ).flags
        == []
    )
    assert (
        _eval(
            _result([_field("note", value=None, is_critical=False)]), "missing_critical_value"
        ).flags
        == []
    )


# ── 4. currency_mismatch (warning) ─────────────────────────────────────────────


def test_currency_mismatch_flags_multiple_currencies():
    res = _eval(
        _result([_field("total", value="100 EUR", data_type="currency")], currency="USD"),
        "currency_mismatch",
    )
    assert [f.rule_id for f in res.flags] == ["currency_mismatch"]
    assert res.flags[0].severity == "warning"


def test_currency_mismatch_single_currency_ok():
    assert (
        _eval(
            _result([_field("total", value="100 USD", data_type="currency")], currency="USD"),
            "currency_mismatch",
        ).flags
        == []
    )


# ── 5. future_date_anomaly (warning, > now + 90d) ──────────────────────────────


def test_future_date_anomaly():
    assert (
        len(
            _eval(
                _result([_field("ship_date", value=_d(200), data_type="date")]),
                "future_date_anomaly",
            ).flags
        )
        == 1
    )
    assert (
        _eval(
            _result([_field("ship_date", value=_d(10), data_type="date")]), "future_date_anomaly"
        ).flags
        == []
    )


# ── 6. past_date_anomaly (info, < now - 5y) with historical exemption ──────────


def test_past_date_anomaly_flags_old_date():
    res = _eval(
        _result([_field("report_date", value=_d(-6 * 365), data_type="date")]), "past_date_anomaly"
    )
    assert [(f.rule_id, f.severity) for f in res.flags] == [("past_date_anomaly", "info")]


def test_past_date_anomaly_exempts_historical_fields():
    # date_of_birth matches the historical-field exemption → no flag even when old.
    assert (
        _eval(
            _result([_field("date_of_birth", value=_d(-30 * 365), data_type="date")]),
            "past_date_anomaly",
        ).flags
        == []
    )


# ── 7. overall_low_confidence (error, < 0.60) ──────────────────────────────────


def test_overall_low_confidence_boundaries():
    assert len(_eval(_result(overall_confidence=0.59), "overall_low_confidence").flags) == 1
    assert _eval(_result(overall_confidence=0.60), "overall_low_confidence").flags == []
    assert (
        _eval(_result(overall_confidence=0.59), "overall_low_confidence").human_in_loop
        == "required"
    )


# ── 8. no_identifiers_found (warning) with non-commercial exemption ────────────


def test_no_identifiers_found_flags_commercial():
    res = _eval(_result(reference_keys={}, doc_type="invoice"), "no_identifiers_found")
    assert [f.rule_id for f in res.flags] == ["no_identifiers_found"]


def test_no_identifiers_found_exempts_non_commercial():
    assert (
        _eval(_result(reference_keys={}, doc_type="prescription"), "no_identifiers_found").flags
        == []
    )


def test_no_identifiers_found_ok_with_keys():
    assert (
        _eval(_result(reference_keys={"invoice_number": "INV-1"}), "no_identifiers_found").flags
        == []
    )


# ── 9. unsupported_language (info) ─────────────────────────────────────────────


def test_unsupported_language_by_code():
    res = _eval(_result(language="zh"), "unsupported_language")
    assert [(f.rule_id, f.severity) for f in res.flags] == [("unsupported_language", "info")]


def test_unsupported_language_by_non_latin_value():
    res = _eval(
        _result([_field("name", value="日本語テキスト")], language="en"), "unsupported_language"
    )
    assert [f.rule_id for f in res.flags] == ["unsupported_language"]


def test_unsupported_language_latin_ok():
    assert (
        _eval(
            _result([_field("name", value="Acme Ltd")], language="en"), "unsupported_language"
        ).flags
        == []
    )


# ── 10. amount_zero (warning) ──────────────────────────────────────────────────


def test_amount_zero_flags():
    for zero in ("0", "0.00", "0.0", "", None):
        res = _eval(_result([_field("total", value=zero, data_type="currency")]), "amount_zero")
        assert [f.rule_id for f in res.flags] == ["amount_zero"], zero
    assert (
        _eval(_result([_field("total", value="100.00", data_type="currency")]), "amount_zero").flags
        == []
    )


# ── 11. short_extraction (warning, < 3 fields) ─────────────────────────────────


def test_short_extraction_boundaries():
    assert len(_eval(_result([_field("a"), _field("b")]), "short_extraction").flags) == 1
    assert _eval(_result([_field("a"), _field("b"), _field("c")]), "short_extraction").flags == []


# ── 12. missing_date (warning) ─────────────────────────────────────────────────


def test_missing_date():
    assert len(_eval(_result([_field("a", data_type="text")]), "missing_date").flags) == 1
    assert (
        _eval(_result([_field("when", value=_d(-1), data_type="date")]), "missing_date").flags == []
    )


# ── 13. expired_due_date (warning) ─────────────────────────────────────────────


def test_expired_due_date_flags_past_due():
    res = _eval(_result([_field("due_date", value=_d(-10), data_type="date")]), "expired_due_date")
    assert [(f.rule_id, f.field_name) for f in res.flags] == [("expired_due_date", "due_date")]


def test_expired_due_date_future_and_non_due_ok():
    assert (
        _eval(
            _result([_field("due_date", value=_d(10), data_type="date")]), "expired_due_date"
        ).flags
        == []
    )
    # a non-due-named past date is not an "expired due date"
    assert (
        _eval(
            _result([_field("report_date", value=_d(-10), data_type="date")]), "expired_due_date"
        ).flags
        == []
    )


# ── 14. large_monetary_amount (warning, >= 100000) ─────────────────────────────


def test_large_monetary_amount_boundaries():
    assert (
        len(
            _eval(
                _result([_field("total", value="150000", data_type="currency")]),
                "large_monetary_amount",
            ).flags
        )
        == 1
    )
    assert (
        len(
            _eval(
                _result([_field("total", value="100000", data_type="currency")]),
                "large_monetary_amount",
            ).flags
        )
        == 1
    )
    assert (
        _eval(
            _result([_field("total", value="99999.99", data_type="currency")]),
            "large_monetary_amount",
        ).flags
        == []
    )


# ── 15. potential_personal_data (info) ─────────────────────────────────────────


def test_potential_personal_data():
    res = _eval(_result([_field("patient_name", value="Jane Roe")]), "potential_personal_data")
    assert [(f.rule_id, f.severity) for f in res.flags] == [("potential_personal_data", "info")]
    assert _eval(_result([_field("line_total", value="9")]), "potential_personal_data").flags == []


# ── 16. duplicate_field_name (warning) ─────────────────────────────────────────


def test_duplicate_field_name():
    res = _eval(
        _result([_field("vendor", value="A"), _field("vendor", value="B")]), "duplicate_field_name"
    )
    assert [f.rule_id for f in res.flags] == ["duplicate_field_name"]
    # same name, same value → not a conflict
    assert (
        _eval(
            _result([_field("vendor", value="A"), _field("vendor", value="A")]),
            "duplicate_field_name",
        ).flags
        == []
    )


# ── HITL severity mapping + disabled rules + clean doc ─────────────────────────


def test_hitl_mapping_by_severity():
    # error → required
    assert (
        _eval(_result([_field(confidence=0.1)]), "very_low_confidence_field").human_in_loop
        == "required"
    )
    # warning → recommended
    assert (
        _eval(_result([_field(confidence=0.5)]), "low_confidence_field").human_in_loop
        == "recommended"
    )
    # info only → not_required
    assert (
        _eval(_result([_field("patient_name")]), "potential_personal_data").human_in_loop
        == "not_required"
    )


def test_disabled_rule_is_not_evaluated():
    r = rule("very_low_confidence_field")
    r.enabled = False
    res = _validator.validate(_result([_field(confidence=0.05)]), [r])
    assert res.flags == []
    assert res.rules_triggered == []


def test_clean_document_triggers_no_rules():
    clean = _result(
        fields=[
            _field("vendor_name", value="Acme Ltd", confidence=0.97, data_type="text"),
            _field(
                "invoice_total",
                value="1000.00 USD",
                confidence=0.96,
                data_type="currency",
                is_critical=True,
            ),
            _field("invoice_date", value=_d(-30), confidence=0.95, data_type="date"),
        ],
        overall_confidence=0.96,
        reference_keys={"invoice_number": "INV-2024-001"},
        doc_type="invoice",
        language="en",
        currency="USD",
    )
    res = _validator.validate(clean, default_rules())
    assert res.flags == []
    assert res.rules_triggered == []
    assert res.human_in_loop == "not_required"
