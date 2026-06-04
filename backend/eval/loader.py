"""Filesystem layer: golden-set labels, source documents, and recordings.

- ``fixtures/labels/*.json``  -> ``GoldenDoc`` ground truth.
- ``fixtures/docs/*``         -> source documents (txt / png / jpg / pdf / xlsx).
- ``recordings/*.json``       -> committed ``ExtractionResult`` dumps (the model's
  recorded output; CI scores against these without a network call).

Pure I/O — no model or network access.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.models.schemas import ExtractionResult
from app.services.ingest import IngestResult, IngestService

from .types import GoldenDoc

EVAL_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = EVAL_DIR / "fixtures"
DOCS_DIR = FIXTURES_DIR / "docs"
LABELS_DIR = FIXTURES_DIR / "labels"
RECORDINGS_DIR = EVAL_DIR / "recordings"
REPORTS_DIR = EVAL_DIR / "reports"

_IMAGE_MEDIA = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def load_golden_set() -> list[GoldenDoc]:
    """All golden docs, ordered by doc_id for stable reports."""
    docs = [GoldenDoc.model_validate(json.loads(p.read_text())) for p in LABELS_DIR.glob("*.json")]
    return sorted(docs, key=lambda d: d.doc_id)


def doc_source_path(gold: GoldenDoc) -> Path:
    return FIXTURES_DIR / gold.source


async def build_ingest(gold: GoldenDoc) -> IngestResult:
    """Turn a golden document into an ``IngestResult`` for the extractor."""
    path = doc_source_path(gold)
    suffix = path.suffix.lower()
    if gold.modality == "text" or suffix == ".txt":
        return IngestResult(path.read_text(encoding="utf-8"), None, None, "text")
    if gold.modality == "image" or suffix in _IMAGE_MEDIA:
        return IngestResult(None, path.read_bytes(), _IMAGE_MEDIA.get(suffix, "image/png"), "image")
    # pdf / xlsx — reuse the production ingest pipeline.
    return await IngestService().process(path.read_bytes(), "", path.name)


def recording_path(doc_id: str) -> Path:
    return RECORDINGS_DIR / f"{doc_id}.json"


def has_recording(doc_id: str) -> bool:
    return recording_path(doc_id).exists()


def load_recording(doc_id: str) -> ExtractionResult:
    return ExtractionResult.model_validate(json.loads(recording_path(doc_id).read_text()))


def save_recording(doc_id: str, result: ExtractionResult) -> None:
    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
    recording_path(doc_id).write_text(
        json.dumps(result.model_dump(), indent=2, ensure_ascii=False) + "\n"
    )
