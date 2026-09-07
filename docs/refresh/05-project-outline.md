# 05 · Project outline: rewiring ChatPRFAQ for the frontier

A build plan for one experienced full-stack engineer (or the owner plus Claude Code) over roughly four working weeks, with acceptance criteria per phase. It assumes the decisions in §8 are taken first.

---

## 1. Target repository layout

```
chatprfaq/
├── backend/
│   ├── pyproject.toml                # fastapi, uvicorn, anthropic>=1,<2, pydantic>=2, sqlalchemy[asyncio], asyncpg, aiosqlite, python-docx (or keep docx in the browser)
│   ├── app/
│   │   ├── main.py                   # FastAPI app, routers, CORS, lifespan (cache pre-warm of the charter)
│   │   ├── settings.py               # pydantic-settings: models per seat, effort per seat, betas, DB URL, allowed origins
│   │   ├── council/
│   │   │   ├── charter.py            # the frozen system prompt: methodology + roster (the only place personas are defined)
│   │   │   ├── seats/                # one module per seat: task template, Pydantic output schema, model, effort, max_tokens
│   │   │   │   ├── s00_framing.py … s10_validation_plan.py, s09b_bar_raiser.py, s01b_ledger.py
│   │   │   ├── dossier.py            # append-only dossier builder; canonical artifact order; cache_control placement
│   │   │   ├── graph.py              # seat dependency DAG
│   │   │   └── runner.py             # asyncio DAG runner: resume, cancel, retries, cost accounting
│   │   ├── llm/
│   │   │   ├── client.py             # AsyncAnthropic factory; betas; fallbacks="default"; typed error mapping
│   │   │   ├── stream.py             # Messages stream → RunEvent adapter (deltas, progress notes, usage, refusal)
│   │   │   └── research.py           # seat 1 web_search/web_fetch call + citation capture
│   │   ├── schemas/                  # shared Pydantic models: PressRelease, Edit, FAQItem, Finding, Source, Hypothesis, PRFAQ, RunEvent
│   │   ├── db/                       # SQLAlchemy models + migrations (alembic)
│   │   ├── api/                      # routers: runs, events (SSE), framing, export, history, health
│   │   ├── export/                   # docx / markdown / pdf renderers over the typed PRFAQ (+ redline export)
│   │   └── evals/                    # seed ideas, rubric, LLM judge, regression runner
│   └── tests/                        # unit (schemas, dossier, graph), integration (one seat live, cache-hit assertion), e2e (full run on a fixture idea)
├── frontend/
│   ├── package.json                  # react 19, react-router 7, tailwind 4, vite 6, zod, diff-match-patch, partial-json
│   ├── src/
│   │   ├── app/routes/               # /, /new, /runs/:id (council), /runs/:id/document, /runs/:id/evolution, /runs/:id/research, /history, /how-it-works
│   │   ├── api/                      # generated TS types from the backend schemas; SSE client with Last-Event-ID replay
│   │   ├── state/runStore.ts         # single reducer over RunEvent; derived selectors (versions, edits, ledger)
│   │   ├── components/council/       # CouncilTimeline, SeatCard, PersonaBadge, ProgressNotes, WorkingNotes, FramingReview
│   │   ├── components/document/      # PRFAQView, VersionTimeline, SectionDiff, EditCard, ClaimChip, FAQList, ExportMenu
│   │   ├── components/research/      # FindingsLedger, SourceCard, EvidencePopover
│   │   ├── design/                   # tokens (light/dark), persona identity system, typography
│   │   └── lib/                      # partialJson, sectionDiff, formatters
│   └── tests/                        # vitest for reducer/diff; playwright smoke on a recorded run fixture
├── docs/refresh/                     # these documents
└── deploy/                           # Dockerfile (single image: built frontend served by FastAPI), fly.toml or Replit config, env template
```

Old → new mapping: `config.py` → `council/charter.py` + `council/seats/*`; `processors/*` → `council/runner.py` + `llm/*`; `routes.py` → `api/*`; `utils/*` → `db/*`; `App.tsx` → `state/runStore.ts` + routes; the three diff engines → `lib/sectionDiff.ts`; `prfaqExporter.ts` → `backend/app/export/docx.py` (server-side, from the typed model) or a slim client renderer over the same model; `templates/reporting.html` + `static/reporting.js` → `/history` and a small ops view.

---

## 2. Data model

