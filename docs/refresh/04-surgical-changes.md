# 04 · Surgical changes worth making regardless of the full refresh

These are precise, file-level changes. Group A makes the current code run again on today's API; B fixes silent quality defects in the pipeline; C is hygiene; D lists frontier patterns that pay off even inside the old architecture; E is what *not* to touch. If the full refresh in `05-project-outline.md` is approved, A–C still apply on day one because they de-risk the branch you build from; D is absorbed by the refresh.

## A. Required to run at all

| # | Change | Where | Detail |
|---|---|---|---|
| A1 | Council model → `claude-fable-5-1` (or `claude-opus-5`) | `config.py:5` | `claude-sonnet-4-20250514` is deprecated (retires 2026-06-15). Make it an env var, not a constant. |
| A2 | Insight model → `claude-haiku-4-5` | `processors/llm_processor.py:50` | `claude-3-5-haiku-20241022` was retired 2026-02-19 and returns 404, so every insight call fails today. |
| A3 | Remove `temperature` and `top_p` | `processors/claude_processor.py:272-281`, `processors/llm_processor.py:1088-1098, 1183-1193` | Rejected (400) by every current model. |
| A4 | Raise `max_tokens` and stream | `processors/claude_processor.py:274` | 8192 now caps thinking **plus** text; use 16000–32000 and switch to `client.messages.stream(...).get_final_message()` so the SDK's timeout guard doesn't refuse the request. |
| A5 | Upgrade `anthropic` to 1.x | `pyproject.toml`, `uv.lock` | `anthropic>=1,<2`; Python ≥ 3.10 (already 3.11); the SDK now uses `httpx2` — `claude_processor.py:32-35` builds `httpx.Timeout` objects; replace with `anthropic.Timeout(...)`. |
| A6 | Drop Gemini | `config.py:8-10`, `processors/llm_processor.py:8, 32-46`, `pyproject.toml` | Dead preview model, unused client, extra dependency. |
| A7 | Handle refusals | `processors/claude_processor.py:338-348` | Check `response.stop_reason == "refusal"` before `content[0]`; add `betas=["server-side-fallback-2026-07-01"], fallbacks="default"` on `client.beta.messages.stream(...)`. |
| A8 | Fix the stale test | `tests/test_api.py:146-155` | Asserts 7 steps and the old model id; update or delete. |

## B. Silent quality defects

| # | Change | Where | Detail |
|---|---|---|---|
| B1 | Stop truncating problem-validation research to 500 chars | `processors/llm_processor.py:332-334` (step 6) and `418-424` (step 9) | Both prompts tell the persona to *use* the problem validation findings; the code hands them the first 500 characters and an ellipsis. With a 1M-context model, pass the full text. |
| B2 | Give step 7 the internal FAQ | `config.py:644-682` | The handler at `llm_processor.py:354-360` already formats `internal_faq`; the template never references it. Add it so the engineer/VP findings inform the customer-validated rewrite. |
| B3 | Give step 10 the evidence, not the polished prose | `processors/llm_processor.py:436-448`, `config.py:900-903` | Pass market research, internal FAQ (its risk register) and concept validation alongside the PRFAQ so hypotheses are derived from findings. |
| B4 | Validate structure before storing a step | `processors/llm_processor.py:474-506` | Steps 4/7/9 must contain their PR header; if missing, retry once with the error appended instead of letting the frontend fall back to dumping the whole output into the version slot (`App.tsx:651-656, 698-703, 741-746`). Better: D2. |
| B5 | Make the singleton per-request | `routes.py:58`, `processors/llm_processor.py:20, 549` | `self.step_outputs` on a module-level `LLMProcessor` is shared across concurrent runs; instantiate per run or key state by `request_id`. |
| B6 | Kill the timer fiction | `processors/claude_processor.py:207-218` | `threading.Timer` fires "Running exec readout session…" at t+2s regardless of progress. Either remove or drive from real stream events (D4). |
| B7 | Remove the 2-second wait for the step-10 insight | `processors/llm_processor.py:775-777, 917-944` | Busy-wait on a cache to beat a race; goes away when insights are part of the step output (D2). |

## C. Security and hygiene

| # | Change | Where |
|---|---|---|
| C1 | Delete `/api/test-perplexity` — it returns the first 20 characters of the API key to any caller | `routes.py:679-792` |
| C2 | Put `/api/debug/*`, `/api/reporting/*`, `/reporting` behind auth or remove for production | `routes.py:794-1355` |
| C3 | Restrict CORS to the app origin | `app.py:47` |
| C4 | Fail fast when `SESSION_SECRET` is unset in production instead of `"dev-secret-key"` | `app.py:44` |
| C5 | Delete stray files `=0.40.0` and `=1.0.0` (captured pip output) and add `data/` to `.gitignore` (already) | repo root |
| C6 | SQLite at `data/reporting.db` is lost on every Replit autoscale deploy; point `DatabaseService` at Postgres (Replit provides one) or accept that reporting is ephemeral | `utils/database_service.py:17` |
| C7 | Remove the `allowedHosts` Replit hostname hard-coded in the Vite config | `frontend/vite.config.ts:16` |

## D. Frontier patterns that pay off even without the rewrite

| # | Pattern | Effect |
|---|---|---|
| D1 | `cache_control: {type:"ephemeral", ttl:"1h"}` on each step's system prompt | Persona system prompts are 1–3K tokens and identical across runs; with the 512-token minimum on current models they all cache. Cheap win, no design change. |
| D2 | Structured outputs (`output_config.format`) for steps 0, 4, 7, 8, 9, 10 and for the insight call | Removes every regex in `App.tsx:617-747` and `929-1041`, the `FAQFixWrapper` DOM surgery in `StepCard.tsx`, and half of `contentProcessor.ts`; makes the PR version timeline guaranteed-complete. This is the highest-leverage single change. |
| D3 | Web search (`web_search_20260209`) in step 1 instead of Perplexity | Real citations with cited text; one fewer vendor and SDK; the URL-slug title guessing in `perplexity_processor.py:174-206` goes away. |
| D4 | `thinking: {type:"adaptive", display:"updates"}` on the research step and `display:"summarized"` elsewhere | Real progress lines to replace the timer messages; reasoning summaries for a "working notes" panel. |
| D5 | Streaming `text_delta`s through the existing SSE channel | Even in the Flask design, forwarding deltas turns 60-second blanks into live typing. |
| D6 | Run steps 5 and 6 concurrently | Only requires moving one `await`; saves a full stage of wall clock. |
| D7 | Fold the insight into each step's schema | Deletes `_trigger_insight_extraction`, both insight endpoints, the late-fetch effect in `App.tsx:872-882`, and the insight cache. |

## E. Do not change

- The substance of the persona prompts in `config.py`: mandates, frameworks, the 16 internal questions, the 3/4/2/1 persona mix, the eight-part PR structure, the "surgical edits only" constraints on refinement steps.
- The sequence and the four PR checkpoints (v1 draft, v2 VP-refined, v3 customer-validated, v4 editorial-final).
- The human gate after framing (step 0) with per-section feedback.
- The Word export's typographic decisions (Calibri 10pt, centred bold headline, italic sub-heading, underlined FAQ section headers) — port them onto the typed document model.
