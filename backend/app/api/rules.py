from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from ..api.deps import get_current_user
from ..core.db import get_db
from ..core.logging import get_logger
from ..models.schemas import GovernanceRule, RulesListResponse, RuleToggleRequest
from ..services.validation import RULES_DEFINITIONS

logger = get_logger(__name__)
router = APIRouter()


def _default_rules() -> list[GovernanceRule]:
    """The unpersisted default rule set for a service-key caller (no user_id).

    There is no user row to own the governance_rules under, so there is nothing
    to seed or backfill: default severity/enabled straight from RULES_DEFINITIONS.
    `id` has no DB row to draw from; `rule_id` is unique and stable, so it stands
    in (id is never consumed by validation, only by the rule-toggle API surface,
    which a service caller never reaches).
    """
    return [
        GovernanceRule(
            id=d["rule_id"],
            rule_id=d["rule_id"],
            name=d["name"],
            description=d["description"],
            severity=d["severity"],
            enabled=d["enabled"],
            config=d["config"],
        )
        for d in RULES_DEFINITIONS
    ]


async def get_or_seed_rules(user_id: Optional[str]) -> list[GovernanceRule]:
    """Return user's governance rules, seeding defaults on first access.
    Also backfills any rules added since the user's initial seed.

    A service-key caller (agent-flow) has no user_id: `governance_rules` is
    per-user, so there is nothing to seed or fetch, and the default rule set is
    returned unpersisted rather than crashing on a NULL/None mismatch.
    """
    if user_id is None:
        return _default_rules()

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule '{rule_id}' not found"
        )

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
