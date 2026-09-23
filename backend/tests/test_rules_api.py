"""Tests for app.api.rules.get_or_seed_rules.

A service-key caller (agent-flow) authenticates with no user_id (None), and
governance_rules is a per-user table, so there is nothing to seed or fetch for
it. Passing None straight to a Supabase `.eq("user_id", None)` call used to
serialize as the literal string "None" and crash Postgres with
`invalid input syntax for type uuid: "None"` on every P5 extraction.
"""

from __future__ import annotations

import asyncio

from app.api.rules import get_or_seed_rules
from app.services.validation import RULES_DEFINITIONS


def test_get_or_seed_rules_none_user_returns_defaults_without_db() -> None:
    rules = asyncio.run(get_or_seed_rules(None))

    assert len(rules) == len(RULES_DEFINITIONS)
    by_id = {r.rule_id: r for r in rules}
    for d in RULES_DEFINITIONS:
        rule = by_id[d["rule_id"]]
        assert rule.id == d["rule_id"]
        assert rule.severity == d["severity"]
        assert rule.enabled == d["enabled"]
        assert rule.config == d["config"]
