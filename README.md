# Dome Document Intelligence

*Extracts structured data from any business document — with per-field confidence scores, governance validation, and a full audit trail — without storing the document.*

Part of the Dome portfolio. For full tool specification see [`TOOL_CONTEXT.md`](./TOOL_CONTEXT.md). For cross-cutting Dome context see [dome-docs](../dome-docs/).

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
| Frontend (Next.js) | Not yet built |
| Claude provider | Working |
| Ollama provider | Stubbed — in progress |
| Azure OpenAI provider | Stubbed |

---

## Quick start

### Requirements

- Python 3.12
- Node.js 20+ *(once frontend is built)*
- Ollama *(optional — for local AI mode)*

### Setup

```bash
# Clone
git clone https://github.com/dome-layer/[repo-name].git
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
```

API will be available at `http://localhost:8000`. Health check: `GET /api/health`.

*Frontend not yet built. Use a REST client (curl, Bruno, Postman) to call the API directly during development.*

---

## Environment variables

Create `backend/.env` from `.env.example`. Required variables:

```bash
# LLM — choose one mode
LLM_PROVIDER=claude              # claude | azure_openai | ollama

# Claude (cloud demo)
ANTHROPIC_API_KEY=sk-ant-...

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

Run [`backend/supabase_schema.sql`](./backend/supabase_schema.sql) in your Supabase SQL editor to create the required tables (`governance_rules`, `governance_events`) and indexes. Governance rules for each user are seeded automatically on first `GET /api/rules`.

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
├── TOOL_CONTEXT.md             Full tool specification (read this first)
├── README.md                   This file
└── backend/                    FastAPI service
    ├── app/
    │   ├── main.py             App entry point, lifespan, CORS
    │   ├── api/                Route handlers (extract, rules, audit)
    │   ├── core/               Config, DB client, logging
    │   ├── models/             Pydantic schemas
    │   ├── providers/          LLM provider implementations
    │   └── services/           Ingest, extraction, validation, governance
    ├── supabase_schema.sql     DB setup — run once in Supabase SQL editor
    ├── Dockerfile
    ├── railway.toml
    └── requirements.txt
```

*`frontend/` does not exist yet. Planned: Next.js 14 + TypeScript + Tailwind.*

---

## Related

- [dome-docs](../dome-docs/) — cross-cutting Dome documentation
- [`TOOL_CONTEXT.md`](./TOOL_CONTEXT.md) — full spec for this tool
- [Portfolio status](../dome-docs/PORTFOLIO_STATUS.md)
