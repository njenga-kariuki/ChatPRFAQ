/* One reducer over the event union. Hydrate from a RunSnapshot, then apply events.
   Events with seq <= snapshotSeq only rebuild streaming buffers (the snapshot already
   reflects everything else); later events are applied in full. */

import type {
  ArtifactKind,
  ArtifactRecord,
  BarRaiserOutput,
  ChangeKind,
  Edit,
  FAQItem,
  FAQSection,
  Finding,
  Framing,
  PersonaId,
  PersonaRecord,
  RunEvent,
  RunSnapshot,
  RunStatus,
  SeatId,
  SeatRecord,
  SlotId,
  Source,
  StepRecord,
  SynthesisOutput,
  Usage,
  VersionRecord,
} from '../api/model';
import { parsePartialJson } from '../lib/partialJson';
import { SLOT_ORDER } from '../lib/council';

export type StepStatus = 'queued' | 'working' | 'done' | 'failed';
export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

export interface ToolCall {
  kind: 'search' | 'fetch';
  query: string | null;
  url: string | null;
  ts: string;
}

export interface ProgressNote {
  text: string;
  ts: string;
}

export interface StepAttempt {
  seat: SeatId;
  attempt: number;
  name: string;
  persona: PersonaId;
  model: string;
  effort: string;
  status: StepStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationS: number | null;
  activity: string[];
  text: string;
  thinking: string;
  notes: ProgressNote[];
  tools: ToolCall[];
  keyInsight: string | null;
  kind: ArtifactKind | null;
  artifactId: string | null;
  usage: Usage | null;
  costUsd: number;
  fallbackUsed: boolean;
  error: string | null;
  retrying: boolean;
}

export interface RunState {
  runId: string | null;
  idea: string;
  status: RunStatus | null;
  framing: Framing | null;
  framingAttempt: number;
  framingInsight: string | null;
  createdAt: string | null;
  completedAt: string | null;
  error: string | null;
  totalCostUsd: number;
  config: Record<string, unknown>;
  shareToken: string | null;
  headline: string | null;
  roster: PersonaRecord[];
  seats: SeatRecord[];
  steps: Record<string, StepAttempt[]>;
  /** Which attempt per seat receives seat-level events (delta, thinking, progress, tool). */
  activeAttempt: Record<string, number>;
  artifacts: ArtifactRecord[];
  versions: Record<number, VersionRecord>;
  findings: Finding[];
  sources: Source[];
  barRaiser: BarRaiserOutput | null;
  budgetWarning: { spentUsd: number; ceilingUsd: number } | null;
  completedDurationS: number | null;
  snapshotSeq: number;
  streamSeq: number;
  connection: ConnectionState;
  loadError: string | null;
}

export const TERMINAL_STATUSES: RunStatus[] = ['completed', 'failed', 'cancelled'];

export function isTerminal(status: RunStatus | null): boolean {
  return status !== null && TERMINAL_STATUSES.includes(status);
}

export function initialState(): RunState {
  return {
    runId: null,
    idea: '',
    status: null,
    framing: null,
    framingAttempt: 0,
    framingInsight: null,
    createdAt: null,
    completedAt: null,
    error: null,
    totalCostUsd: 0,
    config: {},
    shareToken: null,
    headline: null,
    roster: [],
    seats: [],
    steps: {},
    activeAttempt: {},
    artifacts: [],
    versions: {},
    findings: [],
    sources: [],
    barRaiser: null,
    budgetWarning: null,
    completedDurationS: null,
    snapshotSeq: 0,
    streamSeq: 0,
    connection: 'idle',
    loadError: null,
  };
}

function newAttempt(
  seat: SeatId,
  attempt: number,
  name: string,
  persona: PersonaId,
  model: string,
  effort: string,
  kind: ArtifactKind | null,
): StepAttempt {
  return {
    seat,
    attempt,
    name,
    persona,
    model,
    effort,
    status: 'queued',
    startedAt: null,
    endedAt: null,
    durationS: null,
    activity: [],
    text: '',
    thinking: '',
    notes: [],
    tools: [],
    keyInsight: null,
    kind,
    artifactId: null,
    usage: null,
    costUsd: 0,
    fallbackUsed: false,
    error: null,
    retrying: false,
  };
}

function statusFromRecord(status: string): StepStatus {
  switch (status) {
    case 'completed':
      return 'done';
    case 'running':
      return 'working';
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'queued';
  }
}

