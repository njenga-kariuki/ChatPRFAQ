# 03 · Design brief: the council progression and the living document

> Produced by a dedicated design pass over the full frontend (`frontend/src`, `index.css`), the step prompts in `config.py`, the SSE shapes in `routes.py`, and the captured run logs. It is written for the frontend engineer building Phase 2 of `05-project-outline.md`. Naming note: this brief calls the eight press-release paragraphs *slots*; the schemas in `02-frontier-architecture.md` call the same objects *sections* with the same eight ids.


Scope: design thinking only, written for a frontend engineer to build from. Based on a full read of `frontend/src` (~7k lines), `index.css`, `config.py` step prompts, `routes.py` SSE shapes, `processors/claude_processor.py` team-dynamics strings, and the two pasted run logs. The two PNGs in `attached_assets/` are a Replit port dialog and a Flask 404, not UI captures, so the critique is from code, not screenshots.

Two ideas are sacred and every decision below serves them: (a) a visible progression of colleagues reviewing and handing off, and (b) the press release as a living document whose edits across v1 to v4 are inspectable, with each edit tied to who made it and what research drove it.

---

## 1. Critique of the current UX

### What works and must be preserved

- **The step-as-colleague card with a one-line insight** (`StepCard.tsx`). Collapsed header = step name + persona + labelled insight ("Pain:", "Refined:", "Top Q:"); expanded = full output. This is the right atom. The label vocabulary from `_get_insight_label` (Insight/Pain/Headline/Refined/Risk/Finding/Change/Top Q/Thesis/Must nail) is good product writing; keep it verbatim.
- **Named versions with a source subtitle** (`PressReleaseEvolution.tsx` `versionInfo`: "v2 VP Refined, Executive Feedback"). Provenance in embryo; keep the four names.
- **Redlines as a first-class toggle** in a serif, page-like `.document-viewer`. The document looks like a document, not a chat transcript.
- **Step 0 as a human gate** (`ProductAnalysisReview.tsx`): three cards (Target Customer / Customer Problem / Product Scope), refine or continue. This is the one place the user shapes the work and it should stay before anything expensive runs.
- **Team-dynamics messages while a step runs** ("VP Product reviewing press release...", "Running exec readout session...", "PM incorporating VP's strategic feedback..."). Cheap, human, and exactly the colleague feeling the owner wants.
- **Four lenses on a finished run** (`EnhancedResults.tsx` tabs: Final Documents / PR Evolution / Research Artifacts / Process). Right lenses, wrong container (below).
- **Exec-grade DOCX formatting** (`prfaqExporter.ts`): centered bold headline, italic sub-heading, 10pt Calibri, underlined FAQ headers. The format is right even though the parsing is fragile.
- **Restraint**: neutral grays, one blue, no dashboard chrome, copy buttons everywhere.

### What is weak

