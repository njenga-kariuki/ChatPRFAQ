/* Vocabulary keyed by contract enums (artifact kinds, slot ids, criteria). Persona names
   and seat titles come from the server; nothing here names a colleague. */

import type { ArtifactKind, ChangeKind, Confidence, Criterion, Hypothesis, PersonaRecord, PlanPhase, SeatRecord, SlotId, Topic } from '../api/model';

export const SLOT_ORDER: SlotId[] = ['headline', 'subheading', 'summary', 'problem', 'solution', 'benefits', 'internal_quote', 'cta'];

export const SLOT_LABELS: Record<SlotId, string> = {
  headline: 'Headline',
  subheading: 'Sub-heading',
  summary: 'Summary',
  problem: 'Problem',
  solution: 'Solution',
  benefits: 'Benefits',
  internal_quote: 'Internal quote',
  cta: 'How to get started',
};

export const VERSION_NAMES: Record<number, string> = {
  1: 'Draft',
  2: 'VP refined',
  3: 'Customer validated',
  4: 'Final',
};

/** Which artifact kinds produce a press-release version. */
export const KIND_VERSION: Partial<Record<ArtifactKind, number>> = {
  pr_v1: 1,
  pr_v2: 2,
  pr_v3: 3,
  prfaq: 4,
};

export const KIND_LABELS: Record<ArtifactKind, string> = {
  brief: 'the brief',
  market_research: 'market research',
  ledger: 'the evidence ledger',
  problem_validation: 'problem validation',
  pr_v1: 'PR v1',
  pr_v2: 'PR v2',
  internal_faq: 'the internal FAQ',
  concept_validation: 'concept validation',
  pr_v3: 'PR v3',
  external_faq: 'the customer FAQ',
  prfaq: 'the PRFAQ draft',
  bar_raiser: 'the Bar Raiser review',
  plan: 'the validation plan',
};

export const KIND_TITLES: Record<ArtifactKind, string> = {
  brief: 'Brief',
  market_research: 'Market research',
  ledger: 'Evidence ledger',
  problem_validation: 'Problem validation',
  pr_v1: 'Press release v1',
  pr_v2: 'Press release v2',
  internal_faq: 'Internal FAQ',
  concept_validation: 'Concept validation',
  pr_v3: 'Press release v3',
  external_faq: 'Customer FAQ',
  prfaq: 'PRFAQ',
  bar_raiser: 'Bar Raiser review',
  plan: 'Validation plan',
};

/** The insight label vocabulary, carried over from the previous product. */
export const INSIGHT_LABELS: Record<ArtifactKind, string> = {
  brief: 'Insight',
  market_research: 'Insight',
  ledger: 'Finding',
  problem_validation: 'Pain',
  pr_v1: 'Headline',
  pr_v2: 'Refined',
  internal_faq: 'Risk',
  concept_validation: 'Finding',
  pr_v3: 'Change',
  external_faq: 'Top Q',
  prfaq: 'Thesis',
  bar_raiser: 'Verdict',
  plan: 'Must nail',
};

interface Verbs {
  working: string;
  done: string;
  queued: string;
}

/** Sentence fragments per artifact kind: "{Persona} is drafting the press release". */
export const KIND_VERBS: Record<ArtifactKind, Verbs> = {
  brief: { working: 'framing the idea', done: 'framed the idea', queued: 'frame the idea' },
  market_research: { working: 'researching the market', done: 'researched the market', queued: 'research the market' },
  ledger: { working: 'building the evidence ledger', done: 'built the evidence ledger', queued: 'build the evidence ledger' },
  problem_validation: {
    working: 'validating the problem with a panel',
    done: 'validated the problem with a panel',
    queued: 'validate the problem with a panel',
  },
  pr_v1: { working: 'drafting the press release', done: 'drafted the press release', queued: 'draft the press release' },
  pr_v2: { working: 'refining the press release', done: 'refined the press release', queued: 'refine the press release' },
  internal_faq: { working: 'drafting the internal FAQ', done: 'drafted the internal FAQ', queued: 'draft the internal FAQ' },
  concept_validation: {
    working: 'testing the concept with a panel',
    done: 'tested the concept with a panel',
    queued: 'test the concept with a panel',
  },
  pr_v3: { working: 'refining the solution', done: 'refined the solution', queued: 'refine the solution' },
  external_faq: { working: 'drafting the customer FAQ', done: 'drafted the customer FAQ', queued: 'draft the customer FAQ' },
  prfaq: { working: 'synthesizing the PRFAQ', done: 'synthesized the PRFAQ', queued: 'synthesize the PRFAQ' },
  bar_raiser: { working: 'reviewing against the bar', done: 'reviewed against the bar', queued: 'review against the bar' },
  plan: { working: 'designing the validation plan', done: 'designed the validation plan', queued: 'design the validation plan' },
};

