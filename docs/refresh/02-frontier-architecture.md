# 02 · Frontier architecture: how to rebuild the council on today's Claude platform

Goal: the same council, the same sequence, the same living document — but every persona thinks with a frontier model over the *complete* dossier, every step streams, every edit carries provenance, and the whole run is a durable, resumable, shareable record. This document is the engineering design; `03-design-brief.md` is the UX design; `05-project-outline.md` is the build plan.

All API facts below were checked against the current Claude API reference bundled with this session (model IDs, parameters, betas). Where a detail should be re-verified at implementation time it is marked **verify**.

---

## 1. Which tier of the platform

Three options were considered:

| Option | Fit | Why |
|---|---|---|
| **Claude API + code-controlled workflow** (each council step = one Messages API request, orchestrated by our own DAG runner) | **Chosen** | The council is a *deterministic* sequence with typed inputs and outputs per step. We need per-step schemas, per-step models/effort, precise UI events, and replayable state. That is exactly the "workflow" tier. |
| Managed Agents (multiagent coordinator + roster of persona agents) | Rejected | Built for open-ended agent loops with a sandbox and model-driven delegation. It would put the council's ordering under the model's control and put our UI at the mercy of an event stream we don't shape. We don't need bash, files, or containers. |
| Single long conversation, one model plays all personas in turn | Rejected | Loses per-step schemas and parallelism, and every step would drag the full transcript (including prior thinking) forward. The original's one-request-per-step shape is right; keep it. |

One consequence worth stating: because every step is a **fresh, single-turn request** (no replayed assistant turns), the pipeline is untouched by the Claude Fable 5.1 "preserved thinking" history-editing rules — there is no transcript to edit.

---

## 2. Model strategy

### 2.1 Recommendation