- **Personas have no identity.** They are a gray subtitle string. The same colleague recurs (Principal PM at steps 3 and 7; user researcher at 2 and 6) with no continuity, and the names hardcoded in `App.tsx` `initialStepsData` are stale versus `config.py`: step 8 says "Marketing" (backend: Customer Success Lead), step 10 says "Defining MLP Plan / PM + Tech Lead" (backend: Hypothesis-Driven Validation Plan / Head of Product Validation & Research), step 1 says "Market Analyst + PM". The roster must come from the server.
- **Insights are desktop-only and hover-only.** `.step-insight-container { display:none }` below 1280px; the full text appears only as a hover overlay. The best summary in the product is invisible on a laptop.
- **Handoffs are never expressed.** Step N completes, step N+1 opens. Nothing says "the VP is reading v1 plus the market research plus the problem validation." The dependency graph exists in `config.py` user prompts and is never surfaced.
- **Provenance is generated, then thrown away.** Steps 4 and 7 emit "## Key Refinements Made" (a numbered list of what was sharpened and why). The regex extraction strips it out to isolate the PR; the Evolution tab shows the diff with no who/why. The exact artifact the owner wants is discarded.
- **Two results UIs.** `ModernResults.tsx` is unreachable because `viewMode` flips to `'results'` on completion and `EnhancedResults` takes over with its own duplicated `localStepsData`. `ProcessingStatus.tsx` is imported and never rendered.
- **Progress is theater.** A percent the backend sends as a fixed value (logs show `progress: 8` through steps 1 to 3), capped at 99, behind a shimmer bar. Real timing is ~40 to 50s per step and ~8 to 10 minutes total; users get no elapsed time, per-step time, or ETA.
- **The version slider is over-built** (`VersionRangeSlider.tsx`, 292 lines) for four discrete stops; the compare/single mode reconciliation in `PressReleaseEvolution.tsx` (lines 31 to 79) is fragile state juggling. A four-stop segmented control does the job.
- **Research artifacts are decorated with fake stats.** "Industry Size" is `artifacts.marketResearch?.match(/\$[\d.]+[BMK]/)`; "10 Customers" and "10 Users" are hardcoded strings. Emoji icons (📊 🔍 ✅ 👥 ⚡ 🎯) in an executive tool.
- **Citations are rendered by CSS trick**: `.prose-custom li a::after { content: attr(href) }` prints the raw URL after the link text, truncated by breakpoint. No structured source model.
- **Styling debt that will block a redesign**: inline `style={{fontSize:'22px'}}` on most headings; ~30 `!important`s; `.insight-label { font-weight: 506000 }`; invalid CSS (`ring:`, `p:contains("[")`); mobile overrides keyed on Tailwind class names (`.bg-white.rounded-2xl { @apply p-6 }`); Tailwind v4 (`@import 'tailwindcss'`) paired with a v3 `tailwind.config.cjs` that v4 ignores without `@config`, so the custom grays likely never apply; unused Bootstrap Icons CDN in `index.html`; no dark mode; `FAQFixWrapper` rewriting `innerHTML` after render.
- **Landing copy**: an unverifiable "Used by PMs at OpenAI, Anthropic, Meta, Google, and Stripe"; two company names in footers (Kilele LLC, Work Back AI LLC).

### What is broken or fragile

- **Regex extraction of PR versions** (`App.tsx` cases 4, 7, 9): three cascading patterns each, then a fallback that stores the *entire* step output as the version. So v2 can contain the "Key Refinements Made" list and v4 can be the whole PRFAQ, which then diffs against a bare press release as a wall of red and green. This block is duplicated verbatim (~150 lines) inside the hang-detection polling path.
- **Insights arrive after the stream ends.** Insight extraction runs on a separate thread per step (log: `[INSIGHT THREAD - Step 9] ... Storing insight in cache for potential late retrieval`) and emits status-less events (`Step 9 | unknown`). The frontend compensates with `fetchLateInsights()` on a 500ms timer after the results view mounts. Insights must be modelled as arriving any time, including after `complete`.
- **Hang detection** (`App.tsx` ~line 950): a 30s timer that starts polling `/api/check-completion/:id` every 5s for 10 minutes and replays step outputs through a copy of the extraction switch. Its effect depends on `stepsData`, so the timer resets on every SSE event. This is a workaround for SSE dropping on the host; with server-persisted runs it should become "reconnect and replay from the event log."
- **"Resume from Step N" is not a resume.** `resumeFromSavedProgress` restores the cards from localStorage and then calls `proceedToMainWorkflow`, which resets every step to pending and re-runs from step 1.
- **`useSmartScroll`** blocks programmatic scrolling for 30s after any interaction and is never called. Dead, but instructive: auto-follow was a real need never solved.
- **Three diff engines with a red-box failure mode.** `DocumentDiffViewer` tries `markdownAstDiff` (hand-rolled LCS plus inline Jaro-Winkler), then `markdownAwareDiff`, then char diff. `AstDiffRenderer` renders headings as `<p>`, shows unknown nodes (blockquote, thematicBreak, html) as red "Unsupported: {type}" boxes, and reports hardcoded `0/0` stats under a bar reading "✨ AST Diff Active" to end users.
- **Refresh loses everything.** `/app` holds the run in memory; `resultId` is generated client-side and used for nothing; there is no run URL.
- **Debug surface ships to production**: Ctrl+Shift+D panel, `debugLogs` in localStorage, `console.log` throughout the exporter.

