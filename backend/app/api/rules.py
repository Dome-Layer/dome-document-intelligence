from fastapi import APIRouter, Depends, HTTPException, status

from ..api.deps import get_current_user
from ..core.db import get_db
from ..core.logging import get_logger
from ..models.schemas import GovernanceRule, RuleToggleRequest, RulesListResponse
from ..services.validation import RULES_DEFINITIONS

logger = get_logger(__name__)
router = APIRouter()


async def get_or_seed_rules(user_id: str) -> list[GovernanceRule]:
    """Return user's governance rules, seeding defaults on first access.
    Also backfills any rules added since the user's initial seed."""
    db = get_db()
    rows = db.table("governance_rules").select("*").eq("user_id", user_id).execute()

    if rows.data:
        existing_ids = {r["rule_id"] for r in rows.data}
        missing = [d for d in RULES_DEFINITIONS if d["rule_id"] not in existing_ids]
        if missing:
            logger.info("backfilling_new_rules", user_id=user_id, count=len(missing))
            inserts = [
                {
                    "user_id": user_id,
                    "rule_id": d["rule_id"],
                    "name": d["name"],
                    "description": d["description"],
                    "severity": d["severity"],
                    "enabled": d["enabled"],
                    "config": d["config"],
                }
                for d in missing
            ]
            new_rows = db.table("governance_rules").insert(inserts).execute()
            return [_row_to_rule(r) for r in rows.data + new_rows.data]
        return [_row_to_rule(r) for r in rows.data]

    # First access — seed all default rules for this user
    logger.info("seeding_rules_for_user", user_id=user_id)
    inserts = [
        {
            "user_id": user_id,
            "rule_id": d["rule_id"],
            "name": d["name"],
            "description": d["description"],
            "severity": d["severity"],
            "enabled": d["enabled"],
            "config": d["config"],
        }
        for d in RULES_DEFINITIONS
    ]
    result = db.table("governance_rules").insert(inserts).execute()
    return [_row_to_rule(r) for r in result.data]


@router.get("/rules", response_model=RulesListResponse)
async def list_rules(user_id: str = Depends(get_current_user)) -> RulesListResponse:
    rules = await get_or_seed_rules(user_id)
    return RulesListResponse(rules=rules)


@router.patch("/rules/{rule_id}", response_model=GovernanceRule)
async def toggle_rule(
    rule_id: str,
    body: RuleToggleRequest,
    user_id: str = Depends(get_current_user),
) -> GovernanceRule:
    db = get_db()
    rows = (
        db.table("governance_rules")
        .select("*")
        .eq("user_id", user_id)
        .eq("rule_id", rule_id)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule '{rule_id}' not found")

    updated = (
        db.table("governance_rules")
        .update({"enabled": body.enabled})
        .eq("user_id", user_id)
        .eq("rule_id", rule_id)
        .execute()
    )
    logger.info("rule_toggled", rule_id=rule_id, enabled=body.enabled, user_id=user_id)
    return _row_to_rule(updated.data[0])


def _row_to_rule(row: dict) -> GovernanceRule:
    return GovernanceRule(
        id=str(row["id"]),
        rule_id=row["rule_id"],
        name=row["name"],
        description=row.get("description", ""),
        severity=row["severity"],
        enabled=bool(row["enabled"]),
        config=row.get("config") or {},
    )
