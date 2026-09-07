import type { PersonaRecord, SeatRecord, VersionRecord } from '../api/model';
import { INSIGHT_LABELS, KIND_VERSION, VERSION_NAMES, personaById } from '../lib/council';
import type { StepAttempt } from '../state/runStore';
import { InsightLine } from './InsightLine';
import { PersonaMonogram } from './PersonaMonogram';

interface Props {
  versions: VersionRecord[];
  seats: SeatRecord[];
  steps: Record<string, StepAttempt[]>;
  roster: PersonaRecord[];
  from: number;
  to: number;
  mode: 'read' | 'compare' | 'walk';
  onSelect: (version: number) => void;
}

/** Four-stop segmented control with author monogram and the comparative insight as a caption. */
export function VersionStops({ versions, seats, steps, roster, from, to, mode, onSelect }: Props) {
  const stops = [1, 2, 3, 4].map((n) => {
    const v = versions.find((x) => x.version === n) ?? null;
    const seat = seats.find((s) => KIND_VERSION[s.produces] === n) ?? null;
    const attempts = seat ? steps[seat.id] ?? [] : [];
    const attempt = attempts[attempts.length - 1] ?? null;
    const persona = personaById(roster, v?.persona ?? seat?.persona ?? '');
    return { n, v, seat, attempt, persona };
  });
  const active = stops.find((s) => s.n === to);
  const caption = active?.v?.caption ?? active?.attempt?.keyInsight ?? null;
  const captionLabel = active?.seat ? INSIGHT_LABELS[active.seat.produces] : 'Insight';
  return (
    <div className="stops">
      <div className="stops__row" role="group" aria-label="Press release versions">
        {stops.map((s) => {
          const inRange = mode !== 'read' && s.n >= from && s.n <= to;
          const working = s.attempt?.status === 'working';
          return (
            <button
              key={s.n}
              type="button"
              className={`stop${s.n === to ? ' is-active' : ''}${inRange ? ' in-range' : ''}${s.n === from && mode !== 'read' ? ' is-from' : ''}`}
              disabled={!s.v}
              onClick={() => onSelect(s.n)}
              aria-pressed={s.n === to}
              title={s.v ? `v${s.n} · ${VERSION_NAMES[s.n]}` : working ? 'In progress' : 'Not yet'}
            >
              <span className="stop__num mono">v{s.n}</span>
              <span className="stop__name">{VERSION_NAMES[s.n]}</span>
              <PersonaMonogram persona={s.persona} size={20} working={working} muted={!s.v} />
              {!s.v && <span className="stop__state">{working ? 'in progress' : 'not yet'}</span>}
            </button>
          );
        })}
      </div>
      {caption && (
        <div className="stops__caption">
          <InsightLine label={captionLabel} text={caption} compact />
        </div>
      )}
    </div>
  );
}
