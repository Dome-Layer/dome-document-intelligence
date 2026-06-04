"""Unit tests for type-aware value normalization (Layer 1b)."""

from __future__ import annotations

from eval.normalize import (
    normalize_currency,
    normalize_date,
    normalize_identifier,
    normalize_percentage,
    normalize_text,
    values_equivalent,
)


def test_normalize_currency_us_and_eu():
    assert normalize_currency("$1,000.00") == 1000.0
    assert normalize_currency("1,000.00 USD") == 1000.0
    assert normalize_currency("USD 1234.56") == 1234.56
    assert normalize_currency("€1.234,56") == 1234.56  # EU grouping
    assert normalize_currency("1234.56") == 1234.56


def test_normalize_currency_ambiguous_comma():
    assert normalize_currency("1,23") == 1.23  # single comma, 2 trailing → decimal
    assert normalize_currency("1,234") == 1234.0  # single comma, 3 trailing → thousands
    assert normalize_currency("(500.00)") == -500.0  # accounting negative


def test_normalize_currency_unparseable():
    assert normalize_currency("n/a") is None
    assert normalize_currency("") is None


def test_normalize_percentage():
    assert normalize_percentage("12.5%") == 12.5
    assert normalize_percentage("0.5") == 0.5


def test_normalize_date_formats():
    assert normalize_date("2024-01-15") == "2024-01-15"
    assert normalize_date("15/01/2024") == "2024-01-15"
    assert normalize_date("Jan 15, 2024") == "2024-01-15"
    assert normalize_date("15 January 2024") == "2024-01-15"
    assert normalize_date("not a date") is None


def test_normalize_identifier_and_text():
    assert normalize_identifier("inv-2024-001") == "INV-2024-001"
    assert normalize_identifier("  PT 98765 ") == "PT98765"
    assert normalize_text("  Hello   World ") == "hello world"


def test_values_equivalent_normalized():
    assert values_equivalent("1000.00", "$1,000", "currency", "normalized") == (True, "currency")
    assert values_equivalent("1000.00", "1,000.50", "currency", "normalized")[0] is False
    assert values_equivalent("2024-01-15", "15/01/2024", "date", "normalized") == (True, "date")
    assert values_equivalent("Acme Ltd", "acme  ltd", "text", "normalized") == (True, "text")
    assert values_equivalent("INV-1", "inv-1", "identifier", "normalized") == (True, "identifier")


def test_values_equivalent_exact_and_fuzzy():
    assert values_equivalent("Total", "Total", "text", "exact") == (True, "exact")
    assert values_equivalent("Total", "total", "text", "exact") == (False, "exact")
    # fuzzy is never decided here — it is deferred to the judge.
    assert values_equivalent("a", "b", "text", "fuzzy") == (False, "deferred")


def test_values_equivalent_missing():
    assert values_equivalent(None, None, "text", "normalized")[0] is True
    assert values_equivalent("x", None, "text", "normalized")[0] is False
