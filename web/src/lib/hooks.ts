import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { readStorage, writeStorage } from './storage';

/** A ticking clock; only ticks while `active`. */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, active]);
  return now;
}

export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Boolean preference persisted per browser. */
export function useStoredFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const raw = readStorage(key);
    return raw === null ? initial : raw === '1';
  });
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      writeStorage(key, v ? '1' : '0');
    },
    [key],
  );
  return [value, set];
}

/** Rotates through lines on a cadence; resets when the list changes. */
export function useRotating(lines: string[], everyMs: number): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (lines.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), everyMs);
    return () => clearInterval(t);
  }, [lines, everyMs]);
  return lines[i % Math.max(1, lines.length)] ?? '';
}

export function scrollToId(id: string, reduced = false): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

/** Scroll to the element named by the URL hash once the content it points at exists. */
export function useHashScroll(ready: boolean): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash || !ready) return;
    const id = decodeURIComponent(hash.slice(1));
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
  }, [hash, ready]);
}
