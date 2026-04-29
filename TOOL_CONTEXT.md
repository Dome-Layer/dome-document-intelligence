# Dome Document Intelligence — TOOL_CONTEXT

*Tool-specific context document. Lives in this tool's repo alongside its code.*
*For cross-cutting Dome context (method, design system, architecture principles), see [dome-docs](../dome-docs/).*

---

## Identity

- **Tool name:** Dome Document Intelligence
- **Portfolio position:** P3
- **DOME phase:** Orchestrate & Model
- **Status:** in development (backend complete, frontend not yet built)
- **Repo:** TODO — add GitHub URL when repo is created
- **Demo URL:** TODO — add Railway/Vercel URLs when deployed

---

## Purpose

### Problem statement
Regulated EU enterprises receive high volumes of heterogeneous business documents — invoices, purchase orders, trade confirmations, letters of credit, contracts — and must extract structured data from them reliably, with full auditability, and without exposing document content to third-party systems. Current approaches are either manual (slow, error-prone) or rely on fixed templates that break when document layouts change.

### Solution
Dome Document Intelligence accepts any business document (PDF, image, XLSX, camera capture), auto-detects its type and structure via a two-pass LLM pipeline, extracts all significant fields with per-field confidence scores, validates the extraction against a configurable set of governance rules, and returns a fully structured result with an auditable governance event — all without retaining the document content itself.

### Value proposition
Turn any business document into validated, auditable structured data in seconds, without storing the document — optionally using a locally deployed AI with no data ever leaving the client's infrastructure.

### Target users
- Finance analysts and back-office teams at commodity traders and banks processing trade confirmations and letters of credit
- Procurement managers at manufacturing or retail corporates processing invoices and purchase orders
- Legal and compliance officers at regulated enterprises needing auditable document processing
- Any regulated EU enterprise needing to demonstrate governance over unstructured document intake

---

## User flow

### Standalone (demo)

1. User navigates to the upload page and drops a file (PDF, JPG, PNG, XLSX) or captures via camera.
2. The frontend POSTs the file to `/api/extract` with a Supabase bearer token.
3. The backend ingests the document: text extraction for PDFs (with vision fallback for scanned pages), direct vision for images, pandas serialisation for XLSX.
4. Pass 1 LLM call (Claude Sonnet) detects document type, industry, sections, language, and currency.
5. Pass 2 LLM call extracts all significant fields with confidence scores, data types, and reference keys.
6. The governance rules engine evaluates the extraction against the user's active rule set (10 pre-seeded rules).
7. A GovernanceEvent is logged to Supabase — metadata and hashes only, no document content.
8. The result page displays: document profile card, extraction table (field / value / confidence / type), governance flags (info / warning / error), and a human-in-loop banner if review is required.
9. User can navigate to the Rules page to toggle individual rules on/off.
10. User can navigate to the Audit page to review past extraction events.

### Called from Agent Flow (v2-ready)

TODO — integration contract not yet defined. The `/api/extract` endpoint is designed to accept multipart uploads from orchestrator agents; `workflow_run_id` propagation via metadata is architecture-ready.

---

## Architecture

### Tech stack (demo)
- **Frontend:** TODO — not yet built. Planned: Next.js 14 + TypeScript + Tailwind (per plan)
- **Backend:** Python 3.12 + FastAPI 0.115+ (fully implemented)
- **Database:** Supabase (`https://imhsfglekxcanatbsmri.supabase.co`) — governance_rules + governance_events tables
- **Key libraries:** PyMuPDF 1.24+ (PDF text extraction + scanned PDF rendering), pandas 2.2+ / openpyxl 3.1+ (XLSX), anthropic 0.40+ (Claude API), structlog 24.4+ (structured logging), pydantic 2.9+, python-multipart
- **Hosting:** Backend — Railway (Dockerfile deploy, health check `/api/health`). Frontend — TODO (planned: Vercel)

