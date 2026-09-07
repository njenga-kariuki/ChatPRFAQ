"""Run the council on the seed ideas and grade the results.

    python -m app.evals.run_evals --limit 3 --out evals/results.json

Uses whatever provider the environment configures (LLM_PROVIDER=fake runs offline).
Records per-seed rubric scores, unsupported-claim counts, Bar Raiser verdicts, cost
and duration, so model, effort and prompt changes can be compared over time.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import time

from app.council.bus import EventBus
from app.council.runner import CouncilRunner
from app.db.store import Store
from app.evals.judge import judge_run
from app.evals.seeds import SEEDS
from app.llm.provider import build_provider
from app.schemas import Ledger, SynthesisOutput
from app.settings import get_settings


async def _run_one(runner: CouncilRunner, store: Store, bus: EventBus, idea: str) -> str:
    run_id = await runner.create_run(idea)
    q = bus.subscribe(run_id)
    while True:
        ev = await q.get()
        if ev["type"] == "framing.ready":
            break
        if ev["type"] == "run.failed":
            raise RuntimeError(ev["error"])
    await runner.confirm(run_id, None)
    while True:
        ev = await q.get()
        if ev["type"] == "run.completed":
            return run_id
        if ev["type"] == "run.failed":
            raise RuntimeError(ev["error"])


async def main(limit: int | None, out: str) -> None:
    settings = get_settings()
    store = Store(settings.database_url)
    await store.init()
    provider = build_provider(settings)
    bus = EventBus()
    runner = CouncilRunner(store, provider, settings, bus)
    results = []
    for seed in SEEDS[:limit]:
        t0 = time.time()
        run_id = await _run_one(runner, store, bus, seed["idea"])
        latest = await store.latest_artifacts(run_id)
        prfaq = SynthesisOutput.model_validate(json.loads(latest["prfaq"].payload_json))
        ledger = Ledger.model_validate(json.loads(latest["ledger"].payload_json))
        review = json.loads(latest["bar_raiser"].payload_json) if "bar_raiser" in latest else None
        verdict = await judge_run(provider, settings, prfaq, ledger)
        run = await store.get_run(run_id)
        results.append(
            {
                "seed": seed["id"],
                "run_id": run_id,
                "judge_overall": verdict.overall,
                "judge_scores": {s.criterion: s.score for s in verdict.scores},
                "unsupported_claims": verdict.unsupported_claims,
                "bar_raiser_overall": review["overall"] if review else None,
                "bar_raiser_verdict": review["verdict"] if review else None,
                "cost_usd": run.total_cost_usd,
                "duration_s": round(time.time() - t0, 1),
                "summary": verdict.summary,
            }
        )
        print(f"{seed['id']:>18}  judge {verdict.overall}/5  unsupported {verdict.unsupported_claims}  cost ${run.total_cost_usd:.2f}  {results[-1]['duration_s']}s")
    summary = {
        "provider": settings.llm_provider,
        "models": {"judgment": settings.council_model_default, "fast": settings.council_model_fast, "reviewer": settings.council_model_reviewer},
        "n": len(results),
        "mean_judge_overall": round(statistics.mean(r["judge_overall"] for r in results), 2) if results else None,
        "mean_unsupported_claims": round(statistics.mean(r["unsupported_claims"] for r in results), 2) if results else None,
        "mean_cost_usd": round(statistics.mean(r["cost_usd"] for r in results), 2) if results else None,
        "results": results,
    }
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"\nwrote {out}: mean judge {summary['mean_judge_overall']}/5, mean unsupported {summary['mean_unsupported_claims']}, mean cost ${summary['mean_cost_usd']}")
    await store.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--out", default="evals/results.json")
    args = parser.parse_args()
    asyncio.run(main(args.limit, args.out))
