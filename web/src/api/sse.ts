/* Server-Sent Events over fetch: replays from `after`, reconnects with the last seq,
   stops on `event: end`, and reports connection state. */

import type { RunEvent } from './model';
import type { ConnectionState } from '../state/runStore';

export interface SseOptions {
  after: number;
  onEvent(event: RunEvent): void;
  onState(state: ConnectionState): void;
  onEnd(): void;
  onError?(error: Error): void;
}

export interface SseHandle {
  close(): void;
}

interface Frame {
  id: string | null;
  event: string | null;
  data: string;
}

function parseFrame(block: string): Frame | null {
  const frame: Frame = { id: null, event: null, data: '' };
  let seen = false;
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    seen = true;
    if (field === 'id') frame.id = value;
    else if (field === 'event') frame.event = value;
    else if (field === 'data') frame.data = frame.data ? `${frame.data}\n${value}` : value;
  }
  return seen ? frame : null;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

export function subscribeRunEvents(runId: string, opts: SseOptions): SseHandle {
  const ctrl = new AbortController();
  let last = opts.after;
  let closed = false;
  let failures = 0;

  async function readOnce(): Promise<'end' | 'closed'> {
    const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/events?after=${last}`, {
      signal: ctrl.signal,
      headers: { Accept: 'text/event-stream' },
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    if (!res.body) throw new Error('no response body');
    opts.onState('open');
    failures = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return 'closed';
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, '');
        const frame = parseFrame(block);
        if (!frame) continue;
        if (frame.event === 'end') return 'end';
        if (!frame.data) continue;
        let event: RunEvent;
        try {
          event = JSON.parse(frame.data) as RunEvent;
        } catch {
          continue;
        }
        const seq = frame.id && /^\d+$/.test(frame.id) ? Number(frame.id) : event.seq;
        if (seq <= last) continue;
        last = seq;
        opts.onEvent(event);
      }
    }
  }

  (async () => {
    opts.onState('connecting');
    while (!closed) {
      try {
        const outcome = await readOnce();
        if (closed) return;
        if (outcome === 'end') {
          opts.onState('closed');
          opts.onEnd();
          return;
        }
      } catch (err) {
        if (closed) return;
        const status = (err as { status?: number }).status;
        if (status && status >= 400 && status < 500) {
          opts.onState('error');
          opts.onError?.(err as Error);
          return;
        }
        opts.onError?.(err as Error);
      }
      failures += 1;
      opts.onState('reconnecting');
      await sleep(Math.min(15000, 1000 * 2 ** Math.min(failures - 1, 4)), ctrl.signal);
    }
  })();

  return {
    close() {
      if (closed) return;
      closed = true;
      ctrl.abort();
      opts.onState('closed');
    },
  };
}