---

## 2. Information architecture

### Routes

| Route | Purpose |
|---|---|
| `/` | Landing: idea entry (the form is the hero) plus the council roster. |
| `/how-it-works` | Keep; rebuild on the persona system. |
| `/runs` | Library: past runs, resumable runs. |
| `/runs/:runId` | The Run. Redirects to the right view for its state: `brief` while framing, `council` while working, `document` when complete. |
| `/runs/:runId/brief` | Step 0 review (customer / problem / scope), refine, confirm. |
| `/runs/:runId/council` | Council progression (live and replayable). |
| `/runs/:runId/council/:step` | One step: full output, notes, findings/edits produced, inputs consumed. |
| `/runs/:runId/document` | Final PRFAQ (and the validation plan as a second document). |
| `/runs/:runId/evolution?from=1&to=2&slot=problem&edit=3` | Version timeline, redline, walkthrough. Query params make every state linkable. |
| `/runs/:runId/research` | Findings and sources with backlinks. |
| `/s/:token` | Read-only share of a run (document by default, evolution and research available, council replay available, notes hidden). |

### Object model, as the user perceives it

- **Run**: idea text, brief (customer / problem / scope), status (framing / working / paused / complete / failed), created and finished times, steps, versions, documents, findings, sources, share token.
- **Council Step** (0 to 10): persona, title, phase, status (queued / working / done / failed), started/finished, elapsed, `consumes` (list of prior outputs and versions), `produces` (version, findings, edits, FAQ set, plan), streamed output (markdown), notes (reasoning summary, optional), insight `{label, text, arrivedAt}`.
- **Persona**: id, display name ("VP Product"), full title ("VP of Product"), initials, hue token, one-line "how I review", the steps they appear at. Server-owned; the frontend never hardcodes names.
- **Document Version** (v1 draft, v2 VP refined, v3 customer validated, v4 final): author persona, producing step, base version, eight slots (headline, sub-heading, summary, problem, solution, benefits, internal quote, call to action), the list of edits applied to reach it, the comparative insight as its caption.
- **Edit**: version, slot, before, after, kind (sharpen / replace / add / remove), rationale (one sentence, from "Key Refinements Made"), author persona, evidence (finding ids).
- **Finding**: producing step and persona, kind (market / problem / concept), one-sentence claim, supporting excerpt or participant quote, sources, `usedBy` (edit ids, FAQ answer ids, PR slots).
- **Source**: url, title, domain, cited text, retrieved time, findings that cite it. Deduped by URL across the run.

The eight PR slots are the spine of the whole design. `config.py` steps 3, 4 and 7 already mandate that exact structure and order, so the frontend can rely on it rather than infer it.

---

## 3. The Council Progression experience

### Desktop layout (≥1100px)

Two regions under a slim top bar (run title = first sentence of the idea, status, elapsed, share, export).

**Left rail, 288px, sticky.** The council roster in fixed order, grouped into four phases: *Frame & Research* (0, 1, 2), *Draft & Review* (3, 4), *Pressure-test* (5, 6), *Refine & Finalize* (7, 8, 9, 10). Each row: persona monogram (hue), step title, status glyph, and, once done, the insight label as a small chip ("Pain:") with the insight text truncated to one line. Clicking a row scrolls the timeline to that card. The rail is the map; it never reorders.

**Main column, max 760px measure.** A vertical timeline of step cards separated by *handoff connectors*. This is where the user watches colleagues work.

### Step card states

