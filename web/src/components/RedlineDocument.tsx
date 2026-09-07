import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Finding, PersonaRecord, SlotId, VersionRecord } from '../api/model';
import { CHANGE_KIND_LABELS, SLOT_LABELS, SLOT_ORDER, personaById } from '../lib/council';
import { wordDiff, type DiffSegment } from '../lib/wordDiff';
import type { EditRef } from '../state/runStore';
import { HistoryIcon } from './Icons';
import { PersonaMonogram } from './PersonaMonogram';

export function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.op === 0 ? (
          <span key={i}>{s.text}</span>
        ) : s.op === 1 ? (
          <ins key={i} className="diff-ins">
            {s.text}
          </ins>
        ) : (
          <del key={i} className="diff-del">
            {s.text}
          </del>
        ),
      )}
    </>
  );
}

export type RedlineMode = 'read' | 'compare' | 'walk';

export interface SlotNote {
  slotId: SlotId;
  refs: EditRef[];
}

interface Props {
  from: VersionRecord;
  to: VersionRecord;
  mode: RedlineMode;
  edits: EditRef[];
  activeEdit: EditRef | null;
  roster: PersonaRecord[];
  findings: Finding[];
  wideGutter: boolean;
  onOpenHistory: (slot: SlotId) => void;
  onOpenFinding: (ids: string[]) => void;
  onOpenNote: (note: SlotNote) => void;
}

export function ProvenanceNote({
  note,
  roster,
  findings,
  expanded,
  onOpenFinding,
}: {
  note: SlotNote;
  roster: PersonaRecord[];
  findings: Finding[];
  expanded: boolean;
  onOpenFinding: (ids: string[]) => void;
}) {
  return (
    <div className={`provnote${expanded ? ' is-expanded' : ''}`}>
      {note.refs.map((ref, i) => {
        const persona = personaById(roster, ref.persona);
        return (
          <div key={`${ref.version}-${i}`} className="provnote__edit">
            <div className="provnote__author">
              <PersonaMonogram persona={persona} size={20} />
              <span className="provnote__name">{persona?.name ?? ref.persona}</span>
              <span className="chip chip--version">v{ref.version}</span>
              <span className="chip chip--muted">{CHANGE_KIND_LABELS[ref.edit.change_kind]}</span>
            </div>
            <div className="provnote__rationale">{ref.edit.rationale}</div>
            {ref.edit.evidence_finding_ids.length > 0 && (
              <div className="provnote__evidence">
                {ref.edit.evidence_finding_ids.map((id) => {
                  const f = findings.find((x) => x.id === id);
                  const label = f ? `${f.metric ? `${f.metric} · ` : ''}${f.claim}` : id;
                  return (
                    <button key={id} type="button" className="chip chip--evidence" onClick={() => onOpenFinding([id])} title={f?.claim}>
                      <span className="mono">{id}</span>
                      <span className="chip__text">{expanded ? label : f?.metric ?? f?.claim ?? id}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Slot-keyed press release with word-level diffs inside changed slots and a provenance gutter. */
export function RedlineDocument({ from, to, mode, edits, activeEdit, roster, findings, wideGutter, onOpenHistory, onOpenFinding, onOpenNote }: Props) {
  const rows = useMemo(() => {
    return SLOT_ORDER.map((slotId) => {
      const before = from.press_release.slots.find((s) => s.id === slotId)?.text ?? '';
      const after = to.press_release.slots.find((s) => s.id === slotId)?.text ?? '';
      const changed = mode !== 'read' && before !== after;
      const refs = edits.filter((e) => e.edit.slot_id === slotId);
      return { slotId, before, after, changed, refs, segments: changed ? wordDiff(before, after) : null };
    });
  }, [from, to, mode, edits]);

  const [hoverSlot, setHoverSlot] = useState<SlotId | null>(null);
  const activeSlot = mode === 'walk' && activeEdit ? activeEdit.edit.slot_id : null;

  useEffect(() => {
    if (!activeSlot) return;
    const el = document.getElementById(`slot-${activeSlot}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSlot, activeEdit]);

  return (
    <div className={`redline${wideGutter ? ' has-gutter' : ''} mode-${mode}`}>
      {rows.map((row) => {
        const dim = mode === 'walk' && activeSlot !== null && activeSlot !== row.slotId;
        const note: SlotNote | null = row.refs.length ? { slotId: row.slotId, refs: row.refs } : null;
        const showNote = wideGutter && note && (mode !== 'walk' || activeSlot === row.slotId);
        let body: ReactNode;
        if (row.segments) body = <DiffText segments={row.segments} />;
        else body = row.after;
        const tag = row.slotId === 'headline' ? 'h3' : 'p';
        const cls = `redline__text${row.slotId === 'headline' ? ' redline__text--headline' : row.slotId === 'subheading' ? ' redline__text--subheading' : ''}${row.changed ? ' is-changed' : ''}`;
        const walkRefs = mode === 'walk' && activeEdit && activeSlot === row.slotId ? [activeEdit] : row.refs;
        return (
          <div
            key={row.slotId}
            id={`slot-${row.slotId}`}
            className={`redline__row${dim ? ' is-dim' : ''}${activeSlot === row.slotId ? ' is-active' : ''}`}
            onMouseEnter={() => setHoverSlot(row.slotId)}
            onMouseLeave={() => setHoverSlot(null)}
          >
            <div className="redline__slot">
              <div className="redline__label">
                <span>{SLOT_LABELS[row.slotId]}</span>
                <button
                  type="button"
                  className={`slot-history${hoverSlot === row.slotId ? ' is-visible' : ''}`}
                  onClick={() => onOpenHistory(row.slotId)}
                  aria-label={`History of ${SLOT_LABELS[row.slotId]}`}
                  title="Paragraph history"
                >
                  <HistoryIcon size={14} />
                </button>
              </div>
              {tag === 'h3' ? <h3 className={cls}>{body}</h3> : <p className={cls}>{body}</p>}
              {!wideGutter && note && row.changed && (
                <button type="button" className="prov-marker" onClick={() => onOpenNote({ slotId: row.slotId, refs: walkRefs })}>
                  {walkRefs.length === 1 ? `${personaById(roster, walkRefs[0].persona)?.name ?? 'Edited'} · why` : `${walkRefs.length} edits · why`}
                </button>
              )}
            </div>
            {wideGutter && (
              <div className="redline__gutter">
                {showNote && row.changed && <ProvenanceNote note={{ slotId: row.slotId, refs: walkRefs }} roster={roster} findings={findings} expanded={mode === 'walk'} onOpenFinding={onOpenFinding} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
