# Dome Document Intelligence

*Extracts structured data from any business document — with per-field confidence scores, governance validation, and a full audit trail — without storing the document.*

Covers the **Orchestrate & Model** phases of the DOME method. Part of the [Dome portfolio](../dome-docs/). For cross-cutting Dome context see [dome-docs](../dome-docs/).

---

## What it does

Upload a PDF, image, or spreadsheet and the tool:

1. Auto-detects the document type (invoice, purchase order, trade confirmation, contract, etc.) — no templates or configuration needed
2. Extracts all significant fields with per-field confidence scores
3. Validates the extraction against a configurable set of governance rules
4. Logs an audit event (metadata and hash only — document content is never stored)
5. Flags whether human review is required

The key differentiator within the Dome portfolio: this tool is designed to run with a **locally deployed AI** (Ollama), meaning no document content ever leaves the client's infrastructure. Cloud (Claude API) and Azure OpenAI modes are also supported via a provider switch.

---

## Status

| Layer | Status |
|---|---|
| Backend (FastAPI) | Complete |
| Frontend (Next.js) | Complete |
| Claude provider | Working |
| Ollama provider | Stubbed — in progress |
| Azure OpenAI provider | Stubbed |

---

## Evaluation

Extraction quality and the governance rules engine are measured by an auditable, four-layer
evaluation harness in [`backend/eval/`](backend/eval/) — see **[EVAL.md](EVAL.md)** for the full
methodology and a sample report.

- **Rules engine** — all 16 governance rules are unit-tested (CI-gated, deterministic).
- **Extraction** — scored against a committed golden set with type-aware normalization: field
  precision/recall/F1, value-match, doc-type accuracy, end-to-end human-in-loop agreement.
- **Confidence calibration** — a reliability table + ECE that checks the model's *stated*
  confidence against its *actual* accuracy.
- **Validated LLM judge** — checked against ground truth before it is trusted for fuzzy fields;
  each live run logs one governance `eval_judgment` event.

```bash
cd backend
make eval         # live: re-run the model + validated judge → eval_report.{json,md}
make eval-score   # offline: score the committed recordings (no network)
```

CI runs the deterministic layers against recorded outputs and **never** calls a live model.

---

## Quick start

### Requirements

- Python 3.12
- Node.js 20+
- Ollama *(optional — for local AI mode)*

### Setup

```bash
# Clone
git clone https://github.com/Dome-Layer/dome-document-intelligence.git
cd dome-document-intelligence

# Backend
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Environment
cp .env.example .env
# Edit .env with your values — see Environment variables below
```

### Run locally

```bash
# Backend (from backend/)
uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/)
npm install
npm run dev
```

Backend API: `http://localhost:8000`. Health check: `GET /api/health`.
Frontend: `http://localhost:3000`.

---

## Environment variables

Create `backend/.env` from `.env.example`. Required variables:

```bash
# LLM — choose one mode
LLM_PROVIDER=claude              # claude | azure_openai | ollama

# Claude (cloud demo)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6   # optional — override the Claude model

# Azure OpenAI (client tenant — not yet implemented)
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=
AZURE_OPENAI_DEPLOYMENT=

# Ollama (local / air-gapped — not yet implemented)
OLLAMA_URL=http://localhost:11434

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
ENVIRONMENT=development          # development | production
CORS_ORIGINS=http://localhost:3000
MAX_FILE_SIZE_MB=20
```

Never commit real secrets. `backend/.env` is gitignored; `.env.example` is not.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/extract` | Upload a document and run extraction |
| `GET` | `/api/rules` | List governance rules for the authenticated user |
| `PATCH` | `/api/rules/{rule_id}` | Toggle a rule enabled/disabled |
| `GET` | `/api/audit` | Paginated governance event log |
| `GET` | `/api/audit/{event_id}` | Single audit event detail |
| `GET` | `/api/health` | Health check |

All endpoints except `/api/health` require a Supabase bearer token. Authentication uses Supabase magic link, triggered from the DOME website login page.

### Example extraction call

```bash
curl -X POST http://localhost:8000/api/extract \
  -H "Authorization: Bearer <supabase-token>" \
  -F "file=@invoice.pdf"
```

---

## Database setup

Run the canonical DOME governance schema — [`dome-docs/templates/governance_schema.sql`](../dome-docs/templates/governance_schema.sql) — in your Supabase SQL editor to create the required tables (`governance_rules`, `governance_events`) and indexes. For in-place upgrades to an existing deployment, apply the numbered files in [`dome-docs/migrations/`](../dome-docs/migrations/). Governance rules for each user are seeded automatically on first `GET /api/rules`.

---

## Deployment

### Cloud demo

- Backend: Railway (Dockerfile deploy, EU region)
- Frontend: Vercel (EU region) — *not yet deployed*

### Client Azure tenant

Azure OpenAI provider not yet implemented. See `TOOL_CONTEXT.md` for planned architecture.

### Air-gapped / local AI

Ollama provider not yet implemented. Target models: Llama 3.2 Vision, Qwen2-VL. See `TOOL_CONTEXT.md` for planned architecture.

---

## Repository structure

```
dome-document-intelligence/
├── README.md                   This file
├── EVAL.md                     Evaluation methodology + sample report
├── LICENSE
├── SECURITY.md
├── backend/                    FastAPI service
│   ├── Makefile                eval / eval-score / test / lint targets
│   ├── eval/                   Evaluation harness (golden set, scorer, calibration, judge)
│   ├── app/
│   │   ├── main.py             App entry point, lifespan, CORS
│   │   ├── api/                Route handlers (extract, rules, audit)
│   │   ├── core/               Config, DB client, logging
│   │   ├── models/             Pydantic schemas
│   │   ├── providers/          LLM provider implementations
│   │   └── services/           Ingest, extraction, validation, governance
│   ├── supabase_schema.sql     Pointer stub — canonical schema lives in dome-docs/templates/
│   ├── Dockerfile
│   ├── railway.toml
│   └── requirements.txt
└── frontend/                   Next.js application
    ├── app/                    Pages (upload, result, rules, audit)
    ├── components/             UI components (upload, result, layout, auth)
    ├── context/                Auth context
    ├── lib/                    API client, auth helpers, types
    └── styles/
```

---

## Related

- [dome-docs](../dome-docs/) — cross-cutting Dome documentation
- [Portfolio status](../dome-docs/PORTFOLIO_STATUS.md)
