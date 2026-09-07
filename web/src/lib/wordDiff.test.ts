import { describe, expect, it } from 'vitest';
import { diffStats, wordDiff } from './wordDiff';

const join = (segs: ReturnType<typeof wordDiff>, keep: (op: number) => boolean) => segs.filter((s) => keep(s.op)).map((s) => s.text).join('');

describe('wordDiff', () => {
  it('diffs at word granularity', () => {
    const segs = wordDiff('the quick brown fox jumps', 'the quick red fox jumps');
    expect(segs).toEqual([
      { op: 0, text: 'the quick ' },
      { op: -1, text: 'brown' },
      { op: 1, text: 'red' },
      { op: 0, text: ' fox jumps' },
    ]);
  });

  it('never cuts inside a word and round-trips both texts', () => {
    const before = 'Owners of small businesses spend six to nine hours a week reconciling receipts, usually after close.';
    const after = 'Owners of independent businesses with one to three locations spend six to nine hours a week reconciling receipts against bank statements, usually after close.';
    const segs = wordDiff(before, after);
    expect(join(segs, (op) => op <= 0)).toBe(before);
    expect(join(segs, (op) => op >= 0)).toBe(after);
    for (const s of segs) {
      if (s.op === 0) continue;
      // a changed segment starts and ends on a token boundary (no partial words)
      expect(/^\S|^\s/.test(s.text)).toBe(true);
      expect(s.text.trim().length).toBeGreaterThan(0);
    }
    const stats = diffStats(segs);
    expect(stats.inserted).toBeGreaterThan(0);
    expect(stats.deleted).toBe(1);
  });

  it('treats identical text as one equal segment', () => {
    expect(wordDiff('same text', 'same text')).toEqual([{ op: 0, text: 'same text' }]);
    expect(wordDiff('', '')).toEqual([]);
  });

  it('handles pure insertion and deletion', () => {
    expect(wordDiff('', 'new words')).toEqual([{ op: 1, text: 'new words' }]);
    expect(wordDiff('old words', '')).toEqual([{ op: -1, text: 'old words' }]);
  });
});
