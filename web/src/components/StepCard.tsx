import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ArtifactKind, SeatRecord } from '../api/model';
import { INSIGHT_LABELS, KIND_VERSION, headerSentence, personaById } from '../lib/council';
import { domainOf, formatDuration, formatUsd } from '../lib/format';
import { useNow, useRotating, useStoredFlag } from '../lib/hooks';
import { parsePartialJson } from '../lib/partialJson';
import { useRun } from '../state/RunProvider';
import { artifactById, type StepAttempt } from '../state/runStore';
import { useRunSelector } from '../state/store';
import { ArtifactView } from './ArtifactView';
import { ChevronDown, ChevronRight, RefreshIcon, SearchIcon } from './Icons';
import { InsightLine } from './InsightLine';
import { PersonaMonogram } from './PersonaMonogram';
import { StreamingMarkdown } from './StreamingMarkdown';
import { WorkingNotes } from './WorkingNotes';
import { useToast } from './Toast';

interface Props {
  seat: SeatRecord;
  isLive: boolean;
}

interface Chip {
  label: string;
  to: string;
}

function producedChips(kind: ArtifactKind, payload: Record<string, unknown> | null, base: string, findingsCount: number, sourcesCount: number): Chip[] {
  const p = payload ?? {};
  const len = (k: string) => (Array.isArray(p[k]) ? (p[k] as unknown[]).length : 0);
  switch (kind) {
    case 'brief':
      return [{ label: 'Brief', to: `${base}/brief` }];
    case 'market_research':
      return [{ label: `Research${len('citations') ? ` · ${len('citations')} citations` : ''}`, to: `${base}/research#raw` }];
    case 'ledger':
      return [{ label: `${findingsCount || len('findings')} findings, ${sourcesCount || len('sources')} sources`, to: `${base}/research` }];
    case 'problem_validation':
      return [{ label: `${len('participants')} participants`, to: `${base}/research#panels` }];
    case 'pr_v1':
      return [{ label: 'PR v1', to: `${base}/evolution?from=1&to=1` }];
    case 'pr_v2':
      return [
        { label: 'PR v2', to: `${base}/evolution?from=1&to=2` },
        { label: `${len('edits')} edits`, to: `${base}/evolution?from=1&to=2&mode=walk` },
      ];
    case 'internal_faq': {
      const sections = (p.sections as { items?: unknown[] }[] | undefined) ?? [];
      const n = sections.reduce((acc, s) => acc + (s.items?.length ?? 0), 0);
      return [{ label: `${n} internal FAQs`, to: `${base}/document#internal-faq` }];
    }
    case 'concept_validation':
      return [
        { label: `${len('participants')} participants`, to: `${base}/research#panels` },
        { label: `${len('concerns')} concerns`, to: `${base}/research#panels` },
      ];
    case 'pr_v3':
      return [
        { label: 'PR v3', to: `${base}/evolution?from=2&to=3` },
        { label: `${len('edits')} edits`, to: `${base}/evolution?from=2&to=3&mode=walk` },
      ];
    case 'external_faq':
      return [{ label: `${len('items')} customer FAQs`, to: `${base}/document#customer-faq` }];
    case 'prfaq':
      return [
        { label: 'PRFAQ', to: `${base}/document` },
        { label: 'PR v4', to: `${base}/evolution?from=3&to=4` },
      ];
    case 'bar_raiser':
      return [{ label: `Scored ${String(p.overall ?? '–')}/5 · ${String(p.verdict ?? '')}`, to: `${base}/document#bar-raiser` }];
    case 'plan':
      return [{ label: `${len('hypotheses')} hypotheses`, to: `${base}/document?tab=plan` }];
    default:
      return [];
  }
}

function ActivityLine({ attempt }: { attempt: StepAttempt }) {
  const rotating = useRotating(attempt.activity, 4000);
  const note = attempt.notes[attempt.notes.length - 1];
  const tool = attempt.tools[attempt.tools.length - 1];
  let text: ReactNode = null;
  if (attempt.retrying && attempt.error) {
    text = <span className="activity__retry">Retrying · {attempt.error}</span>;
  } else if (tool && (!note || tool.ts >= note.ts)) {
    text =
      tool.kind === 'search' ? (
        <>
          <SearchIcon size={13} /> Searching “{tool.query}”
        </>
      ) : (
        <>Reading {tool.url ? domainOf(tool.url) : 'a page'}</>
      );
  } else if (note) {
    text = note.text;
  } else if (!attempt.text) {
    text = rotating;
  }
  if (!text) return null;
  return (
    <div className="activity" key={typeof text === 'string' ? text : undefined}>
      <span className="activity__text">{text}</span>
    </div>
  );
}

