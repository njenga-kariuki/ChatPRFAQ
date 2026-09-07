import { useEffect, useState } from 'react';
import { useRunSelector } from '../state/store';
import { CopyButton } from './CopyButton';
import { CloseIcon, LinkIcon } from './Icons';

export function ShareSheet() {
  const [open, setOpen] = useState(false);
  const token = useRunSelector((s) => s.shareToken);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const url = token ? `${window.location.origin}/s/${token}` : null;
  return (
    <>
      <button type="button" className="btn btn--sm" onClick={() => setOpen(true)}>
        <LinkIcon size={14} />
        <span className="btn__label">Share</span>
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2 id="share-title" className="page__title">
                Share this run
              </h2>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(false)} aria-label="Close">
                <CloseIcon size={16} />
              </button>
            </div>
            {url ? (
              <>
                <p className="muted small">An unlisted, read-only link. Anyone with it can open the run.</p>
                <div className="share-url">
                  <input className="input mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
                  <CopyButton text={url} label="Copy link" size="md" />
                </div>
                <div>
                  <div className="section__title">What readers see</div>
                  <ul className="av-list">
                    <li>The final PRFAQ and the validation plan (opens here by default).</li>
                    <li>The press-release evolution with every edit, its author and its evidence.</li>
                    <li>The research ledger: findings, sources and the simulated panels.</li>
                    <li>A replay of the council progression.</li>
                  </ul>
                  <div className="section__title" style={{ marginTop: 16 }}>
                    What stays private
                  </div>
                  <ul className="av-list">
                    <li>Working notes (reasoning summaries) are never shown on the shared page.</li>
                    <li>Nobody can edit, cancel or resume the run from the link.</li>
                  </ul>
                </div>
              </>
            ) : (
              <p className="muted">A share link becomes available once the run has been created on the server.</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
