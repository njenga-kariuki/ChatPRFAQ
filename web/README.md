# ChatPRFAQ web

The frontend for the Working Backwards council: a Vite + React + TypeScript single-page app that drives the FastAPI backend in `../backend` through its REST endpoints and the persisted SSE event stream.

## Commands

```bash
npm ci                      # Node 22
npm run dev                 # Vite on :5173, proxies /api to http://localhost:8000 (start the backend with `make api` or `make api-fake`)
npm run typecheck           # tsc over the app and the Vite config
npm test -- --run           # vitest unit tests
npm run build               # production build into dist/ (served by the backend from STATIC_DIR and by the Docker image)
npm run gen:types           # regenerate src/api/types.ts from openapi.json (run `make types` at the repo root to refresh openapi.json first)
```

CI runs typecheck, tests and build, and fails if `openapi.json` no longer matches the backend.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Idea composer, the council roster, the four press-release checkpoints |
| `/how-it-works` | The sequence, seat by seat |
| `/runs` | Run library |
| `/runs/:id/brief` | The framing gate: edit the working name and framing inline, ask the strategist for another pass, confirm |
| `/runs/:id/council` | The council timeline: rail with insights, handoff connectors, streaming cards with working notes, cancel and resume |
| `/runs/:id/council/:seat` | One seat's full output and attempts |
| `/runs/:id/document` | The PRFAQ and the validation plan, with per-section provenance and an Evidence toggle |
| `/runs/:id/evolution` | v1 to v4: read, compare (word-level redline with the reviewer's rationale and evidence beside each section), walkthrough |
| `/runs/:id/research` | Findings, their sources, and where each finding was used |
| `/s/:token` | Read-only share view of a run |
| `/demo` | Replays `fixtures/run.events.jsonl` with no backend (`?speed=1|4|instant`, `?at=<event seq>` pauses the replay there) |

## How it fits together

- `src/api/client.ts` wraps the REST endpoints. `src/api/sse.ts` opens `GET /api/runs/{id}/events` and reconnects with `?after=<last seq>`, so nothing is lost across a dropped connection.
- `src/state/runStore.ts` is a pure reducer over the event union in `src/api/types.ts` (`step.*`, `document.version`, `run.*`). A run snapshot hydrates the store and every event after `last_seq` is applied on top, which is why a reload in the middle of a run rebuilds the working card's stream.
- `src/lib/partialJson.ts` renders a seat's structured output progressively while it streams; `src/lib/wordDiff.ts` (diff-match-patch) produces the per-section redlines.
- `src/export/docx.ts` writes the clean Word document and the tracked-changes redline (reviewer attribution, rationales as comments) in the browser; it is loaded on demand. Markdown, validation plan, CriticMarkup redline and JSON exports come from the backend for live and shared runs and are generated locally for the demo.
- `src/design/*.css` holds the tokens (light and dark), the shell, the council, the document views and the pages.
- `src/demo/replay.ts` replays a recorded event log through the same store, including the framing gate.

## Fixtures

`fixtures/run.snapshot.json` and `fixtures/run.events.jsonl` are recorded from the fake provider by `make fixture`. The demo route and the reducer tests read them; re-record them whenever event shapes change.

## Tests

`vitest` covers the reducer (full replay of the fixture, hydration, duplicate suppression, cost totals), the selectors, partial JSON parsing, word diffs, the SSE client's reconnect behaviour, and the DOCX output.
