// Types mirroring backend Pydantic schemas (schemas.py)

export interface DocumentProfile {
  doc_type: string
  industry_hint: string | null
  sections: string[]
  language: string
  currency: string | null
}

export interface ExtractedField {
  name: string
  value: string | null
  confidence: number
  location_hint: string | null
  data_type: string
  is_critical: boolean
}

export interface ExtractionResult {
  fields: ExtractedField[]
  overall_confidence: number
  reference_keys: Record<string, string>
  document_profile: DocumentProfile
}

export interface ValidationFlag {
  rule_id: string
  rule_name: string
  severity: 'info' | 'warning' | 'error'
  field_name: string | null
  message: string
}

export interface DocumentIntelligenceResult {
  extraction: ExtractionResult
  flags: ValidationFlag[]
  human_in_loop: 'not_required' | 'recommended' | 'required'
  processing_time_ms: number
}

export interface GovernanceRule {
  id: string
  rule_id: string
  name: string
  description: string
  severity: 'info' | 'warning' | 'error'
  enabled: boolean
  config: Record<string, unknown>
}

export interface GovernanceEvent {
  id?: string
  agent_id: string
  action_type: string
  timestamp: string
  input_hash: string
  input_type: string
  output_summary: string
  rules_applied: string[]
  rules_triggered: string[]
  confidence: number | null
  human_in_loop: string
  user_id: string | null
  metadata: Record<string, unknown>
}

export interface AuditListResponse {
  events: GovernanceEvent[]
  total: number
  page: number
  page_size: number
}

export interface RulesListResponse {
  rules: GovernanceRule[]
}

// ── Saved extractions ─────────────────────────────────────────────────────────

export interface SavedExtractionSummary {
  id: string
  filename: string | null
  doc_type: string
  industry_hint: string | null
  overall_confidence: number
  human_in_loop: 'not_required' | 'recommended' | 'required'
  processing_time_ms: number
  saved_at: string
}

export interface SavedExtractionDetail extends SavedExtractionSummary {
  result: DocumentIntelligenceResult
}

export interface SavedExtractionsListResponse {
  extractions: SavedExtractionSummary[]
  total: number
  page: number
  page_size: number
}
