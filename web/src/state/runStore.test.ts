import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RunEvent, RunSnapshot } from '../api/model';
import { emptySnapshotFrom, parseEventLog } from '../demo/replay';
import { applyEvent, applyEvents, costSoFar, hydrate, initialState, latestAttempt, sumOfStepCosts, versionList } from './runStore';

const snapshot = JSON.parse(readFileSync(new URL('../../fixtures/run.snapshot.json', import.meta.url), 'utf8')) as RunSnapshot;
const events: RunEvent[] = parseEventLog(readFileSync(new URL('../../fixtures/run.events.jsonl', import.meta.url), 'utf8'));

describe('runStore replay', () => {
  const replayed = applyEvents(hydrate(initialState(), emptySnapshotFrom(snapshot)), events);

  it('replays every event of the fixture', () => {
    expect(events).toHaveLength(360);
    expect(replayed.streamSeq).toBe(360);
    expect(replayed.status).toBe('completed');
    expect(replayed.idea).toBe(snapshot.run.idea);
    expect(replayed.framing?.working_name).toBe('BookkeepingService');
  });

  it('produces versions 1 to 4 with their edits', () => {
    const versions = versionList(replayed);
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4]);
    expect(versions[0].edits).toHaveLength(0);
    expect(versions[1].edits).toHaveLength(8);
    expect(versions[2].edits).toHaveLength(6);
    expect(versions[3].edits).toHaveLength(5);
    for (const v of versions) expect(v.press_release.slots.map((s) => s.id)).toEqual(['headline', 'subheading', 'summary', 'problem', 'solution', 'benefits', 'internal_quote', 'cta']);
    // the second document.version for v4 (Bar Raiser revision) replaces the first
    expect(versions[3].caption).toContain('Bar Raiser');
    expect(versions[3].artifact_id).toBe(snapshot.versions[3].artifact_id);
    expect(replayed.headline).toBe(snapshot.versions[0].press_release.slots[0].text);
  });

  it('records two attempts for the editor and one for everyone else', () => {
    expect(replayed.steps['9']).toHaveLength(2);
    expect(replayed.steps['9'].map((a) => a.attempt)).toEqual([1, 2]);
    expect(replayed.steps['9'].every((a) => a.status === 'done')).toBe(true);
    for (const seat of ['0', '1', '1b', '2', '3', '4', '5', '6', '7', '8', '9b', '10']) expect(replayed.steps[seat]).toHaveLength(1);
    expect(latestAttempt(replayed, '9')?.text.length).toBeGreaterThan(10_000);
    expect(latestAttempt(replayed, '1')?.tools).toHaveLength(4);
    expect(latestAttempt(replayed, '1')?.notes).toHaveLength(1);
    expect(latestAttempt(replayed, '0')?.thinking).toContain('Planning');
  });

  it('totals cost from step completions and the run summary', () => {
    const expected = snapshot.steps.reduce((acc, s) => acc + s.cost_usd, 0);
    expect(sumOfStepCosts(replayed)).toBeCloseTo(expected, 4);
    expect(replayed.totalCostUsd).toBeCloseTo(snapshot.run.total_cost_usd, 4);
    expect(costSoFar(replayed)).toBeCloseTo(1.2626, 4);
    expect(replayed.completedDurationS).toBe(1.8);
  });

  it('builds provisional artifacts and the ledger from the stream', () => {
    expect(replayed.artifacts).toHaveLength(14);
    expect(replayed.artifacts.filter((a) => a.kind === 'prfaq')).toHaveLength(2);
    expect(replayed.findings).toHaveLength(12);
    const research = replayed.artifacts.find((a) => a.kind === 'market_research');
    expect((research?.payload as { markdown: string }).markdown).toContain('## Market Opportunity Analysis');
    expect(replayed.barRaiser?.verdict).toBe('revise');
  });

  it('ignores duplicate deliveries', () => {
    const delta = events.find((e) => e.type === 'step.delta' && e.seat === '0');
    const started = events.find((e) => e.type === 'step.started' && e.seat === '0');
    let s = hydrate(initialState(), emptySnapshotFrom(snapshot));
    s = applyEvents(s, events.slice(0, 3));
    if (!delta || !started) throw new Error('fixture changed');
    s = applyEvent(s, delta);
    const once = latestAttempt(s, '0')?.text ?? '';
    s = applyEvent(s, delta);
    expect(latestAttempt(s, '0')?.text).toBe(once);
  });
});

describe('runStore hydration', () => {
  const hydrated = hydrate(initialState(), snapshot);

  it('matches the replayed run', () => {
    expect(hydrated.status).toBe('completed');
    expect(versionList(hydrated).map((v) => v.version)).toEqual([1, 2, 3, 4]);
    expect(hydrated.steps['9']).toHaveLength(2);
    expect(hydrated.snapshotSeq).toBe(360);
    expect(hydrated.findings).toHaveLength(12);
    expect(hydrated.sources).toHaveLength(4);
    expect(latestAttempt(hydrated, '9')?.artifactId).toBe(snapshot.artifacts.filter((a) => a.kind === 'prfaq')[1].id);
  });

  it('rebuilds streaming buffers from replayed events without disturbing state', () => {
    const rebuilt = applyEvents(hydrated, events);
    expect(rebuilt.status).toBe('completed');
    expect(rebuilt.artifacts).toHaveLength(14);
    expect(rebuilt.totalCostUsd).toBeCloseTo(snapshot.run.total_cost_usd, 4);
    expect(latestAttempt(rebuilt, '9')?.text.length).toBeGreaterThan(10_000);
    expect(latestAttempt(rebuilt, '9')?.status).toBe('done');
    expect(latestAttempt(rebuilt, '9')?.costUsd).toBeCloseTo(0.2154, 4);
    expect(rebuilt.steps['9'][0].text.length).toBeGreaterThan(10_000);
    expect(versionList(rebuilt)[3].caption).toContain('Bar Raiser');
  });
});
