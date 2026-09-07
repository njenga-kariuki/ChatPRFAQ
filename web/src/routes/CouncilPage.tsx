import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CouncilRail } from '../components/CouncilRail';
import { CouncilTimeline } from '../components/CouncilTimeline';
import { useToast } from '../components/Toast';
import { useMediaQuery } from '../lib/hooks';
import { useRun } from '../state/RunProvider';
import { seatStatus } from '../state/runStore';
import { useRunState } from '../state/store';

export function CouncilPage() {
  const { readOnly, actions, source, basePath } = useRun();
  const state = useRunState();
  const toast = useToast();
  const wide = useMediaQuery('(min-width: 1100px)');
  const [busy, setBusy] = useState(false);
  const done = state.seats.filter((s) => seatStatus(state, s.id) === 'done').length;
  const total = state.seats.length;
  const running = state.status === 'running';
  const canCancel = !readOnly && source.kind === 'live' && (running || state.status === 'framing');

  const cancel = async () => {
    if (!window.confirm('Cancel this run? Finished steps are kept and the run can be resumed later.')) return;
    setBusy(true);
    try {
      await actions.cancel();
      toast('Cancelling…');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="council">
      {!wide && <CouncilRail variant="stepper" />}
      <div className="council__layout">
        {wide && (
          <aside className="council__rail">
            <CouncilRail variant="rail" />
          </aside>
        )}
        <div className="council__main">
          <div className="council__head">
            <div className="muted small tabular">
              {done} of {total} steps done
              {state.status === 'awaiting_confirmation' && (
                <>
                  {' · '}
                  <Link to={`${basePath}/brief`}>Review the brief to start the council</Link>
                </>
              )}
            </div>
            {canCancel && (
              <button type="button" className="btn btn--sm btn--danger" onClick={cancel} disabled={busy}>
                {busy ? 'Cancelling…' : 'Cancel run'}
              </button>
            )}
          </div>
          <CouncilTimeline />
        </div>
      </div>
    </div>
  );
}
