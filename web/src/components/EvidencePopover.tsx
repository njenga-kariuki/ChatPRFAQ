import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Finding, PersonaRecord, Source } from '../api/model';
import { CONFIDENCE_LABELS, TOPIC_LABELS } from '../lib/council';
import { domainOf } from '../lib/format';
import { CloseIcon, ExternalIcon } from './Icons';
import { PersonaMonogram } from './PersonaMonogram';

export interface EvidenceTarget {
  findingIds: string[];
  kind?: 'evidence' | 'assumption';
  claimText?: string;
  anchor: DOMRect;
}

interface CardProps {
  findingIds: string[];
  kind?: 'evidence' | 'assumption';
  claimText?: string;
  findings: Finding[];
  sources: Source[];
  establishedBy?: PersonaRecord;
  footer?: ReactNode;
}

/** The finding, who established it, and its sources. Used by the popover and the side sheet. */
export function FindingCard({ findingIds, kind, claimText, findings, sources, establishedBy, footer }: CardProps) {
  const found = findingIds.map((id) => ({ id, f: findings.find((x) => x.id === id) }));
  return (
    <div className="evcard">
      {kind === 'assumption' && (
        <div className="evcard__assumption">
          <span className="chip chip--warning">Assumption</span>
          <span className="small">Stated without a finding behind it; flagged for validation.</span>
        </div>
      )}
      {claimText && <div className="evcard__claim">“{claimText}”</div>}
      {found.length === 0 && kind !== 'assumption' && <div className="muted small">No finding is linked to this sentence.</div>}
      {found.map(({ id, f }) => (
        <div key={id} className="evcard__finding">
          <div className="row row--wrap" style={{ gap: 6 }}>
            <span className="chip mono">{id}</span>
            {f?.metric && <span className="chip chip--accent">{f.metric}</span>}
            {f && <span className={`chip chip--conf-${f.confidence}`}>{CONFIDENCE_LABELS[f.confidence]}</span>}
            {f && <span className="chip chip--muted">{TOPIC_LABELS[f.topic]}</span>}
          </div>
          <div className="evcard__text">{f ? f.claim : 'Finding not in the ledger.'}</div>
          {establishedBy && (
            <div className="evcard__by">
              <PersonaMonogram persona={establishedBy} size={20} />
              <span>Established by {establishedBy.name}</span>
            </div>
          )}
          {f && f.source_ids.length > 0 && (
            <ul className="evcard__sources">
              {f.source_ids.map((sid) => {
                const s = sources.find((x) => x.id === sid);
                if (!s) return <li key={sid}>{sid}</li>;
                return (
                  <li key={sid}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="srclink">
                      <span>{s.title}</span>
                      <span className="srclink__domain">{domainOf(s.url)}</span>
                      <ExternalIcon size={12} />
                    </a>
                    {s.cited_text && <div className="evcard__cited">“{s.cited_text}”</div>}
                  </li>
                );
              })}
            </ul>
          )}
          {f && f.source_ids.length === 0 && <div className="muted small">From the analyst's synthesis; no direct source.</div>}
        </div>
      ))}
      {footer}
    </div>
  );
}

interface PopoverProps extends Omit<CardProps, 'footer'> {
  anchor: DOMRect;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function EvidencePopover({ anchor, onClose, onMouseEnter, onMouseLeave, ...card }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: anchor.bottom + 8, left: anchor.left });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(anchor.left, vw - w - 12);
    left = Math.max(12, left);
    let top = anchor.bottom + 8;
    if (top + h > vh - 12) top = Math.max(12, anchor.top - h - 8);
    setPos({ top, left });
  }, [anchor]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onClose, { passive: true, once: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onClose);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="popover popover--fixed" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Evidence" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button type="button" className="popover__close btn btn--quiet btn--sm" onClick={onClose} aria-label="Close">
        <CloseIcon size={14} />
      </button>
      <FindingCard {...card} />
    </div>
  );
}
