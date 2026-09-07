/* Renders any artifact kind from a possibly-partial payload (mid-stream JSON), so the
   same components serve the streaming peek, the done card, and the seat page. */

import type { ReactNode } from 'react';
import type {
  ArtifactKind,
  BarRaiserOutput,
  BriefPayload,
  ConceptValidationPayload,
  DeepPartial,
  DraftOutput,
  Edit,
  ExternalFaqPayload,
  FAQItem,
  FAQSection,
  Finding,
  InternalFaqPayload,
  LedgerPayload,
  MarketResearchPayload,
  PersonaRecord,
  ProblemValidationPayload,
  RefinementOutput,
  SynthesisOutput,
  ValidationPlanOutput,
} from '../api/model';
import {
  ARCHETYPE_LABELS,
  CHANGE_KIND_LABELS,
  CONFIDENCE_LABELS,
  CRITERION_LABELS,
  PHASE_LABELS,
  SEAN_ELLIS_LABELS,
  SLOT_LABELS,
  SLOT_ORDER,
  TOPIC_LABELS,
  priorityScore,
} from '../lib/council';
import { domainOf } from '../lib/format';
import { ExternalIcon } from './Icons';
import { StreamingMarkdown } from './StreamingMarkdown';

type P<T> = DeepPartial<T>;

