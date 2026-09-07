import { SLOT_LABELS, personaById } from '../lib/council';
import type { PersonaRecord } from '../api/model';
import type { EditRef } from '../state/runStore';
import { ChevronLeft, ChevronRight } from './Icons';

interface Props {
  edits: EditRef[];
  index: number;
  roster: PersonaRecord[];
  onIndex: (i: number) => void;
}

/** "Edit 3 of 7" with prev/next; keyboard bindings live in the page. */
export function EditWalkthrough({ edits, index, roster, onIndex }: Props) {
  if (!edits.length) return <div className="muted small">No edits in this range.</div>;
  const current = edits[Math.min(index, edits.length - 1)];
  const persona = personaById(roster, current.persona);
  return (
    <div className="walk" role="group" aria-label="Edit walkthrough">
      <button type="button" className="btn btn--sm" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index <= 0} aria-label="Previous edit">
        <ChevronLeft size={14} />
      </button>
      <span className="walk__label tabular">
        Edit {index + 1} of {edits.length}
      </span>
      <button type="button" className="btn btn--sm" onClick={() => onIndex(Math.min(edits.length - 1, index + 1))} disabled={index >= edits.length - 1} aria-label="Next edit">
        <ChevronRight size={14} />
      </button>
      <span className="walk__what muted small">
        {SLOT_LABELS[current.edit.slot_id]} · v{current.version} · {persona?.name}
      </span>
      <span className="walk__keys muted tiny hide-sm">← → edits · [ ] versions · r redline</span>
    </div>
  );
}
