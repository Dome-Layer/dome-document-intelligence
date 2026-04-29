import hashlib
from datetime import datetime, timezone
from typing import Optional

from ..core.db import get_db
from ..core.logging import get_logger
from ..models.schemas import GovernanceEvent

logger = get_logger(__name__)

AGENT_ID = "document-intelligence"


def hash_input(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def emit_governance_event(
    *,
    input_data: bytes,
    input_type: str,
    output_summary: str,
    rules_applied: list[str],
    rules_triggered: list[str],
    confidence: Optional[float],
    human_in_loop: str,
    user_id: Optional[str],
    metadata: dict,
) -> GovernanceEvent:
    event = GovernanceEvent(
        agent_id=AGENT_ID,
        action_type="extraction",
        timestamp=datetime.now(timezone.utc),
        input_hash=hash_input(input_data),
        input_type=input_type,
        output_summary=output_summary,
        rules_applied=rules_applied,
        rules_triggered=rules_triggered,
        confidence=confidence,
        human_in_loop=human_in_loop,
        user_id=user_id,
        metadata=metadata,
    )

    try:
        db = get_db()
        payload = {
            "agent_id": event.agent_id,
            "action_type": event.action_type,
            "timestamp": event.timestamp.isoformat(),
            "input_hash": event.input_hash,
            "input_type": event.input_type,
            "output_summary": event.output_summary,
            "rules_applied": event.rules_applied,
            "rules_triggered": event.rules_triggered,
            "confidence": event.confidence,
            "human_in_loop": event.human_in_loop,
            "user_id": event.user_id,
            "metadata": event.metadata,
        }
        db.table("governance_events").insert(payload).execute()
        logger.info("governance_event_emitted", input_hash=event.input_hash, human_in_loop=human_in_loop)
    except Exception as e:
        # Governance logging must never break the main flow
        logger.error("governance_event_failed", error=str(e))

    return event