export function List({ items, className = '' }: { items: (string | undefined)[] | undefined; className?: string }) {
  if (!items?.length) return null;
  return (
    <ul className={`av-list ${className}`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <div className="av-field">
      <div className="av-field__label">{label}</div>
      <div className="av-field__body">{children}</div>
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="av-section" id={id}>
      <h4 className="av-section__title">{title}</h4>
      {children}
    </section>
  );
}

export function QA({ item, n, findings }: { item: P<FAQItem> | undefined; n?: number; findings?: Finding[] }) {
  if (!item?.question && !item?.answer) return null;
  const ids = (item.evidence_finding_ids ?? []).filter((x): x is string => !!x);
  return (
    <div className="qa">
      <div className="qa__q">
        {n !== undefined && <span className="qa__n">{n}.</span>}
        {item.question}
      </div>
      {item.answer && <div className="qa__a">{item.answer}</div>}
      {findings && ids.length > 0 && (
        <div className="qa__ev">
          {ids.map((id) => {
            const f = findings.find((x) => x.id === id);
            return (
              <span key={id} className="chip chip--muted" title={f?.claim}>
                {id}
                {f?.metric ? ` · ${f.metric}` : ''}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FaqSections({ sections, findings, start = 1 }: { sections: P<FAQSection>[] | undefined; findings?: Finding[]; start?: number }) {
  let n = start;
  return (
    <>
      {sections?.map((sec, i) => (
        <div key={i} className="faq-section">
          {sec?.title && <h5 className="faq-section__title">{sec.title}</h5>}
          {sec?.items?.map((it, j) => (
            <QA key={j} item={it} n={n++} findings={findings} />
          ))}
        </div>
      ))}
    </>
  );
}

export function PressReleaseBlock({ slots, compact = false }: { slots: P<{ id: string; text: string }>[] | undefined; compact?: boolean }) {
  if (!slots?.length) return null;
  const byId = new Map(slots.map((s) => [s?.id, s?.text ?? '']));
  return (
    <div className={`pr${compact ? ' pr--compact' : ''}`}>
      {SLOT_ORDER.map((id) => {
        const text = byId.get(id);
        if (text === undefined) return null;
        if (id === 'headline') return <h3 key={id} className="pr__headline">{text}</h3>;
        if (id === 'subheading') return <p key={id} className="pr__subheading">{text}</p>;
        if (id === 'internal_quote') return <p key={id} className="pr__para pr__quote">{text}</p>;
        return <p key={id} className="pr__para">{text}</p>;
      })}
    </div>
  );
}

export function EditsList({ edits, findings, persona }: { edits: P<Edit>[] | undefined; findings?: Finding[]; persona?: PersonaRecord }) {
  if (!edits?.length) return null;
  return (
    <ol className="edits">
      {edits.map((e, i) => (
        <li key={i} className="edit">
          <div className="edit__head">
            <span className="chip">{e?.slot_id ? SLOT_LABELS[e.slot_id as keyof typeof SLOT_LABELS] ?? e.slot_id : '…'}</span>
            {e?.change_kind && <span className="chip chip--muted">{CHANGE_KIND_LABELS[e.change_kind as keyof typeof CHANGE_KIND_LABELS] ?? e.change_kind}</span>}
            {persona && <span className="muted small">{persona.name}</span>}
          </div>
          {e?.rationale && <div className="edit__rationale">{e.rationale}</div>}
          {!!e?.evidence_finding_ids?.length && (
            <div className="edit__ev">
              {e.evidence_finding_ids.map((id) => {
                const f = id ? findings?.find((x) => x.id === id) : undefined;
                return (
                  <span key={id} className="chip chip--muted" title={f?.claim}>
                    {id}
                    {f?.metric ? ` · ${f.metric}` : ''}
                  </span>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function FindingsRows({ findings, sources }: { findings: P<Finding>[] | undefined; sources?: P<{ id: string; title: string; url: string }>[] }) {
  if (!findings?.length) return null;
  return (
    <div className="scroll-x">
      <table className="table table--tight">
        <thead>
          <tr>
            <th>Id</th>
            <th>Claim</th>
            <th>Metric</th>
            <th>Topic</th>
            <th>Sources</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f, i) => (
            <tr key={f?.id ?? i}>
              <td className="mono nowrap">{f?.id}</td>
              <td>{f?.claim}</td>
              <td className="nowrap">{f?.metric ?? ''}</td>
              <td className="nowrap">{f?.topic ? TOPIC_LABELS[f.topic as keyof typeof TOPIC_LABELS] ?? f.topic : ''}</td>
              <td className="nowrap">
                {(f?.source_ids ?? []).map((sid) => {
                  const s = sources?.find((x) => x?.id === sid);
                  return s?.url ? (
                    <a key={sid} href={s.url} target="_blank" rel="noreferrer" className="srclink" title={s.title}>
                      {sid}
                    </a>
                  ) : (
                    <span key={sid}>{sid} </span>
                  );
                })}
              </td>
              <td className="nowrap">{f?.confidence ? CONFIDENCE_LABELS[f.confidence as keyof typeof CONFIDENCE_LABELS] ?? f.confidence : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Quotes({ quotes, names }: { quotes: P<{ participant_id: string; text: string }>[] | undefined; names?: Map<string, string> }) {
  if (!quotes?.length) return null;
  return (
    <div className="quotes">
      {quotes.map((q, i) => (
        <blockquote key={i} className="quote">
          <p>“{q?.text}”</p>
          <footer className="quote__by">
            {q?.participant_id && names?.get(q.participant_id) ? `${names.get(q.participant_id)} · ` : ''}
            {q?.participant_id} <span className="chip chip--label">simulated panel</span>
          </footer>
        </blockquote>
      ))}
    </div>
  );
}

function BriefView({ p }: { p: P<BriefPayload> }) {
  const f = p.framing;
  return (
    <div className="stack">
      <Field label="Working name">{f?.working_name}</Field>
      <Field label="Target customer">{f?.target_customer}</Field>
      <Field label="Customer problem">{f?.customer_problem}</Field>
      <Field label="Product scope">{f?.product_scope}</Field>
    </div>
  );
}

function MarketResearchView({ p, streaming }: { p: P<MarketResearchPayload>; streaming: boolean }) {
  return (
    <div className="stack">
      <StreamingMarkdown text={p.markdown ?? ''} streaming={streaming} />
      {!!p.citations?.length && (
        <Section title={`Citations (${p.citations.length})`}>
          <ul className="citations">
            {p.citations.map((c, i) => (
              <li key={i}>
                {c?.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="srclink">
                    <span>{c.title || domainOf(c.url)}</span>
                    <span className="srclink__domain">{domainOf(c.url)}</span>
                    <ExternalIcon size={12} />
                  </a>
                ) : (
                  <span>{c?.title}</span>
                )}
                {c?.cited_text && <div className="muted small">“{c.cited_text}”</div>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function ProblemValidationView({ p }: { p: P<ProblemValidationPayload> }) {
  const names = new Map((p.participants ?? []).map((x) => [x?.id ?? '', x?.name ?? '']));
  return (
    <div className="stack">
      {!!p.research_questions?.length && (
        <Section title="Research questions">
          <List items={p.research_questions} />
        </Section>
      )}
      {!!p.participants?.length && (
        <Section title="Participants">
          <div className="muted small" style={{ marginBottom: 8 }}>
            Simulated panel of {p.participants.length}.
          </div>
          <div className="scroll-x">
            <table className="table table--tight">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Archetype</th>
                  <th>Context</th>
                  <th>Frequency</th>
                  <th>Current solution</th>
                </tr>
              </thead>
              <tbody>
                {p.participants.map((x, i) => (
                  <tr key={x?.id ?? i}>
                    <td className="mono nowrap">{x?.id}</td>
                    <td className="nowrap">{x?.name}</td>
                    <td>{x?.role}</td>
                    <td className="nowrap">{x?.archetype && <span className={`chip chip--arch-${x.archetype}`}>{ARCHETYPE_LABELS[x.archetype] ?? x.archetype}</span>}</td>
                    <td>{x?.context}</td>
                    <td>{x?.problem_frequency}</td>
                    <td>{x?.current_solution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {p.severity && (
        <Section title="Severity">
          <Field label="High priority"><List items={p.severity.high_priority} /></Field>
          <Field label="Moderate"><List items={p.severity.moderate} /></Field>
          <Field label="Edge cases"><List items={p.severity.edge_cases} /></Field>
        </Section>
      )}
      {p.current_solutions && (
        <Section title="Current solutions">
          <Field label="What they use"><List items={p.current_solutions.what_they_use} /></Field>
          <Field label="Where it fails"><List items={p.current_solutions.where_it_fails} /></Field>
          <Field label="Workaround costs"><List items={p.current_solutions.workaround_costs} /></Field>
        </Section>
      )}
      {p.appetite && (
        <Section title="Appetite">
          <Quotes quotes={p.appetite.quotes} names={names} />
          <Field label="Price sensitivity">{p.appetite.price_sensitivity}</Field>
          <Field label="Must-haves"><List items={p.appetite.must_haves} /></Field>
        </Section>
      )}
      {p.implications && (
        <Section title="Implications">
          <Field label="Core capabilities"><List items={p.implications.core_capabilities} /></Field>
          <Field label="Approaches to avoid"><List items={p.implications.approaches_to_avoid} /></Field>
          <Field label="Performance thresholds"><List items={p.implications.performance_thresholds} /></Field>
          <Field label="Acceptable trade-offs"><List items={p.implications.acceptable_tradeoffs} /></Field>
        </Section>
      )}
      {p.risks && (
        <Section title="Risks">
          <Field label="Segments unlikely to adopt"><List items={p.risks.segments_unlikely_to_adopt} /></Field>
          <Field label="Competing priorities"><List items={p.risks.competing_priorities} /></Field>
        </Section>
      )}
    </div>
  );
}

function ConceptValidationView({ p, findings }: { p: P<ConceptValidationPayload>; findings?: Finding[] }) {
  const names = new Map((p.participants ?? []).map((x) => [x?.id ?? '', x?.name ?? '']));
  const reactions = (title: string, list: P<{ theme: string; participant_ids: string[]; quotes: { participant_id: string; text: string }[] }>[] | undefined) =>
    !!list?.length && (
      <Section title={title}>
        {list.map((r, i) => (
          <div key={i} className="reaction">
            <div className="reaction__theme">
              {r?.theme}
              {!!r?.participant_ids?.length && <span className="muted small"> · {r.participant_ids.length} participants</span>}
            </div>
            <Quotes quotes={r?.quotes} names={names} />
          </div>
        ))}
      </Section>
    );
  return (
    <div className="stack">
      {!!p.research_questions?.length && (
        <Section title="Research questions">
          <List items={p.research_questions} />
        </Section>
      )}
      {!!p.participants?.length && (
        <Section title="Participants">
          <div className="muted small" style={{ marginBottom: 8 }}>
            Simulated concept panel of {p.participants.length}.
          </div>
          <div className="scroll-x">
            <table className="table table--tight">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Segment</th>
                  <th>Verdict</th>
                  <th>Without it</th>
                  <th>Current solution</th>
                </tr>
              </thead>
              <tbody>
                {p.participants.map((x, i) => (
                  <tr key={x?.id ?? i}>
                    <td className="mono nowrap">{x?.id}</td>
                    <td className="nowrap">{x?.name}</td>
                    <td>{x?.segment}</td>
                    <td className="nowrap">{x?.verdict && <span className={`chip chip--verdict-${x.verdict}`}>{x.verdict}</span>}</td>
                    <td>{x?.sean_ellis ? SEAN_ELLIS_LABELS[x.sean_ellis] ?? x.sean_ellis : ''}</td>
                    <td>{x?.current_solution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {reactions('What resonated', p.resonated)}
      {reactions('Concerns', p.concerns)}
      {!!p.surprising_insights?.length && (
        <Section title="Surprising insights">
          <List items={p.surprising_insights} />
        </Section>
      )}
      {!!p.polarizing?.length && (
        <Section title="Polarizing">
          {p.polarizing.map((x, i) => (
            <div key={i} className="av-field">
              <div className="av-field__label">{x?.aspect}</div>
              <div className="av-field__body">
                {x?.why}
                <div className="muted small">
                  Loved by {x?.loved_by?.join(', ')}; questioned by {x?.questioned_by?.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}
      {!!p.recommended_refinements?.length && (
        <Section title="Recommended refinements">
          <List items={p.recommended_refinements} />
        </Section>
      )}
      {p.synthesized_faq && (
        <Section title="Synthesized research FAQ">
          <QA item={p.synthesized_faq} findings={findings} />
        </Section>
      )}
    </div>
  );
}

function BarRaiserView({ p }: { p: P<BarRaiserOutput> }) {
  return (
    <div className="stack">
      {!!p.scores?.length && (
        <div className="scores">
          {p.scores.map((s, i) => (
            <div key={i} className="score">
              <div className="score__row">
                <span className="score__name">{s?.criterion ? CRITERION_LABELS[s.criterion as keyof typeof CRITERION_LABELS] ?? s.criterion : '…'}</span>
                <span className="score__bar" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`score__pip${(s?.score ?? 0) >= n ? ' is-on' : ''}`} />
                  ))}
                </span>
                <span className="score__num tabular">{s?.score ?? '–'}/5</span>
              </div>
              {s?.note && <div className="score__note">{s.note}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="row row--wrap">
        {p.overall !== undefined && (
          <span className="chip">
            Overall {p.overall}/5
          </span>
        )}
        {p.verdict && <span className={`chip ${p.verdict === 'pass' ? 'chip--success' : 'chip--warning'}`}>{p.verdict === 'pass' ? 'Pass' : 'Revise'}</span>}
      </div>
      {!!p.required_fixes?.length && (
        <Section title="Required fixes">
          <ul className="fixes">
            {p.required_fixes.map((f, i) => (
              <li key={i} className="fix">
                <span className={`chip ${f?.severity === 'blocking' ? 'chip--danger' : 'chip--warning'}`}>{f?.severity}</span>
                <span className="mono small">{f?.target}</span>
                <div>{f?.instruction}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export function PlanView({ p }: { p: P<ValidationPlanOutput> }) {
  const hyps = (p.hypotheses ?? []).filter((h): h is P<ValidationPlanOutput['hypotheses'][number]> => !!h);
  const ranked = [...hyps]
    .map((h) => ({ h, score: h.impact !== undefined && h.confidence !== undefined && h.ease !== undefined ? priorityScore({ impact: h.impact, confidence: h.confidence, ease: h.ease }) : null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const byId = new Map(hyps.map((h) => [h.id, h]));
  return (
    <div className="stack">
      {p.executive_summary && (
        <Section title="Executive summary" id="plan-summary">
          <p className="doc-para">{p.executive_summary}</p>
        </Section>
      )}
      {ranked.length > 0 && (
        <Section title="Hypotheses, ranked by priority" id="plan-hypotheses">
          <div className="muted small" style={{ marginBottom: 8 }}>
            Priority = impact × (11 − confidence) ÷ (11 − ease); confidence 10 means very uncertain.
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hypothesis</th>
                  <th>Phase</th>
                  <th className="nowrap">Impact</th>
                  <th className="nowrap">Confidence</th>
                  <th className="nowrap">Ease</th>
                  <th className="nowrap">Priority</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ h, score }, i) => (
                  <tr key={h.id ?? i}>
                    <td className="mono nowrap">{h.id}</td>
                    <td>
                      <div>{h.statement}</div>
                      {h.why_critical && <div className="muted small">{h.why_critical}</div>}
                      {!!h.depends_on?.length && <div className="muted small">Depends on {h.depends_on.join(', ')}</div>}
                    </td>
                    <td className="nowrap">{h.phase ? PHASE_LABELS[h.phase as keyof typeof PHASE_LABELS] ?? h.phase : ''}</td>
                    <td className="tabular">{h.impact}</td>
                    <td className="tabular">{h.confidence}</td>
                    <td className="tabular">{h.ease}</td>
                    <td className="tabular">
                      <strong>{score ?? '–'}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {!!p.sequence?.length && (
        <Section title="Sequence" id="plan-sequence">
          <div className="phases">
            {p.sequence.map((ph, i) => (
              <div key={i} className="phase card">
                <div className="card__body">
                  <div className="phase__title">{ph?.phase ? PHASE_LABELS[ph.phase as keyof typeof PHASE_LABELS] ?? ph.phase : '…'}</div>
                  <div className="row row--wrap" style={{ margin: '6px 0' }}>
                    {ph?.hypothesis_ids?.map((id) => (
                      <span key={id} className="chip mono" title={byId.get(id)?.statement}>
                        {id}
                      </span>
                    ))}
                  </div>
                  <Field label="Rationale">{ph?.rationale}</Field>
                  <Field label="Decision point">{ph?.decision_point}</Field>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {!!p.test_plans?.length && (
        <Section title="Test plans" id="plan-tests">
          <div className="stack">
            {p.test_plans.map((t, i) => (
              <div key={i} className="card">
                <div className="card__body">
                  <div className="row row--wrap" style={{ marginBottom: 6 }}>
                    <span className="chip mono">{t?.hypothesis_id}</span>
                    <strong>{t?.method}</strong>
                  </div>
                  <div className="muted small" style={{ marginBottom: 8 }}>
                    {t?.hypothesis_id ? byId.get(t.hypothesis_id)?.statement : ''}
                  </div>
                  <Field label="Build">{t?.build}</Field>
                  <Field label="Success criteria">{t?.success_criteria}</Field>
                  <Field label="Sample size">{t?.sample_size}</Field>
                  <Field label="Risks">{t?.risks}</Field>
                  {!!t?.tools?.length && (
                    <Field label="Tools">
                      <div className="row row--wrap">
                        {t.tools.map((x, j) => (
                          <span key={j} className="chip">
                            {x}
                          </span>
                        ))}
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {p.synthesis && (
        <Section title="Synthesis" id="plan-synthesis">
          <Field label="Proceed when">{p.synthesis.proceed}</Field>
          <Field label="Iterate when">{p.synthesis.iterate}</Field>
          <Field label="Stop when">{p.synthesis.stop}</Field>
        </Section>
      )}
      {!!p.not_testing?.length && (
        <Section title="Not testing" id="plan-not-testing">
          {p.not_testing.map((x, i) => (
            <Field key={i} label={x?.aspect ?? '…'}>
              {x?.why}
            </Field>
          ))}
        </Section>
      )}
      {p.best_practices && (
        <Section title="Best practices" id="plan-best-practices">
          <Field label="Biggest pitfall">{p.best_practices.biggest_pitfall}</Field>
          <Field label="First test">{p.best_practices.first_test}</Field>
          <Field label="Recruitment">{p.best_practices.recruitment}</Field>
          <Field label="Prototype fidelity">{p.best_practices.prototype_fidelity}</Field>
        </Section>
      )}
    </div>
  );
}

function PrfaqView({ p, findings }: { p: P<SynthesisOutput>; findings?: Finding[] }) {
  return (
    <div className="stack">
      {p.title && <h3 className="av-title">{p.title}</h3>}
      {p.executive_summary && (
        <Section title="Executive summary">
          <p className="doc-para">{p.executive_summary}</p>
        </Section>
      )}
      {!!p.edits?.length && (
        <Section title="Editorial changes">
          <EditsList edits={p.edits} findings={findings} />
        </Section>
      )}
      {p.press_release?.slots && (
        <Section title="Press release">
          <PressReleaseBlock slots={p.press_release.slots} />
        </Section>
      )}
      {!!p.customer_faq?.length && (
        <Section title="Customer FAQ">
          {p.customer_faq.map((it, i) => (
            <QA key={i} item={it} n={i + 1} findings={findings} />
          ))}
        </Section>
      )}
      {!!p.internal_faq?.length && (
        <Section title="Internal FAQ">
          <FaqSections sections={p.internal_faq} findings={findings} />
        </Section>
      )}
      {p.research_faq && (
        <Section title="Research FAQ">
          <QA item={p.research_faq} findings={findings} />
        </Section>
      )}
      {p.summary_of_changes && <Field label="Summary of changes">{p.summary_of_changes}</Field>}
    </div>
  );
}

interface ArtifactViewProps {
  kind: ArtifactKind;
  payload: unknown;
  streaming?: boolean;
  findings?: Finding[];
  persona?: PersonaRecord;
}

export function ArtifactView({ kind, payload, streaming = false, findings, persona }: ArtifactViewProps) {
  const p = (payload ?? {}) as Record<string, unknown>;
  let body: ReactNode;
  switch (kind) {
    case 'brief':
      body = <BriefView p={p as P<BriefPayload>} />;
      break;
    case 'market_research':
      body = <MarketResearchView p={p as P<MarketResearchPayload>} streaming={streaming} />;
      break;
    case 'ledger': {
      const l = p as P<LedgerPayload>;
      body = <FindingsRows findings={l.findings} sources={l.sources} />;
      break;
    }
    case 'problem_validation':
      body = <ProblemValidationView p={p as P<ProblemValidationPayload>} />;
      break;
    case 'pr_v1': {
      const d = p as P<DraftOutput>;
      body = <PressReleaseBlock slots={d.press_release?.slots} />;
      break;
    }
    case 'pr_v2':
    case 'pr_v3': {
      const r = p as P<RefinementOutput>;
      body = (
        <div className="stack">
          {!!r.edits?.length && (
            <Section title={`Edits (${r.edits.length})`}>
              <EditsList edits={r.edits} findings={findings} persona={persona} />
            </Section>
          )}
          {r.press_release?.slots && (
            <Section title="Press release">
              <PressReleaseBlock slots={r.press_release.slots} />
            </Section>
          )}
          {r.summary_of_changes && <Field label="Summary of changes">{r.summary_of_changes}</Field>}
        </div>
      );
      break;
    }
    case 'internal_faq': {
      const f = p as P<InternalFaqPayload>;
      body = <FaqSections sections={f.sections} findings={findings} />;
      break;
    }
    case 'concept_validation':
      body = <ConceptValidationView p={p as P<ConceptValidationPayload>} findings={findings} />;
      break;
    case 'external_faq': {
      const f = p as P<ExternalFaqPayload>;
      body = (
        <div>
          {f.items?.map((it, i) => (
            <QA key={i} item={it} n={i + 1} findings={findings} />
          ))}
        </div>
      );
      break;
    }
    case 'prfaq':
      body = <PrfaqView p={p as P<SynthesisOutput>} findings={findings} />;
      break;
    case 'bar_raiser':
      body = <BarRaiserView p={p as P<BarRaiserOutput>} />;
      break;
    case 'plan':
      body = <PlanView p={p as P<ValidationPlanOutput>} />;
      break;
    default:
      body = <pre className="scroll-x">{JSON.stringify(payload, null, 2)}</pre>;
  }
  return <div className={`artifact artifact--${kind}${streaming && kind !== 'market_research' ? ' is-streaming' : ''}`}>{body}</div>;
}
