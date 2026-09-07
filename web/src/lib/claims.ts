import type { Claim } from '../api/model';

export interface TextSegment {
  text: string;
  claim: Claim | null;
}

/** Split slot text into plain and claim-bearing segments (first occurrence of each claim). */
export function segmentByClaims(text: string, claims: Claim[]): { segments: TextSegment[]; unanchored: Claim[] } {
  const spans: { start: number; end: number; claim: Claim }[] = [];
  const unanchored: Claim[] = [];
  for (const claim of claims) {
    const needle = claim.text.trim();
    if (!needle) continue;
    const idx = text.indexOf(needle);
    if (idx < 0) {
      unanchored.push(claim);
      continue;
    }
    const overlaps = spans.some((s) => idx < s.end && idx + needle.length > s.start);
    if (overlaps) unanchored.push(claim);
    else spans.push({ start: idx, end: idx + needle.length, claim });
  }
  spans.sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) segments.push({ text: text.slice(cursor, s.start), claim: null });
    segments.push({ text: text.slice(s.start, s.end), claim: s.claim });
    cursor = s.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), claim: null });
  return { segments, unanchored };
}
