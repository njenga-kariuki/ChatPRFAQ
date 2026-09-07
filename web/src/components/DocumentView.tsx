import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Claim, FAQItem, Slot, SlotId, SynthesisOutput, ValidationPlanOutput } from '../api/model';
import { segmentByClaims } from '../lib/claims';
import { SLOT_ORDER, personaForSeat, seatByKind } from '../lib/council';
import { formatDate } from '../lib/format';
import { useRun } from '../state/RunProvider';
import { allEdits, latestArtifact, versionList } from '../state/runStore';
import { useRunState } from '../state/store';
import { ArtifactView, PlanView } from './ArtifactView';
import { EvidencePopover, type EvidenceTarget } from './EvidencePopover';
import { HistoryIcon } from './Icons';
import { PersonaMonogram } from './PersonaMonogram';
import { SlotHistory } from './SlotHistory';

interface Props {
  prfaq: SynthesisOutput;
  plan: ValidationPlanOutput | null;
  tab: 'prfaq' | 'plan';
  evidence: boolean;
  markers: boolean;
}

function ClaimSpan({ claim, onOpen, children }: { claim: Claim; onOpen: (t: Omit<EvidenceTarget, 'anchor'>, el: HTMLElement) => void; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const open = () => {
    if (ref.current) onOpen({ findingIds: claim.finding_ids, kind: claim.kind, claimText: claim.text }, ref.current);
  };
  return (
    <button ref={ref} type="button" className={`ev ev--${claim.kind}`} onClick={open} onMouseEnter={open} aria-label={`${claim.kind === 'assumption' ? 'Assumption' : 'Evidence'}: ${claim.finding_ids.join(', ') || claim.text}`}>
      {children}
    </button>
  );
}

function SlotText({ slot, evidence, onOpen }: { slot: Slot; evidence: boolean; onOpen: (t: Omit<EvidenceTarget, 'anchor'>, el: HTMLElement) => void }) {
  const { segments, unanchored } = useMemo(() => (evidence ? segmentByClaims(slot.text, slot.claims) : { segments: [{ text: slot.text, claim: null }], unanchored: [] as Claim[] }), [slot, evidence]);
  return (
    <>
      {segments.map((s, i) => (s.claim ? <ClaimSpan key={i} claim={s.claim} onOpen={onOpen}>{s.text}</ClaimSpan> : <span key={i}>{s.text}</span>))}
      {evidence && unanchored.length > 0 && (
        <span className="ev-unanchored">
          {unanchored.map((c, i) => (
            <UnanchoredMark key={i} claim={c} onOpen={onOpen} />
          ))}
        </span>
      )}
    </>
  );
}

function UnanchoredMark({ claim, onOpen }: { claim: Claim; onOpen: (t: Omit<EvidenceTarget, 'anchor'>, el: HTMLElement) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} type="button" className={`ev-mark ev-mark--${claim.kind}`} onClick={() => ref.current && onOpen({ findingIds: claim.finding_ids, kind: claim.kind, claimText: claim.text }, ref.current)} title={claim.text}>
      {claim.kind === 'assumption' ? 'assumption' : claim.finding_ids.join(', ')}
    </button>
  );
}

function FaqBlock({ item, n, evidence, onOpen, id }: { item: FAQItem; n: number; evidence: boolean; onOpen: (t: Omit<EvidenceTarget, 'anchor'>, el: HTMLElement) => void; id: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="doc-qa" id={id}>
      <h4 className="doc-qa__q">
        <span className="doc-qa__n tabular">{n}.</span> {item.question}
      </h4>
      <p className="doc-qa__a">
        {item.answer}
        {evidence && item.evidence_finding_ids.length > 0 && (
          <button ref={ref} type="button" className="ev-sup" onClick={() => ref.current && onOpen({ findingIds: item.evidence_finding_ids, kind: 'evidence' }, ref.current)} aria-label={`Evidence: ${item.evidence_finding_ids.join(', ')}`}>
            {item.evidence_finding_ids.join(', ')}
          </button>
        )}
      </p>
    </div>
  );
}

