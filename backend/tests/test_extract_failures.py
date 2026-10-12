"""Failed extractions: each one returns a clear error and leaves a governance event.

2026-10-12: a long bank statement made the model's answer stop at the output token
limit. DocI reported "LLM returned invalid JSON" as a user error and recorded nothing,
so the failed run was missing from the Governance Dashboard.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from dome_core.llm import LLMOutputTruncatedError
from fastapi.testclient import TestClient

from app.api import extract as extract_api
from app.api.deps import get_current_user
from app.main import app
from app.services.extraction import _field_extraction_prompt, _field_extraction_vision_prompt
from app.services.ingest import IngestResult


@pytest.fixture
def events(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[dict]]:
    recorded: list[dict] = []

    async def fake_process(data: bytes, content_type: str, filename: str) -> IngestResult:
        return IngestResult(
            text="statement text", image_bytes=None, media_type=None, input_type="pdf"
        )

    async def fake_emit(**kwargs) -> None:
        recorded.append(kwargs)

    monkeypatch.setattr(extract_api._ingest, "process", fake_process)
    monkeypatch.setattr(extract_api, "emit_governance_event", fake_emit)
    monkeypatch.setattr(extract_api, "get_llm_provider", lambda: object())
    app.dependency_overrides[get_current_user] = lambda: "user-1"
    yield recorded
    app.dependency_overrides.pop(get_current_user, None)


def _failing_extractor(monkeypatch: pytest.MonkeyPatch, error: Exception) -> None:
    class Failing:
        def __init__(self, provider: object) -> None:
            pass

        async def extract(self, ingested: IngestResult) -> None:
            raise error

    monkeypatch.setattr(extract_api, "ExtractionService", Failing)


def _post() -> object:
    with TestClient(app) as client:
        return client.post(
            "/api/extract",
            files={"file": ("statement.pdf", b"%PDF-1.4 test", "application/pdf")},
            headers={"X-Workflow-Run-Id": "run-1"},
        )


def test_truncated_answer_is_explained_and_recorded(monkeypatch, events) -> None:
    _failing_extractor(monkeypatch, LLMOutputTruncatedError(16384))

    response = _post()

    assert response.status_code == 422
    assert "cut off" in response.json()["detail"]
    assert len(events) == 1
    event = events[0]
    assert event["output_summary"] == "Extraction failed"
    assert event["metadata"]["error_type"] == "output_truncated"
    assert event["metadata"]["filename"] == "statement.pdf"
    assert event["user_id"] == "user-1"
    assert event["workflow_run_id"] == "run-1"


def test_invalid_model_output_is_recorded(monkeypatch, events) -> None:
    _failing_extractor(monkeypatch, ValueError("LLM returned invalid JSON: Expecting value"))

    response = _post()

    assert response.status_code == 422
    assert "invalid JSON" in response.json()["detail"]
    assert [e["metadata"]["error_type"] for e in events] == ["invalid_model_output"]


def test_upstream_error_is_recorded(monkeypatch, events) -> None:
    _failing_extractor(monkeypatch, RuntimeError("upstream down"))

    response = _post()

    assert response.status_code == 502
    assert [e["metadata"]["error_type"] for e in events] == ["extraction_error"]


def test_prompts_cap_repeated_rows_and_ask_for_compact_json() -> None:
    from app.models.schemas import DocumentProfile

    profile = DocumentProfile.model_construct(doc_type="bank_statement", language="en")
    for prompt in (
        _field_extraction_prompt("text", profile),
        _field_extraction_vision_prompt(profile),
    ):
        assert "only the first 10 rows" in prompt
        assert "rows_not_extracted" in prompt
        assert "compact JSON" in prompt