function kindForSeat(seats: SeatRecord[], seat: string): ArtifactKind | null {
  return seats.find((s) => s.id === seat)?.produces ?? null;
}

function attemptFromRecord(r: StepRecord, seats: SeatRecord[]): StepAttempt {
  const a = newAttempt(r.seat, r.attempt, r.name, r.persona, r.model, r.effort, kindForSeat(seats, r.seat));
  a.status = statusFromRecord(r.status);
  a.startedAt = r.started_at;
  a.endedAt = r.ended_at;
  a.durationS = r.duration_s;
  a.usage = r.usage;
  a.costUsd = r.cost_usd;
  a.fallbackUsed = r.fallback_used;
  a.error = r.status === 'cancelled' ? (r.error ?? 'Cancelled') : r.error;
  a.keyInsight = r.key_insight;
  return a;
}

/** Full hydration from a snapshot; streaming buffers start empty. */
export function hydrate(base: RunState, snapshot: RunSnapshot): RunState {
  const seats = snapshot.seats.length ? snapshot.seats : base.seats;
  const roster = snapshot.roster.length ? snapshot.roster : base.roster;
  const steps: Record<string, StepAttempt[]> = {};
  for (const r of snapshot.steps) {
    (steps[r.seat] ??= []).push(attemptFromRecord(r, seats));
  }
  for (const list of Object.values(steps)) list.sort((x, y) => x.attempt - y.attempt);
  // Pair artifacts with attempts by seat order (artifacts carry no attempt number).
  const bySeat = new Map<string, ArtifactRecord[]>();
  for (const a of snapshot.artifacts) {
    const list = bySeat.get(a.seat) ?? [];
    list.push(a);
    bySeat.set(a.seat, list);
  }
  for (const [seat, list] of bySeat) {
    const done = (steps[seat] ?? []).filter((s) => s.status === 'done');
    done.forEach((s, i) => {
      const art = list[i] ?? list[list.length - 1];
      if (art) {
        s.artifactId = art.id;
        s.kind = art.kind;
      }
    });
  }
  const versions: Record<number, VersionRecord> = {};
  for (const v of snapshot.versions) versions[v.version] = v;
  const run = snapshot.run;
  return {
    ...base,
    runId: run.id,
    idea: run.idea,
    status: run.status,
    framing: run.framing,
    framingAttempt: (steps['0'] ?? []).length,
    framingInsight: (steps['0'] ?? []).slice(-1)[0]?.keyInsight ?? null,
    createdAt: run.created_at,
    completedAt: run.completed_at,
    error: run.error,
    totalCostUsd: run.total_cost_usd,
    config: run.config,
    shareToken: run.share_token,
    headline: run.headline,
    roster,
    seats,
    steps,
    activeAttempt: {},
    artifacts: snapshot.artifacts,
    versions,
    findings: snapshot.findings,
    sources: snapshot.sources,
    barRaiser: snapshot.bar_raiser,
    snapshotSeq: snapshot.last_seq,
    streamSeq: 0,
    loadError: null,
  };
}

