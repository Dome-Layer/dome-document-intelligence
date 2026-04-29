import time
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from ..api.deps import get_current_user
from ..core.limiter import limiter
from ..core.config import settings
from ..core.logging import get_logger
from ..models.schemas import DocumentIntelligenceResult, GovernanceRule
from ..providers import get_llm_provider
from ..services.governance import emit_governance_event
from ..services.extraction import ExtractionService
from ..services.ingest import IngestService
from ..services.validation import ValidationService
from .rules import get_or_seed_rules

logger = get_logger(__name__)

router = APIRouter()

_ingest = IngestService()
_validate = ValidationService()


@router.post(
    "/extract",
    response_model=DocumentIntelligenceResult,
    summary="Extract structured data from a business document",
)
@limiter.limit("20/hour")
async def extract(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
) -> DocumentIntelligenceResult:
    # ── Size guard ────────────────────────────────────────────────────────────
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_file_size_mb} MB limit",
        )

    content_type = file.content_type or ""
    filename = file.filename or ""
    start_ms = time.monotonic()

    # ── Ingest ────────────────────────────────────────────────────────────────
    try:
        ingested = await _ingest.process(data, content_type, filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except Exception as e:
        logger.error("ingest_error", error=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Document processing failed: {e}")

    # ── Extract ───────────────────────────────────────────────────────────────
    provider = get_llm_provider()
    extractor = ExtractionService(provider)
    try:
        extraction = await extractor.extract(ingested)
    except Exception as e:
        logger.error("extraction_error", error=str(e))
        # Emit a failed governance event before re-raising
        await emit_governance_event(
            input_data=data,
            input_type=ingested.input_type,
            output_summary="Extraction failed",
            rules_applied=[],
            rules_triggered=[],
            confidence=None,
            human_in_loop="required",
            user_id=user_id,
            metadata={"error": str(e), "filename": filename},
        )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Extraction failed: {e}")

    # ── Validate ──────────────────────────────────────────────────────────────
    active_rules: list[GovernanceRule] = await get_or_seed_rules(user_id)
    validation = _validate.validate(extraction, active_rules)

    elapsed_ms = int((time.monotonic() - start_ms) * 1000)

    # ── Governance event (metadata only — no document content) ────────────────
    await emit_governance_event(
        input_data=data,
        input_type=ingested.input_type,
        output_summary=(
            f"{extraction.document_profile.doc_type} — "
            f"{len(extraction.fields)} fields extracted, "
            f"confidence {extraction.overall_confidence:.0%}"
        ),
        rules_applied=[r.rule_id for r in active_rules],
        rules_triggered=validation.rules_triggered,
        confidence=extraction.overall_confidence,
        human_in_loop=validation.human_in_loop,
        user_id=user_id,
        metadata={
            "doc_type": extraction.document_profile.doc_type,
            "language": extraction.document_profile.language,
            "field_count": len(extraction.fields),
            "reference_key_count": len(extraction.reference_keys),
            "flag_count": len(validation.flags),
            "processing_time_ms": elapsed_ms,
            "filename": filename,
        },
    )

    # Document data is never persisted — discard here
    del data
    del ingested

    return DocumentIntelligenceResult(
        extraction=extraction,
        flags=validation.flags,
        human_in_loop=validation.human_in_loop,
        processing_time_ms=elapsed_ms,
    )
