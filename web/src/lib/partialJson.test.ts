import { describe, expect, it } from 'vitest';
import { isCompleteJson, parsePartialJson } from './partialJson';

describe('parsePartialJson', () => {
  it('returns null until an object begins', () => {
    expect(parsePartialJson('')).toBeNull();
    expect(parsePartialJson('   ')).toBeNull();
  });

  it('renders the fields that have arrived so far', () => {
    const text = '{"edits": [{"slot_id": "headline", "new_text": "BookkeepingService Closes the Bo';
    const parsed = parsePartialJson<{ edits: { slot_id: string; new_text: string }[] }>(text);
    expect(parsed?.edits).toHaveLength(1);
    expect(parsed?.edits[0].slot_id).toBe('headline');
    expect(parsed?.edits[0].new_text.startsWith('BookkeepingService')).toBe(true);
  });

  it('keeps nested structures while a later field is open', () => {
    const text = '{"press_release": {"slots": [{"id": "headline", "text": "A", "claims": []}, {"id": "subheading", "text": "B", "claims": []}]}, "summary_of_changes": "Tight';
    const parsed = parsePartialJson<{ press_release: { slots: { id: string; text: string }[] }; summary_of_changes: string }>(text);
    expect(parsed?.press_release.slots.map((s) => s.id)).toEqual(['headline', 'subheading']);
    expect(parsed?.summary_of_changes).toBe('Tight');
  });

  it('parses complete documents strictly', () => {
    const text = '{"a": 1, "b": [1, 2, 3]}';
    expect(parsePartialJson(text)).toEqual({ a: 1, b: [1, 2, 3] });
    expect(isCompleteJson(text)).toBe(true);
    expect(isCompleteJson('{"a": 1')).toBe(false);
  });
});