| Table | Key fields | Notes |
|---|---|---|
| `runs` | id, idea_text, framing (json), status, created_at, completed_at, total_cost, config_snapshot (models/effort per seat), share_token | One row per council run |
| `steps` | run_id, seat, attempt, status, model, effort, started_at, ended_at, input_tokens, cached_tokens, output_tokens, web_searches, stop_reason, served_by_fallback | One row per attempt |
| `artifacts` | id, run_id, seat, kind (research/ledger/validation/pr/faq/prfaq/plan/bar_raiser), payload (json), key_insight | The dossier entries; immutable |
| `document_versions` | run_id, version (1–4), artifact_id, produced_by_seat | The PR timeline |
| `edits` | version_id, section_id, new_text, rationale, change_kind, evidence_finding_ids | From seats 4/7/9 |
| `findings` / `sources` | run_id, id, claim, metric, confidence, source_ids / url, title, cited_text | The evidence ledger |
| `events` | run_id, seq, type, payload, ts | Append-only; SSE replays from here |

---

## 3. API contract

| Endpoint | Purpose |
|---|---|
| `POST /api/runs` `{idea}` → `{run_id}` | Creates the run and starts seat 0 |
| `POST /api/runs/{id}/framing/refine` `{customer, problem, scope}` | Re-runs seat 0 with feedback |
| `POST /api/runs/{id}/framing/confirm` | Freezes the brief; starts the council |
| `GET /api/runs/{id}/events` (SSE, honours `Last-Event-ID`) | Replays then tails the typed event stream |
| `GET /api/runs/{id}` | Snapshot: run, steps, artifacts, versions, edits, ledger |
| `POST /api/runs/{id}/cancel` / `POST /api/runs/{id}/resume` | Cancel; resume from last completed seat |
| `GET /api/runs/{id}/export?format=docx|md|pdf|redline` | Rendered from the typed PRFAQ |
| `GET /api/runs?cursor=` | History (owner's runs) |
| `GET /api/health` | Model reachability, DB, cache warm state |

Event union (discriminated on `type`): `run.started`, `framing.ready`, `step.started`, `step.progress`, `step.tool`, `step.delta`, `step.thinking`, `step.completed`, `step.failed`, `document.version`, `run.completed`, `run.failed`, `run.cancelled`. Types are generated into `frontend/src/api/types.ts` from the Pydantic models (e.g. `pydantic-to-typescript` or a JSON-schema step in the build) so the contract cannot drift.

---

## 4. Phases

### Phase 0 — Decide and clear the ground (1–2 days)
- Take the decisions in §8; record them in `docs/refresh/DECISIONS.md`.
- Confirm the org meets Fable 5.1's 30-day data-retention requirement; confirm rate limits for Fable 5.x and Opus 5 (separate buckets).
- Apply the day-one items from `04-surgical-changes.md` §A and §C on `main` so the old app is not leaking keys while the refresh is built.
- Write the 12 seed ideas for the eval set and freeze the quality rubric.
- Scaffold the new repo layout; delete `google-generativeai`, `openai`, `flask*`, `gunicorn` from dependencies.

**Done when:** a `make dev` boots FastAPI + Vite with a health endpoint reporting the three model IDs reachable.

### Phase 1 — Council core, backend only (week 1)
1. Shared schemas (`schemas/*`) and the frozen charter with the roster.
2. Dossier builder with canonical order and cache markers; unit tests that two consecutive prompts are byte-identical on the shared prefix.
3. `llm/client.py` + `llm/stream.py`: streaming, fallbacks, refusal handling, usage capture, typed error mapping.
4. One seat end-to-end (seat 3, PR draft) driven from a CLI (`python -m app.council.run "idea"`), streaming deltas to the terminal, validating the schema.
5. Seat 1 research with web search + citations, then seat 1b ledger extraction.
6. All remaining seats, ported from `config.py` with the prompt changes in `02 §7`.
7. DAG runner: dependencies, parallel 5‖6 (9‖10 behind a flag), retries, cancel, resume; event log + SSE endpoint; Postgres/SQLite via SQLAlchemy.
8. Integration test: full run on a fixture idea; assertion that step 3 reports `cache_read_input_tokens > 0`; assertion that every PR version has exactly eight sections and every edit references a valid section.

**Done when:** `POST /api/runs` produces a complete typed PRFAQ + validation plan with a replayable event log, in under 6 minutes, with per-step cost recorded.

### Phase 2 — Frontend (week 2)
1. Design system from `03-design-brief.md`: tokens, light/dark, persona identity, typography, motion rules.
2. `runStore` reducer over the event union; SSE client with replay; partial-JSON progressive rendering.
3. Framing review (seat 0 gate) with per-section feedback.
4. Council timeline: seat cards streaming text, progress notes, thinking summaries ("working notes"), key insights, handoff affordances; visual sequence preserved during parallel execution.
5. Document views: final PRFAQ, version timeline v1→v4, per-section diff with edit cards (who / why / evidence), evidence popovers to findings and sources, assumptions flagged.
6. Research view: ledger + sources; validation plan view.
7. Exports: DOCX (ported typography), Markdown, PDF, redline (tracked changes across versions).
8. History and shareable run URLs.

**Done when:** a user can watch a full run live, refresh mid-run without losing anything, open the run on a phone, step through every edit with its rationale, and export a Word file that matches the old typographic spec.

### Phase 3 — Quality, cost, hardening (week 3)
1. Bar Raiser seat with rubric scores surfaced in the UI (config-flagged).
2. Eval harness: run the 12 seeds; LLM judge; hallucination check against the ledger; baseline score.
3. Effort sweep per seat (`medium`/`high`/`xhigh`) and model A/B (Fable 5.1 vs Opus 5 on seats 2, 6, 10) against the eval; pick defaults; record cost per run.
4. Prompt de-prescription A/B (goal-and-constraints prompts vs the ported step-by-step prompts).
5. Ops view: per-run cost, cache hit rate, fallback rate, Bar Raiser trend.
6. Security: auth (at minimum an owner token for history/ops), restricted CORS, rate limiting on `POST /api/runs`, secret handling.
7. Deployment: Docker image; managed Postgres; environment template; cache pre-warm on boot; runbook.

**Done when:** eval baseline is recorded, the chosen configuration is documented, and production serves a run end-to-end from a fresh deploy.

### Phase 4 — Launch and backlog (ongoing)
- Optional human gate after v2 (pause the council for the user's notes before customer validation).
- "Ask the council" follow-ups on a finished run (a new seat that answers questions over the dossier).
- Persona memory across runs for the same user (lessons file per user — Fable 5.1 benefits measurably from a memory surface).
- Multi-idea comparison; team workspaces; comment threads on sections.

---

## 5. Test strategy

| Layer | What | Tooling |
|---|---|---|
| Unit | schema validation, dossier prefix stability, DAG ordering, event reducer, section diff | pytest, vitest |
| Contract | generated TS types match Pydantic; SSE replay from any `Last-Event-ID` | pytest + schema snapshot |
| Integration (live API, gated by env) | one seat per model; cache-hit assertion; refusal/fallback path with a synthetic prompt; web-search citations present | pytest markers |
| E2E | full run on a fixture idea; Playwright smoke over a recorded event log (no API cost) | pytest, playwright |
| Quality | eval set with LLM judge; regression threshold on the rubric | `backend/app/evals` |

---

## 6. Configuration (environment)

`ANTHROPIC_API_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `COUNCIL_MODEL_DEFAULT=claude-fable-5-1`, `COUNCIL_MODEL_FAST=claude-sonnet-5`, `COUNCIL_MODEL_REVIEWER=claude-opus-5`, per-seat overrides `SEAT_04_MODEL`, `SEAT_04_EFFORT`, `WEB_SEARCH_MAX_USES=15`, `BAR_RAISER_ENABLED=true`, `RUN_STEP_TIMEOUT_S=900`, `OWNER_TOKEN`.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fable 5.1 classifier false positives on a benign idea (e.g. a security or biotech product) | `fallbacks="default"` on every call; surface "served by fallback" in the ops view; Opus 5 as a one-line config switch |
| Long research turns at high effort | Streaming + progress notes; `max_uses` cap; per-step timeout with resume |
| Structured-output prose feels stilted vs free markdown | A/B on the eval; the markdown-then-structure fallback is designed in (`02 §4`) |
| Cost per run ~4x the old app | Effort sweep; Sonnet on simple seats; cache verification test; cost shown per run |
| Prompt cache silently breaks after a later change | Standing integration assertion on `cache_read_input_tokens` |
| Beta features (per-message effort, display updates) not enabled for the org | Both are optional; the design degrades to pinned effort and summarized thinking |

---

## 8. Decisions the owner must take before Phase 1

| # | Decision | Recommendation |
|---|---|---|
| 1 | Model mix | Fable 5.1 on judgment seats, Sonnet 5 on seats 0/1b/8, Opus 5 as reviewer + fallback (see `02 §2.1`) |
| 2 | Add the Bar Raiser seat? | Yes, config-flagged, on by default; it is the most Amazon-native quality lever available |
| 3 | Structured outputs for the drafting seats (JSON with progressive rendering) vs markdown + structuring pass | Structured; it is what makes provenance and exact diffs possible |
| 4 | Hosting | Docker image + managed Postgres (Fly.io/Render/Railway); Replit is workable if it gets Postgres, but the ephemeral-disk history should end |
| 5 | Auth | Owner token now; real accounts only if sharing/history becomes multi-user |
| 6 | Optional gate after v2 | Ship as a setting, off by default, so the demo stays one click |
| 7 | Cost ceiling per run | Set one (e.g. $12) enforced by the runner; alert at 80% |
| 8 | Keep Perplexity as an alternative research provider? | No for v1; keep the interface |