/** A persona whose name joins two people ("VP Business + Principal Engineer") takes plural verbs. */
export function isPair(persona: Pick<PersonaRecord, 'name'>): boolean {
  return /\+|&|\band\b/i.test(persona.name);
}

export function headerSentence(
  persona: PersonaRecord,
  kind: ArtifactKind,
  status: 'queued' | 'working' | 'done' | 'failed',
  attempt = 1,
): string {
  const pair = isPair(persona);
  const v = KIND_VERBS[kind];
  const again = attempt > 1 ? ' again' : '';
  switch (status) {
    case 'working':
      return `${persona.name} ${pair ? 'are' : 'is'} ${v.working}${again}`;
    case 'done':
      return `${persona.name} ${v.done}${again}`;
    case 'failed':
      return `${persona.name} could not finish ${v.working.replace(/^\w+ing /, (m) => m)}`;
    default:
      return `${persona.name} will ${v.queued}`;
  }
}

export const CRITERION_LABELS: Record<Criterion, string> = {
  customer_clarity: 'Customer clarity',
  problem_specificity: 'Problem specificity',
  anecdote_believability: 'Anecdote believability',
  v1_feasibility: 'Feasibility of version 1',
  differentiation: 'Differentiation',
  evidence_coverage: 'Evidence coverage',
  executive_readability: 'Executive readability',
};

export const TOPIC_LABELS: Record<Topic, string> = {
  market_size: 'Market size',
  competition: 'Competition',
  customer: 'Customer',
  pricing: 'Pricing',
  trend: 'Trends',
  regulation: 'Regulation',
  barrier: 'Barriers',
  success_factor: 'Success factors',
  other: 'Other',
};

export const TOPIC_ORDER: Topic[] = ['market_size', 'customer', 'competition', 'pricing', 'trend', 'regulation', 'barrier', 'success_factor', 'other'];

export const CONFIDENCE_LABELS: Record<Confidence, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  sharpen: 'Sharpened',
  clarify: 'Clarified',
  reground: 'Regrounded',
  cut: 'Cut',
  restructure: 'Restructured',
  polish: 'Polished',
};

export const ARCHETYPE_LABELS: Record<string, string> = {
  acute: 'acute',
  moderate: 'moderate',
  edge: 'edge case',
  skeptic: 'skeptic',
};

export const PHASE_LABELS: Record<PlanPhase, string> = {
  foundation: 'Foundation',
  solution_fit: 'Solution fit',
  scale: 'Scale',
};

export const SEAN_ELLIS_LABELS: Record<string, string> = {
  very_disappointed: 'Very disappointed without it',
  somewhat_disappointed: 'Somewhat disappointed',
  not_disappointed: 'Not disappointed',
};

/** ICE adaptation: impact × (11 − confidence) ÷ (11 − ease); confidence 10 = very uncertain. */
export function priorityScore(h: Pick<Hypothesis, 'impact' | 'confidence' | 'ease'>): number {
  const denom = Math.max(1, 11 - h.ease);
  return Math.round(((h.impact * (11 - h.confidence)) / denom) * 100) / 100;
}

export function personaForSeat(roster: PersonaRecord[], seats: SeatRecord[], seatId: string): PersonaRecord | undefined {
  const seat = seats.find((s) => s.id === seatId);
  if (seat) return roster.find((p) => p.id === seat.persona);
  return roster.find((p) => p.seats.includes(seatId as SeatRecord['id']));
}

export function personaById(roster: PersonaRecord[], id: string): PersonaRecord | undefined {
  return roster.find((p) => p.id === id);
}

export function seatByKind(seats: SeatRecord[], kind: ArtifactKind): SeatRecord | undefined {
  return seats.find((s) => s.produces === kind);
}

/** Phases in seat order, each with its seats. */
export function seatPhases(seats: SeatRecord[]): { phase: string; seats: SeatRecord[] }[] {
  const out: { phase: string; seats: SeatRecord[] }[] = [];
  for (const s of seats) {
    const last = out[out.length - 1];
    if (last && last.phase === s.phase) last.seats.push(s);
    else out.push({ phase: s.phase, seats: [s] });
  }
  return out;
}

export function isVersionKind(kind: ArtifactKind | null | undefined): kind is 'pr_v1' | 'pr_v2' | 'pr_v3' | 'prfaq' {
  return !!kind && kind in KIND_VERSION;
}
