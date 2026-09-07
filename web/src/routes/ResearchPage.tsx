import { Link } from 'react-router-dom';
import type { ConceptValidationPayload, MarketResearchPayload, ProblemValidationPayload } from '../api/model';
import { ArtifactView } from '../components/ArtifactView';
import { FindingsList } from '../components/FindingsList';
import { PersonaMonogram } from '../components/PersonaMonogram';
import { SourcesTable } from '../components/SourcesTable';
import { personaForSeat, seatByKind } from '../lib/council';
import { useHashScroll } from '../lib/hooks';
import { useRun } from '../state/RunProvider';
import { latestArtifact } from '../state/runStore';
import { useRunState } from '../state/store';

export function ResearchPage() {
  const state = useRunState();
  const { basePath } = useRun();
  const ledgerPersona = personaForSeat(state.roster, state.seats, '1b');
  const research = latestArtifact(state, 'market_research');
  const problem = latestArtifact(state, 'problem_validation');
  const concept = latestArtifact(state, 'concept_validation');
  const personaOfKind = (kind: Parameters<typeof seatByKind>[1]) => {
    const seat = seatByKind(state.seats, kind);
    return seat ? personaForSeat(state.roster, state.seats, seat.id) : undefined;
  };

  useHashScroll(state.findings.length > 0 || !!research);

  const nav = [
    { id: 'findings', label: `Findings (${state.findings.length})` },
    { id: 'sources', label: `Sources (${state.sources.length})` },
    { id: 'panels', label: 'Panels' },
    { id: 'raw', label: 'Market research' },
  ];

  return (
    <div className="research page">
      <header className="page__head">
        <h1 className="page__title">Research</h1>
        <p className="page__lede">Source → finding → use. Every number in the document traces back here.</p>
        <nav className="research__nav" aria-label="Research sections">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="chip">
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="section" id="findings">
        <h2 className="research__h2">Findings</h2>
        {state.findings.length ? (
          <FindingsList state={state} findings={state.findings} sources={state.sources} establishedBy={ledgerPersona} basePath={basePath} />
        ) : (
          <p className="muted">
            The evidence ledger arrives when {ledgerPersona?.name ?? 'the analyst'} finishes. <Link to={`${basePath}/council`}>Watch the council</Link>.
          </p>
        )}
      </section>

      <section className="section" id="sources">
        <h2 className="research__h2">Sources</h2>
        <SourcesTable sources={state.sources} findings={state.findings} retrievedAt={research?.created_at ?? null} />
      </section>

      <section className="section" id="panels">
        <h2 className="research__h2">Panels</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Both panels are simulated by {personaOfKind('problem_validation')?.name ?? 'the researcher'}. Participants are archetypes, not interviews; they are labelled as such wherever they are quoted.
        </p>
        <div className="panels">
          <details className="panel card" open>
            <summary className="panel__summary">
              <PersonaMonogram persona={personaOfKind('problem_validation')} size={20} />
              <span>Problem validation panel</span>
              <span className="chip chip--label">simulated panel</span>
              {problem && <span className="muted small">{((problem.payload as unknown as ProblemValidationPayload).participants ?? []).length} participants</span>}
            </summary>
            <div className="card__body">
              {problem ? <ArtifactView kind="problem_validation" payload={problem.payload} findings={state.findings} /> : <p className="muted small">Not run yet.</p>}
            </div>
          </details>
          <details className="panel card" open>
            <summary className="panel__summary">
              <PersonaMonogram persona={personaOfKind('concept_validation')} size={20} />
              <span>Concept validation panel</span>
              <span className="chip chip--label">simulated panel</span>
              {concept && <span className="muted small">{((concept.payload as unknown as ConceptValidationPayload).participants ?? []).length} participants</span>}
            </summary>
            <div className="card__body">
              {concept ? <ArtifactView kind="concept_validation" payload={concept.payload} findings={state.findings} /> : <p className="muted small">Not run yet.</p>}
            </div>
          </details>
        </div>
      </section>

      <section className="section" id="raw">
        <h2 className="research__h2">Market research</h2>
        {research ? (
          <>
            <p className="doc__drafted">
              <PersonaMonogram persona={personaOfKind('market_research')} size={20} /> Written by {personaOfKind('market_research')?.name} with live web search
              {(research.payload as unknown as MarketResearchPayload).searches ? ` · ${(research.payload as unknown as MarketResearchPayload).searches} searches` : ''}
            </p>
            <div className="card">
              <div className="card__body">
                <ArtifactView kind="market_research" payload={research.payload} />
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Not available yet.</p>
        )}
      </section>
    </div>
  );
}