- **Queued**: muted; monogram at 40% opacity; title; a one-liner in the connector above explains what it is waiting for ("Starts when the VP finishes v2").
- **Working**: monogram with a 2s breathing ring in the persona hue; header reads as a sentence, "VP Product is refining the press release"; below it the rotating team-dynamics line (4s cadence, cross-fade, no typewriter) and a tabular-numeral elapsed timer. Body: the output rendered progressively as markdown in document typography with a 1px caret at the end. The body is a *peek* by default (last ~8 lines, fading top edge) so ten streaming steps do not become 90,000 characters of scrollback; "Expand" opens it fully, and the choice persists per card. If notes (reasoning summaries) are available, a "Working notes" disclosure sits between header and body, collapsed, in muted text, streaming independently. Notes are never included in exports or share links unless the owner decides otherwise (Decision 6).
- **Done**: collapses over 250ms to header + insight line. The insight line renders in full (wraps; no hover, no truncation on any width). If the insight has not arrived yet, show a two-word skeleton ("Distilling…") in its place for up to 60s, then fill it in whenever it lands, including after run completion. Footer shows what the step produced as chips: "PR v2", "16 internal FAQs", "7 findings, 12 sources". Chips deep-link (v2 opens Evolution at v1→v2; findings open Research filtered to this step).
- **Failed**: error text, "Retry this step" (server re-runs only that step and its dependents), the rest of the council stays queued.

### Handoff connectors

Between cards, a 1px vertical line with a short label generated from the static dependency graph, no LLM involved: "→ VP Product receives PR v1, Market Research, Problem Validation". When the downstream step starts, the line draws in over 300ms and the label brightens. This is the cheapest possible way to make "the sequence was intentional" legible: every card announces what it read before it wrote. Where a version is produced (steps 3, 4, 7, 9), the connector carries a small version badge (v1, v2, v3, v4) so the document's growth is visible in the timeline without opening Evolution.

### Insights

Insights stay on the card and in the rail. For steps 4 and 7 (comparative insights, "Refined:" / "Change:"), the same text becomes the caption of the version stop in Evolution, so the two experiences share one sentence.

### Auto-follow

Chat semantics replace `useSmartScroll`: if the user is within ~120px of the live card's bottom, the timeline keeps it in view as text streams; the moment they scroll up, following stops and a "Jump to live" pill appears at the bottom. No timers, no 30-second lockouts.

### Parallel work

Recommendation: **preserve strict visual sequence; allow at most one parallel pair, 5 and 6.** Order in the rail and timeline is spatial and fixed. Both cards enter *working* at once, both monograms breathe, and the top bar reads "2 colleagues working". The earlier-ordered card (5) is auto-followed; the other stays peeked with its dynamics line and timer. If 6 finishes first it collapses in its own slot and 7 may start (it needs only v2 plus concept validation), with 5 still working alongside. Nothing reorders, so the progression story survives; two colleagues at the table is how real reviews work anyway. Do not parallelize 8 to 10; the "editor waits for everything" beat matters.

### Mobile (<720px)

The rail becomes a horizontal stepper pinned under the top bar: eleven monograms in order, the working ones breathing, tap to jump. Cards are full-width with 16px gutters; the peek is ~6 lines; the elapsed timer moves into the header line; handoff labels stay but truncate to one line. "Jump to live" sits above the bottom safe area. Notes disclosure is present but collapsed. Nothing is hidden by breakpoint that is visible on desktop; only density changes.

---

## 4. The Document Evolution experience

### Version timeline

A four-stop segmented control, not a slider. Each stop: version number, name ("VP Refined"), author monogram, and the comparative insight as a caption under the active stop. Stops for versions that do not exist yet are disabled with "in progress" if the step is working. Deep-linkable via `?from=&to=`.

Three modes in a small control to the right: **Read** (one clean version), **Compare** (from→to redline), **Walkthrough** (one edit at a time). Keyboard: `[` `]` move versions, `←` `→` move edits, `r` toggles redline.

### Diff granularity: paragraph-level structured edits, with word-level rendering inside a slot

Recommendation: the unit of change, provenance, navigation and export is the **slot** (one of the eight PR paragraphs). Within a changed slot, render an inline word-level diff computed client-side from `before`/`after` (diff-match-patch in word mode, then semantic cleanup) purely for reading; never for meaning.

Why paragraph-level and not character diffs:

1. Rationale is per-refinement. The VP writes "Sharpened target customer from small businesses to solo restaurateurs based on research insights." That maps to a slot, not to a character range. Structured edits let each rationale sit next to the paragraph it changed.
2. LLM rewrites produce synonym churn. Character diffs of two 8-paragraph rewrites are noise: a hundred tiny green/red fragments with no story. Slot-level edits with a word diff inside give one readable change per paragraph.
3. The eight slots are stable anchors across all four versions, so v1→v4 can be compared slot by slot without LCS or Jaro-Winkler heuristics, and "paragraph history" (one slot across four versions) becomes a trivial query.
4. It removes the triple-fallback diff stack and the red "Unsupported" boxes.

Fallback for v4 (the Editor rewrites the PR inside the PRFAQ rather than emitting edits): the server aligns by slot position and the frontend renders the word diff with a synthesized edit `{kind: "polish", rationale: "Editorial pass", author: Senior Editor}`. Same UI, weaker provenance, no special case.

### Redline view

Document typography on a ~680px measure (serif body, 17px/1.65). Deletions: muted red strikethrough. Insertions: ink-blue underline (not green; green reads as "success"). Unchanged slots render normally. In Compare mode across more than one version (v1→v3), a slot that changed twice shows the net diff, and its provenance note lists both edits in order with two monograms.

**Provenance gutter (≥1200px)**: a right margin column, 280px, one note aligned to each changed slot: author monogram + name, rationale sentence, evidence chips ("Market Research: 42% of solo operators…", "Participant: Maria, acute"). Clicking a chip opens the finding in a side sheet with its sources and the cited text. Below 1200px the gutter collapses into a small marker at the end of each changed paragraph that opens the same note as a popover (desktop) or bottom sheet (mobile).

### Walkthrough mode

"Edit 3 of 7" with prev/next. The document scrolls the active slot into view; all other slots dim to 60%; the gutter shows only that note, expanded, with evidence excerpts inline. This is the "scrub through edits" experience, and because edits are the unit, it is a list, not a scrubber.

### Paragraph history

From any slot, "History" opens a stacked view: the same slot at v1, v2, v3, v4 top to bottom, each with its author and the edit that produced it. This is the single view that best expresses "the way the document was edited through each pass" and it is cheap once edits are slot-keyed.

### Linking the final PRFAQ back

In the Document view, the press release section carries a quiet summary line under the sub-heading: "4 versions · 11 edits · 3 reviewers" linking to Evolution. On hover (desktop) each PR paragraph reveals a hairline clock glyph in the left margin; clicking it opens paragraph history for that slot. On mobile a "Show revision markers" toggle in the toolbar exposes the same glyphs. The FAQ sections link to their producing steps ("Drafted by Customer Success Lead from concept-test concerns") in a single muted line under each section heading, off by default in exports.

### Exports

- **DOCX (clean)**: keep the formatting spec; feed it structured slots and FAQ objects instead of regex-parsed markdown.
- **DOCX (redline)**: real tracked changes via `docx`'s `InsertedTextRun` / `DeletedTextRun`, `author` = persona name, `date` = step finish time, so Word's reviewing pane lists "VP Product" and "Principal PM" as reviewers; rationales as anchored comments.
- **Markdown**: clean, plus a CriticMarkup redline (`{++ins++}`, `{--del--}`, `{>>VP Product: rationale<<}`).
- **PDF**: print stylesheet of the Document view.

---

## 5. Evidence and citations

Three layers, one direction: **Source → Finding → Use.** A source is a URL with cited text. A finding is a claim a researcher made from sources (or from a simulated participant). A use is where a finding shows up: an edit, a PR slot, or an FAQ answer.

In the executive document, **no footnote numbers in the press release body by default.** Amazon PRs do not carry citations, and the owner's audience reads the PR as a narrative. Instead:

- An **Evidence** toggle in the document toolbar (off by default, remembered per user). When on, sentences with a linked finding get a faint dotted underline; hover or tap shows a popover: the finding's claim, the persona who established it, the source title and domain, the cited excerpt, and an outbound link. Internal FAQ answers may additionally show superscript markers when Evidence is on, because that document is internal and readers expect them.
- The **Research view** is the full ledger: a Findings list grouped by step and persona, each with "Used in: PR §Problem (v2), Internal FAQ Q3" backlinks; and a Sources table (title, domain, cited by N findings, retrieved date). Concept-test participants appear as findings with an archetype chip (acute / moderate / edge / skeptic) so an edit can cite "Maria, acute" rather than a paragraph number. Simulated participants are labelled as simulated everywhere they appear; do not let a persona quote look like a customer interview.
- **No raw URLs in prose.** Links render as title plus muted domain and an external-link glyph; drop the `a::after` rule.
- Findings from simulated research carry the persona as authority and a "simulated panel" label; findings with sources carry the domain. Both are legitimate; the difference must be visible.

---

## 6. Visual design direction

Executive-grade and calm: a document tool that happens to show people working, not a dashboard that happens to contain a document.

**Typography.** UI in a humanist sans (Inter, falling back to the system stack). Documents in a text serif with a real fallback stack (Source Serif 4 or Charter, then Georgia). Scale: 12 / 13 / 14 / 15 / 17 / 20 / 24 / 30; UI body 14 to 15; document body 17/1.65 on a 66 to 72ch measure; PR headline 24 semibold serif; sub-heading 17 italic. Tabular numerals for timers and counts. No inline font sizes; one token file.

**Color.** A warm-neutral base so paper reads as paper: light `paper #FAFAF7`, `ink #1A1A18`, `muted #6B6B66`, `rule #E6E5E0`; dark `paper #121211`, `ink #ECEBE6`, `muted #9A9A94`, `rule #2A2A27`. One accent for actions and "live" (ink blue, ~`#3556C8` light / `#7A93F0` dark). Semantic colors desaturated: success, warning, danger. Diff tokens: `ins` = accent underline, `del` = muted red strikethrough; in dark mode both get 12 to 16% tinted backgrounds for legibility. Define all tokens on `:root`, override under `prefers-color-scheme: dark` and `[data-theme="dark"]`; never hardcode a hex in a component (`AstDiffRenderer` currently has eight).

**Persona identity.** Nine colleagues: Strategist (0), Market Analyst (1), User Researcher (2 and 6, see Decision 3), Principal PM (3 and 7), VP Product (4), VP Business + Principal Engineer (5, rendered as a pair of overlapping monograms), Customer Success Lead (8), Senior Editor (9), Head of Validation (10). Each gets a two-letter monogram in a 28px circle (24px in rails, 20px in chips), a hue from a nine-step OKLCH ring at constant lightness and low chroma (so no persona "shouts" and all pass contrast on both papers), a short handle, and a one-line "how I review" for the roster and How It Works. The same hue follows the persona everywhere: rail, card ring, gutter note, tracked-change author color in the redline. No illustrated avatars, no emoji, no photos; monograms age well and export cleanly to DOCX comments.

**Motion.** Text appears as it arrives; no per-character animation, no typewriter. A blinking 1px caret marks the live end. Working monograms breathe (2s, 20% opacity ring). Card collapse 250ms ease-out; connector draw 300ms; insight fade-in 200ms. Remove shimmer bars, `animate-ping`, hover-lift buttons and completion bounces. Honor `prefers-reduced-motion` by replacing all of the above with instant state changes and a static "working" dot.

**Density.** Document views: generous (32px section gaps, 24px paragraph gaps). Council timeline: medium (16px card padding, 12px between header and body). Rail: compact (36px rows). One card style: 8px radius, 1px `rule` border, no shadow. Shadows only on sheets and popovers.

---

## 7. Component inventory and mapping

### New components (one-line spec each)

