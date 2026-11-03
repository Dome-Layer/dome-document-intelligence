"""Flag params: the values each rule's message is built from (roadmap row 6).

The interface words a flag in the visitor's language from ``params``; the English ``message``
stays the record. These tests pin the keys the frontend catalogue reads, rule by rule, so a
change on one side cannot silently fall back to English on the other.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from app.models.schemas import DocumentProfile, ExtractedField, ExtractionResult
from app.services.validation import ValidationService
from eval.rules import rule

_validator = ValidationService()
_NOW = datetime.now(timezone.utc)


def _d(days: int) -> str:
    return (_NOW + timedelta(days=days)).strftime("%Y-%m-%d")


def _field(
    name: str,
    value: str | None = "v",
    confidence: float = 0.95,
    data_type: str = "text",
    is_critical: bool = False,
) -> ExtractedField:
    return ExtractedField(
        name=name, value=value, confidence=confidence, data_type=data_type, is_critical=is_critical
    )


def _result(
    fields: list[ExtractedField],
    overall: float = 0.95,
    keys: dict[str, str] | None = None,
    language: str = "en",
    currency: str | None = None,
) -> ExtractionResult:
    return ExtractionResult(
        fields=fields,
        overall_confidence=overall,
        reference_keys={"invoice_number": "INV-1"} if keys is None else keys,
        document_profile=DocumentProfile(doc_type="invoice", language=language, currency=currency),
    )


def _params(result: ExtractionResult, rule_id: str) -> dict:
    flags = _validator.validate(result, [rule(rule_id)]).flags
    assert len(flags) == 1, (rule_id, flags)
    # Params travel as JSON (API response, saved extraction), so they must survive a round trip.
    return json.loads(json.dumps(flags[0].params))


def test_confidence_rules_send_field_confidence_and_threshold():
    p = _params(_result([_field("total", confidence=0.55)]), "low_confidence_field")
    assert p == {"field": "total", "confidence": 0.55, "threshold": 0.70}
    p = _params(_result([_field("total", confidence=0.2)]), "very_low_confidence_field")
    assert p == {"field": "total", "confidence": 0.2, "threshold": 0.40}
    p = _params(_result([_field("a")], overall=0.5), "overall_low_confidence")
    assert p == {"confidence": 0.5, "threshold": 0.60}


def test_field_rules_send_the_field_and_its_value():
    assert _params(
        _result([_field("total", value=None, is_critical=True)]), "missing_critical_value"
    ) == {"field": "total"}
    assert _params(_result([_field("total", value="0", data_type="currency")]), "amount_zero") == {
        "field": "total"
    }
    future = _d(200)
    assert _params(
        _result([_field("issued", value=future, data_type="date")]), "future_date_anomaly"
    ) == {"field": "issued", "days": 90, "value": future}
    past = _d(-6 * 365)
    assert _params(
        _result([_field("signed_on", value=past, data_type="date")]), "past_date_anomaly"
    ) == {"field": "signed_on", "years": 5, "value": past}
    due = _d(-3)
    assert _params(
        _result([_field("due_date", value=due, data_type="date")]), "expired_due_date"
    ) == {"field": "due_date", "value": due}
    assert _params(
        _result([_field("total", value="EUR 250,000", data_type="currency")]),
        "large_monetary_amount",
    ) == {"field": "total", "value": "EUR 250,000", "threshold": 100000}


def test_list_and_count_rules():
    p = _params(
        _result([_field("a", value="USD 1", data_type="currency")], currency="EUR"),
        "currency_mismatch",
    )
    assert p == {"currencies": ["EUR", "USD"]}
    assert _params(_result([_field("a")]), "short_extraction") == {"count": 1, "min_fields": 3}
    names = [f"{n}" for n in ("full_name", "email", "phone", "iban", "address", "city")]
    p = _params(_result([_field(n) for n in names]), "potential_personal_data")
    assert p == {"fields": names}  # every field, not only the five the English message names


def test_language_rule_has_two_forms():
    assert _params(_result([_field("a")], language="ja"), "unsupported_language") == {
        "language": "ja"
    }
    assert _params(_result([_field("name", value="Иван")]), "unsupported_language") == {
        "field": "name"
    }


def test_duplicate_sends_both_values():
    p = _params(
        _result([_field("total", value="10"), _field("total", value="12")]), "duplicate_field_name"
    )
    assert p == {"field": "total", "first": "10", "second": "12"}


def test_rules_without_values_send_none():
    assert _params(_result([_field("a")], keys={}), "no_identifiers_found") == {}
    assert _params(_result([_field("a")]), "missing_date") == {}
