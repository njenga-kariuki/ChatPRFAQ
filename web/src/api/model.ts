/* Typed aliases over the generated OpenAPI types, plus the artifact payload shapes
   (the contract types `payload` as an open object; these mirror backend/app/schemas). */

import type { components } from './types';

type S = components['schemas'];

export type RunSnapshot = S['RunSnapshot'];
export type RunRecord = S['RunRecord'];
export type StepRecord = S['StepRecord'];
export type ArtifactRecord = S['ArtifactRecord'];
export type VersionRecord = S['VersionRecord'];
export type Finding = S['Finding'];
export type Source = S['Source'];
export type BarRaiserOutput = S['BarRaiserOutput'];
export type Score = S['Score'];
export type Fix = S['Fix'];
export type PersonaRecord = S['PersonaRecord'];
export type SeatRecord = S['SeatRecord'];
export type Framing = S['Framing'];
export type PressRelease = S['PressRelease'];
export type Slot = S['Slot'];
export type Claim = S['Claim'];
export type Edit = S['Edit'];
export type Usage = S['Usage'];
export type RunListItem = S['RunListItem'];
export type RunListResponse = S['RunListResponse'];
export type HealthResponse = S['HealthResponse'];
export type RefineFramingRequest = S['RefineFramingRequest'];

export type SeatId = SeatRecord['id'];
export type PersonaId = PersonaRecord['id'];
export type ArtifactKind = ArtifactRecord['kind'];
export type RunStatus = RunRecord['status'];
export type SlotId = Slot['id'];
export type ChangeKind = Edit['change_kind'];
export type Topic = Finding['topic'];
export type Confidence = Finding['confidence'];
export type Criterion = Score['criterion'];

/* Events: the generated union has an optional `type` (it has a default); pin it. */
type WithType<T, K extends string> = Omit<T, 'type'> & { type: K };
export type RunStarted = WithType<S['RunStarted'], 'run.started'>;
export type FramingReady = WithType<S['FramingReady'], 'framing.ready'>;
export type RunStatusChanged = WithType<S['RunStatusChanged'], 'run.status'>;
export type StepStarted = WithType<S['StepStarted'], 'step.started'>;
export type StepProgress = WithType<S['StepProgress'], 'step.progress'>;
export type StepTool = WithType<S['StepTool'], 'step.tool'>;
export type StepDelta = WithType<S['StepDelta'], 'step.delta'>;
export type StepThinking = WithType<S['StepThinking'], 'step.thinking'>;
export type StepCompleted = WithType<S['StepCompleted'], 'step.completed'>;
export type StepFailed = WithType<S['StepFailed'], 'step.failed'>;
export type DocumentVersionEvent = WithType<S['DocumentVersionEvent'], 'document.version'>;
export type RunBudgetWarning = WithType<S['RunBudgetWarning'], 'run.budget_warning'>;
export type RunCompleted = WithType<S['RunCompleted'], 'run.completed'>;
export type RunFailed = WithType<S['RunFailed'], 'run.failed'>;
export type RunCancelled = WithType<S['RunCancelled'], 'run.cancelled'>;

export type RunEvent =
  | RunStarted
  | FramingReady
  | RunStatusChanged
  | StepStarted
  | StepProgress
  | StepTool
  | StepDelta
  | StepThinking
  | StepCompleted
  | StepFailed
  | DocumentVersionEvent
  | RunBudgetWarning
  | RunCompleted
  | RunFailed
  | RunCancelled;

export type RunEventType = RunEvent['type'];

export const EVENT_TYPES: RunEventType[] = [
  'run.started',
  'framing.ready',
  'run.status',
  'step.started',
  'step.progress',
  'step.tool',
  'step.delta',
  'step.thinking',
  'step.completed',
  'step.failed',
  'document.version',
  'run.budget_warning',
  'run.completed',
  'run.failed',
  'run.cancelled',
];

/* Artifact payloads (backend/app/schemas/*.py) */

export interface BriefPayload {
  idea: string;
  framing: Framing;
  key_insight: string | null;
}

export interface Citation {
  url: string;
  title: string;
  cited_text: string;
}

export interface MarketResearchPayload {
  markdown: string;
  citations: Citation[];
  searches: number;
  fetches: number;
}

export interface LedgerPayload {
  findings: Finding[];
  sources: Source[];
}