export function DocumentView({ prfaq, plan, tab, evidence, markers }: Props) {
  const state = useRunState();
  const { basePath } = useRun();
  const [target, setTarget] = useState<EvidenceTarget | null>(null);
  const [historySlot, setHistorySlot] = useState<SlotId | null>(null);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openEvidence = useCallback((t: Omit<EvidenceTarget, 'anchor'>, el: HTMLElement) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setTarget({ ...t, anchor: el.getBoundingClientRect() });
  }, []);
  const closeEvidence = useCallback(() => {
    pinned.current = false;
    setTarget(null);
  }, []);
  const scheduleClose = () => {
    if (pinned.current) return;
    closeTimer.current = setTimeout(() => setTarget(null), 250);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const versions = versionList(state);
  const edits = allEdits(state);
  const reviewers = new Set(versions.filter((v) => v.edits.length).map((v) => v.persona));
  const slots = SLOT_ORDER.map((id) => prfaq.press_release.slots.find((s) => s.id === id)).filter((s): s is Slot => !!s);
  const ledgerPersona = personaForSeat(state.roster, state.seats, '1b');
  const personaOfKind = (kind: Parameters<typeof seatByKind>[1]) => {
    const seat = seatByKind(state.seats, kind);
    return seat ? personaForSeat(state.roster, state.seats, seat.id) : undefined;
  };
  const customerPersona = personaOfKind('external_faq');
  const internalPersona = personaOfKind('internal_faq');
  const researchPersona = personaOfKind('concept_validation');
  const editorPersona = personaOfKind('prfaq');
  const planPersona = personaOfKind('plan');
  const barRaiser = state.barRaiser ?? (latestArtifact(state, 'bar_raiser')?.payload as unknown as typeof state.barRaiser);
  const barPersona = personaOfKind('bar_raiser');
  const revised = (state.steps['9'] ?? []).length > 1;
  const date = state.completedAt ?? state.createdAt;

  if (tab === 'plan') {
    return (
      <article className="doc" aria-labelledby="doc-title">
        <header className="doc__head">
          <h1 id="doc-title" className="doc__title">
            Validation plan
          </h1>
          <div className="doc__meta">
            {planPersona && (
              <span className="doc__by">
                <PersonaMonogram persona={planPersona} size={20} /> Designed by {planPersona.name}
              </span>
            )}
            <span className="muted">{formatDate(date)}</span>
          </div>
        </header>
        {plan ? <PlanView p={plan} /> : <p className="muted">The validation plan arrives when the last colleague finishes.</p>}
      </article>
    );
  }

  let internalN = 0;

  return (
    <article className={`doc${markers ? ' show-markers' : ''}${evidence ? ' show-evidence' : ''}`} aria-labelledby="doc-title">
      <header className="doc__head">
        <h1 id="doc-title" className="doc__title">
          {prfaq.title}
        </h1>
        <div className="doc__meta">
          {editorPersona && (
            <span className="doc__by">
              <PersonaMonogram persona={editorPersona} size={20} /> Edited by {editorPersona.name}
            </span>
          )}
          <span className="muted">{formatDate(date)}</span>
          {barRaiser && (
            <a href="#bar-raiser" className={`chip ${barRaiser.verdict === 'pass' ? 'chip--success' : 'chip--warning'}`}>
              Bar Raiser {barRaiser.overall}/5 · {barRaiser.verdict === 'pass' ? 'pass' : revised ? 'revised' : 'revise'}
            </a>
          )}
        </div>
      </header>

      <section className="doc__section" id="executive-summary">
        <h2 className="doc__h2">Executive summary</h2>
        <p className="doc__p">{prfaq.executive_summary}</p>
      </section>

      <section className="doc__section" id="press-release">
        <h2 className="doc__h2">Press release</h2>
        {slots.map((slot) => {
          const isHead = slot.id === 'headline';
          const isSub = slot.id === 'subheading';
          const content = <SlotText slot={slot} evidence={evidence} onOpen={openEvidence} />;
          return (
            <div key={slot.id} className="doc__slot" id={`slot-${slot.id}`}>
              {versions.length > 0 && (
                <button type="button" className="doc__marker" onClick={() => setHistorySlot(slot.id)} aria-label={`Revision history of ${slot.id.replace('_', ' ')}`} title="Paragraph history">
                  <HistoryIcon size={14} />
                </button>
              )}
              {isHead ? (
                <h3 className="doc__headline">{content}</h3>
              ) : isSub ? (
                <>
                  <p className="doc__subheading">{content}</p>
                  {versions.length > 0 && (
                    <p className="doc__evolink">
                      <Link to={`${basePath}/evolution?from=1&to=${versions[versions.length - 1].version}`}>
                        {versions.length} {versions.length === 1 ? 'version' : 'versions'} · {edits.length} {edits.length === 1 ? 'edit' : 'edits'} · {reviewers.size} {reviewers.size === 1 ? 'reviewer' : 'reviewers'}
                      </Link>
                    </p>
                  )}
                </>
              ) : (
                <p className={`doc__p${slot.id === 'internal_quote' ? ' doc__p--quote' : ''}`}>{content}</p>
              )}
            </div>
          );
        })}
      </section>

      <section className="doc__section" id="customer-faq">
        <h2 className="doc__h2">Customer FAQ</h2>
        {customerPersona && (
          <p className="doc__drafted">
            <PersonaMonogram persona={customerPersona} size={20} /> Drafted by {customerPersona.name} from the concept panel's concerns
          </p>
        )}
        {prfaq.customer_faq.map((item, i) => (
          <FaqBlock key={i} item={item} n={i + 1} evidence={evidence} onOpen={openEvidence} id={`customer-faq-${i + 1}`} />
        ))}
      </section>

      <section className="doc__section" id="internal-faq">
        <h2 className="doc__h2">Internal FAQ</h2>
        {internalPersona && (
          <p className="doc__drafted">
            <PersonaMonogram persona={internalPersona} size={20} /> Drafted by {internalPersona.name}
          </p>
        )}
        {prfaq.internal_faq.map((section) => (
          <div key={section.title} className="doc__faqsection">
            <h3 className="doc__h3">{section.title}</h3>
            {section.items.map((item) => {
              internalN += 1;
              return <FaqBlock key={internalN} item={item} n={internalN} evidence={evidence} onOpen={openEvidence} id={`internal-faq-${internalN}`} />;
            })}
          </div>
        ))}
      </section>

      <section className="doc__section" id="research-faq">
        <h2 className="doc__h2">Research</h2>
        {researchPersona && (
          <p className="doc__drafted">
            <PersonaMonogram persona={researchPersona} size={20} /> From the concept panel run by {researchPersona.name} (simulated)
          </p>
        )}
        <FaqBlock item={prfaq.research_faq} n={internalN + 1} evidence={evidence} onOpen={openEvidence} id="research-faq-1" />
      </section>

      {barRaiser && (
        <section className="doc__section doc__section--panel" id="bar-raiser">
          <h2 className="doc__h2">Bar Raiser review</h2>
          {barPersona && (
            <p className="doc__drafted">
              <PersonaMonogram persona={barPersona} size={20} /> Scored by {barPersona.name}
              {revised && editorPersona ? `; fixes applied by ${editorPersona.name} in a revision` : ''}
            </p>
          )}
          <div className="doc__panel">
            <ArtifactView kind="bar_raiser" payload={barRaiser} />
          </div>
        </section>
      )}

      {target && (
        <EvidencePopover
          anchor={target.anchor}
          findingIds={target.findingIds}
          kind={target.kind}
          claimText={target.claimText}
          findings={state.findings}
          sources={state.sources}
          establishedBy={ledgerPersona}
          onClose={closeEvidence}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
      {historySlot && <SlotHistory slot={historySlot} onClose={() => setHistorySlot(null)} />}
    </article>
  );
}
