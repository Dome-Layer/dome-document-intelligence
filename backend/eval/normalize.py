"""Type-aware value normalization for deterministic field comparison (Layer 1b).

Comparison is driven by the label's ``match`` mode and ``data_type``:
- ``exact``      -> raw string equality after trimming.
- ``normalized`` -> type-aware canonicalisation (this module), then compare.
- ``fuzzy``      -> not decided here; deferred to the LLM judge (Layer 3).

Stdlib only. Date parsing reuses the extractor-side parser
(``app.services.validation._try_parse_date``) and extends it with month names.
"""

from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Optional

from app.services.validation import _try_parse_date

from .types import MatchMode

_WS = re.compile(r"\s+")
_CURRENCY_KEEP = re.compile(r"[^\d.,\-]")  # drop everything but digits, separators, sign
_MONEY_EPSILON = 0.005  # cent-precision tolerance

_MONTH_FORMATS = (
    "%d %B %Y",
    "%d %b %Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%B %d %Y",
    "%b %d %Y",
    "%d-%b-%Y",
    "%d-%B-%Y",
)


# ── Scalar normalizers ────────────────────────────────────────────────────────


def normalize_text(value: str) -> str:
    """Casefold + collapse internal whitespace + trim."""
    return _WS.sub(" ", value.strip()).casefold()


def normalize_identifier(value: str) -> str:
    """Uppercase, drop all whitespace; keep separators (INV-2024-001 is canonical)."""
    return _WS.sub("", value.strip()).upper()


def normalize_currency(value: str) -> Optional[float]:
    """Parse a monetary/number string to float, handling US and EU grouping.

    Returns None if no number can be recovered. Parentheses denote a negative.
    """
    raw = value.strip()
    negative = raw.startswith("(") and raw.endswith(")")
    s = _CURRENCY_KEEP.sub("", raw)
    if not s or s in ("-", ".", ","):
        return None

    has_comma, has_dot = "," in s, "." in s
    if has_comma and has_dot:
        # The right-most separator is the decimal point.
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")  # EU: 1.234,56
        else:
            s = s.replace(",", "")  # US: 1,234.56
    elif has_comma:
        parts = s.split(",")
        # A single comma with exactly two trailing digits reads as a decimal comma.
        if len(parts) == 2 and len(parts[1]) == 2:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")

    try:
        num = float(s)
    except ValueError:
        return None
    return -num if negative else num


def normalize_number(value: str) -> Optional[float]:
    return normalize_currency(value)


def normalize_percentage(value: str) -> Optional[float]:
    return normalize_number(value.replace("%", ""))


def normalize_date(value: str) -> Optional[str]:
    """Return an ISO ``YYYY-MM-DD`` string, or None if unparseable."""
    parsed = _try_parse_date(value)
    if parsed is not None:
        return parsed.strftime("%Y-%m-%d")
    cleaned = value.strip()
    for fmt in _MONTH_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


# ── Comparison ────────────────────────────────────────────────────────────────


def values_equivalent(
    expected: Optional[str],
    predicted: Optional[str],
    data_type: str,
    match_mode: MatchMode,
) -> tuple[bool, str]:
    """Decide whether a predicted value matches the expected value.

    Returns ``(equivalent, method)`` where ``method`` records how the decision was
    made (e.g. ``currency``, ``date``, ``text``, ``exact``) for the report. ``fuzzy``
    mode returns ``(False, "deferred")`` — the judge decides later.
    """
    if predicted is None or str(predicted).strip() == "":
        return (expected is None or str(expected).strip() == "", "empty")
    if expected is None:
        return (False, "no-expected")

    e, p = str(expected), str(predicted)

    if match_mode == "exact":
        return (e.strip() == p.strip(), "exact")
    if match_mode == "fuzzy":
        return (False, "deferred")

    # match_mode == "normalized": dispatch on data_type.
    if data_type == "currency":
        en, pn = normalize_currency(e), normalize_currency(p)
        if en is not None and pn is not None:
            return (math.isclose(en, pn, rel_tol=1e-9, abs_tol=_MONEY_EPSILON), "currency")
        return (normalize_text(e) == normalize_text(p), "currency-text-fallback")
    if data_type == "percentage":
        en, pn = normalize_percentage(e), normalize_percentage(p)
        if en is not None and pn is not None:
            return (math.isclose(en, pn, rel_tol=1e-9, abs_tol=1e-6), "percentage")
        return (normalize_text(e) == normalize_text(p), "percentage-text-fallback")
    if data_type == "date":
        en_d, pn_d = normalize_date(e), normalize_date(p)
        if en_d and pn_d:
            return (en_d == pn_d, "date")
        return (normalize_text(e) == normalize_text(p), "date-text-fallback")
    if data_type == "identifier":
        return (normalize_identifier(e) == normalize_identifier(p), "identifier")

    return (normalize_text(e) == normalize_text(p), "text")