- `AppShell`: top bar (run title, status, elapsed, share, export, theme), content slot; no marketing copy inside a run.
- `RunProvider`: normalized run state (steps, versions, edits, findings, sources) fed by a resumable event stream; replays persisted runs identically to live ones.
- `IdeaComposer`: landing textarea with example ideas and Enter-to-submit; the only form on the landing page.
- `BriefReview`: Step 0's three slot cards, each with an inline "Refine this" note field and a single Confirm; replaces the separate feedback form.
- `CouncilRail`: sticky roster grouped by phase; persona monogram, title, status glyph, insight chip; click-to-scroll; becomes `CouncilStepper` (horizontal) under 720px.
- `CouncilTimeline`: ordered list of `StepCard`s with `HandoffConnector`s and chat-style auto-follow plus "Jump to live".
- `StepCard`: queued / working / done / failed states; header sentence, dynamics line, elapsed, peek/expand body, notes disclosure, produced chips.
- `HandoffConnector`: static dependency label plus version badge; draws in when the downstream step starts.
- `PersonaMonogram`: initials in a hue circle; sizes 20/24/28; pair variant.
- `InsightLine`: label chip plus full-wrapping text; skeleton while pending; used in cards, rail, and version captions.
- `StreamingMarkdown`: block-level incremental renderer; closed blocks render as markdown, the open tail as plain text until it closes; no post-render DOM rewriting.
- `WorkingNotes`: collapsed disclosure that streams reasoning summaries in muted text; excluded from exports and shares by default.
- `DocumentView`: the final PRFAQ in document typography with section navigation, Evidence toggle, revision markers, and a second tab for the validation plan.
- `EvidencePopover`: finding claim, persona, source, cited excerpt, outbound link; anchored to a sentence.
- `VersionStops`: four-stop segmented control with author monogram and comparative-insight caption; drives `?from=&to=`.
- `RedlineDocument`: slot-keyed renderer with word-level inline diff inside changed slots; Read / Compare / Walkthrough modes.
- `ProvenanceGutter`: per-slot notes (author, rationale, evidence chips) in the right margin; collapses to inline markers below 1200px.
- `EditWalkthrough`: prev/next through edits, dims non-active slots, keyboard bindings.
- `SlotHistory`: one slot across v1 to v4 with the edit that produced each.
- `FindingsList` and `SourcesTable`: the research ledger with backlinks and archetype chips.
- `RunLibrary`: list of runs (title, date, status, PR headline, monogram stack, Resume/Open).
- `ExportMenu`: DOCX clean, DOCX redline, Markdown, PDF, each with a one-line description.
- `ShareSheet`: create/revoke read-only link; choose which views are visible.
- `CopyButton`, `Toast`: keep as is.

### Old to new mapping

| Old | Disposition |
|---|---|
| `App.tsx` (1813 lines: state machine, SSE parsing, regex extraction, hang polling, debug panel) | **Rewrite.** Split into `RunProvider` (event stream, normalization), route components, and nothing else. Extraction, polling, and the debug panel are deleted; the server owns versions and reconnection. |
| `StepCard.tsx` | **Rewrite** as the new `StepCard` (keep the header + insight pattern; drop `FAQFixWrapper`, hover-only insight, and the 1280px hide). |
| `StepsDisplay.tsx` | **Delete**; `CouncilTimeline` replaces it. |
| `ProcessingStatus.tsx` | **Delete** (never rendered). |
| `EnhancedResults.tsx` | **Delete**; its four tabs become the four run routes. |
| `ModernResults.tsx` | **Delete** (unreachable duplicate). |
| `PressReleaseEvolution.tsx` | **Rewrite** as `VersionStops` + `RedlineDocument`; keep the four version names. |
| `VersionRangeSlider.tsx` | **Delete**; segmented control. |
| `DocumentDiffViewer.tsx`, `AstDiffRenderer.tsx`, `MarkdownAwareDiffRenderer.tsx`, `utils/markdownAstDiff.ts`, `utils/markdownAwareDiff.ts`, `utils/diffUtils.ts` | **Delete.** Replace with one ~60-line word-diff helper over `before`/`after` per slot. Keep `diff-match-patch` as the dependency. |
| `ProductAnalysisReview.tsx` | **Rewrite** as `BriefReview`; keep the three-card structure and the confirm/refine flow; drop emoji and the regex section parser (server returns the three fields). |
| `ResearchArtifactsView.tsx` | **Rewrite** as `FindingsList` + `SourcesTable`; drop fake stats and the modal. |
| `MarkdownRenderer.tsx` | **Rewrite** as `StreamingMarkdown`; one variant, styled by tokens. |
| `HowItWorksPage.tsx` | **Keep**, restyle on the persona system; replace the phase boxes with the same roster used in `CouncilRail`. |
| `LandingPage.tsx`, `ProductIdeaForm.tsx` | **Rewrite** into one `LandingPage` using `IdeaComposer`; remove the unverifiable customer claim; one company name. |
| `Navigation.tsx` | **Keep**, minor restyle. |
| `CopyButton.tsx`, `CopyToast.tsx` | **Keep.** |
| `utils/prfaqExporter.ts` | **Rewrite** the parsing half (consume structured slots and FAQ objects), **keep** the formatting spec, add tracked-changes output. |
| `utils/contentProcessor.ts` | **Delete**; cleanup rules belong server-side, applied once before persistence. |
| `index.css` (1245 lines) | **Rewrite** as tokens + a small set of component styles; no `!important`, no class-name-keyed mobile overrides, no inline sizes. Fix the Tailwind v4/v3 config mismatch or drop the config file. |
| `index.html` | Remove the unused Bootstrap Icons stylesheet. |

