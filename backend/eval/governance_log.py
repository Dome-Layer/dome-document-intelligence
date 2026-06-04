"""Audit the judge: log one ``eval_judgment`` governance event per live eval run.

Mirrors ``app.services.governance.emit_governance_event`` (same table, same
service-role ``get_db`` write, same ``GovernanceEvent`` shape, same
``agent_id="document-intelligence"``) but with a distinct
``action_type="eval_judgment"`` so model-quality checks join the audit trail and can
later feed the P6 dashboard. Like the production emitter, a DB failure is logged but
never raised.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from dome_core.governance import hash_input_text

from app.core.db import get_db
from app.core.logging import get_logger
from app.models.schemas import GovernanceEvent
from app.services.governance import AGENT_ID

logger = get_logger(__name__)

EVAL_ACTION_TYPE = "eval_judgment"


def emit_eval_judgment_event(
    *,
    output_summary: str,
    confidence: Optional[float],
    metadata: dict,
    human_in_loop: str = "not_required",
) -> GovernanceEvent:
    """Persist a single eval-judgment audit row; return the event regardless of DB outcome."""
    event = GovernanceEvent(
        agent_id=AGENT_ID,
        action_type=EVAL_ACTION_TYPE,
        timestamp=datetime.now(timezone.utc),
        input_hash=hash_input_text(output_summary),
        input_type="eval_golden_set",
        output_summary=output_summary,
        rules_applied=[],
        rules_triggered=[],
        confidence=confidence,
        human_in_loop=human_in_loop,
        user_id=None,
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
            "workflow_run_id": event.workflow_run_id,
            "metadata": event.metadata,
        }
        db.table("governance_events").insert(payload).execute()
        logger.info("eval_judgment_emitted", input_hash=event.input_hash)
    except Exception as e:  # never break the eval run on a logging failure
        logger.error("eval_judgment_failed", error=str(e))
    return event
