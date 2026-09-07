import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArtifactView } from '../components/ArtifactView';
import { InsightLine } from '../components/InsightLine';
import { PersonaMonogram } from '../components/PersonaMonogram';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { WorkingNotes } from '../components/WorkingNotes';
import { INSIGHT_LABELS, KIND_TITLES, headerSentence, personaById, seatByKind } from '../lib/council';
import { domainOf, formatDateTime, formatDuration, formatUsd } from '../lib/format';
import { parsePartialJson } from '../lib/partialJson';
import { useRun } from '../state/RunProvider';
import { artifactById } from '../state/runStore';
import { useRunState } from '../state/store';

export function SeatPage() {
  const { seat: seatId = '' } = useParams();
  const { basePath, showNotes } = useRun();
  const state = useRunState();
  const seat = state.seats.find((s) => s.id === seatId);
  const attempts = state.steps[seatId] ?? [];
  const attempt = attempts[attempts.length - 1] ?? null;
  const persona = personaById(state.roster, attempt?.persona ?? seat?.persona ?? '');
  const artifact = artifactById(state, attempt?.artifactId ?? null);
  const kind = attempt?.kind ?? seat?.produces ?? 'brief';
  const status = attempt?.status ?? 'queued';
  const partial = useMemo(() => (attempt?.text && kind !== 'market_research' ? parsePartialJson<Record<string, unknown>>(attempt.text) : null), [attempt?.text, kind]);
  const payload = (artifact?.payload as Record<string, unknown> | undefined) ?? partial;

  if (!seat) {
    return (
      <div className="page page--narrow">
        <p className="muted">No such step.</p>
        <Link to={`${basePath}/council`}>Back to the council</Link>
      </div>
    );
  }

  const inputs = seat.depends_on.map((k) => ({ kind: k, seat: seatByKind(state.seats, k) }));

  return (
    <div className="page page--narrow seatpage">
      <p className="small">
        <Link to={`${basePath}/council`}>← Council</Link>
      </p>
      <header className="seatpage__head">
        <PersonaMonogram persona={persona} size={36} working={status === 'working'} />
        <div>
          <h1 className="page__title">{persona ? headerSentence(persona, kind, status, attempt?.attempt ?? 1) : seat.name}</h1>
          <div className="muted">
            {seat.name} · {persona?.title}
          </div>
        </div>
      </header>

      <dl className="kv seatpage__facts">
        <dt>Status</dt>
        <dd>{status}</dd>
        {attempt && (
          <>
            <dt>Model</dt>
            <dd className="mono">
              {attempt.model} · {attempt.effort} effort{attempt.fallbackUsed ? ' · fallback used' : ''}
            </dd>
            <dt>Started</dt>
            <dd>{formatDateTime(attempt.startedAt)}</dd>
            {attempt.durationS !== null && (
              <>
                <dt>Duration</dt>
                <dd className="tabular">{formatDuration(attempt.durationS)}</dd>
              </>
            )}
            {attempt.costUsd > 0 && (
              <>
                <dt>Cost</dt>
                <dd className="tabular">{formatUsd(attempt.costUsd, 4)}</dd>
              </>
            )}
            {attempt.usage && (
              <>
                <dt>Tokens</dt>
                <dd className="tabular">
                  {attempt.usage.input_tokens ?? 0} in · {attempt.usage.output_tokens ?? 0} out · {attempt.usage.cache_read_input_tokens ?? 0} cached
                  {attempt.usage.web_searches ? ` · ${attempt.usage.web_searches} searches` : ''}
                </dd>
              </>
            )}
            {attempts.length > 1 && (
              <>
                <dt>Attempts</dt>
                <dd>{attempts.length}</dd>
              </>
            )}
          </>
        )}
      </dl>

      {status === 'done' && <InsightLine label={INSIGHT_LABELS[kind]} text={attempt?.keyInsight} />}
      {status === 'failed' && (
        <div className="notice notice--danger" role="alert">
          {attempt?.error}
        </div>
      )}

      <section className="section">
        <div className="section__title">Inputs consumed</div>
        {inputs.length === 0 ? (
          <p className="muted small">The idea as written.</p>
        ) : (
          <div className="row row--wrap">
            {inputs.map((i) => (
              <Link key={i.kind} to={`${basePath}/council/${i.seat?.id ?? ''}`} className="chip">
                {KIND_TITLES[i.kind]}
                {i.seat && <span className="muted"> · {personaById(state.roster, i.seat.persona)?.name}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {attempt && attempt.tools.length > 0 && (
        <section className="section">
          <div className="section__title">Research activity</div>
          <ul className="av-list">
            {attempt.tools.map((t, i) => (
              <li key={i}>
                {t.kind === 'search' ? `Searched “${t.query}”` : `Read ${t.url ? domainOf(t.url) : 'a page'}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showNotes && attempt?.thinking && (
        <section className="section">
          <WorkingNotes text={attempt.thinking} personaName={persona?.name} open streaming={status === 'working'} />
        </section>
      )}

      <section className="section">
        <div className="section__title">{KIND_TITLES[kind]}</div>
        {kind === 'market_research' && attempt ? (
          payload && (payload as { markdown?: string }).markdown !== undefined ? (
            <ArtifactView kind={kind} payload={payload} findings={state.findings} persona={persona} />
          ) : (
            <StreamingMarkdown text={attempt.text} streaming={status === 'working'} />
          )
        ) : payload ? (
          <ArtifactView kind={kind} payload={payload} streaming={status === 'working'} findings={state.findings} persona={persona} />
        ) : (
          <p className="muted small">{status === 'queued' ? 'Not started yet.' : 'Nothing to show yet.'}</p>
        )}
      </section>
    </div>
  );
}
