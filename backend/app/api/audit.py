from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..api.deps import get_current_user
from ..core.db import get_db
from ..core.logging import get_logger
from ..models.schemas import AuditListResponse, GovernanceEvent

logger = get_logger(__name__)
router = APIRouter()


@router.get("/audit", response_model=AuditListResponse)
async def list_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
) -> AuditListResponse:
    db = get_db()
    offset = (page - 1) * page_size

    # Total count
    count_resp = (
        db.table("governance_events")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    total = count_resp.count or 0

    # Page of events
    rows = (
        db.table("governance_events")
        .select("*")
        .eq("user_id", user_id)
        .order("timestamp", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    events = [_row_to_event(r) for r in (rows.data or [])]
    return AuditListResponse(events=events, total=total, page=page, page_size=page_size)


@router.get("/audit/{event_id}", response_model=GovernanceEvent)
async def get_audit_event(
    event_id: str,
    user_id: str = Depends(get_current_user),
) -> GovernanceEvent:
    db = get_db()
    rows = (
        db.table("governance_events")
        .select("*")
        .eq("id", event_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit event not found")
    return _row_to_event(rows.data[0])


def _row_to_event(row: dict) -> GovernanceEvent:
    ts = row["timestamp"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))

    return GovernanceEvent(
        agent_id=row["agent_id"],
        action_type=row["action_type"],
        timestamp=ts,
        input_hash=row["input_hash"],
        input_type=row["input_type"],
        output_summary=row["output_summary"],
        rules_applied=row.get("rules_applied") or [],
        rules_triggered=row.get("rules_triggered") or [],
        confidence=row.get("confidence"),
        human_in_loop=row.get("human_in_loop", "not_required"),
        user_id=str(row["user_id"]) if row.get("user_id") else None,
        metadata=row.get("metadata") or {},
    )
