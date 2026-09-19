# SchemaSay

> Ask questions in plain English and get answers from your database — with charts, explanations, and an audit trail.

SchemaSay is a full-stack analytics app. You connect a database, ask questions in natural language or run SQL by hand, and review results with trust signals and history. The backend validates SQL, runs read-only queries, and logs each request. The frontend is a React workbench for day-to-day use.

**Demo:** [TODO: Add live demo URL or screen recording link]

---

## Features

- **Ask** — Natural-language questions turned into SQL, with results, charts, and a trust panel
- **SQL** — Manual SQL editor with formatting and execution
- **Schema** — Browse synced tables and columns for the active connection
- **Metrics** — Define reusable business metrics and preview them
- **Govern** — Set connection policies (blocked tables/columns, confidence rules)
- **Audit** — Query history, detail view, replay, and pipeline telemetry
- **Connections** — Add PostgreSQL, MySQL, SQL Server, SQLite, or CSV/Excel uploads; sync schema; manage business-language aliases
- **Auth** — Email/password login, token refresh, and optional Google sign-in
- **Feedback** — Rate whether an answer helped, with optional reason chips and SQL correction

Other UI helpers: saved queries and recent queries (stored in the browser), command palette, keyboard shortcuts, light/dark theme.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Backend | FastAPI, SQLAlchemy, Alembic, Pandas, SQLGlot, Python 3.10+ |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts |
| AI | OpenAI-compatible and Gemini-compatible providers; heuristic NL→SQL compiler when no API key is set |
| Platform database | PostgreSQL (via Docker Compose) or SQLite (simple local setup) |
| Target databases | PostgreSQL, MySQL, Microsoft SQL Server, SQLite, CSV/Excel upload |

---

## Screenshots

[TODO: Add screenshot — Ask workbench with results]

[TODO: Add screenshot — Connections and schema aliases]

[TODO: Add screenshot — Audit page with pipeline telemetry]

---

## Getting started

### Prerequisites

- Python 3.10 or later
- Node.js 22 or later (for the frontend)
- Optional: Docker (for PostgreSQL as the platform database)
- Optional: OpenAI or Gemini API key (for LLM-backed SQL and richer insights). Without a key, Ask uses the built-in heuristic compiler.

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd SchemaSay
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Edit `.env` and set real values (placeholders are rejected on startup):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Platform database (see options below) |
| `SECRET_KEY` | JWT signing key (32+ characters) |
| `ENCRYPTION_KEY` | Fernet key for stored connection passwords |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | Optional LLM providers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google sign-in |

Generate a Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Platform database options**

PostgreSQL (Docker):

```bash
docker compose up -d
```

Use the `DATABASE_URL` from `.env.example` (PostgreSQL on localhost).

SQLite (no Docker):

```env
DATABASE_URL=sqlite:///./backend/schemasay_local.db
```

Use an absolute path on Windows if you prefer, for example:

```env
DATABASE_URL=sqlite:///C:/path/to/SchemaSay/backend/schemasay_local.db
```

### 2. Backend

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt
alembic -c backend/alembic.ini upgrade head
```

Run the API:

```bash
# Windows PowerShell
$env:PYTHONPATH="backend"
uvicorn app.main:app --reload

# macOS / Linux
# PYTHONPATH=backend uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- Health: `GET /health`
- Readiness: `GET /ready`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: `http://localhost:5173`

In development, Vite proxies `/api` to the backend on port 8000.

### 4. First use

1. Open `http://localhost:5173` and create an account (or sign in with Google if configured).
2. Go to **Connections** and add a database or upload a CSV/Excel file.
3. Sync schema from the connection or Schema page.
4. Open **Ask**, pick a question, and review results, trust info, and audit history.

---

## How it works

```text
User → React UI → FastAPI
                    → Query pipeline (NL→SQL or raw SQL)
                    → SQL validation + schema grounding + policy checks
                    → Execute on target database (bounded rows)
                    → Results, chart, explanation, audit log
```

**NL→SQL path:** A heuristic compiler handles many questions offline. When LLM API keys are present, the system can route harder questions to OpenAI or Gemini and fall back to heuristics if needed.

**Security:** Only single `SELECT` statements are allowed. Writes, stacked queries, and many dangerous patterns are blocked. Connection hosts can be restricted with allowlists. Target database accounts should still be read-only.

---

## Project structure

