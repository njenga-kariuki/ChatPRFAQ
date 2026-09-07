# ChatPRFAQ

A council of AI colleagues runs Amazon's Working Backwards process on a product idea and produces an executive-ready PRFAQ, with every pass over the press release inspectable and every claim traceable to evidence.

The user enters an idea. A Product Strategist frames it (target customer, problem, scope) and the user confirms or refines. Then the council runs in the order a strong product organisation reviews work: live market research with citations, a simulated problem-discovery panel, a Principal PM's draft, a VP Product refinement, an internal FAQ from a VP Business and a Principal Engineer in parallel with a simulated concept test, a customer-validated refinement, a customer FAQ, an editorial synthesis, a Bar Raiser review, and a hypothesis-driven validation plan. The press release has four checkpoints (v1 draft, v2 VP-refined, v3 customer-validated, v4 final) and every edit between them carries who made it, why, and which finding supports it.

This is the 2026 rebuild on the current Claude platform. The proposal that led to it, including the analysis of the original 2025 implementation, is in [`docs/refresh/`](docs/refresh/README.md).

## How it works

```
idea ─▶ 0 Frame ─▶ user confirms ─▶ 1 Research ─▶ 1b Ledger ─▶ 2 Problem panel ─▶ 3 Draft v1 ─▶ 4 VP v2 ─┬▶ 5 Internal FAQ ─┐
                                                                                                        │                  ├▶ 7 Refine v3 ─▶ 8 Customer FAQ ─▶ 9 Edit v4 ─▶ 9b Bar Raiser ─▶ 10 Validation plan
                                                                                                        └▶ 6 Concept panel ─┘
```

- **One frozen council charter** is the system prompt for every seat (methodology, the eight press-release slots, evidence rules, the roster). It is cached for an hour and shared by every run.
- **An append-only dossier** is the user message: every artifact produced so far, in a fixed order, so each seat reads the whole prior context from the prompt cache and no persona is ever truncated.
- **Structured outputs on every seat** except live research. The press release is eight typed slots with per-claim evidence; refinement seats return per-slot edits with a rationale, evidence ids and a change kind; FAQs, panels, the ledger, the review and the plan are typed too.
- **Live research** uses Claude's server-side web search and fetch; citations become an evidence ledger (`F-01`, `S-01`, ...) that every later seat cites. Numbers with no finding are flagged as assumptions and picked up by the validation plan.
- **Streaming from the first token**, with the model's reasoning summaries as working notes and real progress lines during research.
- **Persist first, stream second.** Every event is written to the database before it is sent; the stream replays from any sequence number, so refresh, reconnect, resume, sharing and history all work.
- **Models per seat**: Claude Fable 5.1 on the judgment seats, Claude Sonnet 5 on framing, ledger extraction and the customer FAQ, Claude Opus 5 as the Bar Raiser and as the automatic fallback. All configurable per seat.

## Run it

Requirements: Python 3.11+, `uv`, Node 22. An Anthropic API key with 30-day data retention on the workspace (required by Claude Fable 5.1), or `LLM_PROVIDER=fake` for an offline demo.

```bash
make setup                          # backend venv + frontend node_modules
cp backend/.env.example backend/.env  # add ANTHROPIC_API_KEY (or LLM_PROVIDER=fake)
make dev                            # backend on :8000, frontend on :5173
make dev-fake                       # the same, fully offline with a streaming fake council
```

Then open http://localhost:5173. `/demo` replays a recorded run without a backend.

Checks: `make test` runs the backend suite and the frontend typecheck, unit tests and build. `make live-check` sends one cheap real request to validate the key and request shape. `make evals` runs the twelve seed ideas through the council and grades them with an LLM judge.

Production: `docker build -f deploy/Dockerfile -t chatprfaq .` produces one image that serves the built frontend from the backend; `deploy/docker-compose.yml` adds Postgres. Set `DATABASE_URL`, `ANTHROPIC_API_KEY`, `OWNER_TOKEN` (protects run creation and history) and `RUN_COST_CEILING_USD`. A `.replit` is included for Replit deployments.

## Layout

```
backend/app/
  council/charter.py      the frozen system prompt: methodology + roster
  council/seats/          one module per seat: task, output schema, model tier, effort
  council/dossier.py      append-only dossier with cache markers
  council/graph.py        dependency graph (5 ‖ 6; Bar Raiser gates the plan)
  council/runner.py       asyncio runner: framing gate, fan-out, retries, resume, cost
  llm/                    Anthropic provider, fake provider, cost, citations
  schemas/                the typed document model and the RunEvent union
  db/                     SQLAlchemy models and the Store
  api/                    runs, SSE with replay, export, snapshot
  export/                 markdown, redline, json
  evals/                  seed ideas, LLM judge, regression runner
web/                      the React frontend (see web/README.md)
docs/refresh/             the proposal and design brief
deploy/                   Dockerfile, docker-compose
```

## API

`POST /api/runs` · `GET /api/runs/{id}` · `GET /api/runs/{id}/events` (SSE, `Last-Event-ID`) · `POST /api/runs/{id}/framing/refine` · `POST /api/runs/{id}/framing/confirm` · `POST /api/runs/{id}/cancel` · `POST /api/runs/{id}/resume` · `GET /api/runs` · `GET /api/share/{token}` · `GET /api/runs/{id}/export?format=md|plan|redline|json` · `GET /api/roster` · `GET /api/seats` · `GET /api/health`. The OpenAPI document is generated into `web/openapi.json` (`make types`).

## Legacy

The 2025 implementation (Flask, `processors/`, `frontend/`) is still present at the repository root for reference and is not used by anything in `backend/` or `web/`. It can be removed with `git rm -r app.py routes.py config.py main.py deploy.py run_dev.py build-for-deployment.sh processors utils templates static tests attached_assets replit.md DEVELOPMENT.md REPORTING.md package.json package-lock.json pyproject.toml uv.lock frontend "=0.40.0" "=1.0.0"`.
