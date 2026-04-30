from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Document extraction models ────────────────────────────────────────────────

class DocumentProfile(BaseModel):
    doc_type: str
    industry_hint: Optional[str] = None
    sections: list[str] = []
    language: str = "en"
    currency: Optional[str] = None


class ExtractedField(BaseModel):
    name: str
    value: Optional[str] = None
    confidence: float
    location_hint: Optional[str] = None
    data_type: str  # "currency" | "date" | "text" | "identifier" | "percentage"
    is_critical: bool = False


class ExtractionResult(BaseModel):
    fields: list[ExtractedField]
    overall_confidence: float
    reference_keys: dict[str, str] = {}
    document_profile: DocumentProfile


class ValidationFlag(BaseModel):
    rule_id: str
    rule_name: str
    severity: str  # "info" | "warning" | "error"
    field_name: Optional[str] = None
    message: str


class DocumentIntelligenceResult(BaseModel):
    extraction: ExtractionResult
    flags: list[ValidationFlag]
    human_in_loop: str  # "not_required" | "recommended" | "required"
    processing_time_ms: int


# ── Governance models ─────────────────────────────────────────────────────────

class GovernanceEvent(BaseModel):
    agent_id: str
    action_type: str
    timestamp: datetime
    input_hash: str
    input_type: str
    output_summary: str
    rules_applied: list[str]
    rules_triggered: list[str]
    confidence: Optional[float] = None
    human_in_loop: str
    user_id: Optional[str] = None
    workflow_run_id: Optional[str] = None
    metadata: dict = {}


# ── Rules models ──────────────────────────────────────────────────────────────

class GovernanceRule(BaseModel):
    id: str
    rule_id: str
    name: str
    description: str
    severity: str
    enabled: bool
    config: dict = {}


class RuleToggleRequest(BaseModel):
    enabled: bool


# ── API response models ───────────────────────────────────────────────────────

class RulesListResponse(BaseModel):
    rules: list[GovernanceRule]


class AuditListResponse(BaseModel):
    events: list[GovernanceEvent]
    total: int
    page: int
    page_size: int


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"


# ── Saved extractions models ──────────────────────────────────────────────────

class SaveExtractionRequest(BaseModel):
    filename: Optional[str] = None
    result: dict


class SavedExtractionSummary(BaseModel):
    id: str
    filename: Optional[str] = None
    doc_type: str
    industry_hint: Optional[str] = None
    overall_confidence: float
    human_in_loop: str
    processing_time_ms: int
    saved_at: str


class SavedExtractionDetail(SavedExtractionSummary):
    result: dict


class SavedExtractionsListResponse(BaseModel):
    extractions: list[SavedExtractionSummary]
    total: int
    page: int
    page_size: int