Run the **judgment** seats on **Claude Fable 5.1** (`claude-fable-5-1`, Anthropic's most capable widely released model) and the **volume/extraction** work on **Claude Sonnet 5** (`claude-sonnet-5`), with **Claude Opus 5** (`claude-opus-5`) as the configured alternative for every seat and as the automatic fallback target. Make the model per seat a config value; the table below is the recommended default.

| Seat | Model | Effort | Rationale |
|---|---|---|---|
| 0 Framing (Strategy Expert) | Sonnet 5 | medium | Short, structured, latency-sensitive (user is waiting to review) |
| 1 Market Research (agentic web research) | **Fable 5.1** | high | Multistep web research is a headline Fable 5.1 strength; quality of everything downstream depends on it |
| 1b Findings extraction (evidence ledger) | Sonnet 5 | low | Pure extraction into schema; input-heavy |
| 2 Problem Validation (10 personas) | **Fable 5.1** | high | Simulated interviews need believable, specific, non-generic voices |
| 3 PR Draft (Principal PM) | **Fable 5.1** | high (test xhigh) | The document everyone else edits |
| 4 VP Refinement | **Fable 5.1** | high | Surgical, evidence-grounded edits with rationale |
| 5 Internal FAQ (VP Biz + Principal Eng) | **Fable 5.1** | high | TAM, business model options, risks — the hardest reasoning in the run |
| 6 Concept Validation (10 participants) | **Fable 5.1** | high | Same as 2 |
| 7 Solution Refinement | **Fable 5.1** | high | Same as 4 |
| 8 External FAQ | Sonnet 5 | medium | Formatting-heavy, derived from 6 |
| 9 Editorial Synthesis | **Fable 5.1** | high | Voice, flow, claim-checking across the whole dossier |
| 9b Bar Raiser (new, optional) | Opus 5 | high | Independent reviewer should be a *different* model than the author |
| 10 Validation Plan | **Fable 5.1** | high | Hypothesis decomposition + ICE scoring |
| Insights (per step) | *none* | – | Folded into each step's schema (see §4); no extra call |

Why not Opus 5 everywhere: the owner asked for the absolute frontier and this is a document where reasoning depth is the product. Why not Fable 5.1 everywhere: seats 0, 1b and 8 are structurally simple and latency-sensitive; Sonnet 5 there saves ~30% of run cost and time with no visible quality loss. An A/B on the eval set (§8) settles any seat where this is doubted; the config makes that a one-line change.

### 2.2 Non-negotiable API facts for these models

- **Thinking is always on** for Fable 5.1 (omit the `thinking` parameter or send `{type: "adaptive"}`; `disabled` and `budget_tokens` return 400). Opus 5 and Sonnet 5 also think by default. Control depth with `output_config.effort` (`low`…`max`), not a budget.
- **No sampling parameters.** `temperature`, `top_p`, `top_k` are rejected. The old `temperature=0.3, top_p=0.95` goes away; determinism comes from schemas and prompts.
- **No assistant prefill; no forced `tool_choice` on Fable 5.1.** Use structured outputs for JSON and plain instructions for tool steering.
- **`max_tokens` caps thinking + text.** Size it generously (16K for FAQ steps, 32K for research/PR/synthesis) and always stream.
- **Handle `stop_reason == "refusal"` before reading content**, and opt into server-side fallbacks by default: `betas=["server-side-fallback-2026-07-01"], fallbacks="default"` on `client.beta.messages.stream(...)`. Council content is benign, but Fable 5.1's classifiers (bio/cyber/reasoning-extraction) can false-positive; with `"default"` the API re-runs a declined request on Opus 5 / Opus 4.8 inside the same call. Log `usage.iterations` so we know when a seat was served by the fallback.
- **Thinking summaries** are opt-in: `thinking={"type": "adaptive", "display": "summarized"}` returns a readable summary (billing unchanged). We use it for the "working notes" panel. On research steps, `display: "updates"` (beta `thinking-display-updates-2026-08-18`) returns the model's between-tool progress notes — this is what replaces the timer-driven "team dynamics" fiction with real narration.
- **Data retention:** Fable 5.1 requires 30-day retention on the org/workspace (a ZDR org gets a 400 on every request). Confirm before the first deploy.
- **Pricing** (per MTok): Fable 5.1 $10 in / $50 out, cache reads $0.25; Opus 5 $5 / $25; Sonnet 5 $2 / $10. Web search is billed per search on top. Cache minimum prefix is 512 tokens on all three.
- **SDK:** `anthropic` 1.x (Python ≥ 3.10, `httpx2`). Use `AsyncAnthropic`, `messages.stream()`, typed exceptions, `max_retries` — delete the hand-rolled retry loops.

---

## 3. The context system: an append-only dossier with a cached council charter

This is the heart of the "right context system". Two rules:

**Rule 1 — one frozen system prompt for the whole council.**
`system` is byte-identical for every step of every run: the Working Backwards charter (methodology, the eight-part press release structure, evidence rules, house style, formatting that schemas don't already enforce) **plus the full persona roster** — all eleven seats, each with its mandate and what it hands to whom. Mark it `cache_control: {type: "ephemeral", ttl: "1h"}`. Effects:
- The ~10–15K-token charter is written once an hour and read at $0.25/MTok by every step of every run (caches are shared across users within the workspace).
- Every persona knows who came before and who comes next, which measurably improves handoffs ("the VP will review this; the Customer Success Lead will turn concerns into FAQs").
- The step's *role selection* goes in the task block at the end of the user message ("You are now seat 4, the VP Product…"), not in `system`. Changing `system` per step would invalidate the message cache on every step.

**Rule 2 — the dossier is append-only and canonically ordered.**
The single user message is a list of text blocks in a fixed order, one per artifact, each block prefixed with a stable header (`<artifact id="market_research" step="1" persona="Market Research Analyst">`):

```
brief → market_research → findings_ledger → problem_validation → pr_v1 →
pr_v2 → internal_faq → concept_validation → pr_v3 → external_faq → prfaq
```

A step's message contains exactly the prefix of that list it is entitled to, then its task block. Because the list only grows and never reorders, step N+1's prompt is step N's prompt plus new blocks, so with a `cache_control` marker on the last dossier block each step reads the whole prior dossier from cache and writes only the delta. Within a run, steps are minutes apart, so the default 5-minute TTL is enough for the dossier; the 1-hour entry (system) legally precedes the 5-minute entries.

Two refinements:
- **Parallel seats share the prefix.** Seats 5 and 6 consume the same dossier. Fire 5, await its first streamed token (the cache entry becomes readable once streaming starts), then fire 6 — 6 reads what 5 wrote.
- **Per-seat effort without cache loss.** Changing top-level `output_config.effort` between requests invalidates the message cache. Pin the top-level effort to `high` for the run and, for the two Sonnet/low seats, either accept the miss (their prompts are small) or use the per-message effort system message (`{"role": "system", "content": [], "output_config": {"effort": "low"}}`, beta `mid-conversation-output-config-2026-07-01`, Fable 5.1 / Opus 5 only). **verify** the beta is open to the org; otherwise accept the miss.

What this replaces: the ad-hoc `step_data` dict, the `[:500]` truncations, and every prompt's private copy of the PR structure. The 1M context window means no step is ever starved; the largest step-9 prompt is well under 100K tokens.

**Silent-invalidator checklist for the implementer:** no timestamps, request IDs, or run IDs anywhere in `system` or in the dossier blocks; `json.dumps(..., sort_keys=True)` for any serialized artifact; tools list deterministic per seat (only seat 1 has tools); one model per seat (caches are model-scoped — Sonnet seats never share Fable's cache, which is fine, their prompts are the small ones). Add an integration test asserting `cache_read_input_tokens > 0` on step 3 of a run.

---

## 4. Structured outputs end the regex era

Every seat returns JSON validated against a Pydantic model via `output_config.format` (`client.messages.parse` for non-streaming; `messages.stream(..., output_config={"format": ...})` + validate on `get_final_message()` when streaming). Structured outputs work with streaming and thinking; the schema is compiled once and cached for 24h. Constraints to design around: `additionalProperties: false` on every object, no recursion, no min/max — keep schemas flat.

The one incompatibility that shapes the design: **structured outputs cannot be combined with citations.** Seat 1 therefore runs in two phases (§5).

### 4.1 The shared document model

```python
class PRSection(BaseModel):          # the design brief calls these "slots"; same eight ids
    id: Literal["headline","subheading","summary","problem","solution","benefits","internal_quote","cta"]
    text: str
    claims: list[Claim]           # each: {text, finding_ids: list[str] | None, kind: "evidence"|"assumption"}

class PressRelease(BaseModel):
    sections: list[PRSection]     # exactly the eight, in order

class Edit(BaseModel):
    section_id: ...               # which PR section
    new_text: str
    rationale: str                # one sentence, written for the author
    evidence_finding_ids: list[str]
    change_kind: Literal["sharpen","clarify","reground","cut","reorder-within-section"]

class RefinementResult(BaseModel):
    edits: list[Edit]
    press_release: PressRelease   # the full new version, so the UI never has to apply patches
    summary_of_changes: str       # the comparative "insight" for this step
    key_insight: str              # one sentence, ≤ 20 words
```

Seats 4, 7 and 9 return `RefinementResult`; seat 3 returns `PressRelease` + `key_insight`; seats 5 and 8 return `list[FAQItem]`; seat 6 returns the concept-test schema with participant ids, counts, and quotes; seat 10 returns `Hypothesis[]` with ICE fields as numbers; seat 0 returns the three framing fields. The final PRFAQ is a typed composition, so the Word/PDF exporter renders a model instead of parsing prose.

What this buys: paragraph-level diffs are computed per `section_id` with a plain character diff inside the section (the 1,050-line three-engine diff stack goes away); every edit shows who/why/which finding; the version timeline is guaranteed complete (a step that fails schema validation is retried once with the validation error appended, then marked failed — it can never silently corrupt v2…v4); the per-step insight is a field, so the late-insight cache, the polling, and the insight thread all disappear.

Streaming JSON progressively: the server forwards `text_delta`s; the client runs a tolerant partial-JSON parser and renders section text as it fills in, so the user still watches the PM write the press release paragraph by paragraph. Alternative if that UX proves fiddly: stream markdown for the drafting seats and run a Sonnet "structurer" pass after — one extra cheap call, slight fidelity risk; not recommended as the default.

---

## 5. Research with real evidence

Seat 1 replaces Perplexity with Claude's server-side **web search** (`web_search_20260209`, dynamic filtering built in) and **web fetch** (`web_fetch_20260209`; **verify** the current fetch variant for Fable 5.1 at implementation time). One agentic request: the model runs up to `max_uses` searches (start at 15), fetches the pages worth reading, and writes the market research as markdown **with citations** (text blocks carry `citations` with URL, title, and the cited passage). Between tool calls, `display: "updates"` gives real progress lines for the UI.

Phase 1b (Sonnet 5, low effort, structured output): turn the cited research into an **evidence ledger** — `Finding{id, claim, metric?, source_ids, confidence}` and `Source{id, url, title, cited_text}`. From here on, every persona is told to cite finding ids when they use a number or a market claim, and the editor (seat 9) is told to flag any quantitative claim in the PR that has no finding id as an *assumption* (rendered differently in the UI, listed in the validation plan). This is the mechanism that makes "do not make up any data" enforceable instead of aspirational.

Keep a `ResearchProvider` interface so Perplexity can be re-plugged as an alternative provider, but do not ship it in v1 — the OpenAI SDK dependency and the URL-slug citation titles both go.

---

## 6. Orchestration: a DAG runner with streaming, persistence and resume

### 6.1 Dependencies (what actually depends on what)

```
0 ─▶ 1 ─▶ 1b ─▶ 2 ─▶ 3 ─▶ 4 ─┬▶ 5 ─┐
                                 │     ├─▶ 7 ─▶ 8 ─▶ 9 ─▶ 9b ─▶ 10
                                 └▶ 6 ─┘
```

- 5 (Internal FAQ) and 6 (Concept Validation) both need only v2 + research; they run in parallel. Seat 7 then also receives the internal FAQ (the original intended this and never wired it).
- 10 (Validation Plan) is re-sourced to consume v3 + both FAQs + the evidence ledger *alongside* the final PRFAQ, so its hypotheses come from findings and the risk register rather than from polished prose. Because it no longer strictly depends on seat 9, it *could* run in parallel with 9; the design brief argues for keeping 8→10 sequential so the "editor waits for everything, then the validation lead closes" beat survives. Ship it sequential behind a config flag (`PARALLEL_VALIDATION_PLAN=false`).
- Critical path drops from 10 serial stages to 9 (8 with the flag), and every stage streams from its first second.

Preserve the *visual* sequence in the UI even where execution is parallel (the design brief covers how: fixed slots, two monograms breathing, nothing reorders).

### 6.2 Runtime

- **FastAPI + uvicorn**, `AsyncAnthropic`, one `asyncio.Task` per run, `asyncio.gather` for the parallel fan-outs. Flask's thread+queue+heartbeat machinery is deleted.
- **Persistence first, streaming second.** Every event the runner emits is appended to an `events` table (Postgres in production; SQLite locally) *before* it is pushed to subscribers. The SSE endpoint `GET /api/runs/{id}/events` replays from `Last-Event-ID` and then tails — so a dropped connection, a refresh, a second tab, or a shared link all show the same run. This single decision removes the hang-detection poller, the completion-state dict, the localStorage resume, and the "connection lost during step N" dead-end.
- **Resume = re-run the DAG from the last completed node.** Because artifacts are persisted per step, a failed step 7 restarts at 7 with the same dossier prefix (and a warm cache).
- **Typed event contract** (one discriminated union, shared with the frontend via generated TypeScript types):
  `run.started`, `step.started{seat, persona, model}`, `step.progress{seat, note}` (from `display: "updates"` / thinking summaries), `step.delta{seat, text}`, `step.tool{seat, kind: "search"|"fetch", query|url}`, `step.completed{seat, artifact_id, key_insight, usage}`, `step.failed{seat, error, retryable}`, `document.version{version, artifact_id, edits}`, `run.completed{prfaq_id, plan_id, cost}`, `run.failed`.
- **Cancellation** via `POST /api/runs/{id}/cancel` (task cancel + event).
- **Cost accounting** from `usage` on every step (input, cached, output, web searches) stored on the step row and summed on the run.

### 6.3 Reliability rules

- SDK retries (`max_retries=3`) handle 429/5xx/connection errors. On `stop_reason == "max_tokens"`, retry once with double `max_tokens`. On schema validation failure, retry once with the validator message appended to the task block. On `refusal` after fallbacks, fail the step with the category.
- Per-step timeout of 15 minutes (Fable 5.1 at high effort can legitimately run for minutes on the research seat); no per-message timeouts on the SSE path.
- Idempotent step execution keyed on `(run_id, seat, attempt)`.

---

## 7. Prompts: keep the voices, drop the scaffolding

`config.py` holds 975 lines of prompt text that encode the actual craft. Keep the personas, mandates, frameworks (Mom Test, JTBD, Sean Ellis, Kano, ICE), the eight-part PR structure, the 16 internal questions and the persona mix (3/4/2/1). Change:

- **Move all formatting rules into schemas.** "Colon inside the bold markers", "Q/A on the same line", "no horizontal rules", "no meta-commentary" exist because the renderer regex-parsed prose. With typed outputs they are deleted, which shortens every prompt by a third.
- **De-prescribe for Fable 5.1.** State the goal, the constraints and the quality bar; remove step-by-step "METHODOLOGY 1…6" enumerations where the model already knows the craft. Prior-model scaffolding measurably reduces Fable 5.1 output quality. A/B on the eval set.
- **Give the reason.** Each task block opens with the frame the council needs: "You are seat 4 in a Working Backwards council. The PM's draft is below. Your edits will be shown to the author with your rationale, and the customer research lead will test the result with ten customers next."
- **Evidence rules become mechanical**: "Every market number cites a finding id from the ledger. If you need a number the ledger doesn't have, write it as an assumption."
- **Add the density guard** ("say what you mean; when a literal phrase is available, use it") for the prose seats, and calibrate length explicitly (PR 600–800 words; FAQ answers 60–140 words).
- **Remove** "double-check", "verify your output", anti-formatting language and the retry-on-format instructions.
- Add the autonomy line to the research seat so it never ends its turn asking whether to search more.

---

## 8. Quality loop and evaluation

- **Bar Raiser (seat 9b, optional, on by default in the proposal):** an Opus 5 reviewer scores the synthesized PRFAQ on a fixed rubric (customer clarity, problem specificity, believability of anecdotes, feasibility of v1, differentiation, evidence coverage, executive readability), each 1–5 with one sentence, and returns at most five required fixes. Seat 9 applies them in one more pass (capped at one loop). The scores are shown in the UI and persisted, so quality becomes a number over time.
- **Eval set:** 12 seed ideas spanning B2B/B2C/hardware/services, run through the council, graded by an LLM judge (Sonnet 5) on the same rubric plus a hallucination check against the ledger. Use it to settle model/effort/prompt choices and to catch regressions. The bundled `claude-api build-eval` workflow scaffolds this.
- **Observability:** per-step model, effort, tokens, cache hits, web searches, duration, refusal/fallback flags, Bar Raiser score — on the run record and in a small ops view (replaces the old `/reporting` dashboard).

---

## 9. Speed and cost, honestly

| | Today (Sonnet 4 + Perplexity) | Refresh (recommended mix) | Refresh (all Opus 5) |
|---|---|---|---|
| Time to first visible output per step | 40–90 s (nothing until the step finishes) | < 3 s (streaming) | < 3 s |
| Wall clock, full run | ~5–10 min | ~4–6 min at `high` (9 stages, 5‖6 fan-out; research seat is the long pole) | ~3–5 min |
| Input tokens per run (est.) | ~250K | ~450K, ~70% served from cache | same |
| Output + thinking tokens (est.) | ~50K | ~120–150K | ~100–120K |
| Cost per run (est.) | ~$1.5–2 | **~$6–9** | ~$3.5–4.5 |

Costs are estimates to be baselined with `count_tokens` and real runs; the "recommended mix" number is dominated by Fable 5.1 output pricing and thinking. Effort sweeps (`medium` on seats 2/6/10) will pull it down without visible loss if the eval says so. The old run was cheap because it was shallow and truncated; the new run is priced like a document ten colleagues actually read.

---

## 10. What "10x" concretely means

| Dimension | Before | After |
|---|---|---|
| Model | Sonnet 4, 8K output, no thinking, temperature-sampled | Fable 5.1 / Sonnet 5 with adaptive thinking, 1M context, structured outputs |
| Context per persona | Truncated to 500 chars in two seats; ad-hoc dict | Complete, canonical, cached dossier |
| Research | One Perplexity call, URL-slug citations | Agentic web research with real citations, an evidence ledger, claims traced to sources |
| Edits | Full-document rewrite, regex-recovered, heuristic AST diff | Structured per-section edits with rationale and evidence; exact diffs |
| Waiting | Blank spinner + timer fiction | Token streaming + real progress notes + thinking summaries |
| Reliability | Threads, heartbeat, poller, localStorage, global singleton | Persisted event log, replayable SSE, resume from any step, multi-tenant safe |
| Quality control | None | Schema validation, Bar Raiser rubric, eval set |
| Runs | Lost on refresh | Durable, shareable URL, history |