```text
SchemaSay/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # REST endpoints
│   │   ├── core/
│   │   │   ├── ai/           # Heuristic compiler, query generator, insights
│   │   │   ├── pipeline/     # Query orchestration
│   │   │   ├── security/     # SQL validation
│   │   │   ├── schema/       # Schema graph and sync
│   │   │   ├── eval/         # Heuristic benchmark harness
│   │   │   └── ...
│   │   ├── models/           # SQLAlchemy models
│   │   └── schemas/          # Pydantic request/response types
│   ├── alembic/              # Platform DB migrations
│   ├── scripts/
│   │   └── run_heuristic_eval.py
│   └── tests/                # Backend test suite
├── frontend/
│   └── src/
│       ├── features/         # Ask, SQL, Schema, Metrics, Govern, Audit, Connections, Auth
│       ├── components/       # Shared UI
│       └── lib/              # API client, utilities
├── .env.example
├── docker-compose.yml        # Optional PostgreSQL for platform DB
└── .github/workflows/ci.yml
```

---

## API overview

All routes are under `/api/v1`. Main groups:

| Group | Purpose |
|-------|---------|
| `/auth` | Register, login, refresh, logout, Google OAuth, current user |
| `/connections` | CRUD, test, upload, aliases, policies, history |
| `/schema` | Sync, list, tree view |
| `/assistant` | Natural-language query, raw SQL execution |
| `/query` | Direct SQL execute and format |
| `/insights` | Summaries over result data |
| `/metrics` | Metric definitions and preview |
| `/audit` | List, detail, replay |
| `/feedback` | Submit feedback, fetch learning examples |

Full interactive docs: `http://localhost:8000/docs`

---

## Testing

Backend (195 tests):

```bash
# Windows PowerShell
$env:DATABASE_URL="sqlite:///:memory:"
$env:SECRET_KEY="test-secret-key-0123456789-0123456789"
$env:ENCRYPTION_KEY="7c2w6QFqE7d3hK2x5uXvGmYwQ8rTnZpL0sA1bC2dE3f="
$env:PYTHONPATH="backend"
python -m pytest -q backend/tests

# macOS / Linux
# DATABASE_URL=sqlite:///:memory: SECRET_KEY=test-secret-key-0123456789-0123456789 \
# ENCRYPTION_KEY=7c2w6QFqE7d3hK2x5uXvGmYwQ8rTnZpL0sA1bC2dE3f= \
# PYTHONPATH=backend pytest -q backend/tests
```

Frontend build check:

```bash
cd frontend
npm run build
```

Heuristic eval benchmark (offline, no API key needed):

```bash
python backend/scripts/run_heuristic_eval.py
```

**Eval results:** [TODO: Add pass rate summary after running the benchmark on your machine]

### CI

GitHub Actions runs on push and pull request:

- Backend: pytest, ruff, bandit, pip-audit, migration check (Python 3.10–3.12)
- Frontend job: [TODO: Update CI to run `npm run build` — current workflow still targets removed legacy frontend files]

---

## Configuration and limits

Default resource limits (override via environment variables in `backend/app/config.py`):

| Limit | Default |
|-------|---------|
| Upload size | 10 MB |
| Upload rows / columns | 100,000 / 100 |
| Query result rows / columns | 10,000 / 200 |
| Cell size | 32 KiB |
| Schema metadata entries | 20,000 |

Rate limiting uses Redis when `REDIS_URL` is set. Without Redis, an in-memory limiter is used (fine for single-process local runs).

For production-style deployments, set `ALLOWED_DB_HOSTS` and use read-only credentials on target databases.

---

## Known limitations

- Complex multi-table questions may need manual SQL or schema aliases.
- Insights work best with an LLM API key; some simple cases use rule-based summaries.
- Saved queries and recent queries live in browser storage only (not synced to the server).
- No hosted deployment guide yet — see placeholder below.

---

## Roadmap

| Status | Item |
|--------|------|
| Done | Ask, SQL, Schema, Metrics, Govern, Audit, Connections, auth, aliases, answer-focused feedback |
| Done | Heuristic compiler, eval harness, audit telemetry |
| TODO | Public demo deployment |
| TODO | Updated frontend CI (`npm run build`) |
| TODO | [Add your next priorities here] |

---

## Deployment

[TODO: Add deployment steps when you host this (e.g. Railway, Render, VPS). Include notes on PostgreSQL, Redis, TLS, and `ALLOWED_DB_HOSTS`.]

---

## License

MIT License — see [LICENSE](LICENSE).

---

## Author

[TODO: Your name]

[TODO: LinkedIn or portfolio link]

[TODO: GitHub profile link]
