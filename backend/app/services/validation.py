import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from ..models.schemas import ExtractionResult, ValidationFlag, GovernanceRule
from ..core.logging import get_logger

logger = get_logger(__name__)

# ── Pre-seeded rule definitions ───────────────────────────────────────────────

RULES_DEFINITIONS: list[dict] = [
    {
        "rule_id": "low_confidence_field",
        "name": "Low confidence field",
        "description": "Any extracted field with confidence < 0.70",
        "severity": "warning",
        "enabled": True,
        "config": {"threshold": 0.70},
    },
    {
        "rule_id": "very_low_confidence_field",
        "name": "Very low confidence",
        "description": "Any extracted field with confidence < 0.40",
        "severity": "error",
        "enabled": True,
        "config": {"threshold": 0.40},
    },
    {
        "rule_id": "missing_critical_value",
        "name": "Missing critical value",
        "description": "A field identified as critical by the LLM has no value",
        "severity": "error",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "currency_mismatch",
        "name": "Currency mismatch",
        "description": "Multiple currencies detected without explicit FX conversion",
        "severity": "warning",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "future_date_anomaly",
        "name": "Future date anomaly",
        "description": "A date field is more than 90 days in the future",
        "severity": "warning",
        "enabled": True,
        "config": {"days_ahead": 90},
    },
    {
        "rule_id": "past_date_anomaly",
        "name": "Past date anomaly",
        "description": "A date field is more than 5 years in the past",
        "severity": "info",
        "enabled": True,
        "config": {"years_back": 5},
    },
    {
        "rule_id": "overall_low_confidence",
        "name": "Low overall confidence",
        "description": "Overall extraction confidence < 0.60 — recommend manual review",
        "severity": "error",
        "enabled": True,
        "config": {"threshold": 0.60},
    },
    {
        "rule_id": "no_identifiers_found",
        "name": "No identifiers found",
        "description": "No reference keys detected (no PO, invoice, contract ID)",
        "severity": "warning",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "unsupported_language",
        "name": "Non-Latin script",
        "description": "Document contains non-Latin characters — extraction may be partial",
        "severity": "info",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "amount_zero",
        "name": "Zero amount detected",
        "description": "A currency field extracted as zero or empty",
        "severity": "warning",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "short_extraction",
        "name": "Very few fields extracted",
        "description": "Fewer than 3 fields extracted — likely a scan quality issue or blank page",
        "severity": "warning",
        "enabled": True,
        "config": {"min_fields": 3},
    },
    {
        "rule_id": "missing_date",
        "name": "No date field found",
        "description": "No date-type field extracted — undated documents may be invalid",
        "severity": "warning",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "expired_due_date",
        "name": "Expired due date",
        "description": "A due date, expiry date, or payment deadline is in the past",
        "severity": "warning",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "large_monetary_amount",
        "name": "Large monetary amount",
        "description": "A currency field exceeds the configured threshold — recommend escalation",
        "severity": "warning",
        "enabled": True,
        "config": {"threshold": 100000},
    },
    {
        "rule_id": "potential_personal_data",
        "name": "Personal data detected",
        "description": "Fields containing personal data (names, IDs, addresses) — handle per GDPR/HIPAA",
        "severity": "info",
        "enabled": True,
        "config": {},
    },
    {
        "rule_id": "duplicate_field_name",
        "name": "Duplicate field name",
        "description": "The same field name was extracted twice with different values",
        "severity": "warning",
        "enabled": True,
        "config": {},
    },
]

_RULE_MAP = {r["rule_id"]: r for r in RULES_DEFINITIONS}

# Regex to detect non-Latin characters (CJK, Arabic, Cyrillic, etc.)
_NON_LATIN = re.compile(r"[^\u0000-\u024F\s\d\W]")
# Simple date pattern matching (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, D Month YYYY)
_DATE_PATTERNS = [
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
    re.compile(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})\b"),
]