/** Refresh canonical data (artifacts, ledger, versions, step accounting) without touching buffers. */
export function mergeSnapshot(state: RunState, snap: Partial<RunSnapshot>): RunState {
  let next: RunState = { ...state };
  if (snap.artifacts?.length) {
    const byId = new Map(next.artifacts.map((a) => [a.id, a]));
    for (const a of snap.artifacts) byId.set(a.id, a);
    next.artifacts = Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  if (snap.findings?.length) next.findings = snap.findings;
  if (snap.sources?.length) next.sources = snap.sources;
  if (snap.versions?.length) {
    const versions = { ...next.versions };
    for (const v of snap.versions) versions[v.version] = v;
    next.versions = versions;
  }
  if (snap.bar_raiser) next.barRaiser = snap.bar_raiser;
  if (snap.roster?.length) next.roster = snap.roster;
  if (snap.seats?.length) next.seats = snap.seats;
  if (snap.steps?.length) {
    const steps = { ...next.steps };
    for (const r of snap.steps) {
      const list = [...(steps[r.seat] ?? [])];
      const i = list.findIndex((s) => s.attempt === r.attempt);
      const rec = attemptFromRecord(r, next.seats);
      if (i < 0) {
        list.push(rec);
        list.sort((x, y) => x.attempt - y.attempt);
      } else {
        const cur = list[i];
        const status = cur.status === 'done' ? 'done' : rec.status === 'queued' ? cur.status : rec.status;
        list[i] = {
          ...cur,
          status,
          startedAt: cur.startedAt ?? rec.startedAt,
          endedAt: rec.endedAt ?? cur.endedAt,
          durationS: rec.durationS ?? cur.durationS,
          usage: rec.usage ?? cur.usage,
          costUsd: rec.costUsd || cur.costUsd,
          fallbackUsed: rec.fallbackUsed || cur.fallbackUsed,
          error: status === 'failed' ? (rec.error ?? cur.error) : cur.error,
          keyInsight: rec.keyInsight ?? cur.keyInsight,
        };
      }
      steps[r.seat] = list;
    }
    next.steps = steps;
  }
  const run = snap.run;
  if (run && (snap.last_seq === undefined || snap.last_seq >= next.streamSeq)) {
    next = {
      ...next,
      status: run.status,
      framing: run.framing ?? next.framing,
      completedAt: run.completed_at ?? next.completedAt,
      error: run.error ?? next.error,
      totalCostUsd: Math.max(next.totalCostUsd, run.total_cost_usd),
      config: run.config ?? next.config,
      shareToken: run.share_token ?? next.shareToken,
      headline: run.headline ?? next.headline,
    };
  } else if (run) {
    next = {
      ...next,
      totalCostUsd: Math.max(next.totalCostUsd, run.total_cost_usd),
      shareToken: run.share_token ?? next.shareToken,
      headline: run.headline ?? next.headline,
    };
  }
  if (snap.last_seq !== undefined) next.snapshotSeq = Math.max(next.snapshotSeq, snap.last_seq);
  return next;
}

function updateAttempt(
  state: RunState,
  seat: string,
  attempt: number | null,
  fn: (a: StepAttempt) => StepAttempt,
): RunState {
  const list = state.steps[seat] ?? [];
  const target = attempt ?? state.activeAttempt[seat] ?? null;
  let i = target === null ? list.length - 1 : list.findIndex((a) => a.attempt === target);
  if (i < 0) i = list.length - 1;
  if (i < 0) return state;
  const nextList = [...list];
  nextList[i] = fn(list[i]);
  return { ...state, steps: { ...state.steps, [seat]: nextList } };
}

function provisionalPayload(a: StepAttempt, kind: ArtifactKind): Record<string, unknown> {
  if (kind === 'market_research') return { markdown: a.text, citations: [], searches: 0, fetches: 0 };
  return (parsePartialJson<Record<string, unknown>>(a.text) ?? {}) as Record<string, unknown>;
}

/** Apply one event. Returns the same state object when the event is a duplicate. */
export function applyEvent(state: RunState, e: RunEvent): RunState {
  if (e.seq <= state.streamSeq) return state;
  const rebuild = e.seq <= state.snapshotSeq;
  let s: RunState = { ...state, streamSeq: e.seq };
  if (!s.runId) s.runId = e.run_id;

  switch (e.type) {
    case 'run.started':
      if (rebuild) return s;
      return { ...s, idea: e.idea, createdAt: s.createdAt ?? e.ts };

    case 'run.status':
      if (rebuild) return s;
      return {
        ...s,
        status: e.status,
        completedAt: isTerminal(e.status) ? (s.completedAt ?? e.ts) : s.completedAt,
      };

    case 'framing.ready':
      if (rebuild) return s;
      return { ...s, framing: e.framing, framingAttempt: e.attempt, framingInsight: e.key_insight };

    case 'step.started': {
      const list = [...(s.steps[e.seat] ?? [])];
      const i = list.findIndex((a) => a.attempt === e.attempt);
      const kind = kindForSeat(s.seats, e.seat);
      if (i >= 0) {
        const cur = list[i];
        list[i] = {
          ...cur,
          name: e.name,
          persona: e.persona,
          model: e.model,
          effort: e.effort,
          activity: e.activity,
          text: '',
          thinking: '',
          notes: [],
          tools: [],
          retrying: false,
          kind: cur.kind ?? kind,
          ...(rebuild
            ? {}
            : {
                status: 'working' as StepStatus,
                startedAt: e.ts,
                endedAt: null,
                durationS: null,
                error: null,
                keyInsight: null,
                artifactId: null,
              }),
        };
      } else {
        const a = newAttempt(e.seat, e.attempt, e.name, e.persona, e.model, e.effort, kind);
        a.status = 'working';
        a.startedAt = e.ts;
        a.activity = e.activity;
        list.push(a);
        list.sort((x, y) => x.attempt - y.attempt);
      }
      return { ...s, steps: { ...s.steps, [e.seat]: list }, activeAttempt: { ...s.activeAttempt, [e.seat]: e.attempt } };
    }

    case 'step.progress':
      return updateAttempt(s, e.seat, null, (a) => ({ ...a, notes: [...a.notes, { text: e.note, ts: e.ts }] }));

    case 'step.tool':
      return updateAttempt(s, e.seat, null, (a) => ({
        ...a,
        tools: [...a.tools, { kind: e.kind, query: e.query, url: e.url, ts: e.ts }],
      }));

    case 'step.delta':
      return updateAttempt(s, e.seat, null, (a) => ({ ...a, text: a.text + e.text }));

    case 'step.thinking':
      return updateAttempt(s, e.seat, null, (a) => ({
        ...a,
        thinking: a.thinking ? `${a.thinking}\n\n${e.text}` : e.text,
      }));

    case 'step.failed':
      if (rebuild) {
        return e.retryable ? updateAttempt(s, e.seat, e.attempt, (a) => ({ ...a, text: '' })) : s;
      }
      return updateAttempt(s, e.seat, e.attempt, (a) =>
        e.retryable
          ? { ...a, error: e.error, retrying: true, text: '' }
          : { ...a, status: 'failed', error: e.error, retrying: false, endedAt: e.ts },
      );

    case 'step.completed': {
      if (rebuild) return s;
      s = updateAttempt(s, e.seat, e.attempt, (a) => ({
        ...a,
        status: 'done',
        endedAt: e.ts,
        durationS: e.duration_s,
        costUsd: e.cost_usd,
        usage: e.usage,
        model: e.model,
        fallbackUsed: e.fallback_used,
        kind: e.kind,
        artifactId: e.artifact_id,
        keyInsight: e.key_insight,
        error: null,
        retrying: false,
      }));
      const attempt = (s.steps[e.seat] ?? []).find((a) => a.attempt === e.attempt);
      if (attempt && !s.artifacts.some((a) => a.id === e.artifact_id)) {
        const payload = provisionalPayload(attempt, e.kind);
        const record: ArtifactRecord = {
          id: e.artifact_id,
          kind: e.kind,
          seat: e.seat,
          persona: attempt.persona,
          created_at: e.ts,
          key_insight: e.key_insight,
          payload,
        };
        s = { ...s, artifacts: [...s.artifacts, record] };
        if (e.kind === 'ledger' && Array.isArray(payload.findings) && s.findings.length === 0) {
          s = { ...s, findings: payload.findings as Finding[] };
        }
        if (e.kind === 'brief' && !s.headline && payload.framing) {
          const framing = payload.framing as Framing;
          s = { ...s, framing: s.framing ?? framing };
        }
      }
      if (e.seat === '0') s = { ...s, framingAttempt: Math.max(s.framingAttempt, e.attempt), framingInsight: e.key_insight };
      return s;
    }

    case 'document.version': {
      if (rebuild) return s;
      const record: VersionRecord = {
        version: e.version,
        artifact_id: e.artifact_id,
        produced_by_seat: e.produced_by_seat,
        persona: e.persona,
        press_release: e.press_release,
        edits: e.edits,
        caption: e.caption,
      };
      const headline = e.version === 1 ? (e.press_release.slots.find((x) => x.id === 'headline')?.text ?? s.headline) : s.headline;
      return { ...s, versions: { ...s.versions, [e.version]: record }, headline };
    }

    case 'run.budget_warning':
      if (rebuild) return s;
      return { ...s, budgetWarning: { spentUsd: e.spent_usd, ceilingUsd: e.ceiling_usd } };

    case 'run.completed':
      if (rebuild) return s;
      return {
        ...s,
        totalCostUsd: e.total_cost_usd,
        barRaiser: e.bar_raiser ?? s.barRaiser,
        completedDurationS: e.duration_s,
        completedAt: s.completedAt ?? e.ts,
      };

    case 'run.failed':
      if (rebuild) return s;
      return { ...s, status: 'failed', error: e.error, completedAt: s.completedAt ?? e.ts };

    case 'run.cancelled':
      if (rebuild) return s;
      return { ...s, status: 'cancelled', completedAt: s.completedAt ?? e.ts };

    default:
      return s;
  }
}

export function applyEvents(state: RunState, events: RunEvent[]): RunState {
  let s = state;
  for (const e of events) s = applyEvent(s, e);
  return s;
}

/* ---------------------------------------------------------------- selectors */

export function latestAttempt(state: RunState, seat: string): StepAttempt | null {
  const list = state.steps[seat];
  return list && list.length ? list[list.length - 1] : null;
}

export function seatStatus(state: RunState, seat: string): StepStatus {
  return latestAttempt(state, seat)?.status ?? 'queued';
}

export function councilSeats(state: RunState): SeatRecord[] {
  return state.seats.filter((s) => s.id !== '0');
}

export function workingSeats(state: RunState): SeatRecord[] {
  return state.seats.filter((s) => seatStatus(state, s.id) === 'working');
}

/** The earliest-ordered working seat; falls back to the last finished one. */
export function liveSeat(state: RunState): SeatRecord | null {
  const working = workingSeats(state);
  if (working.length) return working[0];
  return null;
}

export function versionList(state: RunState): VersionRecord[] {
  return Object.values(state.versions).sort((a, b) => a.version - b.version);
}

export function latestArtifact<K extends ArtifactKind>(state: RunState, kind: K): ArtifactRecord | null {
  for (let i = state.artifacts.length - 1; i >= 0; i--) {
    if (state.artifacts[i].kind === kind) return state.artifacts[i];
  }
  return null;
}

export function artifactById(state: RunState, id: string | null): ArtifactRecord | null {
  if (!id) return null;
  return state.artifacts.find((a) => a.id === id) ?? null;
}

export function finalPrfaq(state: RunState): SynthesisOutput | null {
  const art = latestArtifact(state, 'prfaq');
  return art ? (art.payload as unknown as SynthesisOutput) : null;
}

export function sumOfStepCosts(state: RunState): number {
  let total = 0;
  for (const list of Object.values(state.steps)) for (const a of list) total += a.costUsd || 0;
  return total;
}

export function costSoFar(state: RunState): number {
  return Math.max(state.totalCostUsd, sumOfStepCosts(state));
}

/** Milliseconds between the run's first activity and its end (or now). */
export function runElapsedMs(state: RunState, now: number): number | null {
  let start: string | null = state.createdAt;
  for (const list of Object.values(state.steps)) for (const a of list) if (a.startedAt && (!start || a.startedAt < start)) start = a.startedAt;
  if (!start) return null;
  const t0 = new Date(start).getTime();
  const end = state.completedAt ? new Date(state.completedAt).getTime() : now;
  return Math.max(0, end - t0);
}

export interface EditRef {
  version: number;
  persona: PersonaId;
  seat: SeatId;
  edit: Edit;
}

/** All edits that touched a slot, in version order, optionally limited to (from, to]. */
export function editsForSlot(state: RunState, slot: SlotId, from = 0, to = Number.MAX_SAFE_INTEGER): EditRef[] {
  const out: EditRef[] = [];
  for (const v of versionList(state)) {
    if (v.version <= from || v.version > to) continue;
    for (const e of v.edits) if (e.slot_id === slot) out.push({ version: v.version, persona: v.persona, seat: v.produced_by_seat, edit: e });
  }
  return out;
}

export function allEdits(state: RunState, from = 0, to = Number.MAX_SAFE_INTEGER): EditRef[] {
  const out: EditRef[] = [];
  for (const v of versionList(state)) {
    if (v.version <= from || v.version > to) continue;
    for (const e of v.edits) out.push({ version: v.version, persona: v.persona, seat: v.produced_by_seat, edit: e });
  }
  // stable order: by version, then by slot order
  return out.sort((a, b) => a.version - b.version || SLOT_ORDER.indexOf(a.edit.slot_id) - SLOT_ORDER.indexOf(b.edit.slot_id));
}

export interface SlotVersion {
  version: number;
  text: string;
  persona: PersonaId;
  seat: SeatId;
  edit: Edit | null;
  changed: boolean;
}

/** One slot across every version, with the edit that produced each. */
export function slotHistory(state: RunState, slot: SlotId): SlotVersion[] {
  const out: SlotVersion[] = [];
  let prev: string | null = null;
  for (const v of versionList(state)) {
    const text = v.press_release.slots.find((x) => x.id === slot)?.text ?? '';
    const edit = v.edits.find((e) => e.slot_id === slot) ?? null;
    out.push({ version: v.version, text, persona: v.persona, seat: v.produced_by_seat, edit, changed: prev !== null && prev !== text });
    prev = text;
  }
  return out;
}

export interface FindingUseSlot {
  kind: 'slot';
  slotId: SlotId;
  versions: number[];
}
export interface FindingUseFaq {
  kind: 'faq';
  doc: 'internal' | 'customer' | 'research';
  section: string | null;
  index: number;
  question: string;
}
export interface FindingUseEdit {
  kind: 'edit';
  version: number;
  slotId: SlotId;
  persona: PersonaId;
  changeKind: ChangeKind;
}
export type FindingUse = FindingUseSlot | FindingUseFaq | FindingUseEdit;

interface FaqDocs {
  internal: FAQSection[];
  customer: FAQItem[];
  research: FAQItem | null;
}

export function faqDocs(state: RunState): FaqDocs {
  const prfaq = finalPrfaq(state);
  if (prfaq) {
    return { internal: prfaq.internal_faq ?? [], customer: prfaq.customer_faq ?? [], research: prfaq.research_faq ?? null };
  }
  const internal = (latestArtifact(state, 'internal_faq')?.payload as { sections?: FAQSection[] } | undefined)?.sections ?? [];
  const customer = (latestArtifact(state, 'external_faq')?.payload as { items?: FAQItem[] } | undefined)?.items ?? [];
  const research = (latestArtifact(state, 'concept_validation')?.payload as { synthesized_faq?: FAQItem } | undefined)?.synthesized_faq ?? null;
  return { internal, customer, research };
}

/** Everywhere a finding is used: press-release claims, FAQ evidence, edit evidence. */
export function usedIn(state: RunState, findingId: string): FindingUse[] {
  const uses: FindingUse[] = [];
  const slotUses = new Map<SlotId, number[]>();
  for (const v of versionList(state)) {
    for (const slot of v.press_release.slots) {
      if (slot.claims.some((c) => c.finding_ids.includes(findingId))) {
        const list = slotUses.get(slot.id) ?? [];
        list.push(v.version);
        slotUses.set(slot.id, list);
      }
    }
  }
  for (const slotId of SLOT_ORDER) {
    const versions = slotUses.get(slotId);
    if (versions) uses.push({ kind: 'slot', slotId, versions });
  }
  const docs = faqDocs(state);
  let n = 0;
  for (const section of docs.internal) {
    for (const item of section.items) {
      n += 1;
      if (item.evidence_finding_ids.includes(findingId)) uses.push({ kind: 'faq', doc: 'internal', section: section.title, index: n, question: item.question });
    }
  }
  docs.customer.forEach((item, i) => {
    if (item.evidence_finding_ids.includes(findingId)) uses.push({ kind: 'faq', doc: 'customer', section: null, index: i + 1, question: item.question });
  });
  if (docs.research && docs.research.evidence_finding_ids.includes(findingId)) {
    uses.push({ kind: 'faq', doc: 'research', section: null, index: 1, question: docs.research.question });
  }
  for (const v of versionList(state)) {
    for (const e of v.edits) {
      if (e.evidence_finding_ids.includes(findingId)) uses.push({ kind: 'edit', version: v.version, slotId: e.slot_id, persona: v.persona, changeKind: e.change_kind });
    }
  }
  return uses;
}

export function findingById(state: RunState, id: string): Finding | undefined {
  return state.findings.find((f) => f.id === id);
}

export function sourceById(state: RunState, id: string): Source | undefined {
  return state.sources.find((s) => s.id === id);
}

export function personaOf(state: RunState, id: PersonaId | string): PersonaRecord | undefined {
  return state.roster.find((p) => p.id === id);
}

export function runTitle(state: RunState): string {
  if (state.headline) return state.headline;
  if (state.framing?.working_name) return state.framing.working_name;
  const t = state.idea.trim().replace(/\s+/g, ' ');
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1] : t;
  return s.length > 90 ? `${s.slice(0, 89).trimEnd()}…` : s;
}