export type Archetype = 'acute' | 'moderate' | 'edge' | 'skeptic';

export interface Participant {
  id: string;
  name: string;
  role: string;
  archetype: Archetype;
  context: string;
  problem_frequency: string;
  current_solution: string;
}

export interface Quote {
  participant_id: string;
  text: string;
}

export interface ProblemValidationPayload {
  research_questions: string[];
  participants: Participant[];
  severity: { high_priority: string[]; moderate: string[]; edge_cases: string[] };
  current_solutions: { what_they_use: string[]; where_it_fails: string[]; workaround_costs: string[] };
  appetite: { quotes: Quote[]; price_sensitivity: string; must_haves: string[] };
  implications: {
    core_capabilities: string[];
    approaches_to_avoid: string[];
    performance_thresholds: string[];
    acceptable_tradeoffs: string[];
  };
  risks: { segments_unlikely_to_adopt: string[]; competing_priorities: string[] };
  key_insight: string;
}

export interface DraftOutput {
  product_name: string;
  press_release: PressRelease;
  key_insight: string;
}

export interface RefinementOutput {
  edits: Edit[];
  press_release: PressRelease;
  summary_of_changes: string;
  key_insight: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  evidence_finding_ids: string[];
}

export interface FAQSection {
  title: string;
  items: FAQItem[];
}

export interface InternalFaqPayload {
  sections: FAQSection[];
  key_insight: string;
}

export interface ExternalFaqPayload {
  items: FAQItem[];
  key_insight: string;
}

export type SeanEllis = 'very_disappointed' | 'somewhat_disappointed' | 'not_disappointed';
export type Verdict = 'adopt' | 'maybe' | 'reject';

export interface ConceptParticipant {
  id: string;
  name: string;
  segment: string;
  context: string;
  current_solution: string;
  sean_ellis: SeanEllis;
  verdict: Verdict;
}

export interface Reaction {
  theme: string;
  participant_ids: string[];
  quotes: Quote[];
}

export interface Polarizing {
  aspect: string;
  loved_by: string[];
  questioned_by: string[];
  why: string;
}

export interface ConceptValidationPayload {
  research_questions: string[];
  participants: ConceptParticipant[];
  resonated: Reaction[];
  concerns: Reaction[];
  surprising_insights: string[];
  polarizing: Polarizing[];
  recommended_refinements: string[];
  synthesized_faq: FAQItem;
  key_insight: string;
}

export interface SynthesisOutput {
  title: string;
  product_name: string;
  executive_summary: string;
  edits: Edit[];
  press_release: PressRelease;
  customer_faq: FAQItem[];
  internal_faq: FAQSection[];
  research_faq: FAQItem;
  summary_of_changes: string;
  key_insight: string;
}

export type PlanPhase = 'foundation' | 'solution_fit' | 'scale';

export interface Hypothesis {
  id: string;
  statement: string;
  impact: number;
  confidence: number;
  ease: number;
  why_critical: string;
  depends_on: string[];
  phase: PlanPhase;
}

export interface PhaseDecision {
  phase: PlanPhase;
  hypothesis_ids: string[];
  rationale: string;
  decision_point: string;
}

export interface TestPlan {
  hypothesis_id: string;
  method: string;
  build: string;
  success_criteria: string;
  sample_size: string;
  risks: string;
  tools: string[];
}

export interface ValidationPlanOutput {
  executive_summary: string;
  hypotheses: Hypothesis[];
  sequence: PhaseDecision[];
  test_plans: TestPlan[];
  synthesis: { proceed: string; iterate: string; stop: string };
  not_testing: { aspect: string; why: string }[];
  best_practices: { biggest_pitfall: string; first_test: string; recruitment: string; prototype_fidelity: string };
  key_insight: string;
}

export interface ArtifactPayloadMap {
  brief: BriefPayload;
  market_research: MarketResearchPayload;
  ledger: LedgerPayload;
  problem_validation: ProblemValidationPayload;
  pr_v1: DraftOutput;
  pr_v2: RefinementOutput;
  internal_faq: InternalFaqPayload;
  concept_validation: ConceptValidationPayload;
  pr_v3: RefinementOutput;
  external_faq: ExternalFaqPayload;
  prfaq: SynthesisOutput;
  bar_raiser: BarRaiserOutput;
  plan: ValidationPlanOutput;
}

/* Everything optional, recursively: the shape of a structured output mid-stream. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
