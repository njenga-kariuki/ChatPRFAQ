import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../api/model';
import { editsForSlot, hydrate, initialState, slotHistory, usedIn } from './runStore';

const snapshot = JSON.parse(readFileSync(new URL('../../fixtures/run.snapshot.json', import.meta.url), 'utf8')) as RunSnapshot;
const state = hydrate(initialState(), snapshot);

describe('usedIn', () => {
  it('finds press-release claims across versions', () => {
    const uses = usedIn(state, 'F-02');
    const slot = uses.find((u) => u.kind === 'slot' && u.slotId === 'summary');
    expect(slot && slot.kind === 'slot' ? slot.versions : []).toEqual([1, 2, 3, 4]);
  });

  it('finds FAQ answers and edits that cite the finding', () => {
    const uses = usedIn(state, 'F-02');
    const faq = uses.filter((u) => u.kind === 'faq');
    expect(faq.map((u) => (u.kind === 'faq' ? `${u.doc}:${u.index}` : ''))).toEqual(['internal:1', 'internal:2']);
    const edits = uses.filter((u) => u.kind === 'edit');
    expect(edits.map((u) => (u.kind === 'edit' ? `${u.version}:${u.slotId}` : ''))).toEqual(['2:headline', '2:summary']);
  });

  it('covers the customer and research FAQ', () => {
    const uses = usedIn(state, 'F-07');
    expect(uses.some((u) => u.kind === 'faq' && u.doc === 'customer')).toBe(true);
    expect(uses.some((u) => u.kind === 'faq' && u.doc === 'research')).toBe(true);
    expect(uses.some((u) => u.kind === 'slot' && u.slotId === 'cta')).toBe(true);
  });

  it('returns nothing for an unknown finding', () => {
    expect(usedIn(state, 'F-99')).toEqual([]);
  });
});

describe('slot selectors', () => {
  it('lists a slot across every version with its edit', () => {
    const history = slotHistory(state, 'summary');
    expect(history.map((h) => h.version)).toEqual([1, 2, 3, 4]);
    expect(history[0].edit).toBeNull();
    expect(history[1].edit?.change_kind).toBe('reground');
    expect(history.slice(1).every((h) => h.changed)).toBe(true);
    expect(history.map((h) => h.persona)).toEqual(['pm', 'vp_product', 'pm', 'editor']);
  });

  it('limits edits to a version range', () => {
    expect(editsForSlot(state, 'summary', 1, 4)).toHaveLength(3);
    expect(editsForSlot(state, 'summary', 1, 2)).toHaveLength(1);
    expect(editsForSlot(state, 'headline', 2, 4)).toHaveLength(0);
  });
});
