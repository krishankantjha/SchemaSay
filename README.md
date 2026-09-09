# SchemaSay

SchemaSay is a natural-language analytics application for querying approved databases and presenting bounded results with charts and AI-generated summaries. The backend validates generated and manually supplied SQL, executes it through SQLAlchemy, records query history, and exposes a FastAPI API. The frontend is a Streamlit wrapper around a bundled HTML/CSS/JavaScript application.

## Security model

SchemaSay is designed for **approved database targets**, not unrestricted arbitrary connectivity. In a hosted deployment, operators should configure an explicit `ALLOWED_DB_HOSTS` allowlist and enforce corresponding network egress rules. Private, loopback, link-local, reserved, multicast, and unspecified remote addresses are blocked unless an operator explicitly allowlists the destination. SQLite paths are confined to the application-owned data directory by default; additional roots must be configured with absolute paths.

The SQL gate accepts one parsed, dialect-specific `SELECT` statement only. It rejects stacked statements, writes, `UNION`, transaction/control statements, row-locking clauses, file-access functions, timing functions, procedures, and SQLite pragmas. The target database credentials should still be read-only because application parsing is a defense-in-depth control rather than a database authorization boundary.

The backend enforces bounded upload bytes, upload rows and columns, query rows and columns, cell size, schema metadata entries, insight payload rows, and request SQL length. Query and LLM execution routes are rate-limited. A Redis-backed limiter is used when `REDIS_URL` is configured; without Redis, the bounded in-memory limiter is suitable only for a single-process local deployment.

Refresh tokens are stored as SHA-256 hashes and consumed atomically during rotation. Existing plaintext refresh-token rows are invalidated by the migration that introduces the hashed column. Access tokens include issuer and audience claims and use the fixed HS256 algorithm configured by the application.

## Technology stack

| Layer | Technologies |
|---|---|
| Backend | FastAPI, SQLAlchemy, Alembic, Pandas, SQLGlot, Python 3.10+ |
| Frontend | Streamlit wrapper, vanilla HTML/CSS/JavaScript, Chart.js, CodeMirror |
| AI | OpenAI-compatible provider and optional Gemini-compatible provider |
| Metadata database | PostgreSQL in normal deployment; SQLite is supported for isolated local tests |
| Target databases | PostgreSQL, MySQL, Microsoft SQL Server, SQLite, and application-owned uploads |

## Repository structure

```text
schemasay/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI route handlers
│   │   ├── core/             # Authentication, connectors, SQL, AI, schema, charts
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic request and response schemas
│   │   └── utils/            # Shared utilities and rate limiting
│   ├── alembic/              # Versioned metadata-database migrations
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── app.py                # Streamlit entry point and HTML bundler
│   ├── index.html
│   ├── js/                   # Frontend modules
│   ├── css/
│   └── requirements.txt
├── .env.example
├── docker-compose.yml
└── pyproject.toml
```

## Local setup

### Prerequisites

Use Python 3.10 or later, Docker Compose for local PostgreSQL, and an optional OpenAI-compatible or Gemini-compatible API key for AI features. The application can run in heuristic/offline mode when no LLM provider is configured.

### Configure the environment

Copy the template and replace every placeholder with a generated value. `SECRET_KEY` must be at least 32 characters. `ENCRYPTION_KEY` must be a valid Fernet key.

```bash
cp .env.example .env
```

For a hosted deployment, configure `ALLOWED_DB_HOSTS` explicitly. For local SQLite files, leave `ALLOWED_SQLITE_ROOTS` empty to use the application-owned data directory, or provide absolute approved directories. Configure `REDIS_URL` when running multiple workers or instances.

### Start PostgreSQL

The Compose service binds its port to localhost only and uses the `POSTGRES_*` variables from `.env`.

```bash
docker compose up -d
```

### Install and run the backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt
alembic -c backend/alembic.ini upgrade head
PYTHONPATH=backend uvicorn app.main:app --reload
```

Schema changes are managed by Alembic. The application does not call `create_all()` during production startup. Check `/health` for liveness and `/ready` for metadata-database readiness.

### Install and run the frontend

```bash
python -m venv frontend/.venv
source frontend/.venv/bin/activate
pip install -r frontend/requirements.txt
SCHEMASAY_API_BASE_URL=http://localhost:8000/api/v1 \
SCHEMASAY_DEMO_MODE=false \
streamlit run frontend/app.py
```

Demo mode is disabled by default. Set `SCHEMASAY_DEMO_MODE=true` only for an intentionally isolated demonstration; the UI should display demo data only in that mode.

## Testing and quality checks

The backend test harness supplies an isolated SQLite metadata database and test-only connector roots, so the ordinary test command is self-contained:

```bash
PYTHONPATH=backend pytest -q backend/tests
python -m compileall -q backend/app backend/tests
node --check frontend/js/*.js
ruff check backend/app backend/tests
bandit -r backend/app
pip-audit -r backend/requirements.txt
```

CI should run these checks on every change, together with a PostgreSQL migration job and a browser smoke test using `SCHEMASAY_DEMO_MODE=false`.

## API health and limits

`GET /health` is a lightweight liveness endpoint. `GET /ready` verifies that the metadata database can execute a simple query. Production deployments should place the API behind TLS termination, configure trusted proxy behavior explicitly, enforce network egress restrictions, and use a read-only account on each target database.

The default resource limits are intentionally conservative and can be adjusted through environment variables: uploads are capped at 10 MB, uploads at 100,000 rows and 100 columns, query results at 10,000 rows and 200 columns, cells at 32 KiB, schema metadata at 20,000 entries, and insight requests at 5,000 rows. Raising these limits should be accompanied by load testing and worker-level memory controls.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
