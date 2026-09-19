# SchemaSay codebase triage

Action checklist before starting new features. Last updated: 2026-09-16.

**Legend**
- **KEEP** — core product; maintain as-is
- **FINISH** — half-built; wire the loop or expose in UI/API
- **FREEZE** — valid but premature; no new work until core loop is proven
- **DELETE** — dead code or safe to remove after quick verification

---

## Priority order (do these first)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Finish connection schema aliases (API + UI) | 1–2 days | High accuracy win |
| 2 | Expose audit telemetry fields in API + Audit page | 0.5 day | Closes observability loop |
| 3 | Collapse user-facing confidence to one score | 0.5 day | Less UI confusion |
| 4 | Wire feedback → verified learning examples | 1 day | Production improvement loop |
| 5 | Delete dead eval/frontend stubs | 1 hour | Less noise |

---

## Backend — heuristic compiler (KEEP)

Core NL→SQL path. Do not delete or merge aggressively.

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/ai/heuristic_compiler.py` | **KEEP** | Main compiler |
| `app/core/ai/heuristic_intent.py` | **KEEP** | Intent classification |
| `app/core/ai/heuristic_resolution.py` | **KEEP** | Table/column scoring |
| `app/core/ai/heuristic_filters.py` | **KEEP** | WHERE clauses |
| `app/core/ai/heuristic_aggregations.py` | **KEEP** | SELECT/GROUP BY/HAVING |
| `app/core/ai/heuristic_dates.py` | **KEEP** | Date bucketing |
| `app/core/ai/heuristic_validation.py` | **KEEP** | Grounding + calibration (internal) |
| `app/core/ai/heuristic_routing.py` | **KEEP** | L1/L2/L3/LLM routing |
| `app/core/ai/query_generator.py` | **KEEP** | Heuristic + LLM orchestration |
| `app/core/ai/heuristic_aliases.py` | **KEEP** | Alias resolution |
| `app/core/schema/graph.py` | **KEEP** | FK graph |
| `tests/test_heuristic_phase*.py` | **KEEP** | Regression safety net |
| `tests/test_heuristic_compiler.py` | **KEEP** | Compiler tests |

---

## Backend — join layer (KEEP, minor cleanup optional)

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/ai/heuristic_schema_intel.py` | **KEEP** | Join pathfinding, ambiguity |
| `app/core/ai/heuristic_joins.py` | **KEEP** | Thin wrapper; optional later merge into schema_intel |
| `heuristic_joins.build_from_clause_with_joins()` | **DELETE** | Unused; only `build_join_plan()` is called |

---

