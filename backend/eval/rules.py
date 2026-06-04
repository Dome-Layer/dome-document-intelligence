"""Canonical governance rules as plain objects, without touching the database.

``app.api.rules.get_or_seed_rules`` reads/writes Supabase. The eval harness and the
rules-engine tests need the same canonical 16-rule set offline, so this mirrors the
dict -> ``GovernanceRule`` mapping in ``app.api.rules._row_to_rule`` but seeds from
the in-code ``RULES_DEFINITIONS`` (``id == rule_id`` since there is no DB row).
"""

from __future__ import annotations

from app.models.schemas import GovernanceRule
from app.services.validation import RULES_DEFINITIONS

_BY_ID: dict[str, dict] = {d["rule_id"]: d for d in RULES_DEFINITIONS}


def _to_rule(d: dict) -> GovernanceRule:
    return GovernanceRule(
        id=d["rule_id"],
        rule_id=d["rule_id"],
        name=d["name"],
        description=d["description"],
        severity=d["severity"],
        enabled=bool(d.get("enabled", True)),
        config=dict(d.get("config", {})),
    )


def default_rules() -> list[GovernanceRule]:
    """All 16 canonical rules as ``GovernanceRule`` objects, all enabled."""
    return [_to_rule(d) for d in RULES_DEFINITIONS]


def rule(rule_id: str) -> GovernanceRule:
    """A single canonical rule by id — used to isolate one rule under test."""
    return _to_rule(_BY_ID[rule_id])


def rules(*rule_ids: str) -> list[GovernanceRule]:
    """A subset of canonical rules by id, in the given order."""
    return [rule(r) for r in rule_ids]
