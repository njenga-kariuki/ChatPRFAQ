import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunEvent } from './model';
import { subscribeRunEvents } from './sse';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

const frame = (seq: number, type: string, extra = '') => `id: ${seq}\nevent: ${type}\ndata: {"seq": ${seq}, "run_id": "r", "ts": "t", "type": "${type}"${extra}}\n\n`;

describe('subscribeRunEvents', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('replays, reconnects with the last seq, and stops on end', async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      if (urls.length === 1) {
        return new Response(streamOf([': keepalive\n\n', frame(1, 'run.started', ', "idea": "x"'), frame(2, 'run.status', ', "status": "framing"').slice(0, 20), frame(2, 'run.status', ', "status": "framing"').slice(20)]), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return new Response(streamOf([frame(3, 'run.cancelled'), 'event: end\ndata: {}\n\n']), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const events: RunEvent[] = [];
    const states: string[] = [];
    const ended = new Promise<void>((resolve) => {
      subscribeRunEvents('r', {
        after: 0,
        onEvent: (e) => events.push(e),
        onState: (s) => states.push(s),
        onEnd: resolve,
      });
    });
    await ended;
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(urls[0]).toContain('after=0');
    expect(urls[1]).toContain('after=2');
    expect(states).toEqual(['connecting', 'open', 'reconnecting', 'open', 'closed']);
  }, 10000);

  it('stops without retrying on a 4xx', async () => {
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const states: string[] = [];
    await new Promise<void>((resolve) => {
      subscribeRunEvents('missing', {
        after: 0,
        onEvent: () => undefined,
        onState: (s) => {
          states.push(s);
          if (s === 'error') resolve();
        },
        onEnd: () => undefined,
      });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['connecting', 'error']);
  });
});
