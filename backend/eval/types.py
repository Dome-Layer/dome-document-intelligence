"""Data models for the evaluation harness.

Two families live here:
- **Ground-truth labels** (`GoldenDoc`, `ExpectedField`, ...) — what each golden
  document *should* extract; authored by hand under ``fixtures/labels/``.
- **Result / report models** (`FieldComparison`, `DocScore`, `EvalReport`, ...) —
  the structured output of the scorer / calibration / judge layers, serialised to
  ``eval_report.json``.

Importing this module has no side effects.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

MatchMode = Literal["exact", "normalized", "fuzzy"]
Modality = Literal["text", "image", "pdf", "xlsx"]

# Match the extractor's data_type vocabulary (models/schemas.ExtractedField.data_type).
DataType = Literal["currency", "date", "text", "identifier", "percentage"]


# ── Ground-truth label schema ─────────────────────────────────────────────────


class ExpectedProfile(BaseModel):
    doc_type: str
    language: str = "en"
    currency: Optional[str] = None


class ExpectedField(BaseModel):
    """One field the golden document is expected to yield.

    ``match`` routes value comparison: ``exact``/``normalized`` are scored
    deterministically (Layer 1b); ``fuzzy`` is deferred to the LLM judge (Layer 3).
    ``aliases`` lets the predicted field carry a differently-spelled name and still
    align to this label (e.g. ``total`` ~ ``invoice_total``).
    """

    name: str
    value: Optional[str] = None
    data_type: DataType = "text"
    is_critical: bool = False
    match: MatchMode = "normalized"
    aliases: list[str] = Field(default_factory=list)


class GoldenDoc(BaseModel):
    doc_id: str
    source: str  # path relative to fixtures/ e.g. "docs/invoice_001.txt"
    modality: Modality = "text"
    expected_profile: ExpectedProfile
    expected_reference_keys: dict[str, str] = Field(default_factory=dict)
    expected_fields: list[ExpectedField] = Field(default_factory=list)
    expected_human_in_loop: str = "not_required"


# ── Scoring / report models ───────────────────────────────────────────────────


class FieldComparison(BaseModel):
    doc_id: str
    name: str
    data_type: str
    match_mode: MatchMode
    is_critical: bool = False
    expected_value: Optional[str] = None
    predicted_value: Optional[str] = None
    predicted_confidence: Optional[float] = None
    present: bool = False  # a predicted field aligned to this expected name
    # correct is None while a fuzzy comparison is still deferred to the judge.
    correct: Optional[bool] = None
    method: str = ""  # exact | normalized | fuzzy-judge | deferred | missing | extra
    note: Optional[str] = None  # normalization detail or judge reason


class DocScore(BaseModel):
    doc_id: str
    modality: Modality
    doc_type_expected: str
    doc_type_predicted: str
    doc_type_correct: bool
    tp: int  # labeled key fields extracted with a correct value
    fp: int  # labeled key fields produced with a wrong value
    fn: int  # labeled key fields not correctly extracted (missing or wrong)
    extra_field_count: (
        int  # predicted fields with no labeled counterpart (over-extraction, not penalized)
    )
    precision: float
    recall: float
    f1: float
    value_matches: int
    value_total: int
    value_match_rate: float
    reference_keys_correct: int
    reference_keys_total: int
    reference_keys_accuracy: float
    hitl_expected: str
    hitl_predicted: str
    hitl_correct: bool
    comparisons: list[FieldComparison] = Field(default_factory=list)


class AggregateScore(BaseModel):
    n_docs: int
    n_expected_fields: int
    micro_precision: float
    micro_recall: float
    micro_f1: float
    macro_f1: float
    value_match_rate: float
    extra_field_count: int  # total over-extracted (unlabeled) fields across the set
    doc_type_accuracy: float
    hitl_agreement: float
    reference_keys_accuracy: float


class CalibrationBucket(BaseModel):
    band: str
    lo: float
    hi: float
    n: int
    mean_confidence: float
    accuracy: float
    gap: float  # |mean_confidence - accuracy|


class CalibrationReport(BaseModel):
    buckets: list[CalibrationBucket]
    ece: float  # expected calibration error
    n: int


class JudgeValidation(BaseModel):
    judge_model: str
    n_objective: int  # objective fields the judge was checked against
    n_agree: int
    agreement_rate: float
    n_fuzzy_judged: int  # fuzzy fields the judge then resolved
    threshold: float
    trustworthy: bool  # agreement_rate >= threshold


class EvalReport(BaseModel):
    generated_at: str
    generator_model: str
    judge_model: Optional[str] = None
    n_docs: int
    aggregate: AggregateScore
    calibration: CalibrationReport
    judge_validation: Optional[JudgeValidation] = None
    per_doc: list[DocScore] = Field(default_factory=list)
