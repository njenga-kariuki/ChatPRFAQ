import { Link } from 'react-router-dom';
import type { Finding, PersonaRecord, Source } from '../api/model';
import { CONFIDENCE_LABELS, SLOT_LABELS, TOPIC_LABELS, TOPIC_ORDER, personaById } from '../lib/council';
import { domainOf } from '../lib/format';
import type { FindingUse, RunState } from '../state/runStore';
import { usedIn } from '../state/runStore';
import { ExternalIcon } from './Icons';
import { PersonaMonogram } from './PersonaMonogram';

interface Props {
  state: RunState;
  findings: Finding[];
  sources: Source[];
  establishedBy?: PersonaRecord;
  basePath: string;
  filterSeat?: string | null;
}

function UseLink({ use, basePath, roster }: { use: FindingUse; basePath: string; roster: PersonaRecord[] }) {
  if (use.kind === 'slot') {
    const vs = use.versions;
    const range = vs.length > 1 ? `v${vs[0]}–v${vs[vs.length - 1]}` : `v${vs[0]}`;
    return (
      <Link to={`${basePath}/document#slot-${use.slotId}`} className="chip">
        PR §{SLOT_LABELS[use.slotId]} ({range})
      </Link>
    );
  }
  if (use.kind === 'faq') {
    const href = use.doc === 'internal' ? `${basePath}/document#internal-faq-${use.index}` : use.doc === 'customer' ? `${basePath}/document#customer-faq-${use.index}` : `${basePath}/document#research-faq-1`;
    const label = use.doc === 'internal' ? `Internal FAQ Q${use.index}` : use.doc === 'customer' ? `Customer FAQ Q${use.index}` : 'Research FAQ';
    return (
      <Link to={href} className="chip" title={use.question}>
        {label}
      </Link>
    );
  }
  const persona = personaById(roster, use.persona);
  return (
    <Link to={`${basePath}/evolution?from=${use.version - 1}&to=${use.version}&slot=${use.slotId}`} className="chip" title={`${persona?.name ?? ''} · ${use.changeKind}`}>
      Edit v{use.version} §{SLOT_LABELS[use.slotId]}
    </Link>
  );
}

/** Findings grouped by topic, each with sources and "used in" backlinks. */
export function FindingsList({ state, findings, sources, establishedBy, basePath }: Props) {
  const groups = TOPIC_ORDER.map((topic) => ({ topic, items: findings.filter((f) => f.topic === topic) })).filter((g) => g.items.length);
  return (
    <div className="findings">
      {establishedBy && (
        <p className="doc__drafted">
          <PersonaMonogram persona={establishedBy} size={20} /> Established by {establishedBy.name} from the market research; each finding cites its sources.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.topic} className="findings__group">
          <h3 className="findings__topic">{TOPIC_LABELS[g.topic]}</h3>
          {g.items.map((f) => {
            const uses = usedIn(state, f.id);
            return (
              <article key={f.id} className="finding" id={`finding-${f.id}`}>
                <div className="finding__head">
                  <span className="chip mono">{f.id}</span>
                  {f.metric && <span className="chip chip--accent">{f.metric}</span>}
                  <span className={`chip chip--conf-${f.confidence}`}>{CONFIDENCE_LABELS[f.confidence]}</span>
                </div>
                <p className="finding__claim">{f.claim}</p>
                {f.source_ids.length > 0 ? (
                  <ul className="finding__sources">
                    {f.source_ids.map((sid) => {
                      const s = sources.find((x) => x.id === sid);
                      return (
                        <li key={sid}>
                          {s ? (
                            <a href={s.url} target="_blank" rel="noreferrer" className="srclink">
                              <span>{s.title}</span>
                              <span className="srclink__domain">{domainOf(s.url)}</span>
                              <ExternalIcon size={12} />
                            </a>
                          ) : (
                            <span className="mono">{sid}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="muted small">Analyst synthesis; no direct source.</div>
                )}
                <div className="finding__uses">
                  <span className="finding__uses-label">Used in</span>
                  {uses.length === 0 ? (
                    <span className="muted small">not cited yet</span>
                  ) : (
                    uses.map((u, i) => <UseLink key={i} use={u} basePath={basePath} roster={state.roster} />)
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
      {groups.length === 0 && <p className="muted">No findings yet.</p>}
    </div>
  );
}