## Backend — pipeline & trust (KEEP + FINISH)

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/pipeline/orchestrator.py` | **KEEP** | Main query pipeline |
| `app/core/explanation/builder.py` | **KEEP** | Query Trust payload |
| `app/core/explanation/confidence.py` | **KEEP** | User-facing score (consolidate here) |
| `app/core/explanation/quality.py` | **KEEP** | Data quality warnings in explanation |
| `app/core/grounding/validator.py` | **KEEP** | Schema grounding |
| `app/core/security/sql_validator.py` | **KEEP** | Read-only enforcement |
| `app/core/execution/query_executor.py` | **KEEP** | Bounded execution |
| `app/core/audit/audit_service.py` | **KEEP** | Audit writes |
| `app/api/routes/assistant.py` | **KEEP** | Ask endpoint |
| `app/api/routes/query.py` | **KEEP** | SQL run endpoint |

### FINISH — audit observability gap

Data is **written** but **not read** by API/UI:

| Item | Verdict | Action |
|------|---------|--------|
| `query_audit_logs.heuristic_tier` | **FINISH** | Add to `AuditLogDetailResponse` + Audit page |
| `query_audit_logs.heuristic_compile_confidence` | **FINISH** | Same, or fold into telemetry JSON only |
| `query_audit_logs.eval_telemetry_json` | **FINISH** | Parse + expose routing, validation_issues, component_confidence |
| `app/schemas/governance.py` | **FINISH** | Extend `AuditLogDetailResponse` |
| `app/api/routes/audit.py` | **FINISH** | Map new fields in `_audit_to_response` |
| `frontend/.../AuditPage.tsx` | **FINISH** | Show tier, routing, validation issues on expand |

**Alternative (simpler):** stop writing duplicate columns; store everything in `eval_telemetry_json` only and expose that one field.

---

## Backend — connection aliases (FINISH)

Half-built bridge — highest-value finish item.

| File | Verdict | Action |
|------|---------|--------|
| `app/models/connection.py` (`ConnectionSchemaAlias`) | **FINISH** | Model stays |
| `alembic/.../b2c3d4e5f6a7_add_connection_schema_aliases.py` | **KEEP** | Migration stays |
| `load_alias_context()` in `heuristic_aliases.py` | **KEEP** | Already used by orchestrator |
| API routes for alias CRUD | **FINISH** | **Missing** — add under connections or govern |
| Pydantic schemas for aliases | **FINISH** | **Missing** |
| Frontend alias editor | **FINISH** | **Missing** — Connections or Govern page |

Until UI exists, aliases only work if inserted manually in DB.

---

## Backend — eval framework (KEEP core, DELETE stubs)

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/eval/runner.py` | **KEEP** | Benchmark runner |
| `app/core/eval/cases.py` | **KEEP** | Case loader |
| `app/core/eval/compare.py` | **KEEP** | Result comparison |
| `app/core/eval/result_validation.py` | **KEEP** | Execution-accuracy checks |
| `app/core/eval/metrics.py` | **KEEP** | Aggregate reporting |
| `app/core/eval/telemetry.py` | **KEEP** | Shared with production audit |
| `app/core/eval/improvement.py` | **KEEP** | `analyze_failures()` used by runner |
| `app/core/eval/improvement.regression_test_snippet()` | **DELETE** | Never called; dead code |
| `app/core/eval/hybrid.py` | **DELETE** or **FREEZE** | Never called in prod or tests |
| `scripts/run_heuristic_eval.py` | **KEEP** | CLI for CI/local |
| `tests/fixtures/eval_cases.json` | **KEEP** | 20 regression cases |
| `tests/fixtures/eval_schema_metadata.py` | **KEEP** | Eval seed schema |
| `tests/test_heuristic_eval.py` | **KEEP** | CI regression |
| `alembic/.../c3d4e5f6a7b8_add_eval_telemetry_json.py` | **KEEP** | If finishing audit exposure |

Remove `hybrid` from `app/core/eval/__init__.py` exports if deleted.

---

## Backend — learning & feedback (KEEP + FINISH)

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/learning/retrieval.py` | **KEEP** | Similar example search |
| `app/core/learning/service.py` | **KEEP** | Feedback persistence |
| `app/api/routes/feedback.py` | **KEEP** | Feedback API |
| `frontend/.../FeedbackBar.tsx` | **KEEP** | User thumbs up/down |

### FINISH — close the loop

| Gap | Action |
|-----|--------|
| Feedback does not auto-promote to verified examples | Add admin/auto-verify path |
| Duplicate `pick_high_confidence_example` in orchestrator **and** `query_generator.py` | **FINISH** — pick once in orchestrator only, or document why both |
| No UI showing “learned from your correction” | Optional Trust panel note |

---

## Backend — semantic metrics (FREEZE)

Parallel SQL path alongside heuristic/LLM. Valid for KPI-heavy users, premature for v1 wedge.

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/semantics/resolver.py` | **FREEZE** | Metric → SQL resolution |
| `app/models/metric.py` | **FREEZE** | |
| `app/api/routes/metrics.py` | **FREEZE** | No new metric types until ask-flow proven |
| `tests/test_metrics.py` | **KEEP** | Don't break existing |

Orchestrator still calls `resolve_metric_question()` first — **KEEP** that hook, but don't expand Metrics product surface.

---

