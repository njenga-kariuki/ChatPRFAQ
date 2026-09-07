import { useMemo, useState, type CSSProperties } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/AppShell';
import { ExportMenu } from '../components/ExportMenu';
import { PauseIcon, PlayIcon, RefreshIcon } from '../components/Icons';
import { ShareSheet } from '../components/ShareSheet';
import { ThemeToggle } from '../components/ThemeToggle';
import { useToast } from '../components/Toast';
import type { Speed } from '../demo/replay';
import { formatDuration, formatUsd } from '../lib/format';
import { useNow } from '../lib/hooks';
import { RunProvider, useReplayState, useRun, type RunSource } from '../state/RunProvider';
import { costSoFar, isTerminal, runElapsedMs, runTitle, workingSeats } from '../state/runStore';
import { useRunState } from '../state/store';

export function RunLayout({ kind }: { kind: 'live' | 'share' | 'demo' }) {
  const params = useParams();
  const [search] = useSearchParams();
  const location = useLocation();
  const runId = params.runId ?? '';
  const token = params.token ?? '';
  const source = useMemo<RunSource>(() => {
    if (kind === 'live') return { kind: 'live', runId };
    if (kind === 'share') return { kind: 'share', token };
    const speedParam = search.get('speed');
    const speed: Speed = speedParam === '4' ? 4 : speedParam === 'instant' ? 'instant' : 1;
    const at = Number(search.get('at') ?? 0);
    const sub = location.pathname.replace(/^\/demo\/?/, '').split('/')[0];
    const watching = sub === '' || sub === 'council' || sub === 'brief';
    return {
      kind: 'demo',
      speed: watching ? speed : 'instant',
      pauseAt: at > 0 ? at : null,
      autoConfirm: !watching || at > 12 || speed === 'instant',
    };
    // The source is fixed for the life of the run page; query changes do not restart the replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, runId, token]);
  const basePath = kind === 'live' ? `/runs/${runId}` : kind === 'share' ? `/s/${token}` : '/demo';
  return (
    <RunProvider source={source} basePath={basePath}>
      <RunFrame />
    </RunProvider>
  );
}

const STATUS_LABEL: Record<string, string> = {
  framing: 'Framing',
  awaiting_confirmation: 'Awaiting your review',
  running: 'Working',
  completed: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function DemoControls() {
  const { demo } = useRun();
  const replay = useReplayState();
  if (!demo || !replay) return null;
  const speeds: { v: Speed; label: string }[] = [
    { v: 1, label: '1×' },
    { v: 4, label: '4×' },
    { v: 'instant', label: 'Instant' },
  ];
  return (
    <div className="demo-controls" aria-label="Replay controls">
      <span className="chip chip--accent">Sample run</span>
      <div className="seg" role="group" aria-label="Replay speed">
        {speeds.map((s) => (
          <button key={String(s.v)} type="button" className="seg__btn" aria-pressed={replay.speed === s.v} onClick={() => demo.setSpeed(s.v)}>
            {s.label}
          </button>
        ))}
      </div>
      {!replay.done && !replay.atGate && (
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => (replay.playing ? demo.pause() : demo.play())} aria-label={replay.playing ? 'Pause replay' : 'Play replay'}>
          {replay.playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
      )}
      <button type="button" className="btn btn--quiet btn--sm" onClick={() => demo.restart()} aria-label="Restart replay" title="Restart">
        <RefreshIcon size={14} />
      </button>
    </div>
  );
}

function RunFrame() {
  const { basePath, source, readOnly, actions } = useRun();
  const state = useRunState();
  const toast = useToast();
  const active = !!state.status && !isTerminal(state.status);
  const now = useNow(1000, active);
  const [busy, setBusy] = useState(false);

  if (state.loadError) {
    return (
      <div className="page page--narrow">
        <div className="notice notice--danger" role="alert">
          <span>{state.loadError}</span>
        </div>
        <p style={{ marginTop: 16 }}>
          <Link to="/runs" className="btn">
            Back to runs
          </Link>
        </p>
      </div>
    );
  }
  if (!state.runId) {
    return <div className="run-loading">Loading the run…</div>;
  }

  const working = workingSeats(state);
  const elapsed = isTerminal(state.status) && state.completedDurationS !== null ? state.completedDurationS * 1000 : runElapsedMs(state, now);
  const statusLabel =
    state.status === 'running' && working.length > 0 ? `${working.length} ${working.length === 1 ? 'colleague' : 'colleagues'} working` : STATUS_LABEL[state.status ?? ''] ?? '';
  const dotClass =
    state.status === 'running' || state.status === 'framing'
      ? 'status-dot--live'
      : state.status === 'completed'
        ? 'status-dot--done'
        : state.status === 'failed' || state.status === 'cancelled'
          ? 'status-dot--failed'
          : 'status-dot--waiting';

  const resume = async () => {
    setBusy(true);
    try {
      await actions.resume();
      toast('Resuming the run');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not resume');
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { to: 'brief', label: 'Brief' },
    { to: 'council', label: 'Council' },
    { to: 'document', label: 'Document' },
    { to: 'evolution', label: 'Evolution' },
    { to: 'research', label: 'Research' },
  ];

  return (
    <div className="runframe" style={{ '--topbar-extra': source.kind === 'demo' ? '36px' : '0px' } as CSSProperties}>
      <header className="topbar">
        <div className="topbar__row">
          <Brand to="/" />
          <div className="topbar__title" title={state.idea}>
            {runTitle(state)}
          </div>
          <div className="topbar__meta">
            <span className="row" style={{ gap: 6 }} title={statusLabel}>
              <span className={`status-dot ${dotClass}`} aria-hidden="true" />
              <span className="hide-sm">{statusLabel}</span>
            </span>
            {elapsed !== null && (
              <>
                <span className="sep hide-sm">·</span>
                <span className="tabular hide-sm" title="Elapsed">
                  {formatDuration(elapsed / 1000)}
                </span>
              </>
            )}
            <span className="sep">·</span>
            <span className="tabular" title="Cost so far">
              {formatUsd(costSoFar(state))}
            </span>
            {(state.connection === 'reconnecting' || state.connection === 'connecting') && active && <span className="connection">Reconnecting…</span>}
            {state.connection === 'error' && <span className="connection">Live updates unavailable</span>}
          </div>
          <div className="topbar__actions">
            {source.kind === 'demo' && (
              <div className="topbar__demo-inline">
                <DemoControls />
              </div>
            )}
            {source.kind === 'live' && <ShareSheet />}
            <ExportMenu />
            <ThemeToggle />
          </div>
        </div>
        <nav className="topbar__tabs" aria-label="Run sections">
          {tabs.map((t) => (
            <NavLink key={t.to} to={`${basePath}/${t.to}`} className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        {source.kind === 'demo' && (
          <div className="topbar__demo-row">
            <DemoControls />
          </div>
        )}
      </header>
      {state.budgetWarning && (
        <div className="run-banner">
          <div className="notice notice--warning" role="status">
            <span>
              Cost has reached {formatUsd(state.budgetWarning.spentUsd)} of the {formatUsd(state.budgetWarning.ceilingUsd)} ceiling for this run. The council stops at the ceiling.
            </span>
          </div>
        </div>
      )}
      {(state.status === 'failed' || state.status === 'cancelled') && (
        <div className="run-banner">
          <div className={`notice ${state.status === 'failed' ? 'notice--danger' : ''}`} role="alert">
            <span className="grow">{state.status === 'failed' ? `The run failed: ${state.error ?? 'unknown error'}` : 'This run was cancelled.'}</span>
            {!readOnly && source.kind === 'live' && (
              <button type="button" className="btn btn--sm" onClick={resume} disabled={busy}>
                <RefreshIcon size={13} />
                {busy ? 'Resuming…' : 'Resume'}
              </button>
            )}
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}

/** /runs/:id → the right view for the run's state. */
export function RunIndexRedirect() {
  const { basePath, source } = useRun();
  const status = useRunState().status;
  if (!status) return <div className="run-loading">Loading the run…</div>;
  if (source.kind === 'share') return <Navigate to={`${basePath}/document`} replace />;
  if (status === 'framing' || status === 'awaiting_confirmation') return <Navigate to={`${basePath}/brief`} replace />;
  if (status === 'completed') return <Navigate to={`${basePath}/document`} replace />;
  return <Navigate to={`${basePath}/council`} replace />;
}