### LLM usage
- **Provider (demo):** Claude Sonnet (`claude-sonnet-4-5`) via Anthropic API — currently the only fully implemented provider
- **Provider (Azure tenant):** Azure OpenAI — stubbed (`NotImplementedError`), not implemented
- **Provider (air-gapped):** Ollama with `Llama 3.2 Vision` or `Qwen2-VL` — this is the **strategic differentiator** for this tool within the DOME portfolio: fully local AI, no data leaves client infrastructure. Currently stubbed (`NotImplementedError`); implementing this is a priority to distinguish this tool from the other DOME tools that rely on cloud AI.
- **Call pattern:**
  - Text documents: `generate_structured()` for both passes (forces JSON-only response)
  - Image / scanned PDF: `generate_vision()` for both passes (base64 image + text prompt)
- **Token budget per call:** Max tokens set to 16,384 per call; two calls per extraction = up to ~32k tokens. Actual usage depends on document length (content truncated to 8,000 chars for text documents).

### Data handling
- **What data enters the tool:** File uploads — PDF, JPEG, PNG, XLSX — up to 20 MB. Natural-language document content is passed to the LLM in-memory only.
- **What is retained:** User IDs (Supabase auth), governance rule configuration, governance event metadata (input_hash, doc_type, field_count, confidence, rules_triggered, human_in_loop, timestamp). No document content is persisted.
- **What is discarded:** All document content — raw bytes, extracted text, LLM responses — after the request completes.
- **Input hashing:** SHA-256 of the raw uploaded file bytes, stored as `input_hash` in GovernanceEvent. Computed in `governance.py` before the file bytes go out of scope.

### Deployment modes

| Mode | LLM | Storage | Auth |
|---|---|---|---|
| Cloud Demo | Claude API (`claude-sonnet-4-5`) | Supabase | Supabase magic link (via DOME website) |
| Client Azure Tenant | Azure OpenAI (stubbed — not implemented) | Azure PostgreSQL (TODO) | Azure AD SSO (TODO) |
| Air-Gapped | Ollama + Llama 3.2 Vision / Qwen2-VL (stubbed — not implemented) | SQLite (TODO) | Local auth (TODO) |

The `LLM_PROVIDER` env var switches providers; zero business logic changes required. Only the Claude provider currently works.