export function StepCard({ seat, isLive }: Props) {
  const { basePath, showNotes, readOnly, actions, source } = useRun();
  const toast = useToast();
  const attempts = useRunSelector((s) => s.steps[seat.id]);
  const roster = useRunSelector((s) => s.roster);
  const findings = useRunSelector((s) => s.findings);
  const sourcesCount = useRunSelector((s) => s.sources.length);
  const attempt = attempts && attempts.length ? attempts[attempts.length - 1] : null;
  const artifact = useRunSelector((s) => artifactById(s, attempt?.artifactId ?? null));
  const persona = personaById(roster, attempt?.persona ?? seat.persona);
  const status = attempt?.status ?? 'queued';
  const kind: ArtifactKind = attempt?.kind ?? seat.produces;
  const working = status === 'working';
  const now = useNow(1000, working);
  const runKey = useRunSelector((s) => s.runId) ?? 'run';
  const [expanded, setExpanded] = useStoredFlag(`chatprfaq.expand.${runKey}.${seat.id}`, false);
  const [showOutput, setShowOutput] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status !== 'done') setShowOutput(false);
  }, [status]);

  const elapsed = working && attempt?.startedAt ? (now - new Date(attempt.startedAt).getTime()) / 1000 : null;

  const partial = useMemo(() => {
    if (!attempt || kind === 'market_research') return null;
    if (status === 'done' && artifact) return null;
    return attempt.text ? parsePartialJson<Record<string, unknown>>(attempt.text) : null;
  }, [attempt, kind, status, artifact]);

  const payload: Record<string, unknown> | null = status === 'done' ? ((artifact?.payload as Record<string, unknown> | undefined) ?? partial) : partial;

  const chips = useMemo(
    () => (status === 'done' ? producedChips(kind, payload, basePath, findings.length, sourcesCount) : []),
    [status, kind, payload, basePath, findings.length, sourcesCount],
  );

  const sentence = persona ? headerSentence(persona, kind, status, attempt?.attempt ?? 1) : seat.name;
  const version = KIND_VERSION[kind];
  const insightPending = status === 'done' && !attempt?.keyInsight && !!attempt?.endedAt && now - new Date(attempt.endedAt).getTime() < 60_000;

  const onRetry = async () => {
    setRetrying(true);
    try {
      await actions.resume();
      toast('Resuming the run');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not resume');
    } finally {
      setRetrying(false);
    }
  };

  let body: ReactNode = null;
  if (working && attempt) {
    if (kind === 'market_research') body = attempt.text ? <StreamingMarkdown text={attempt.text} streaming /> : null;
    else if (partial) body = <ArtifactView kind={kind} payload={partial} streaming findings={findings} persona={persona} />;
  } else if (status === 'done' && showOutput) {
    body = payload ? <ArtifactView kind={kind} payload={payload} findings={findings} persona={persona} /> : <div className="muted small">Output not available.</div>;
  }

  const showBody = body !== null;
  const peek = working && !expanded;

  return (
    <article
      id={`seat-${seat.id}`}
      className={`stepcard is-${status}${isLive ? ' is-live' : ''}`}
      aria-live={working && isLive ? 'polite' : undefined}
      aria-busy={working || undefined}
    >
      <header className="stepcard__head">
        <PersonaMonogram persona={persona} size={28} working={working} muted={status === 'queued'} />
        <div className="stepcard__titles">
          <h3 className="stepcard__sentence">{sentence}</h3>
          <div className="stepcard__sub">
            <span>{seat.name}</span>
            {persona && <span className="muted"> · {persona.title}</span>}
            {attempt && attempt.attempt > 1 && <span className="chip chip--muted">attempt {attempt.attempt}</span>}
            {attempt?.fallbackUsed && <span className="chip chip--warning">fallback model</span>}
          </div>
        </div>
        <div className="stepcard__meta tabular">
          {working && elapsed !== null && <span className="stepcard__timer">{formatDuration(elapsed)}</span>}
          {status === 'done' && attempt?.durationS !== null && attempt?.durationS !== undefined && <span>{formatDuration(attempt.durationS)}</span>}
          {status === 'done' && attempt?.costUsd ? <span className="muted">{formatUsd(attempt.costUsd, 3)}</span> : null}
          {status === 'done' && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setShowOutput((v) => !v)} aria-expanded={showOutput}>
              {showOutput ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{showOutput ? 'Hide output' : 'Show output'}</span>
            </button>
          )}
        </div>
      </header>

      {working && attempt && <ActivityLine attempt={attempt} />}

      {showNotes && attempt?.thinking && (status === 'working' || showOutput) && (
        <WorkingNotes text={attempt.thinking} personaName={persona?.name} streaming={working} />
      )}

      {showBody && (
        <div className={`stepcard__body${peek ? ' is-peek' : ''}`}>
          <div className="stepcard__content">{body}</div>
        </div>
      )}
      {working && showBody && (
        <div className="stepcard__expand">
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      )}

      {status === 'done' && (
        <footer className="stepcard__foot">
          <InsightLine label={INSIGHT_LABELS[kind]} text={attempt?.keyInsight} pending={insightPending} />
          {(chips.length > 0 || version) && (
            <div className="stepcard__chips">
              {chips.map((c) => (
                <Link key={c.label} to={c.to} className="chip">
                  {c.label}
                </Link>
              ))}
              <Link to={`${basePath}/council/${seat.id}`} className="chip chip--muted">
                Open step
              </Link>
            </div>
          )}
        </footer>
      )}

      {status === 'failed' && (
        <footer className="stepcard__foot stepcard__foot--failed">
          <div className="stepcard__error" role="alert">
            {attempt?.error ?? 'This step failed.'}
          </div>
          {!readOnly && source.kind === 'live' && (
            <button type="button" className="btn btn--sm" onClick={onRetry} disabled={retrying}>
              <RefreshIcon size={13} />
              {retrying ? 'Resuming…' : 'Retry this step'}
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