## Backend — governance & security (KEEP, FREEZE expansion)

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/governance/policies.py` | **KEEP** | Table/column blocks |
| `app/core/governance/pii.py` | **KEEP** | PII warnings |
| `app/api/routes/audit.py` | **KEEP** | + FINISH telemetry fields |
| Govern API (if separate) | **FREEZE** | Policy UI works; no new policy types |

---

## Backend — insights (KEEP, simplify later)

| File | Verdict | Notes |
|------|---------|-------|
| `app/core/ai/simple_insight.py` | **KEEP** | Fast path, no LLM |
| `app/core/ai/insight_generator.py` | **KEEP** | LLM insights |
| `app/core/ai/insight_summarizer.py` | **KEEP** | Dataset summary for prompts |
| `app/core/ai/insight_prompt.py` | **KEEP** | |
| `app/api/routes/insights.py` | **KEEP** | |

**FREEZE:** don't add insight types until ask + trust loop is solid.

---

## Backend — infra (KEEP)

| File | Verdict |
|------|---------|
| `app/core/connections/*` | **KEEP** |
| `app/core/auth/*` | **KEEP** |
| `app/core/schema/introspector.py`, `sync_service.py`, `profiler.py`, `loader.py` | **KEEP** |
| `app/core/visualization/chart_service.py` | **KEEP** |
| `app/core/ai/llm_client.py` | **KEEP** |
| `app/core/ai/executor.py` | **KEEP** |
| `app/utils/rate_limiter.py` | **KEEP** |
| `app/config.py` | **KEEP** |

---

## Backend — migrations (KEEP all)

Do not roll back applied migrations. Finish features that use them instead.

| Migration | Verdict | Notes |
|-----------|---------|-------|
| `a1b2c3d4e5f6_add_heuristic_audit_columns.py` | **KEEP** | Expose in API or consolidate into telemetry JSON |
| `b2c3d4e5f6a7_add_connection_schema_aliases.py` | **KEEP** | Needs API + UI |
| `c3d4e5f6a7b8_add_eval_telemetry_json.py` | **KEEP** | Needs API + UI |

---

## Frontend — core workbench (KEEP)

| File / area | Verdict | Notes |
|-------------|---------|-------|
| `features/workbench/AskPage.tsx` | **KEEP** | Primary surface |
| `features/workbench/AskComposer.tsx` | **KEEP** | |
| `features/workbench/ResultsWorkspace.tsx` | **KEEP** | |
| `features/workbench/QueryTrustPanel.tsx` | **KEEP** | Product differentiator |
| `features/workbench/DataTable.tsx` | **KEEP** | |
| `features/workbench/SqlBlock.tsx` | **KEEP** | |
| `features/workbench/SchemaTreeSidebar.tsx` | **KEEP** | |
| `features/workbench/FeedbackBar.tsx` | **KEEP** | + FINISH backend loop |
| `features/workbench/ChartPanel.tsx` | **KEEP** | |
| `features/workbench/InsightPanel.tsx` | **KEEP** | |
| `components/workbench/WorkbenchLayout.tsx` | **KEEP** | |

### FINISH — simplify Trust panel confidence

| Item | Verdict | Action |
|------|---------|--------|
| `component_confidence` bars | **FREEZE** new work | Hide from default view or collapse to “Match quality: Good/Fair/Low” |
| `calibrated_confidence` + ring score | **FINISH** | Pick **one** user-facing number |
| Routing/tier badges | **KEEP** | Useful and already wired |

---

## Frontend — connections & schema (KEEP + FINISH aliases UI)

| File | Verdict |
|------|---------|
| `features/connections/ConnectionsPage.tsx` | **KEEP** + add alias section (**FINISH**) |
| `features/connections/ConnectionContext.tsx` | **KEEP** |
| `features/schema/SchemaPage.tsx` | **KEEP** |

---

## Frontend — admin surfaces (FREEZE)

Valid product areas; don't expand until `/ask` is daily-usable.

| File | Verdict | Notes |
|------|---------|-------|
| `features/metrics/MetricsPage.tsx` | **FREEZE** | Matches backend metrics freeze |
| `features/govern/GovernPage.tsx` | **FREEZE** | Policy UI sufficient |
| `features/audit/AuditPage.tsx` | **KEEP** + **FINISH** telemetry display |

---

## Frontend — auth (KEEP)

| File | Verdict |
|------|---------|
| `features/auth/*` | **KEEP** |
| `features/auth/QueryTrustDemo.tsx` | **KEEP** | Marketing/demo on login panel |

---

## Frontend — command palette (FREEZE)

| File | Verdict | Notes |
|------|---------|-------|
| `features/command/CommandPalette.tsx` | **FREEZE** | Polish, not wedge |
| `features/command/CommandPaletteContext.tsx` | **FREEZE** |
| `features/command/GlobalShortcuts.tsx` | **FREEZE** |
| `features/command/KeyboardShortcutsHelp.tsx` | **FREEZE** |
| `features/command/useGlobalShortcuts.ts` | **FREEZE** |
| `features/command/CommandPaletteTrigger.tsx` | **FREEZE** |

Keep in repo; no new shortcuts or commands until core loop ships.

---

## Frontend — SQL editor (KEEP)

| File | Verdict |
|------|---------|
| `features/sql/SqlPage.tsx` | **KEEP** |
| `components/sql/SqlEditor.tsx` | **KEEP** |

Secondary to Ask, but useful for power users and debugging.

---

## Frontend — UI kit (KEEP)

| Area | Verdict |
|------|---------|
| `components/ui/*` | **KEEP** |
| `components/layout/*` | **KEEP** |
| `styles/*` | **KEEP** |

---

## Frontend — dev-only / dead (DELETE or ignore)

| File | Verdict | Action |
|------|---------|--------|
| `pages/ThemeShowcasePage.tsx` | **KEEP** | Already DEV-only route (`/dev/theme`) — fine |
| `pages/PlaceholderPage.tsx` | **DELETE** | Not imported anywhere |
| `features/workbench/SqlProgressSteps.tsx` | **KEEP** | Used if SQL flow shows steps; verify before delete |
| `features/workbench/QueryProgressSteps.tsx` | **KEEP** | Ask flow |

---

## Confidence system consolidation (FINISH)

Today there are **5 overlapping signals**. Target state:

| Signal | Keep where | Show to user? |
|--------|------------|---------------|
| `compute_confidence_score()` | explanation + audit | **Yes** — single ring |
| `calibrated_confidence` | routing + audit telemetry | No (internal) |
| `component_confidence` | audit telemetry only | No (or debug expand) |
| `heuristic_compile_confidence` | audit column | No — merge into telemetry |
| `false_confidence` flag | audit telemetry | Admin/audit only |

**Files to touch:** `QueryTrustPanel.tsx`, `explanation/builder.py`, `audit.py` schema.

---

## SQL generation path (KEEP — document, don't duplicate)

Resolution order in orchestrator (keep this mental model):

```
1. Semantic metric match     → semantics/resolver.py   [FREEZE expansion]
2. Learning direct match     → learning/retrieval.py   [FINISH feedback loop]
3. Heuristic + LLM           → query_generator.py      [KEEP — core]
```

**FINISH:** Remove redundant `pick_high_confidence_example` call inside `generate_sql()` if orchestrator already short-circuits — or remove orchestrator's pre-check and let `generate_sql` own it (pick one owner).

---

## Safe DELETE checklist (verify before removing)

Run after each deletion:

```bash
cd backend
python -m pytest tests/test_heuristic_eval.py tests/test_heuristic_phase1.py tests/test_heuristic_phase2.py tests/test_heuristic_phase3.py tests/test_heuristic_phase4.py tests/test_assistant.py -q
```

| Candidate | Safe to delete? |
|-----------|-------------------|
| `app/core/eval/hybrid.py` | Yes — no imports in prod/tests |
| `regression_test_snippet()` in improvement.py | Yes — remove function only |
| `build_from_clause_with_joins()` in heuristic_joins.py | Yes — unused function |
| `frontend/src/pages/PlaceholderPage.tsx` | Yes — zero imports |
| `eval/__init__.py` hybrid exports | Yes — if hybrid.py deleted |

**Do NOT delete:** migrations, schema_intel, eval runner, any heuristic module, governance, metrics models (freeze only).

---

## What “done” looks like for this triage

- [ ] Aliases: create/edit/delete in UI, persisted per connection
- [ ] Audit page shows routing + tier + validation issues
- [ ] Trust panel shows one confidence score + plain-language routing
- [ ] Thumbs-down feedback creates reviewable learning candidate
- [x] Dead code removed (`hybrid.py`, `PlaceholderPage`, unused functions)
- [ ] No new Metrics/Govern/Command Palette features until above is checked

---

## Recommended next sprint (after triage)

**Week 1 — Finish**
1. Alias API + UI on Connections page
2. Audit API + Audit page telemetry
3. Delete dead code list above

**Week 2 — Finish**
4. Single confidence score in Trust panel
5. Feedback → learning promotion (manual approve OK)

**Week 3+ — Unfreeze only if dogfooding finds gaps**
6. Expand eval cases from real failed queries
7. Dialect eval on real Postgres

Do not start new heuristic phases until Week 1–2 checkboxes are done.
