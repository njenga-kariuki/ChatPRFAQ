# 01 · What ChatPRFAQ does today (and what was intentional)

This is a ground-truth read of the codebase as it stands on `main` (last commit June 2025). It exists so the refresh preserves the *intent* of the original design, not just its surface.

## 1. The product in one paragraph

A user types a product idea. A "Product Strategy Expert" reframes it into Target Customer / Customer Problem / Product Scope; the user reviews, optionally gives per-section feedback, and confirms. A council of ten AI personas then runs a strictly sequential Working Backwards process, each persona consuming specific prior outputs, culminating in an executive-ready PRFAQ plus a hypothesis-driven validation plan. While it runs, the UI narrates the team at work ("VP Product reviewing press release…", "Running exec readout session…"), surfaces a one-line insight per step, and afterwards lets the user scrub through four versions of the press release with redlines showing how each pass changed the document.

## 2. The council, step by step (the critical sequential workflow)

| # | Persona (from `config.py`) | Model / tool | Consumes | Produces | Downstream use |
|---|---|---|---|---|---|
| 0 | Product Strategy Expert | Claude | Raw idea (+ user feedback on refine) | Three-section analysis | Enriched brief = idea + analysis (string concat in `create_enriched_product_brief`) |
| 1 | Expert Market Research Analyst | **Perplexity `sonar-pro`** (via OpenAI SDK) | Enriched brief | Market research w/ citations appended as "## Source List" | Steps 2, 3, 4, 5, 6, 9 |
| 2 | Principal User Researcher (problem discovery) | Claude | Brief + market research | 10-persona problem validation (3 acute / 4 moderate / 2 edge / 1 skeptic) | Steps 3, 4, 5*, 6*, 9* |
| 3 | Principal Product Manager | Claude | Brief + market research + problem validation | **PR v1** (headline, sub-head, 6 flowing paragraphs) | Step 4 |
| 4 | VP Product | Claude | PR v1 + market research + problem validation | "## Key Refinements Made" + "## Refined Press Release" → **PR v2** | Steps 5, 6, 7 |
| 5 | VP Business Lead + Principal Engineer (dual persona) | Claude | PR v2 + market research + problem validation* | Internal FAQ (16 numbered Q/A across 5 sections) | Step 9 |
| 6 | Senior User Research Lead (concept test) | Claude | PR v2 + market research + problem validation* | 10-participant concept test: Resonated / Major Concerns / Surprising / Polarizing / Refinements / one synthesized FAQ | Steps 7, 8, 9* |
| 7 | Principal PM (customer insights integration) | Claude | PR v2 + concept validation | "## Key Refinements Made" + "## Updated Press Release" → **PR v3** | Steps 8, 9 |
| 8 | Customer Success Lead | Claude | PR v3 + concept validation | External FAQ (5 numbered Q/A) | Step 9 |
| 9 | Senior Editor/Writer | Claude | PR v3 + market research + external FAQ + internal FAQ + research insights* | Full PRFAQ (Exec Summary, polished PR = **PR v4**, Customer FAQ, Internal FAQ + "how research shaped this") | Step 10, final document |
| 10 | Head of Product Validation & Research | Claude | PRFAQ document | ICE-scored hypotheses, 3-phase validation sequence, test plans for top 5, "what we're NOT testing" | Final document |

`*` = **truncated to the first 500 characters** in code (`_handle_concept_validation_research`, `_handle_prfaq_synthesis_enhanced`). This was a context-window workaround for 8K-output-era models and it silently starves steps 6 and 9 of the problem-validation findings they are told to use. Step 5 gets the full text.

Every step also spawns a **background insight thread** (`_trigger_insight_extraction`) that asks a small model for one sentence with a fixed label per step (Insight: / Pain: / Headline: / Refined: / Risk: / Finding: / Change: / Top Q: / Thesis: / Must nail:). Steps 4 and 7 use a *comparative* prompt (before vs after) so the insight describes what changed. Insights are cached server-side and re-fetched by the UI after the stream ends because they often arrive late.

