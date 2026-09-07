import { createContext, useContext, useSyncExternalStore } from 'react';
import type { RunEvent, RunSnapshot } from '../api/model';
import { applyEvents, hydrate, initialState, mergeSnapshot, type ConnectionState, type RunState } from './runStore';

export type Action =
  | { type: 'hydrate'; snapshot: RunSnapshot }
  | { type: 'merge'; snapshot: Partial<RunSnapshot> }
  | { type: 'events'; events: RunEvent[] }
  | { type: 'connection'; state: ConnectionState }
  | { type: 'loadError'; error: string | null }
  | { type: 'replace'; state: RunState };

export interface RunStore {
  getState(): RunState;
  subscribe(listener: () => void): () => void;
  dispatch(action: Action): void;
}

export function reduce(state: RunState, action: Action): RunState {
  switch (action.type) {
    case 'hydrate':
      return hydrate(state, action.snapshot);
    case 'merge':
      return mergeSnapshot(state, action.snapshot);
    case 'events':
      return applyEvents(state, action.events);
    case 'connection':
      return state.connection === action.state ? state : { ...state, connection: action.state };
    case 'loadError':
      return state.loadError === action.error ? state : { ...state, loadError: action.error };
    case 'replace':
      return action.state;
    default:
      return state;
  }
}

export function createRunStore(initial: RunState = initialState()): RunStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      for (const l of listeners) l();
    },
  };
}

export const RunStoreContext = createContext<RunStore | null>(null);

export function useRunStore(): RunStore {
  const store = useContext(RunStoreContext);
  if (!store) throw new Error('useRunStore must be used inside a RunProvider');
  return store;
}

/** Subscribe to a slice. Selectors must return a stable reference for an unchanged state
 *  (state slices or primitives); derive arrays with useMemo in the component. */
export function useRunSelector<T>(selector: (state: RunState) => T): T {
  const store = useRunStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function useRunState(): RunState {
  return useRunSelector((s) => s);
}
