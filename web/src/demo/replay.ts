/* Replays a recorded event log through the run store, at a chosen speed, with the
   framing gate honoured so the demo behaves like a real run. */

import type { ArtifactRecord, RunEvent, RunSnapshot } from '../api/model';
import type { RunStore } from '../state/store';

export type Speed = 1 | 4 | 'instant';

export interface ReplayState {
  playing: boolean;
  speed: Speed;
  index: number;
  total: number;
  atGate: boolean;
  done: boolean;
}

export interface ReplayController {
  getState(): ReplayState;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  setSpeed(speed: Speed): void;
  confirm(): void;
  refine(): void;
  restart(): void;
  finish(): void;
  destroy(): void;
}

const DELAY_MS: Partial<Record<RunEvent['type'], number>> = {
  'step.started': 700,
  'step.thinking': 600,
  'step.progress': 500,
  'step.tool': 700,
  'step.delta': 110,
  'step.completed': 450,
  'document.version': 250,
  'framing.ready': 200,
  'run.completed': 200,
};

export function emptySnapshotFrom(snapshot: RunSnapshot): RunSnapshot {
  return {
    run: {
      ...snapshot.run,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'framing',
      framing: null,
      completed_at: null,
      total_cost_usd: 0,
      error: null,
      headline: null,
      share_token: null,
    },
    steps: [],
    artifacts: [],
    versions: [],
    findings: [],
    sources: [],
    bar_raiser: null,
    last_seq: 0,
    roster: snapshot.roster,
    seats: snapshot.seats,
  };
}

export function parseEventLog(raw: string): RunEvent[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RunEvent);
}

interface Options {
  events: RunEvent[];
  snapshot: RunSnapshot;
  store: RunStore;
  speed: Speed;
  pauseAt?: number | null;
  autoConfirm?: boolean;
}

export function createReplay(opts: Options): ReplayController {
  const { events, snapshot, store } = opts;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let attemptOffset = 0; // bumps seat-0 attempts when the demo "refines"
  let queue: RunEvent[] = [];
  const state: ReplayState = {
    playing: false,
    speed: opts.speed,
    index: 0,
    total: events.length,
    atGate: false,
    done: false,
  };

  const notify = () => {
    for (const l of listeners) l();
  };

  const artifactsById = new Map<string, ArtifactRecord>(snapshot.artifacts.map((a) => [a.id, a]));

  function reset() {
    if (timer) clearTimeout(timer);
    timer = null;
    seq = 0;
    attemptOffset = 0;
    queue = [];
    state.index = 0;
    state.atGate = false;
    state.done = false;
    store.dispatch({ type: 'hydrate', snapshot: emptySnapshotFrom(snapshot) });
  }

  function afterApply(e: RunEvent) {
    if (e.type === 'step.completed') {
      const art = artifactsById.get(e.artifact_id);
      if (art) {
        const merge: Partial<RunSnapshot> = { artifacts: [art] };
        if (art.kind === 'ledger') {
          merge.findings = snapshot.findings;
          merge.sources = snapshot.sources;
        }
        store.dispatch({ type: 'merge', snapshot: merge });
      }
    }
    if (e.type === 'run.completed' && snapshot.bar_raiser) {
      store.dispatch({ type: 'merge', snapshot: { bar_raiser: snapshot.bar_raiser } });
    }
  }

  function stamp(e: RunEvent): RunEvent {
    seq += 1;
    const ts = new Date().toISOString();
    const copy = { ...e, seq, ts } as RunEvent;
    const isSeatZero = ('seat' in copy && copy.seat === '0') || copy.type === 'framing.ready';
    if (attemptOffset && isSeatZero && 'attempt' in copy) {
      (copy as { attempt: number }).attempt = (e as { attempt: number }).attempt + attemptOffset;
    }
    return copy;
  }

  /** Next event to apply: injected queue first, then the log. */
  function nextEvent(): RunEvent | null {
    if (queue.length) return queue.shift() ?? null;
    if (state.index >= events.length) return null;
    const e = events[state.index];
    state.index += 1;
    return e;
  }

  function applyOne(e: RunEvent): boolean {
    const stamped = stamp(e);
    store.dispatch({ type: 'events', events: [stamped] });
    afterApply(stamped);
    if (stamped.type === 'run.status' && stamped.status === 'awaiting_confirmation' && !opts.autoConfirm) {
      state.atGate = true;
      state.playing = false;
      return false;
    }
    if (opts.pauseAt && state.index >= opts.pauseAt && queue.length === 0) {
      state.playing = false;
      opts.pauseAt = null;
      return false;
    }
    return true;
  }

  function delayFor(e: RunEvent): number {
    if (state.speed === 'instant') return 0;
    const base = DELAY_MS[e.type] ?? 0;
    return base / state.speed;
  }

  function step() {
    timer = null;
    if (!state.playing) return;
    if (state.speed === 'instant') {
      const batch: RunEvent[] = [];
      let e: RunEvent | null;
      let halted = false;
      let paused = false;
      while ((e = nextEvent())) {
        const stamped = stamp(e);
        batch.push(stamped);
        if (stamped.type === 'run.status' && stamped.status === 'awaiting_confirmation' && !opts.autoConfirm) {
          halted = true;
          break;
        }
        if (opts.pauseAt && state.index >= opts.pauseAt && queue.length === 0) {
          paused = true;
          opts.pauseAt = null;
          break;
        }
      }
      store.dispatch({ type: 'events', events: batch });
      for (const b of batch) afterApply(b);
      state.playing = false;
      if (halted) state.atGate = true;
      else if (!paused) state.done = true;
      notify();
      return;
    }
    const e = nextEvent();
    if (!e) {
      state.playing = false;
      state.done = true;
      notify();
      return;
    }
    const keepGoing = applyOne(e);
    notify();
    if (keepGoing && state.playing) {
      const peek = queue[0] ?? events[state.index];
      timer = setTimeout(step, peek ? delayFor(peek) : 0);
    }
  }

  function play() {
    if (state.playing || state.done) return;
    if (state.atGate) return;
    state.playing = true;
    notify();
    timer = setTimeout(step, 0);
  }

  const controller: ReplayController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play,
    pause() {
      state.playing = false;
      if (timer) clearTimeout(timer);
      timer = null;
      notify();
    },
    setSpeed(speed) {
      state.speed = speed;
      notify();
      if (state.playing && speed === 'instant') {
        if (timer) clearTimeout(timer);
        timer = setTimeout(step, 0);
      }
    },
    confirm() {
      if (!state.atGate) return;
      state.atGate = false;
      play();
    },
    refine() {
      if (!state.atGate) return;
      // Re-run the framing seat: replay the seat-0 segment as the next attempt.
      const start = events.findIndex((e) => e.type === 'step.started' && e.seat === '0');
      const end = events.findIndex((e, i) => i > start && e.type === 'run.status' && e.status === 'awaiting_confirmation');
      if (start < 0 || end < 0) return;
      attemptOffset += 1;
      queue = [{ type: 'run.status', status: 'framing', seq: 0, run_id: snapshot.run.id, ts: '' } as RunEvent, ...events.slice(start, end + 1)];
      state.atGate = false;
      play();
    },
    restart() {
      reset();
      notify();
      play();
    },
    finish() {
      opts.autoConfirm = true;
      opts.pauseAt = null;
      state.atGate = false;
      state.speed = 'instant';
      state.playing = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(step, 0);
      notify();
    },
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      listeners.clear();
    },
  };

  reset();
  return controller;
}
