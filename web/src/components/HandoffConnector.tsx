import type { SeatRecord } from '../api/model';
import { KIND_LABELS, personaById, seatByKind } from '../lib/council';
import { useRunSelector } from '../state/store';
import { seatStatus } from '../state/runStore';

interface Props {
  seat: SeatRecord;
  upstreamVersion: number | null;
}

/** The dependency label between two step cards, generated from seats[].depends_on. */
export function HandoffConnector({ seat, upstreamVersion }: Props) {
  const seats = useRunSelector((s) => s.seats);
  const roster = useRunSelector((s) => s.roster);
  const steps = useRunSelector((s) => s.steps);
  const versions = useRunSelector((s) => s.versions);
  const state = { seats, roster, steps } as Parameters<typeof seatStatus>[0];
  const persona = personaById(roster, seat.persona);
  const status = seatStatus(state, seat.id);
  const deps = seat.depends_on.map((kind) => ({ kind, seat: seatByKind(seats, kind) }));
  let label: string;
  if (status === 'queued') {
    const unmet = deps.find((d) => d.seat && seatStatus(state, d.seat.id) !== 'done');
    if (unmet?.seat) {
      const p = personaById(roster, unmet.seat.persona);
      label = `Starts when ${p?.name ?? 'the previous colleague'} finishes ${KIND_LABELS[unmet.kind]}`;
    } else {
      label = `${persona?.name ?? 'Next'} receives ${deps.map((d) => KIND_LABELS[d.kind]).join(', ')}`;
    }
  } else {
    label = `${persona?.name ?? 'Next'} ${status === 'working' ? 'receives' : 'received'} ${deps.map((d) => KIND_LABELS[d.kind]).join(', ')}`;
  }
  const active = status !== 'queued';
  const hasVersion = upstreamVersion !== null && !!versions[upstreamVersion];
  return (
    <div className={`handoff${active ? ' is-active' : ''}`} aria-hidden={false}>
      <span className="handoff__line" aria-hidden="true" />
      <div className="handoff__label">
        {upstreamVersion !== null && (
          <span className={`chip chip--version${hasVersion ? '' : ' chip--muted'}`} title={`Press release version ${upstreamVersion}`}>
            v{upstreamVersion}
          </span>
        )}
        <span className="handoff__arrow" aria-hidden="true">
          →
        </span>
        <span className="handoff__text">{label}</span>
      </div>
    </div>
  );
}
