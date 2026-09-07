import DiffMatchPatch from 'diff-match-patch';

export type DiffOp = -1 | 0 | 1;
export interface DiffSegment {
  op: DiffOp;
  text: string;
}

const dmp = new DiffMatchPatch();
dmp.Diff_Timeout = 1;

/** Split into words, whitespace runs and punctuation so the diff never cuts inside a word
 *  and a trailing comma does not make a word look replaced. */
function tokenize(text: string): string[] {
  return text.split(/(\s+|[^\p{L}\p{N}'’\-\s]+)/u).filter((t) => t.length > 0);
}

/**
 * Word-level diff: tokens are mapped to single characters, diffed with diff-match-patch,
 * cleaned up semantically while still word-aligned, then decoded back into text.
 * Insertions and deletions therefore always fall on word boundaries.
 */
export function wordDiff(before: string, after: string): DiffSegment[] {
  if (before === after) return before ? [{ op: 0, text: before }] : [];
  const index = new Map<string, string>();
  const tokens: string[] = [];
  const encode = (text: string): string => {
    let out = '';
    for (const tok of tokenize(text)) {
      let ch = index.get(tok);
      if (ch === undefined) {
        // Stay below the surrogate range so every token is one UTF-16 unit.
        const code = tokens.length + 1;
        if (code >= 0xd800) return '';
        ch = String.fromCharCode(code);
        index.set(tok, ch);
        tokens.push(tok);
      }
      out += ch;
    }
    return out;
  };
  const a = encode(before);
  const b = encode(after);
  if ((a === '' && before !== '') || (b === '' && after !== '')) {
    // Too many distinct tokens to encode; fall back to whole-paragraph replacement.
    return [
      { op: -1, text: before },
      { op: 1, text: after },
    ];
  }
  const diffs = dmp.diff_main(a, b, false);
  dmp.diff_cleanupSemantic(diffs);
  const segments: DiffSegment[] = [];
  for (const [op, chars] of diffs) {
    let text = '';
    for (const ch of chars) text += tokens[ch.charCodeAt(0) - 1];
    if (!text) continue;
    const last = segments[segments.length - 1];
    if (last && last.op === op) last.text += text;
    else segments.push({ op: op as DiffOp, text });
  }
  return segments;
}

export function diffStats(segments: DiffSegment[]): { inserted: number; deleted: number } {
  let inserted = 0;
  let deleted = 0;
  for (const s of segments) {
    const words = s.text.split(/\s+/).filter(Boolean).length;
    if (s.op === 1) inserted += words;
    if (s.op === -1) deleted += words;
  }
  return { inserted, deleted };
}
