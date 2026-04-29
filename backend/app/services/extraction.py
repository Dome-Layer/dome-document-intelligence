import json
from typing import Optional

from ..models.schemas import DocumentProfile, ExtractedField, ExtractionResult
from ..providers import LLMProvider
from ..services.ingest import IngestResult
from ..core.logging import get_logger

logger = get_logger(__name__)

_SYSTEM_ANALYST = (
    "You are a document intelligence specialist. "
    "You extract structured data from any type of document with high precision. "
    "You always respond with valid JSON only — no markdown, no explanation."
)

_TYPE_DETECTION_SCHEMA = {
    "doc_type": "string — e.g. invoice, purchase_order, utility_bill, trade_confirmation, letter_of_credit, contract, commodity_report, lab_report, medical_record, clinical_form, prescription, bank_statement, tax_form, cv_resume, other",
    "industry_hint": "string or null — e.g. healthcare, medical, utilities, financial_services, banking, insurance, legal, hr, procurement, logistics, commodity_finance, real_estate, education, government, retail, technology, other",
    "sections": "array of strings — sections present e.g. header, patient_info, test_results, line_items, payment_terms, signatures, schedules",
    "language": "string — ISO 639-1 code e.g. en, fr, de",
    "currency": "string or null — ISO 4217 code e.g. USD, EUR, GBP",
}

_CONFIDENCE_GUIDANCE = """
Confidence calibration — be conservative:
- 0.90–1.00: value is explicitly labelled and unambiguous in the source
- 0.70–0.89: value is present but required minor interpretation (format, units, abbreviation)
- 0.50–0.69: value is inferred from context or not directly labelled
- 0.30–0.49: multiple plausible values exist; you selected the most likely
- 0.00–0.29: best guess — flag for manual verification
When uncertain, score lower rather than higher."""

_EXTRACTION_SCHEMA = {
    "fields": [
        {
            "name": "snake_case field name",
            "value": "extracted value as string, or null",
            "confidence": "float 0.0-1.0 — see calibration guidance above",
            "location_hint": "where in document e.g. header, footer, line 3, or null",
            "data_type": "one of: currency, date, text, identifier, percentage",
            "is_critical": "bool — true if essential to document purpose",
        }
    ],
    "overall_confidence": "float 0.0-1.0 — weighted average reflecting overall extraction quality",
    "reference_keys": {
        "description": "structured identifiers e.g. invoice_number, po_number, isin, contract_ref, patient_id, accession_number, case_number, sample_id",
        "example": {"invoice_number": "INV-2024-001", "patient_id": "PT-98765"},
    },
}


def _type_detection_prompt(content: str) -> str:
    return f"""Analyse this document and identify its type, structure, language, and currency.
The document may be from any industry — healthcare, finance, legal, HR, logistics, or personal.

Return JSON matching exactly this structure:
{json.dumps(_TYPE_DETECTION_SCHEMA, indent=2)}

Document content:
---
{content[:8000]}
---"""


def _type_detection_vision_prompt() -> str:
    return f"""Analyse this document image and identify its type, structure, language, and currency.
The document may be from any industry — healthcare, finance, legal, HR, logistics, or personal.

Return JSON matching exactly this structure:
{json.dumps(_TYPE_DETECTION_SCHEMA, indent=2)}"""


def _field_extraction_prompt(content: str, profile: DocumentProfile) -> str:
    return f"""Extract all significant fields from this document.

Document profile (use as context):
{profile.model_dump_json(indent=2)}

{_CONFIDENCE_GUIDANCE}

For each field extract: name (snake_case), value, confidence (0.0-1.0), location_hint, data_type, is_critical.
For location_hint, use section names from the document profile when applicable (e.g. "patient_info", "test_results",
"header", "line_items") rather than positional descriptions like "line 3".
Also identify reference_keys — any structured identifiers present (PO numbers, invoice IDs, ISINs, contract refs,
patient IDs, accession numbers, case numbers, sample IDs, registration numbers, etc.)

Return JSON matching exactly this structure:
{json.dumps(_EXTRACTION_SCHEMA, indent=2)}

Document content:
---
{content[:8000]}
---"""


