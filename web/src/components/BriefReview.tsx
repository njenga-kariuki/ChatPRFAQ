import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Framing } from '../api/model';
import { INSIGHT_LABELS, personaForSeat } from '../lib/council';
import { parsePartialJson } from '../lib/partialJson';
import { useRun } from '../state/RunProvider';
import { useRunSelector } from '../state/store';
import { InsightLine } from './InsightLine';
import { PersonaMonogram } from './PersonaMonogram';
import { useToast } from './Toast';

type Section = 'target_customer' | 'customer_problem' | 'product_scope';

const SECTIONS: { id: Section; title: string; hint: string }[] = [
  { id: 'target_customer', title: 'Target customer', hint: 'Who exactly this is for.' },
  { id: 'customer_problem', title: 'Customer problem', hint: 'The pain it removes, in their terms.' },
  { id: 'product_scope', title: 'Product scope', hint: 'What version one does, and does not do.' },
];

const EMPTY: Framing = { working_name: '', target_customer: '', customer_problem: '', product_scope: '' };

export function BriefReview() {
  const { actions, readOnly, basePath, source } = useRun();
  const navigate = useNavigate();
  const toast = useToast();
  const status = useRunSelector((s) => s.status);
  const framing = useRunSelector((s) => s.framing);
  const attempts = useRunSelector((s) => s.steps['0']);
  const roster = useRunSelector((s) => s.roster);
  const seats = useRunSelector((s) => s.seats);
  const attempt = attempts && attempts.length ? attempts[attempts.length - 1] : null;
  const persona = personaForSeat(roster, seats, '0');
  const framingNow = status === 'framing';
  const awaiting = status === 'awaiting_confirmation';
  const editable = awaiting && !readOnly;

  const streamed = useMemo(() => {
    if (!framingNow || !attempt?.text) return null;
    return parsePartialJson<{ framing?: Partial<Framing>; key_insight?: string }>(attempt.text)?.framing ?? null;
  }, [framingNow, attempt?.text]);

  const [draft, setDraft] = useState<Framing>(framing ?? EMPTY);
  const [notes, setNotes] = useState<Record<Section, string>>({ target_customer: '', customer_problem: '', product_scope: '' });
  const [busy, setBusy] = useState<'refine' | 'confirm' | null>(null);
  const attemptNo = attempt?.attempt ?? 0;

  useEffect(() => {
    if (framing) setDraft(framing);
    setNotes({ target_customer: '', customer_problem: '', product_scope: '' });
  }, [framing, attemptNo]);

  const shown: Partial<Framing> = framingNow ? (streamed ?? {}) : draft;
  const dirty = !!framing && (draft.working_name !== framing.working_name || SECTIONS.some((s) => draft[s.id] !== framing[s.id]));
  const hasNotes = SECTIONS.some((s) => notes[s.id].trim().length > 0);

  const lastStreamedField = useMemo(() => {
    if (!streamed) return null;
    const order: (keyof Framing)[] = ['working_name', 'target_customer', 'customer_problem', 'product_scope'];
    let last: keyof Framing | null = null;
    for (const k of order) if (streamed[k] !== undefined) last = k;
    return last;
  }, [streamed]);

  const onRefine = async () => {
    setBusy('refine');
    try {
      await actions.refine({ target_customer: notes.target_customer, customer_problem: notes.customer_problem, product_scope: notes.product_scope });
      toast(source.kind === 'demo' ? 'Demo replay: the strategist re-runs and returns the recorded framing' : 'Sent to the strategist');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send feedback');
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = async () => {
    setBusy('confirm');
    try {
      await actions.confirm(dirty ? draft : undefined);
      navigate(`${basePath}/council`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not confirm');
    } finally {
      setBusy(null);
    }
  };

  const headline = framingNow
    ? `${persona?.name ?? 'The strategist'} is framing your idea${attemptNo > 1 ? ` again (attempt ${attemptNo})` : ''}`
    : awaiting
      ? 'Review the brief before the council starts'
      : 'The brief the council is working from';

  return (
    <div className="brief">
      <header className="brief__head">
        <PersonaMonogram persona={persona} size={36} working={framingNow} />
        <div>
          <h1 className="brief__title">{headline}</h1>
          <p className="brief__lede muted">
            {awaiting
              ? 'Edit any section inline, or leave a note and ask for another pass. Nothing expensive runs until you confirm.'
              : framingNow
                ? 'Customer, problem and scope will fill in as they are written.'
                : 'This is the framing the council received.'}
          </p>
        </div>
      </header>

      {!framingNow && (attempt?.keyInsight || status === 'awaiting_confirmation') && (
        <InsightLine label={INSIGHT_LABELS.brief} text={attempt?.keyInsight} pending={!attempt?.keyInsight && awaiting} />
      )}

      <div className="brief__name">
        <label className="label" htmlFor="working-name">
          Working name
        </label>
        {editable ? (
          <input id="working-name" className="input" value={draft.working_name} onChange={(e) => setDraft({ ...draft, working_name: e.target.value })} />
        ) : (
          <div className={`brief__value brief__value--name${lastStreamedField === 'working_name' ? ' caret' : ''}`}>{shown.working_name ?? ''}</div>
        )}
      </div>

      <div className="brief__cards">
        {SECTIONS.map((sec) => (
          <section key={sec.id} className="card brief__card" aria-labelledby={`brief-${sec.id}`}>
            <div className="card__body">
              <h2 id={`brief-${sec.id}`} className="brief__card-title">
                {sec.title}
              </h2>
              <p className="muted small brief__hint">{sec.hint}</p>
              {editable ? (
                <textarea className="textarea brief__text" value={draft[sec.id]} onChange={(e) => setDraft({ ...draft, [sec.id]: e.target.value })} rows={5} aria-label={sec.title} />
              ) : (
                <p className={`brief__value${lastStreamedField === sec.id ? ' caret' : ''}`}>{shown[sec.id] ?? ''}</p>
              )}
              {editable && (
                <div className="brief__note">
                  <label className="label" htmlFor={`note-${sec.id}`}>
                    Refine this
                  </label>
                  <textarea
                    id={`note-${sec.id}`}
                    className="textarea brief__note-text"
                    rows={2}
                    placeholder={`What should change about the ${sec.title.toLowerCase()}?`}
                    value={notes[sec.id]}
                    onChange={(e) => setNotes({ ...notes, [sec.id]: e.target.value })}
                  />
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {editable && (
        <footer className="brief__actions">
          <button type="button" className="btn" onClick={onRefine} disabled={!hasNotes || busy !== null}>
            {busy === 'refine' ? 'Sending…' : `Ask ${persona?.name ?? 'the strategist'} to refine`}
          </button>
          <button type="button" className="btn btn--primary btn--lg" onClick={onConfirm} disabled={busy !== null}>
            {busy === 'confirm' ? 'Starting…' : dirty ? 'Confirm my edits and start the council' : 'Confirm and start the council'}
          </button>
        </footer>
      )}
      {framingNow && (
        <footer className="brief__actions">
          <button type="button" className="btn btn--primary btn--lg" disabled>
            Framing…
          </button>
        </footer>
      )}
      {!framingNow && !awaiting && status && (
        <footer className="brief__actions">
          <Link to={`${basePath}/council`} className="btn">
            Open the council
          </Link>
        </footer>
      )}
    </div>
  );
}