# Field names that are naturally historical — skip past-date anomaly for these
_HISTORICAL_DATE_FIELDS = re.compile(
    r"\b(birth|born|dob|date_of_birth|established|founded|incorporated|issue_date|issued_date)\b",
    re.IGNORECASE,
)

# Doc types that don't use business-style reference identifiers
_NON_COMMERCIAL_DOC_TYPES = frozenset({
    "lab_report", "medical_record", "clinical_form", "prescription",
    "cv_resume", "personal_document", "patient_record",
})

# Field names indicating a due/expiry date
_DUE_DATE_FIELDS = re.compile(
    r"\b(due_date|payment_due|due|expiry_date|expiry|expiration|valid_until|expires|expire|deadline|maturity_date|maturity)\b",
    re.IGNORECASE,
)

# Field names likely containing personal data
_PII_FIELD_PATTERNS = re.compile(
    r"\b(patient_name|full_name|first_name|last_name|given_name|surname|date_of_birth|dob|"
    r"national_id|passport|ssn|social_security|mrn|nhs_number|"
    r"address|street|city|postcode|zip|phone|mobile|email|"
    r"tax_id|vat_id|bank_account|iban|credit_card)\b",
    re.IGNORECASE,
)

# Regex to pull the largest numeric value from a currency string
_NUMERIC_RE = re.compile(r"[\d]+(?:[.,]\d+)*")


class ValidationResult:
    __slots__ = ("flags", "human_in_loop", "rules_triggered")

    def __init__(self, flags: list[ValidationFlag], human_in_loop: str, rules_triggered: list[str]) -> None:
        self.flags = flags
        self.human_in_loop = human_in_loop
        self.rules_triggered = rules_triggered