**Auth note:** Authentication uses Supabase magic link. The login page lives on the DOME website (not this tool's own frontend) — the user authenticates there and the resulting Supabase bearer token is passed to this tool's API. This is the same auth pattern used across all DOME tools.

---

## Governance

### Events emitted

- `action_type="document_extraction"` — triggered on every successful `POST /api/extract`; metadata includes: `doc_type`, `industry_hint`, `language`, `currency`, `field_count`, `reference_keys` (dict of detected identifiers), `sections` (list of sections detected), `processing_time_ms`

### Rules applied

The rules engine in `ValidationService` evaluates the following 10 pre-seeded rules (stored per-user in Supabase `governance_rules`, seeded on first `GET /api/rules`):

| Rule ID | Name | Severity | Condition |
|---|---|---|---|
| `low_confidence_field` | Low confidence field | warning | Any field with confidence < 0.70 |
| `very_low_confidence_field` | Very low confidence | error | Any field with confidence < 0.40 |
| `missing_critical_value` | Missing critical value | error | A field with `is_critical=true` has null/empty value |
| `currency_mismatch` | Currency mismatch | warning | Multiple distinct currencies detected in fields without explicit FX conversion |
| `future_date_anomaly` | Future date anomaly | warning | A date field parses to > 90 days in the future |
| `past_date_anomaly` | Past date anomaly | info | A date field parses to > 5 years in the past |
| `overall_low_confidence` | Low overall confidence | error | `overall_confidence` < 0.60 |
| `no_identifiers_found` | No identifiers found | warning | `reference_keys` dict is empty |
| `unsupported_language` | Non-Latin script | info | Document text contains CJK, Arabic, or Cyrillic characters |
| `amount_zero` | Zero amount detected | warning | A currency-type field has value "0", "0.00", or empty |

Rules are configurable per user (enabled/disabled via `PATCH /api/rules/{rule_id}`). Rule thresholds (confidence cutoffs) are stored in the `config` JSONB column and read at evaluation time. Full rule authoring (create/edit/delete) is out of scope for v1.

### Human-in-loop triggers

- `human_in_loop="required"` — any error-severity rule triggered (`very_low_confidence_field`, `missing_critical_value`, `overall_low_confidence`)
- `human_in_loop="recommended"` — any warning-severity rule triggered, no error rules triggered
- `human_in_loop="not_required"` — no rules triggered, or only info-level rules triggered

### Confidence scoring

`overall_confidence` is returned directly by the LLM in Pass 2. It is the LLM's self-assessed holistic confidence in the extraction (0.0–1.0). Per-field confidence is also LLM-assessed. There is no post-hoc aggregation formula currently — the LLM's own estimate is used as-is. TODO: consider validating or clamping LLM-reported confidence with a heuristic (e.g. average of per-field confidences as a cross-check).

---

## Frontend components (planned)

Not yet built. Planned stack: Next.js 14 + TypeScript + Tailwind, reusing the DOME design system from Process Analyzer.

| Component | Description |
|---|---|
| `UploadZone` | Drag-and-drop zone, click-to-browse, camera capture via `MediaDevices` API, format validation |
| `DocumentProfileCard` | Detected doc type, industry hint, language, currency, confidence badge |
| `ExtractionTable` | TanStack Table: field name, value, confidence bar, data type tag |
| `GovernanceFlagList` | Flags with severity colour coding (info / warning / error) |
| `HumanInLoopBanner` | Prominent banner shown when `human_in_loop` is `recommended` or `required` |
| `RulesToggleList` | Rule cards with name, description, severity badge, enable/disable switch |
| `AuditLogTable` | TanStack Table: timestamp, doc type, field count, flags triggered, confidence |
| `ConfidencePill` | Reusable badge: green ≥ 0.85, amber 0.60–0.84, red < 0.60 |

### Pages

| Route | Description |
|---|---|
| `/` | Upload page — drag-and-drop zone, camera button, format support list |
| `/result` | Extraction result — document profile, field table, governance flags, HITL status |
| `/rules` | Rules management — list of rules with enable/disable toggles and severity badges |
| `/audit` | Audit log — paginated table of past extraction events (no document content) |

---

## Reuse from Process Analyzer

The following are carried over from the Process Analyzer tool without changes (copy implementations, update agent IDs):

- `LLMProvider` abstract class + `ClaudeProvider`, `AzureOpenAIProvider`, `OllamaProvider`
- `get_llm_provider()` config factory
- `GovernanceEvent` Pydantic model
- Supabase client setup and auth middleware
- Supabase auth tables and magic link flow
- Frontend: DOME design system tokens (fonts, colours, component styles)
- Frontend: auth context, session handling, protected route wrapper
- `Dockerfile` structure
- `.env.example` structure

New in this project: PyMuPDF integration, camera capture, XLSX ingestion, two-pass LLM extraction pipeline, rules engine, rules management UI.

---

## Demo narrative

When demoing to a prospect:

1. **Upload** a document they recognise — an invoice if they're in procurement, a trade confirmation if they're in commodity finance.
2. **Watch** the system detect the document type without being told — "how did it know?"
3. **Review** extracted fields with confidence scores — show a low-confidence field to explain why human review exists.
4. **Show** the governance flags — explain that rules are configurable per client.
5. **Check** the audit log — show that nothing was stored except metadata.
6. **Open** the rules page — toggle a rule off and re-run — show real-time control.

Narrative: *"Dome treats every document as a governance event, not just a data extraction task."*

Suggested sample documents (5–6 across industries): invoice, purchase order, trade confirmation, letter of credit, contract, commodity report. TODO: create or source these for demo seeding.

---

## Integrations with other DOME tools

### Calls out to
None currently. The tool is self-contained.

### Called from
None currently. Planned for Agent Flow orchestration in v2 — the `/api/extract` multipart endpoint is the integration point.

### Shared workflow ID
Not yet implemented. The `metadata` JSONB field in `governance_events` is the intended carrier for `workflow_run_id` when Agent Flow integration is added.

---

## Configuration

### Environment variables

- `LLM_PROVIDER` — which provider to use (`claude` / `azure_openai` / `ollama`). Default: `claude`. Only `claude` is functional.
- `ANTHROPIC_API_KEY` — Anthropic API key. Required when `LLM_PROVIDER=claude`.
- `AZURE_OPENAI_ENDPOINT` — Azure OpenAI endpoint URL. Required when `LLM_PROVIDER=azure_openai` (provider not yet implemented).
- `AZURE_OPENAI_KEY` — Azure OpenAI API key. Required when `LLM_PROVIDER=azure_openai`.
- `AZURE_OPENAI_DEPLOYMENT` — Azure OpenAI deployment name. Required when `LLM_PROVIDER=azure_openai`.
- `OLLAMA_URL` — Ollama server URL. Default: `http://localhost:11434`. Required when `LLM_PROVIDER=ollama` (provider not yet implemented).
- `SUPABASE_URL` — Supabase project URL (e.g. `https://imhsfglekxcanatbsmri.supabase.co`).
- `SUPABASE_ANON_KEY` — Supabase anon/public key. Used for client-side auth validation.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key. Used by backend for direct DB writes (bypasses RLS).
- `ENVIRONMENT` — `development` or `production`. Controls log format (console vs JSON).
- `CORS_ORIGINS` — Comma-separated allowed origins. Default: `http://localhost:3000`.
- `MAX_FILE_SIZE_MB` — Maximum upload size in megabytes. Default: `20`.

### Config files

- `backend/supabase_schema.sql` — DDL for `governance_rules` and `governance_events` tables, indexes, and RLS setup. Run manually in Supabase SQL editor on first setup.
- `backend/railway.toml` — Railway deployment config: Dockerfile builder, start command, health check path (`/api/health`), restart policy.
- Rule thresholds are stored in the `config` JSONB column of `governance_rules` and read at evaluation time. The 10 default rules are seeded by `ValidationService` on first `GET /api/rules` if no rules exist for the user.

---

## Tool-specific prompts

### Pass 1 — Type Detection (text)
**Used for:** Identifying document type, industry, sections, language, and currency from extracted text  
**Model:** `claude-sonnet-4-5`  
**System prompt:** `"You are a document intelligence specialist. You extract structured data from business documents with high precision. You always respond with valid JSON only — no markdown, no explanation."`  
**Prompt:**
```
Analyse this business document and identify its type, structure, language, and currency.

Return JSON matching exactly this structure:
{
  "doc_type": "string — e.g. invoice, purchase_order, trade_confirmation, letter_of_credit, contract, commodity_report, other",
  "industry_hint": "string or null — e.g. commodity_finance, procurement, legal, logistics, banking, insurance, other",
  "sections": "array of strings — sections present e.g. header, line_items, payment_terms, signatures, schedules",
  "language": "string — ISO 639-1 code e.g. en, fr, de",
  "currency": "string or null — ISO 4217 code e.g. USD, EUR, GBP"
}

Document content:
---
[first 8000 chars of extracted text]
---
```

### Pass 1 — Type Detection (vision)
**Used for:** Same as above but for image inputs and scanned PDFs  
**Model:** `claude-sonnet-4-5` (vision)  
**System prompt:** Same as above  
**Prompt:**
```
Analyse this business document image and identify its type, structure, language, and currency.

Return JSON matching exactly this structure:
[same schema as text version]
```

### Pass 2 — Field Extraction (text)
**Used for:** Extracting all significant fields from a document given its detected profile  
**Model:** `claude-sonnet-4-5`  
**System prompt:** Same system prompt as Pass 1  
**Prompt:**
```
Extract all significant fields from this business document.

Document profile (use as context):
[DocumentProfile JSON]

For each field extract: name (snake_case), value, confidence (0.0-1.0), location_hint, data_type, is_critical.
Also identify reference_keys — structured identifiers (PO numbers, invoice IDs, ISINs, contract references, etc.)

Return JSON matching exactly this structure:
{
  "fields": [{"name": "...", "value": "...", "confidence": 0.0-1.0, "location_hint": "...", "data_type": "...", "is_critical": bool}],
  "overall_confidence": 0.0-1.0,
  "reference_keys": {"invoice_number": "INV-...", ...}
}

Document content:
---
[first 8000 chars]
---
```

### Pass 2 — Field Extraction (vision)
**Used for:** Same as above but for image inputs  
**Model:** `claude-sonnet-4-5` (vision)  
**System prompt:** Same as above  
**Prompt:** Same structure as text version, without the document content block (image passed as base64 separately)

---

## Known limitations

- **Text truncation:** Document content is truncated to 8,000 characters for text-based extraction. Long contracts, multi-page reports, or dense XLSX files may have fields from later pages missed.
- **Scanned PDF quality:** Vision fallback triggers when PyMuPDF extracts < 100 characters. Low-resolution scans or heavily compressed images will reduce extraction quality.
- **LLM-reported confidence:** Per-field and overall confidence values are LLM self-assessments, not algorithmically computed. They may be poorly calibrated, especially for ambiguous document types.
- **XLSX multi-sheet:** Only the first sheet is serialised by the pandas ingest path. Multi-sheet workbooks lose data from sheets 2+.
- **Non-Latin scripts:** Flagged by `unsupported_language` rule but extraction is still attempted. Quality for Arabic, Chinese, Japanese, Korean, Cyrillic is untested.
- **Ollama provider (priority):** Stubbed — implementing local AI inference is the key differentiator for this tool and should be prioritised. Target models: Llama 3.2 Vision, Qwen2-VL.
- **Azure OpenAI provider:** Stubbed — no timeline for implementation.
- **No frontend yet:** The backend is complete; the Next.js frontend described in the plan has not been built.
- **Auth in development:** CORS is currently set to `http://localhost:3000`; no production frontend URL configured yet.
- **No bulk processing:** One document per request. Batch workflows not supported in v1.
- **Rule authoring:** Users can enable/disable rules but cannot create, edit, or delete rules via the UI in v1.

The following are explicitly out of scope for v1:
- Cross-document matching / PO-invoice reconciliation (architecture hook in place via `reference_keys`)
- Bulk upload / batch processing
- Export to ERP systems
- Multi-language UI
- Role-based access control within a team

---

## Open questions

- What is the Railway deployment URL for the backend? (not yet confirmed)
- What Vercel project will host the frontend? (not yet created)
- Should the `overall_confidence` field cross-check the LLM's self-reported value against the mean of per-field confidences?
- Should XLSX ingest support multiple sheets? If so, how should multi-sheet content be serialised?
- What sample documents will be used for demo seeding (Section 11 of plan references 5–6 documents across industries)?
- What is the portfolio P-number for this tool?
- When will the Ollama provider be implemented? (Priority — it's the differentiator for this tool in the portfolio.)
- Which Ollama model will be used for the demo: Llama 3.2 Vision or Qwen2-VL? What hardware is the target for air-gapped deployment?
- When will the Azure OpenAI provider be implemented for the enterprise tenant mode?
- Should `workflow_run_id` be added to the `POST /api/extract` request body now (as an optional field) to make Agent Flow integration easier later?

---

## Changelog

- **2026-04-24:** Initial TOOL_CONTEXT.md filled from DOME_DOCUMENT_INTELLIGENCE_PLAN.md and backend codebase (backend complete, frontend not yet built)
