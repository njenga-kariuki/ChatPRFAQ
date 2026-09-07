import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SlotId } from '../api/model';
import { EditWalkthrough } from '../components/EditWalkthrough';
import { FindingCard } from '../components/EvidencePopover';
import { CloseIcon, DownloadIcon } from '../components/Icons';
import { ProvenanceNote, RedlineDocument, type RedlineMode, type SlotNote } from '../components/RedlineDocument';
import { SlotHistory } from '../components/SlotHistory';
import { useToast } from '../components/Toast';
import { VersionStops } from '../components/VersionStops';
import { SLOT_LABELS, VERSION_NAMES, personaForSeat } from '../lib/council';
import { downloadBlob, safeFileStem } from '../lib/download';
import { useMediaQuery } from '../lib/hooks';
import { useRun } from '../state/RunProvider';
import { allEdits, finalPrfaq, versionList, type EditRef } from '../state/runStore';
import { useRunState } from '../state/store';

function parseMode(v: string | null): RedlineMode | null {
  return v === 'read' || v === 'compare' || v === 'walk' ? v : null;
}

export function EvolutionPage() {
  const state = useRunState();
  const { basePath } = useRun();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const wideGutter = useMediaQuery('(min-width: 1200px)');
  const versions = versionList(state);
  const maxV = versions.length ? versions[versions.length - 1].version : 0;

  const toParam = Number(params.get('to'));
  const fromParam = Number(params.get('from'));
  const to = toParam >= 1 && toParam <= maxV ? toParam : maxV;
  const from = fromParam >= 1 && fromParam < to ? fromParam : Math.max(1, to - 1);
  const editParam = Number(params.get('edit'));
  const explicitMode = parseMode(params.get('mode'));
  const mode: RedlineMode = explicitMode ?? (editParam >= 1 ? 'walk' : from < to ? 'compare' : 'read');
  const slotParam = params.get('slot') as SlotId | null;

  const edits = useMemo<EditRef[]>(() => allEdits(state, from, to), [state, from, to]);
  const editIndex = Math.min(Math.max(0, editParam - 1), Math.max(0, edits.length - 1));
  const activeEdit = mode === 'walk' && edits.length ? edits[editIndex] : null;

  const [historySlot, setHistorySlot] = useState<SlotId | null>(null);
  const [findingIds, setFindingIds] = useState<string[] | null>(null);
  const [note, setNote] = useState<SlotNote | null>(null);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setMode = useCallback(
    (m: RedlineMode) => {
      if (m === 'read') update({ mode: 'read', edit: null });
      else if (m === 'compare') update({ mode: 'compare', edit: null, from: String(from < to ? from : Math.max(1, to - 1)) });
      else update({ mode: 'walk', edit: '1', from: String(from < to ? from : Math.max(1, to - 1)) });
    },
    [update, from, to],
  );

  const selectVersion = useCallback(
    (v: number) => {
      if (mode === 'read') update({ to: String(v), from: String(v) });
      else {
        const f = from < v ? from : Math.max(1, v - 1);
        update({ to: String(v), from: String(f), edit: mode === 'walk' ? '1' : null });
      }
    },
    [mode, from, update],
  );

  useEffect(() => {
    if (slotParam && SLOT_LABELS[slotParam]) {
      const el = document.getElementById(`slot-${slotParam}`);
      el?.scrollIntoView({ block: 'center' });
    }
  }, [slotParam, versions.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === ']') {
        if (to < maxV) selectVersion(to + 1);
      } else if (e.key === '[') {
        if (to > 1) selectVersion(to - 1);
      } else if (e.key === 'ArrowRight' && mode === 'walk') {
        if (editIndex < edits.length - 1) update({ edit: String(editIndex + 2) });
      } else if (e.key === 'ArrowLeft' && mode === 'walk') {
        if (editIndex > 0) update({ edit: String(editIndex) });
      } else if (e.key === 'r' || e.key === 'R') {
        setMode(mode === 'read' ? 'compare' : 'read');
      } else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [to, maxV, mode, editIndex, edits.length, selectVersion, update, setMode]);

  if (!versions.length) {
    return (
      <div className="page page--narrow">
        <h1 className="page__title">Press release evolution</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          The first draft arrives when the press release is written. <Link to={`${basePath}/council`}>Watch the council</Link>.
        </p>
      </div>
    );
  }

  const vFrom = versions.find((v) => v.version === from) ?? versions[0];
  const vTo = versions.find((v) => v.version === to) ?? versions[versions.length - 1];
  const changedSlots = vTo.press_release.slots.filter((s) => (vFrom.press_release.slots.find((x) => x.id === s.id)?.text ?? '') !== s.text).length;
  const ledgerPersona = personaForSeat(state.roster, state.seats, '1b');

  const exportRedline = async () => {
    try {
      const { redlineDocument, toBlob } = await import('../export/docx');
      const prfaq = finalPrfaq(state);
      const doc = redlineDocument({
        title: prfaq?.title ?? `${state.framing?.working_name ?? 'PRFAQ'} press release`,
        versions,
        from,
        to,
        roster: state.roster,
        editsInRange: edits,
        findings: state.findings,
        endedAt: (seat) => {
          const list = (state.steps[seat] ?? []).filter((a) => a.status === 'done' && a.endedAt);
          return list.length ? list[list.length - 1].endedAt : null;
        },
        prfaq,
      });
      downloadBlob(await toBlob(doc), `${safeFileStem(state.framing?.working_name ?? state.headline)}-redline-v${from}-v${to}.docx`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <div className="evolution">
      <div className="evolution__toolbar">
        <VersionStops versions={versions} seats={state.seats} steps={state.steps} roster={state.roster} from={from} to={to} mode={mode} onSelect={selectVersion} />
        <div className="evolution__controls">
          <div className="seg" role="group" aria-label="View mode">
            {(['read', 'compare', 'walk'] as RedlineMode[]).map((m) => (
              <button key={m} type="button" className="seg__btn" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === 'read' ? 'Read' : m === 'compare' ? 'Compare' : 'Walkthrough'}
              </button>
            ))}
          </div>
          {mode !== 'read' && versions.length > 1 && (
            <label className="row small" style={{ gap: 6 }}>
              <span className="muted">from</span>
              <select className="input input--inline" value={from} onChange={(e) => update({ from: e.target.value, edit: mode === 'walk' ? '1' : null })} aria-label="Compare from version">
                {versions
                  .filter((v) => v.version < to)
                  .map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version} · {VERSION_NAMES[v.version]}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {from < to && (
            <button type="button" className="btn btn--sm" onClick={exportRedline} title="Word document with tracked changes">
              <DownloadIcon size={13} />
              Redline .docx
            </button>
          )}
        </div>
      </div>

      {mode === 'compare' && (
        <div className="evolution__summary muted small">
          v{from} → v{to}: {changedSlots} of 8 paragraphs changed, {edits.length} {edits.length === 1 ? 'edit' : 'edits'}. Insertions are underlined in blue; deletions are struck through.
        </div>
      )}
      {mode === 'walk' && <EditWalkthrough edits={edits} index={editIndex} roster={state.roster} onIndex={(i) => update({ edit: String(i + 1) })} />}

      <RedlineDocument
        from={vFrom}
        to={vTo}
        mode={mode}
        edits={edits}
        activeEdit={activeEdit}
        roster={state.roster}
        findings={state.findings}
        wideGutter={wideGutter}
        onOpenHistory={setHistorySlot}
        onOpenFinding={setFindingIds}
        onOpenNote={setNote}
      />

      {historySlot && <SlotHistory slot={historySlot} onClose={() => setHistorySlot(null)} />}
      {findingIds && (
        <div className="sheet-backdrop" onClick={() => setFindingIds(null)}>
          <aside className="sheet" role="dialog" aria-modal="true" aria-label="Finding" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2 className="page__title">Evidence</h2>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setFindingIds(null)} aria-label="Close">
                <CloseIcon size={16} />
              </button>
            </div>
            <FindingCard findingIds={findingIds} findings={state.findings} sources={state.sources} establishedBy={ledgerPersona} />
            <p className="small">
              <Link to={`${basePath}/research`} onClick={() => setFindingIds(null)}>
                Open the research ledger
              </Link>
            </p>
          </aside>
        </div>
      )}
      {note && (
        <div className="sheet-backdrop" onClick={() => setNote(null)}>
          <aside className="sheet" role="dialog" aria-modal="true" aria-label="Why this changed" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2 className="page__title">{SLOT_LABELS[note.slotId]}</h2>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setNote(null)} aria-label="Close">
                <CloseIcon size={16} />
              </button>
            </div>
            <ProvenanceNote
              note={note}
              roster={state.roster}
              findings={state.findings}
              expanded
              onOpenFinding={(ids) => {
                setNote(null);
                setFindingIds(ids);
              }}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
