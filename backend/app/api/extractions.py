from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional

from ..api.deps import get_current_user
from ..core.db import get_db
from ..core.logging import get_logger
from ..models.schemas import (
    SaveExtractionRequest,
    SavedExtractionSummary,
    SavedExtractionDetail,
    SavedExtractionsListResponse,
)

logger = get_logger(__name__)
router = APIRouter()

PAGE_SIZE_MAX = 50


@router.post("/extractions", response_model=SavedExtractionSummary, status_code=status.HTTP_201_CREATED)
async def save_extraction(
    body: SaveExtractionRequest,
    user_id: str = Depends(get_current_user),
) -> SavedExtractionSummary:
    result = body.result
    extraction = result.get("extraction", {})
    profile = extraction.get("document_profile", {})

    payload = {
        "user_id": user_id,
        "filename": body.filename,
        "doc_type": profile.get("doc_type", "other"),
        "industry_hint": profile.get("industry_hint"),
        "overall_confidence": extraction.get("overall_confidence", 0),
        "human_in_loop": result.get("human_in_loop", "not_required"),
        "processing_time_ms": result.get("processing_time_ms", 0),
        "result": result,
    }
    db = get_db()
    row = db.table("saved_extractions").insert(payload).execute()
    logger.info("extraction_saved", user_id=user_id, doc_type=payload["doc_type"])
    return _row_to_summary(row.data[0])


@router.get("/extractions", response_model=SavedExtractionsListResponse)
async def list_extractions(
    page: int = 1,
    page_size: int = 20,
    doc_type: Optional[str] = None,
    search: Optional[str] = None,
    user_id: str = Depends(get_current_user),
) -> SavedExtractionsListResponse:
    page_size = min(page_size, PAGE_SIZE_MAX)
    offset = (page - 1) * page_size

    db = get_db()
    query = (
        db.table("saved_extractions")
        .select("id,filename,doc_type,industry_hint,overall_confidence,human_in_loop,processing_time_ms,saved_at", count="exact")
        .eq("user_id", user_id)
        .order("saved_at", desc=True)
    )
    if doc_type:
        query = query.eq("doc_type", doc_type)
    if search:
        query = query.ilike("filename", f"%{search}%")

    rows = query.range(offset, offset + page_size - 1).execute()
    total = rows.count or 0

    return SavedExtractionsListResponse(
        extractions=[_row_to_summary(r) for r in rows.data],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/extractions/{extraction_id}", response_model=SavedExtractionDetail)
async def get_extraction(
    extraction_id: str,
    user_id: str = Depends(get_current_user),
) -> SavedExtractionDetail:
    db = get_db()
    rows = (
        db.table("saved_extractions")
        .select("*")
        .eq("id", extraction_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction not found")
    return _row_to_detail(rows.data[0])


@router.delete("/extractions/{extraction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_extraction(
    extraction_id: str,
    user_id: str = Depends(get_current_user),
) -> None:
    db = get_db()
    rows = (
        db.table("saved_extractions")
        .select("id")
        .eq("id", extraction_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction not found")
    db.table("saved_extractions").delete().eq("id", extraction_id).execute()
    logger.info("extraction_deleted", extraction_id=extraction_id, user_id=user_id)


def _row_to_summary(row: dict) -> SavedExtractionSummary:
    return SavedExtractionSummary(
        id=str(row["id"]),
        filename=row.get("filename"),
        doc_type=row["doc_type"],
        industry_hint=row.get("industry_hint"),
        overall_confidence=float(row["overall_confidence"]),
        human_in_loop=row["human_in_loop"],
        processing_time_ms=int(row["processing_time_ms"]),
        saved_at=str(row["saved_at"]),
    )


def _row_to_detail(row: dict) -> SavedExtractionDetail:
    return SavedExtractionDetail(
        **_row_to_summary(row).__dict__,
        result=row["result"],
    )
