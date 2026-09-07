import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SlotId } from '../api/model';
import { CHANGE_KIND_LABELS, SLOT_LABELS, VERSION_NAMES, personaById } from '../lib/council';
import { wordDiff } from '../lib/wordDiff';
import { useRun } from '../state/RunProvider';
import { slotHistory } from '../state/runStore';
import { useRunState } from '../state/store';
import { CloseIcon } from './Icons';
import { PersonaMonogram } from './PersonaMonogram';
import { DiffText } from './RedlineDocument';

interface Props {
  slot: SlotId;
  onClose: () => void;
}

/** One slot across every version, each with its author and the edit that produced it. */
export function SlotHistory({ slot, onClose }: Props) {
  const state = useRunState();
  const { basePath } = useRun();
  const [showChanges, setShowChanges] = useState(true);
  const history = slotHistory(state, slot);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet sheet--wide" role="dialog" aria-modal="true" aria-labelledby="slot-history-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <div className="section__title" style={{ marginBottom: 2 }}>
              Paragraph history
            </div>
            <h2 id="slot-history-title" className="page__title">
              {SLOT_LABELS[slot]}
            </h2>
          </div>
          <div className="row">
            <label className="row small" style={{ gap: 6 }}>
              <input type="checkbox" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} />
              Show changes
            </label>
            <button type="button" className="btn btn--quiet btn--sm" onClick={onClose} aria-label="Close">
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
        <div className="history">
          {history.map((h, i) => {
            const persona = personaById(state.roster, h.persona);
            const prev = i > 0 ? history[i - 1].text : null;
            return (
              <section key={h.version} className={`history__item${h.changed ? ' is-changed' : ''}`}>
                <header className="history__head">
                  <span className="chip chip--version">v{h.version}</span>
                  <span className="history__name">{VERSION_NAMES[h.version] ?? ''}</span>
                  <PersonaMonogram persona={persona} size={20} />
                  <span className="small">{persona?.name}</span>
                  {i > 0 && !h.changed && <span className="chip chip--muted">unchanged</span>}
                </header>
                {h.edit && (
                  <div className="history__edit">
                    <span className="chip chip--muted">{CHANGE_KIND_LABELS[h.edit.change_kind]}</span>
                    <span>{h.edit.rationale}</span>
                    {h.edit.evidence_finding_ids.length > 0 && (
                      <span className="row row--wrap" style={{ gap: 4 }}>
                        {h.edit.evidence_finding_ids.map((id) => {
                          const f = state.findings.find((x) => x.id === id);
                          return (
                            <span key={id} className="chip mono" title={f?.claim}>
                              {id}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </div>
                )}
                <p className="history__text">
                  {showChanges && h.changed && prev !== null ? <DiffText segments={wordDiff(prev, h.text)} /> : h.text}
                </p>
              </section>
            );
          })}
          {history.length === 0 && <p className="muted">No versions yet.</p>}
        </div>
        <p className="small">
          <Link to={`${basePath}/evolution?slot=${slot}`} onClick={onClose}>
            Open in Evolution
          </Link>
        </p>
      </aside>
    </div>
  );
}