def _field_extraction_vision_prompt(profile: DocumentProfile) -> str:
    return f"""Extract all significant fields from this document image.

Document profile (use as context):
{profile.model_dump_json(indent=2)}

{_CONFIDENCE_GUIDANCE}
If the image is blurry, low-resolution, or poorly lit, assign lower confidence scores even if values appear plausible.

For each field extract: name (snake_case), value, confidence (0.0-1.0), location_hint, data_type, is_critical.
For location_hint, use section names from the document profile when applicable (e.g. "patient_info", "test_results",
"header", "line_items") rather than positional descriptions like "line 3".
Also identify reference_keys — any structured identifiers present (PO numbers, invoice IDs, ISINs, contract refs,
patient IDs, accession numbers, case numbers, sample IDs, registration numbers, etc.)

Return JSON matching exactly this structure:
{json.dumps(_EXTRACTION_SCHEMA, indent=2)}"""


class ExtractionService:
    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider

    async def extract(self, ingested: IngestResult) -> ExtractionResult:
        profile = await self._detect_type(ingested)
        logger.info("type_detected", doc_type=profile.doc_type, language=profile.language)

        result = await self._extract_fields(ingested, profile)
        logger.info(
            "fields_extracted",
            field_count=len(result.fields),
            overall_confidence=result.overall_confidence,
        )
        return result

    # ── Pass 1: type detection ────────────────────────────────────────────────

    async def _detect_type(self, ingested: IngestResult) -> DocumentProfile:
        if ingested.image_bytes:
            raw = await self._provider.generate_vision(
                _type_detection_vision_prompt(),
                ingested.image_bytes,
                ingested.media_type or "image/png",
                system=_SYSTEM_ANALYST,
            )
            data = _parse_json_from_text(raw)
        else:
            data = await self._provider.generate_structured(
                _type_detection_prompt(ingested.text or ""),
                schema=_TYPE_DETECTION_SCHEMA,
                system=_SYSTEM_ANALYST,
            )
        return _build_profile(data)

    # ── Pass 2: field extraction ──────────────────────────────────────────────

    async def _extract_fields(self, ingested: IngestResult, profile: DocumentProfile) -> ExtractionResult:
        if ingested.image_bytes:
            raw = await self._provider.generate_vision(
                _field_extraction_vision_prompt(profile),
                ingested.image_bytes,
                ingested.media_type or "image/png",
                system=_SYSTEM_ANALYST,
            )
            data = _parse_json_from_text(raw)
        else:
            data = await self._provider.generate_structured(
                _field_extraction_prompt(ingested.text or "", profile),
                schema=_EXTRACTION_SCHEMA,
                system=_SYSTEM_ANALYST,
            )
        return _build_extraction_result(data, profile)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_json_from_text(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        text = text.rsplit("```", 1)[0]
    import json as _json
    try:
        return _json.loads(text)
    except _json.JSONDecodeError as e:
        logger.error("vision_json_parse_error", error=str(e), raw=text[:300])
        raise ValueError(f"LLM returned invalid JSON from vision: {e}")


def _build_profile(data: dict) -> DocumentProfile:
    return DocumentProfile(
        doc_type=str(data.get("doc_type", "other")),
        industry_hint=data.get("industry_hint"),
        sections=data.get("sections", []),
        language=str(data.get("language", "en")),
        currency=data.get("currency"),
    )


def _build_extraction_result(data: dict, profile: DocumentProfile) -> ExtractionResult:
    raw_fields = data.get("fields", [])
    fields: list[ExtractedField] = []
    for f in raw_fields:
        try:
            fields.append(
                ExtractedField(
                    name=str(f.get("name", "unknown")),
                    value=f.get("value"),
                    confidence=float(f.get("confidence", 0.5)),
                    location_hint=f.get("location_hint"),
                    data_type=str(f.get("data_type", "text")),
                    is_critical=bool(f.get("is_critical", False)),
                )
            )
        except Exception as e:
            logger.warning("field_parse_error", field=f, error=str(e))

    ref_keys_raw = data.get("reference_keys", {})
    # Strip the schema description key if it leaked through
    reference_keys = {
        k: str(v)
        for k, v in ref_keys_raw.items()
        if k not in ("description", "example") and isinstance(v, (str, int, float))
    }

    # Compute overall_confidence from fields (more reliable than LLM self-report)
    if fields:
        overall_confidence = sum(f.confidence for f in fields) / len(fields)
    else:
        overall_confidence = float(data.get("overall_confidence", 0.5))

    return ExtractionResult(
        fields=fields,
        overall_confidence=overall_confidence,
        reference_keys=reference_keys,
        document_profile=profile,
    )
