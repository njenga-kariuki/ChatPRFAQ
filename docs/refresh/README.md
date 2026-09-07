# ChatPRFAQ · Frontier Refresh Proposal

*Prepared September 2026 against `main` (last change June 2025).*

ChatPRFAQ simulates Amazon's Working Backwards review: a council of AI colleagues takes a product idea through live research, two rounds of simulated customer research, a press release drafted and refined three times, internal and external FAQs, an editorial synthesis, and a hypothesis-driven validation plan — and lets the user watch the handoffs and inspect how the document changed at each pass. The intent is right and the prompts are good. The implementation is a 2025-era single-shot pipeline: retired model IDs, no streaming, truncated context, regex-recovered structure, and a run that lives only in one browser tab.

This set of documents proposes rebuilding it on the current Claude platform so that the same council is roughly ten times better in the ways that matter — depth of reasoning, evidence, provenance, speed-to-first-token, and reliability — without changing what made the sequence intentional.

| Doc | What it answers |
|---|---|
| [01 · Current state](01-current-state.md) | Exactly what the code does today, step by step; what was deliberate and must survive; what is broken |
| [02 · Frontier architecture](02-frontier-architecture.md) | Model strategy, the cached append-only dossier (the "context system"), structured outputs, research with real evidence, the DAG runner, streaming/persistence, prompts, quality loop, honest cost |
| [03 · Design brief](03-design-brief.md) | UX for the council progression and the document evolution; information architecture; visual direction; component inventory; owner decisions |
| [04 · Surgical changes](04-surgical-changes.md) | File-level fixes worth making regardless — run-blockers, silent quality defects, security, and frontier patterns that pay off inside the old code |
| [05 · Project outline](05-project-outline.md) | Repo layout, data model, API contract, four phases with acceptance criteria, tests, config, risks, decisions |

## The proposal in twelve lines

1. **Keep the council and its order.** Eleven seats (ten plus a new optional Bar Raiser), four press-release checkpoints, the human gate after framing. The prompts' substance is ported, their formatting scaffolding is deleted.
2. **Frontier models per seat.** Claude Fable 5.1 on the judgment seats, Claude Sonnet 5 on the simple ones, Claude Opus 5 as reviewer and automatic fallback. Adaptive thinking everywhere; effort tuned per seat by an eval.
3. **One frozen council charter as the system prompt**, cached for an hour and shared by every step of every run, with the full persona roster so each colleague knows who came before and who comes next.
4. **An append-only dossier** in canonical order as the user message, so each step reads the whole prior context from cache and no persona is ever starved (the current code truncates research to 500 characters in two seats).
5. **Structured outputs for every seat.** The press release is eight typed sections; refinement seats return per-section edits with rationale and evidence ids; FAQs, findings, hypotheses and insights are fields, not regex targets.
6. **Live research with real citations** via Claude's web search and fetch tools, distilled into an evidence ledger that later seats cite by id; unsupported numbers are flagged as assumptions.
7. **Streaming from the first token** of every seat, with the model's own progress notes replacing timer-driven "team dynamics" fiction, and reasoning summaries available as "working notes".
8. **A DAG runner** that runs Internal FAQ and Concept Validation in parallel, retries on schema or length failures, resumes from any completed seat, and records cost per step.
9. **Persist first, stream second.** Every event is written to a log before it is sent; SSE replays from `Last-Event-ID`, so refresh, reconnect, share links and history all work and five compensating mechanisms are deleted.
10. **A design built on the eight slots and the persona roster**: handoff connectors that say what each colleague received, a four-stop version control with a provenance gutter, an edit walkthrough, per-paragraph history, and a tracked-changes Word export attributed to the personas.
11. **Quality made measurable**: a Bar Raiser rubric on every run and a twelve-idea eval set with an LLM judge to settle model, effort and prompt choices.
12. **Costs stated plainly**: roughly $6–9 per run on the recommended mix (about four times today) for a document ten colleagues actually read; ~$3.5–4.5 on all-Opus 5.

## Decisions needed before building

See `05-project-outline.md` §8 (eight engineering decisions) and `03-design-brief.md` §8 (ten design decisions). The three that shape everything: structured per-section edits (yes), the model mix (Fable 5.1 on judgment seats), and hosting with a real database (Docker + managed Postgres).

## Implementation status (September 2026)

The proposal has been executed on branch `claude/critical-project-frontier-refresh-87z5r1`:

- `backend/` — the council runtime described in doc 02: charter + dossier context system, thirteen seats with structured outputs, Anthropic provider with fallbacks and refusal handling, fake provider, dependency-graph runner with the framing gate, parallel 5‖6, Bar Raiser loop, resume and cost accounting, persisted replayable SSE, exports, eval harness, tests.
- `web/` — the frontend built from doc 03 (council progression, document evolution with per-slot provenance, research ledger, exports, history, share links, demo replay).
- `deploy/`, `Makefile`, `.github/workflows/ci.yml`, `.replit` — deployment and CI.

Not done in this environment: a live run against the API (no key was available; `make live-check` validates the request shape with one cheap call), the eval baseline on real models (`make evals`), and removal of the legacy tree at the repo root (see README "Legacy").
