import { INSIGHT_LABELS, personaById, seatPhases } from '../lib/council';
import { usePrefersReducedMotion, scrollToId } from '../lib/hooks';
import { useRunSelector } from '../state/store';
import type { StepStatus } from '../state/runStore';
import { CheckIcon } from './Icons';
import { PersonaMonogram } from './PersonaMonogram';

function StatusGlyph({ status }: { status: StepStatus }) {
  if (status === 'done') return <CheckIcon size={13} className="glyph glyph--done" />;
  if (status === 'working') return <span className="glyph glyph--working" aria-label="working" />;
  if (status === 'failed') return <span className="glyph glyph--failed" aria-label="failed" />;
  return <span className="glyph glyph--queued" aria-label="queued" />;
}

/** Desktop: sticky roster grouped by phase. Mobile: horizontal stepper. */
export function CouncilRail({ variant }: { variant: 'rail' | 'stepper' }) {
  const seats = useRunSelector((s) => s.seats);
  const roster = useRunSelector((s) => s.roster);
  const steps = useRunSelector((s) => s.steps);
  const reduced = usePrefersReducedMotion();
  const phases = seatPhases(seats);
  const statusOf = (id: string): StepStatus => {
    const list = steps[id];
    return list && list.length ? list[list.length - 1].status : 'queued';
  };
  const insightOf = (id: string) => {
    const list = steps[id];
    return list && list.length ? list[list.length - 1].keyInsight : null;
  };

  if (variant === 'stepper') {
    return (
      <nav className="stepper" aria-label="Council progress">
        {seats.map((seat) => {
          const status = statusOf(seat.id);
          const persona = personaById(roster, seat.persona);
          return (
            <button
              key={seat.id}
              type="button"
              className={`stepper__item is-${status}`}
              onClick={() => scrollToId(`seat-${seat.id}`, reduced)}
              aria-label={`${seat.name}: ${status}`}
              title={seat.name}
            >
              <PersonaMonogram persona={persona} size={24} working={status === 'working'} muted={status === 'queued'} />
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="rail" aria-label="Council roster">
      {phases.map((ph) => (
        <div key={ph.phase} className="rail__phase">
          <div className="rail__phase-title">{ph.phase}</div>
          {ph.seats.map((seat) => {
            const status = statusOf(seat.id);
            const persona = personaById(roster, seat.persona);
            const insight = insightOf(seat.id);
            return (
              <button
                key={seat.id}
                type="button"
                className={`rail__row is-${status}`}
                onClick={() => scrollToId(`seat-${seat.id}`, reduced)}
                aria-current={status === 'working' ? 'step' : undefined}
              >
                <PersonaMonogram persona={persona} size={24} working={status === 'working'} muted={status === 'queued'} />
                <span className="rail__main">
                  <span className="rail__title">{seat.name}</span>
                  {status === 'done' && insight && (
                    <span className="rail__insight">
                      <span className="rail__insight-label">{INSIGHT_LABELS[seat.produces]}:</span> {insight}
                    </span>
                  )}
                </span>
                <StatusGlyph status={status} />
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
