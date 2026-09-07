import { parse, Allow } from 'partial-json';

/** Parse a JSON document that may still be streaming. Returns null until the text
 *  contains enough of an object to render anything. Complete documents parse strictly. */
export function parsePartialJson<T = unknown>(text: string): T | null {
  const trimmed = text.trimStart();
  if (!trimmed) return null;
  const start = trimmed.indexOf('{');
  if (start < 0) return null;
  const body = start === 0 ? trimmed : trimmed.slice(start);
  try {
    return JSON.parse(body) as T;
  } catch {
    /* still streaming */
  }
  try {
    const value = parse(body, Allow.ALL) as T;
    return value ?? null;
  } catch {
    return null;
  }
}

/** True when the text parses as complete JSON. */
export function isCompleteJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
