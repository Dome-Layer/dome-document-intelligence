"""Verify the eval_judgment governance row pattern (deterministic, no DB).

`make eval` writes exactly one `eval_judgment` audit row per run via
``eval.governance_log.emit_eval_judgment_event`` (mirroring
``app.services.governance.emit_governance_event``). The live write targets whatever
``SUPABASE_*`` is configured; here we capture the payload with a fake DB and assert its
exact shape — the CI-verifiable proof of the audit-row pattern, no network required.
"""

from __future__ import annotations

import hashlib

from eval import governance_log as gl


def test_emit_eval_judgment_payload(monkeypatch):
    captured: dict = {}

    class _Table:
        def insert(self, payload):
            captured["payload"] = payload
            return self

        def execute(self):
            captured["executed"] = True
            return None

    class _DB:
        def table(self, name):
            captured["table"] = name
            return _Table()

    monkeypatch.setattr(gl, "get_db", lambda: _DB())

    summary = "Judge J validated on 10 objective fields (100.0% agreement, trustworthy); resolved 3 fuzzy fields"
    meta = {"judge_model": "J", "n_objective": 10, "agreement_rate": 1.0}
    event = gl.emit_eval_judgment_event(output_summary=summary, confidence=1.0, metadata=meta)

    assert captured["table"] == "governance_events"
    assert captured["executed"] is True

    p = captured["payload"]
    assert p["agent_id"] == "document-intelligence"
    assert p["action_type"] == "eval_judgment"
    assert p["input_type"] == "eval_golden_set"
    assert p["input_hash"] == hashlib.sha256(summary.encode("utf-8")).hexdigest()
    assert p["rules_applied"] == []
    assert p["rules_triggered"] == []
    assert p["confidence"] == 1.0
    assert p["human_in_loop"] == "not_required"
    assert p["user_id"] is None
    assert p["metadata"] == meta

    # the returned event mirrors the persisted row
    assert event.agent_id == "document-intelligence"
    assert event.action_type == "eval_judgment"


def test_emit_eval_judgment_never_raises_on_db_failure(monkeypatch):
    def _boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(gl, "get_db", _boom)
    # Mirrors production governance: a logging failure must not break the eval run.
    event = gl.emit_eval_judgment_event(output_summary="x", confidence=None, metadata={})
    assert event.action_type == "eval_judgment"
