# ChatPRFAQ — notes for future sessions

## What this is
A Working Backwards council on the Claude API. Backend in `backend/` (FastAPI, Python 3.11+), frontend in `web/` (Vite + React + TypeScript). The 2025 Flask app still sits at the repo root (`app.py`, `routes.py`, `processors/`, `frontend/`) and is unused; see README "Legacy".

## Commands
- `make setup`, `make dev` (real provider, needs `ANTHROPIC_API_KEY`), `make dev-fake` (offline).
- Backend tests: `cd backend && .venv/bin/python -m pytest -q` (all offline, fake provider).
- Frontend: `cd web && npm run typecheck && npm test -- --run && npm run build`.
- After changing any Pydantic schema or API route: `make types` (regenerates `web/openapi.json` and TS types) and `make fixture` if event shapes changed. CI diffs `web/openapi.json` against the backend.

## Invariants to keep
- `council/charter.py` must stay byte-identical across seats and runs (it is the cached system prompt). Seat-specific text goes in the seat's task block.
- The dossier (`council/dossier.py`) is append-only in `CANONICAL_ORDER`; never put timestamps, ids or per-run values in an artifact block.
- Every seat output model inherits `StrictModel`; no numeric/string constraints in output schemas (validate in Python instead).
- Every event is persisted before it is published; event types are the discriminated union in `schemas/events.py` and must stay in sync with the frontend types.
- Current-model API facts (`llm/anthropic_provider.py`): adaptive thinking, no sampling params, no prefill, no forced tool choice, structured outputs never combined with citations, refusal handling with `fallbacks="default"`.

## Models
Per-seat via `settings.model_for(seat_id, tier)`; env overrides `SEAT_<id>_MODEL` / `SEAT_<id>_EFFORT`. Defaults: `claude-fable-5-1` (judgment), `claude-sonnet-5` (fast), `claude-opus-5` (reviewer). Prices for cost accounting in `settings.MODEL_PRICES`.
