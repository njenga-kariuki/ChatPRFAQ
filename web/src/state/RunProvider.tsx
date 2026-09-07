import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { Framing, RefineFramingRequest, RunEvent, RunSnapshot } from '../api/model';
import { subscribeRunEvents, type SseHandle } from '../api/sse';
import { createReplay, parseEventLog, type ReplayController, type Speed } from '../demo/replay';
import { createRunStore, RunStoreContext, type RunStore } from './store';
import { isTerminal } from './runStore';
import fixtureSnapshot from '../../fixtures/run.snapshot.json';
import fixtureEventsRaw from '../../fixtures/run.events.jsonl?raw';

export type RunSource =
  | { kind: 'live'; runId: string }
  | { kind: 'share'; token: string }
  | { kind: 'demo'; speed: Speed; pauseAt: number | null; autoConfirm: boolean };

export interface RunActions {
  refine(body: RefineFramingRequest): Promise<void>;
  confirm(framing?: Framing): Promise<void>;
  cancel(): Promise<void>;
  resume(): Promise<void>;
}

export interface RunContextValue {
  store: RunStore;
  source: RunSource;
  basePath: string;
  readOnly: boolean;
  showNotes: boolean;
  demo: ReplayController | null;
  actions: RunActions;
  reload(): Promise<void>;
}

const RunContext = createContext<RunContextValue | null>(null);

export function useRun(): RunContextValue {
  const v = useContext(RunContext);
  if (!v) throw new Error('useRun must be used inside a RunProvider');
  return v;
}

export function useReplayState() {
  const { demo } = useRun();
  return useSyncExternalStore(
    demo ? demo.subscribe : () => () => undefined,
    () => (demo ? demo.getState() : null),
    () => (demo ? demo.getState() : null),
  );
}

const REFETCH_TYPES = new Set<RunEvent['type']>(['step.completed', 'step.failed', 'framing.ready', 'run.completed', 'run.failed', 'run.cancelled']);

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.detail;
  if (e instanceof Error) return e.message;
  return String(e);
}

interface Props {
  source: RunSource;
  basePath: string;
  children: ReactNode;
}

export function RunProvider({ source, basePath, children }: Props) {
  const key = source.kind === 'live' ? `live:${source.runId}` : source.kind === 'share' ? `share:${source.token}` : 'demo';
  const store = useMemo(() => createRunStore(), [key]);
  const [demo, setDemo] = useState<ReplayController | null>(null);
  const sseRef = useRef<SseHandle | null>(null);
  const runIdRef = useRef<string | null>(null);
  const connectRef = useRef<(() => void) | null>(null);
  const reloadRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (source.kind === 'demo') {
      const snapshot = fixtureSnapshot as unknown as RunSnapshot;
      const controller = createReplay({
        events: parseEventLog(fixtureEventsRaw),
        snapshot,
        store,
        speed: source.speed,
        pauseAt: source.pauseAt,
        autoConfirm: source.autoConfirm,
      });
      setDemo(controller);
      store.dispatch({ type: 'connection', state: 'open' });
      controller.play();
      return () => {
        controller.destroy();
        setDemo(null);
      };
    }

    let cancelled = false;
    let pending: RunEvent[] = [];
    let flushScheduled = false;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    const refetch = async () => {
      const id = runIdRef.current;
      if (!id) return;
      try {
        const snap = source.kind === 'share' ? await api.getShared(source.token) : await api.getRun(id);
        if (!cancelled) store.dispatch({ type: 'merge', snapshot: snap });
      } catch {
        /* the stream is still authoritative */
      }
    };
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => void refetch(), 350);
    };
    const flush = () => {
      flushScheduled = false;
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      store.dispatch({ type: 'events', events: batch });
      if (batch.some((e) => REFETCH_TYPES.has(e.type))) scheduleRefetch();
    };
    const schedule = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
      else setTimeout(flush, 16);
    };
    const connect = () => {
      const id = runIdRef.current;
      if (!id || sseRef.current) return;
      sseRef.current = subscribeRunEvents(id, {
        after: store.getState().streamSeq,
        onEvent: (e) => {
          pending.push(e);
          schedule();
        },
        onState: (s) => store.dispatch({ type: 'connection', state: s }),
        onEnd: () => {
          sseRef.current = null;
          flush();
          void refetch();
        },
      });
    };

    (async () => {
      try {
        const snap = source.kind === 'share' ? await api.getShared(source.token) : await api.getRun(source.runId);
        if (cancelled) return;
        runIdRef.current = snap.run.id;
        store.dispatch({ type: 'hydrate', snapshot: snap });
        if (!isTerminal(snap.run.status)) connect();
        else store.dispatch({ type: 'connection', state: 'closed' });
      } catch (e) {
        if (!cancelled) store.dispatch({ type: 'loadError', error: errorMessage(e) });
      }
    })();

    // Expose connect for actions that restart a finished stream.
    connectRef.current = connect;
    reloadRef.current = refetch;

    return () => {
      cancelled = true;
      if (refetchTimer) clearTimeout(refetchTimer);
      sseRef.current?.close();
      sseRef.current = null;
      connectRef.current = null;
      reloadRef.current = null;
    };
  }, [key, store]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<RunContextValue>(() => {
    const ensureStream = () => {
      if (!sseRef.current) connectRef.current?.();
    };
    const actions: RunActions =
      source.kind === 'live'
        ? {
            async refine(body) {
              await api.refineFraming(source.runId, body);
              ensureStream();
            },
            async confirm(framing) {
              await api.confirmFraming(source.runId, framing);
              ensureStream();
            },
            async cancel() {
              await api.cancelRun(source.runId);
            },
            async resume() {
              await api.resumeRun(source.runId);
              ensureStream();
            },
          }
        : source.kind === 'demo'
          ? {
              async refine() {
                demo?.refine();
              },
              async confirm() {
                demo?.confirm();
              },
              async cancel() {
                demo?.pause();
              },
              async resume() {
                demo?.play();
              },
            }
          : {
              async refine() {
                throw new Error('This run is read-only.');
              },
              async confirm() {
                throw new Error('This run is read-only.');
              },
              async cancel() {
                throw new Error('This run is read-only.');
              },
              async resume() {
                throw new Error('This run is read-only.');
              },
            };
    return {
      store,
      source,
      basePath,
      readOnly: source.kind === 'share',
      showNotes: source.kind !== 'share',
      demo,
      actions,
      reload: async () => {
        await reloadRef.current?.();
      },
    };
  }, [store, source, basePath, demo]);

  return (
    <RunContext.Provider value={value}>
      <RunStoreContext.Provider value={store}>{children}</RunStoreContext.Provider>
    </RunContext.Provider>
  );
}