class ValidationService:
    def validate(
        self,
        result: ExtractionResult,
        active_rules: list[GovernanceRule],
    ) -> ValidationResult:
        enabled = {r.rule_id: r for r in active_rules if r.enabled}
        flags: list[ValidationFlag] = []

        for rule_id, rule in enabled.items():
            new_flags = self._evaluate(rule_id, rule, result)
            flags.extend(new_flags)

        rules_triggered = list({f.rule_id for f in flags})
        human_in_loop = _determine_hitl(flags)
        return ValidationResult(flags=flags, human_in_loop=human_in_loop, rules_triggered=rules_triggered)

    def _evaluate(self, rule_id: str, rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
        try:
            if rule_id == "low_confidence_field":
                return _check_low_confidence_field(rule, result)
            elif rule_id == "very_low_confidence_field":
                return _check_very_low_confidence_field(rule, result)
            elif rule_id == "missing_critical_value":
                return _check_missing_critical_value(rule, result)
            elif rule_id == "currency_mismatch":
                return _check_currency_mismatch(rule, result)
            elif rule_id == "future_date_anomaly":
                return _check_future_date_anomaly(rule, result)
            elif rule_id == "past_date_anomaly":
                return _check_past_date_anomaly(rule, result)
            elif rule_id == "overall_low_confidence":
                return _check_overall_low_confidence(rule, result)
            elif rule_id == "no_identifiers_found":
                return _check_no_identifiers_found(rule, result)
            elif rule_id == "unsupported_language":
                return _check_unsupported_language(rule, result)
            elif rule_id == "amount_zero":
                return _check_amount_zero(rule, result)
            elif rule_id == "short_extraction":
                return _check_short_extraction(rule, result)
            elif rule_id == "missing_date":
                return _check_missing_date(rule, result)
            elif rule_id == "expired_due_date":
                return _check_expired_due_date(rule, result)
            elif rule_id == "large_monetary_amount":
                return _check_large_monetary_amount(rule, result)
            elif rule_id == "potential_personal_data":
                return _check_potential_personal_data(rule, result)
            elif rule_id == "duplicate_field_name":
                return _check_duplicate_field_name(rule, result)
        except Exception as e:
            logger.warning("rule_evaluation_error", rule_id=rule_id, error=str(e))
        return []


# ── Rule implementations ──────────────────────────────────────────────────────

def _flag(rule: GovernanceRule, field_name: Optional[str], message: str) -> ValidationFlag:
    return ValidationFlag(
        rule_id=rule.rule_id,
        rule_name=rule.name,
        severity=rule.severity,
        field_name=field_name,
        message=message,
    )


def _check_low_confidence_field(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    threshold = rule.config.get("threshold", 0.70)
    flags = []
    for f in result.fields:
        # Only flag if not already caught by very_low_confidence
        if f.confidence < threshold and f.confidence >= 0.40:
            flags.append(_flag(rule, f.name, f"Field '{f.name}' has confidence {f.confidence:.0%} (below {threshold:.0%})"))
    return flags


def _check_very_low_confidence_field(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    threshold = rule.config.get("threshold", 0.40)
    flags = []
    for f in result.fields:
        if f.confidence < threshold:
            flags.append(_flag(rule, f.name, f"Field '{f.name}' has very low confidence {f.confidence:.0%} (below {threshold:.0%}) — manual verification required"))
    return flags


def _check_missing_critical_value(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    flags = []
    for f in result.fields:
        if f.is_critical and (f.value is None or str(f.value).strip() == ""):
            flags.append(_flag(rule, f.name, f"Critical field '{f.name}' has no value"))
    return flags


def _check_currency_mismatch(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    # Collect currency-type fields and extract currency codes
    currency_codes: set[str] = set()
    if result.document_profile.currency:
        currency_codes.add(result.document_profile.currency.upper())

    for f in result.fields:
        if f.data_type == "currency" and f.value:
            # Look for 3-letter currency codes in the value
            matches = re.findall(r"\b([A-Z]{3})\b", f.value.upper())
            currency_codes.update(matches)

    if len(currency_codes) > 1:
        return [_flag(rule, None, f"Multiple currencies detected: {', '.join(sorted(currency_codes))} — verify FX conversion")]
    return []


def _check_future_date_anomaly(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    days = rule.config.get("days_ahead", 90)
    cutoff = datetime.now(timezone.utc) + timedelta(days=days)
    flags = []
    for f in result.fields:
        if f.data_type == "date" and f.value:
            parsed = _try_parse_date(f.value)
            if parsed and parsed > cutoff:
                flags.append(_flag(rule, f.name, f"Field '{f.name}' has a date more than {days} days in the future: {f.value}"))
    return flags


def _check_past_date_anomaly(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    years = rule.config.get("years_back", 5)
    cutoff = datetime.now(timezone.utc) - timedelta(days=years * 365)
    flags = []
    for f in result.fields:
        if f.data_type == "date" and f.value:
            if _HISTORICAL_DATE_FIELDS.search(f.name):
                continue  # DOB, founding dates, etc. are expected to be old
            parsed = _try_parse_date(f.value)
            if parsed and parsed < cutoff:
                flags.append(_flag(rule, f.name, f"Field '{f.name}' has a date more than {years} years in the past: {f.value}"))
    return flags


def _check_overall_low_confidence(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    threshold = rule.config.get("threshold", 0.60)
    if result.overall_confidence < threshold:
        return [_flag(rule, None, f"Overall extraction confidence {result.overall_confidence:.0%} is below {threshold:.0%} — manual review recommended")]
    return []


def _check_no_identifiers_found(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    doc_type = (result.document_profile.doc_type or "").lower().replace("-", "_").replace(" ", "_")
    if doc_type in _NON_COMMERCIAL_DOC_TYPES:
        return []  # Personal/medical docs don't require business identifiers
    if not result.reference_keys:
        return [_flag(rule, None, "No reference identifiers detected (no invoice number, PO, contract ID, etc.)")]
    return []


def _check_unsupported_language(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    # Check language code and scan field values for non-Latin chars
    lang = result.document_profile.language
    if lang and lang.lower() not in ("en", "fr", "de", "es", "it", "pt", "nl", "sv", "no", "da", "fi", "pl", "cs", "sk", "hr", "ro"):
        return [_flag(rule, None, f"Document language '{lang}' may contain non-Latin script — extraction may be partial")]

    # Scan field values
    for f in result.fields:
        if f.value and _NON_LATIN.search(f.value):
            return [_flag(rule, f.name, f"Non-Latin characters detected in field '{f.name}' — extraction accuracy may be reduced")]
    return []


def _check_amount_zero(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    flags = []
    for f in result.fields:
        if f.data_type == "currency":
            if f.value is None or str(f.value).strip() in ("", "0", "0.0", "0.00"):
                flags.append(_flag(rule, f.name, f"Currency field '{f.name}' has a zero or empty value"))
    return flags


def _check_short_extraction(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    min_fields = rule.config.get("min_fields", 3)
    if len(result.fields) < min_fields:
        return [_flag(rule, None,
            f"Only {len(result.fields)} field(s) extracted (minimum {min_fields}) — "
            "check scan quality or document format")]
    return []


def _check_missing_date(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    has_date = any(f.data_type == "date" for f in result.fields)
    if not has_date:
        return [_flag(rule, None, "No date field found — verify the document is dated")]
    return []


def _check_expired_due_date(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    now = datetime.now(timezone.utc)
    flags = []
    for f in result.fields:
        if f.data_type == "date" and f.value and _DUE_DATE_FIELDS.search(f.name):
            parsed = _try_parse_date(f.value)
            if parsed and parsed < now:
                flags.append(_flag(rule, f.name,
                    f"Field '{f.name}' is a past due/expiry date: {f.value}"))
    return flags


def _check_large_monetary_amount(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    threshold = rule.config.get("threshold", 100000)
    flags = []
    for f in result.fields:
        if f.data_type == "currency" and f.value:
            amount = _parse_amount(f.value)
            if amount is not None and amount >= threshold:
                flags.append(_flag(rule, f.name,
                    f"Field '{f.name}' contains a large amount ({f.value}) exceeding {threshold:,} — recommend escalation"))
    return flags


def _check_potential_personal_data(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    pii_fields = [f.name for f in result.fields if _PII_FIELD_PATTERNS.search(f.name)]
    if pii_fields:
        names = ", ".join(f"'{n}'" for n in pii_fields[:5])
        suffix = f" and {len(pii_fields) - 5} more" if len(pii_fields) > 5 else ""
        return [_flag(rule, None,
            f"Personal data fields detected: {names}{suffix} — ensure GDPR/HIPAA compliance")]
    return []


def _check_duplicate_field_name(rule: GovernanceRule, result: ExtractionResult) -> list[ValidationFlag]:
    seen: dict[str, str] = {}
    flags = []
    for f in result.fields:
        if f.name in seen:
            if f.value != seen[f.name]:
                flags.append(_flag(rule, f.name,
                    f"Field '{f.name}' extracted twice with different values: '{seen[f.name]}' and '{f.value}'"))
        else:
            seen[f.name] = f.value or ""
    return flags


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_amount(value: str) -> Optional[float]:
    """Extract the largest numeric value from a currency string."""
    cleaned = value.replace(",", "").replace(" ", "")
    matches = _NUMERIC_RE.findall(cleaned)
    if not matches:
        return None
    try:
        return max(float(m.replace(",", "")) for m in matches)
    except ValueError:
        return None


def _try_parse_date(value: str) -> Optional[datetime]:
    """Best-effort date parsing — returns UTC datetime or None."""
    value = value.strip()
    # Try ISO format first
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # Try partial match for YYYY-MM-DD
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", value)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def _determine_hitl(flags: list[ValidationFlag]) -> str:
    severities = {f.severity for f in flags}
    if "error" in severities:
        return "required"
    if "warning" in severities:
        return "recommended"
    return "not_required"
