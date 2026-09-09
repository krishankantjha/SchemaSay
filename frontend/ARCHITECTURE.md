# SchemaSay Frontend Architecture

## Baseline

The current frontend baseline is the latest validated commit on `main`. Local audit artifacts are not product changes and must remain untracked.

## Purpose

This document freezes the frontend implementation boundary for the remediation work. The goal is to make the existing product reliable and polished without introducing a large frontend framework or changing the Streamlit and Render deployment model.

## Approved technology stack

| Layer | Technology | Rule |
|---|---|---|
| Hosting shell | Streamlit Python application | Keep `frontend/app.py` as the delivery entry point. |
| UI markup | Semantic HTML5 | Use real buttons, labels, headings, forms, dialogs, tables, and navigation elements where appropriate. |
| Styling | Custom CSS with shared variables/tokens | Improve and extend the existing CSS system; do not add Tailwind or another CSS framework. |
| Application logic | Modern Vanilla JavaScript | Keep the current global-module approach, but enforce clear module ownership and shared helpers. |
| HTTP | Native `fetch` through the central API client | All backend calls must go through one transport layer. |
| SQL editing | CodeMirror `5.65.16` | Retain it for the SQL Workbench and generated SQL editor. |
| Visualization | Chart.js `4.4.0` | Retain it for query and analytics charts, with an explicit supported chart contract. |
| Backend | Existing FastAPI API | The frontend must conform to backend response models rather than silently guessing fields. |

React, Vue, Angular, Next.js, Tailwind, and a frontend rewrite are explicitly out of scope for this remediation cycle. A future Vite/TypeScript migration may be considered only as a separate project after the current application is stable.

## Current delivery model

`frontend/app.py` reads the static HTML shell, injects `window.SCHEMASAY_CONFIG`, inlines local CSS and JavaScript, and renders the result with `streamlit.components.v1.components.html`. The browser application therefore runs inside a Streamlit iframe. Local frontend assets must remain resolvable by this bundling process.

The deployed frontend must set the following environment variables explicitly:

| Variable | Required production value | Purpose |
|---|---|---|
| `SCHEMASAY_API_BASE_URL` | The deployed HTTPS FastAPI base URL ending in `/api/v1` | Prevents browser requests from falling back to the end user’s `localhost`. |
| `SCHEMASAY_DEMO_MODE` | `false` | Prevents the browser from using the shipped demonstration fixtures. |
| Backend `ALLOWED_ORIGINS` | The exact deployed Streamlit origin, plus any approved local origins | Allows credentialed browser requests from the frontend iframe. |

No secret, database password, LLM key, or private backend credential may be placed in frontend source, HTML, JavaScript, or this template.

## Module ownership

| Module | Responsibility | Boundary |
|---|---|---|
| `api.js` | HTTP requests, authentication headers, refresh, response normalization, and demo isolation | No UI rendering. |
| `state.js` | Shared application state and session lifecycle | No direct network calls. |
| `auth.js` | Login, registration, logout, session checks, and identity display | Must be initialized before session checks. |
| `app.js` | Bootstrap, navigation, layout, and page routing | Must not duplicate API contract logic. |
| `connections.js` | Connection list, creation, testing, upload, deletion, and health display | Must use fields guaranteed by backend contracts. |
| `schema.js` | Schema loading, normalization, search, selection, and synchronization | Consumes one normalized table/column shape. |
| `copilot.js` | Natural-language query and generated SQL workflow | Must distinguish UI progress animation from backend telemetry. |
| `query.js` | Result table, chart, pagination, export, and optional insights | Must display truncation and avoid unsolicited expensive work. |
| `history.js` | Server-backed query history, search, filtering, viewing, and rerun | Must not present unbound controls. |
| `settings.js` | Only settings and analytics features that have real backing behavior | Placeholder controls must be removed or clearly marked. |
| `charts.js` | Chart.js lifecycle and supported chart configurations | Supported types must match backend and visible controls. |
| `ui.js` | Escaping, modal, dropdown, toast, loading, and common DOM helpers | Dynamic user/data values must be escaped or assigned with `textContent`. |

## Data and UI invariants

The following rules apply to every subsequent phase:

1. Production UI must never silently substitute demo data for missing backend data.
2. Every displayed backend field must exist in an explicit frontend contract or be normalized in `api.js`.
3. Schema state uses one canonical shape: `{ [tableName]: Array<{ name, type, pk?, fk? }> }`.
4. Connection health must come from an explicit backend health result; it must not be inferred from metadata or an undefined `connected` property.
5. Loading, empty, success, failure, unauthorized, rate-limited, and truncated-result states must be distinct.
6. Every visible button must either perform a working action or be removed/clearly identified as unavailable before release.
7. User-controlled and backend-returned text must not be interpolated into HTML without escaping.
8. The visual system remains the existing green/teal analytics identity with shared spacing, typography, color, radius, focus, and motion tokens.
9. CodeMirror and Chart.js remain the only substantial browser libraries unless a later phase documents a specific need and approval.
10. Changes to `main` must follow the repository’s merge-first review and release-validation workflow.

## Quality gates

Every frontend change should exercise the relevant success and error paths locally and review changed contract assumptions against the FastAPI backend. Before release, run frontend syntax and contract checks, authenticated API integration checks where credentials are available, responsive and accessibility checks, demo-mode isolation checks, deployment-variable verification, and a clean tracked working tree. Local audit artifacts may remain untracked and must not be included in product commits.