---

## 8. Decisions for the owner, prioritized

1. **Structured edits from steps 4, 7 and 9, or keep prose-plus-regex?** Recommendation: structured edits keyed to the eight PR slots (`{slot, before, after, rationale, evidence}`) with the full text also returned. This single decision enables provenance, walkthrough, slot history, and tracked-changes export, and deletes three diff engines. Ask the engineering side to also emit the slots for v1 and v4 so every version has the same shape.

2. **Diff granularity.** Recommendation: paragraph (slot) as the unit of change and provenance; word-level rendering inside a slot; no character diffs anywhere. See Section 4 for the reasoning.

3. **Persona roster: is the user researcher one colleague or two?** `config.py` names a "Senior User Researcher, Problem Discovery" at step 2 and a "Senior User Research Lead & Target Customer Panel" at step 6. Recommendation: one colleague ("User Researcher") who returns with a panel in step 6. Continuity is the point of the council; a recurring face is more memorable than an accurate org chart. Same logic keeps Principal PM at 3 and 7.

4. **Parallelism.** Recommendation: allow only steps 5 and 6 to run concurrently, keep strict visual order, and never parallelize 8 to 10. If the engineering side wants more parallelism later, the timeline already supports multiple working cards; only the narrative gets weaker.

5. **Evidence in the executive document.** Recommendation: off by default with a toolbar toggle; PR body never shows footnote numbers; Internal FAQ may show markers when the toggle is on; the Research view is the ledger. Alternative, if the owner wants a stronger "evidence-based" signal on first open: default on for the Internal FAQ only.

6. **Show reasoning summaries ("working notes")?** Recommendation: yes during a live run, collapsed by default, excluded from exports and share links, and labelled as the persona's notes. The "watching colleagues think" moment is real value; the notes are not part of the deliverable. If the summaries prove low quality in testing, the disclosure hides cleanly with no layout change.

7. **Share links and the library.** Recommendation: unlisted read-only token links, document view by default, council replay and evolution available, notes hidden; per-browser identity for the library until accounts exist. Decide whether "resume" re-runs only the failed step and its dependents (recommended) or everything from the failure forward.

8. **Landing copy and brand.** Remove the OpenAI/Anthropic/Meta/Google/Stripe claim unless substantiated; pick one company name; replace "5 minutes" with "under 10 minutes" given the ~8 to 10 minute runs in the logs.

9. **Exports at launch.** Recommendation: DOCX clean and DOCX redline (tracked changes attributed to personas) ship first; Markdown and PDF are cheap follow-ons. The redline DOCX is the export that turns the evolution view into something an exec can open in Word, and it is unique to this product.

10. **Dark mode.** Recommendation: build it from day one via tokens; documents use warm-dark paper, not pure black, so the serif stays readable.