### What was deliberately designed and must survive the refresh

1. **The council is a sequence of handoffs, not a bag of agents.** Every prompt is written as "you are receiving X from colleague Y; do Z with it." The ordering encodes Amazon's actual review culture: research before writing, VP review before FAQs, customer validation before the second rewrite, editorial polish last.
2. **The press release is a living document with four checkpoints** (v1 draft → v2 VP-refined → v3 customer-validated → v4 editorial-final). Refinement steps are constrained to *surgical* edits (preserve paragraph purpose, stay within 10% word count, don't add features) so the diffs are meaningful.
3. **Two rounds of simulated customer research** bracket the drafting: problem validation (is the pain real?) before the first draft, concept validation (does the solution land?) after the VP pass. Step 6 is explicitly told not to re-validate the problem.
4. **A human gate at Step 0.** The user confirms or refines the framing before the council starts. Nothing else is gated.
5. **Team-dynamics narration** per step (the `step_activity_messages` table in `claude_processor.py`) so waiting feels like watching colleagues, not a spinner.
6. **Evidence discipline in the prompts**: "do not make up any data", "leverage market research insights throughout", "use language directly from customer research".
7. **Executive formatting rules** are baked into every prompt (bold-colon headers, Q/A on the same line, no meta-commentary, no horizontal rules) because the renderer and the Word exporter parse the markdown with regexes.

## 3. How it is wired (backend)

- `app.py` → Flask + CORS; `routes.py` (1,355 lines) holds every endpoint.
- `processors/llm_processor.py` (1,240 lines): a hand-unrolled `process_all_steps` that calls `generate_step_response` ten times, each branch a bespoke `_handle_*` that formats the prompt from `config.py` and calls `ClaudeProcessor.generate_response`. State lives in `self.step_outputs` on a **module-level singleton** (`llm_processor = LLMProcessor()` in `routes.py`), so two concurrent runs overwrite each other's step outputs.
- `processors/claude_processor.py`: one non-streaming `messages.create` per step (`max_tokens=8192`, `temperature=0.3`, `top_p=0.95`), a hand-rolled retry loop keyed on error-message substrings, and `threading.Timer`s that fire the team-dynamics messages on a fixed 2-second cadence regardless of actual progress.
- `processors/perplexity_processor.py`: step 1 via the OpenAI SDK pointed at Perplexity; citations come back as a URL list and are appended as a markdown "Source List" whose titles are guessed from URL slugs.
- `routes.py /api/process_stream`: Server-Sent Events implemented as a background thread + `queue.Queue` + heartbeat thread + step-aware timeouts (120–300s) + a separate `completion_states` dict so the client can poll `/api/check-completion/<id>` when the stream dies.
- Persistence: an in-memory `raw_llm_outputs_cache` (24h TTL, 100 entries) dual-written to SQLite at `data/reporting.db`, plus a `/reporting` HTML dashboard. On Replit autoscale the SQLite file is ephemeral.
- Insight extraction: `claude-3-5-haiku-20241022` in a daemon thread; Gemini Flash is initialised but never used.

## 4. How it is wired (frontend)

- `App.tsx` (1,813 lines) is the whole state machine: landing → analyzing → reviewing → processing → results; SSE parsing; localStorage progress save/resume; a 30-second "hang detection" poller; a debug panel; and **two copies** of the PR-version extraction switch (one for live SSE, one for the poller).
- PR versions are recovered from step outputs by **regex** (`/## Refined Press Release[\s\S]*?(?=##|$)/` etc.) with fallbacks that dump the whole step output into the version slot when the header is missing.
- `EnhancedResults.tsx` is the results shell with four tabs: Final Documents (PRFAQ / MLP plan sub-tabs, Word export), PR Evolution, Research Artifacts, Process.
- `PressReleaseEvolution.tsx` + `VersionRangeSlider.tsx` + `DocumentDiffViewer.tsx`: a from/to range slider over v1–v4 with a "Show Redlines" toggle. Three diff engines are stacked with fallbacks: mdast AST diff (LCS over blocks with a Jaro-Winkler similarity heuristic, then `diff-match-patch` inside changed blocks) → a pattern-based "markdown-aware" diff → raw character diff. Rendered in a Georgia-serif "document viewer" with Word-style track-changes colours.
- `StepCard.tsx`: accordion per step with status rail, persona label, the one-line insight (truncated, expands on hover), and the markdown output. A `FAQFixWrapper` mutates the DOM after render to repair FAQ formatting.
- `prfaqExporter.ts` (882 lines): parses the final PRFAQ markdown back into headline / sub-heading / body / FAQ sections with regexes and emits a Calibri 10pt `.docx` via the `docx` library, with a `recoverMissingContent` pass for when parsing fails.
- `contentProcessor.ts`: a list of regex "safe cleanup rules" applied to every model output before render and before diffing.

## 5. What is broken, obsolete, or fragile today

**Will not run as-is**
- `claude-3-5-haiku-20241022` (insights) was retired 2026-02-19 → 404 on every insight call.
- `claude-sonnet-4-20250514` (all council steps) was deprecated with retirement 2026-06-15. Treat as gone.
- `gemini-2.5-flash-preview-05-20` is a dead preview ID; the `google-generativeai` dependency is loaded for nothing.
- `anthropic` is pinned at 0.52 (lockfile). The current SDK is 1.x on `httpx2`; `temperature`+`top_p` together are rejected by every current model, and `max_tokens=8192` now caps thinking *plus* text.

**Quality defects in the pipeline**
- Steps 6 and 9 receive only the first 500 characters of the problem-validation research (see the `*` above).
- Step 7's prompt never sees the internal FAQ even though the handler formats it (harmless today, but the VP/engineer findings never feed the customer-validated rewrite).
- Step 10 receives only the PRFAQ prose, not the research or the internal FAQ's risk register, so its hypotheses are re-derived from a polished document rather than from evidence.
- No retries or validation on *content*: a step that returns the wrong structure (e.g. no "## Refined Press Release" header) silently corrupts the version timeline downstream.
- Team-dynamics messages are timer-driven fiction: "Running exec readout session…" fires at t+2s whether or not anything happened.

**Architecture debt**
- Non-streaming calls mean the user sees nothing for 40–90 seconds per step; total run time in the captured logs is 5–10 minutes of mostly-blank waiting.
- Global mutable singleton → not safe for two users at once.
- Threads + queue + heartbeat + poller + localStorage resume are five mechanisms compensating for the absence of a persisted run record.
- The SSE contract is untyped; the frontend switches on ad-hoc keys (`type`, `step`, `status`, `keyInsight`, `complete`, `done`, `keepalive`).
- Every structural fact the UI needs (which paragraph changed, why, which persona) is recovered by regex from prose that was asked, politely, to follow a format.

**Security / hygiene**
- `/api/test-perplexity` returns the first 20 characters of the API key to any caller. Remove.
- `/api/debug/*` and `/api/reporting/*` (full idea text + full LLM outputs) are unauthenticated.
- `CORS(origins="*")` on all API routes.
- Two stray files in the repo root named `=0.40.0` and `=1.0.0` (pip output captured by a shell redirect).

## 6. Scale of the codebase

| Area | Lines | Verdict |
|---|---|---|
| `config.py` (prompts) | 975 | **Keep the substance** – the persona voices and methodology are the product |
| `processors/*` | 1,933 | Rewrite |
| `routes.py` | 1,355 | Rewrite |
| `utils/*` | 658 | Rewrite (schema survives) |
| `frontend/src/App.tsx` | 1,813 | Rewrite |
| Diff system (3 engines + 2 renderers) | ~1,050 | Replace with structured edits + one renderer |
| `prfaqExporter.ts` | 882 | Rewrite against the structured document model |
| Remaining components | ~2,000 | Mostly rewrite under the new design system |
