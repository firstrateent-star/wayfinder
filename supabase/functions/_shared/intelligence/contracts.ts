export const KNOWLEDGE_STATUSES = [
  "RESOLVED",
  "PARTIAL",
  "AMBIGUOUS",
  "CONFLICTING",
  "STALE",
  "UNAVAILABLE",
  "UNKNOWN",
  "NOT_APPLICABLE"
] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export type KnowledgeSourceClass =
  | "DETERMINISTIC"
  | "REFERENCE_DATA"
  | "GUIDANCE"
  | "LIVE_EXTERNAL";

export type KnowledgeAuthority = "PRIMARY" | "HIGH" | "SUPPORTING" | "INTERPRETIVE";

export type CapabilityStatus = "READY" | "DEGRADED" | "UNAVAILABLE";

export interface CapabilityReadiness {
  status: CapabilityStatus;
  reason?: string;
  checkedAt?: string;
}

export interface KnowledgeQuery<TInput = unknown> {
  requestId: string;
  capability: string;
  domain?: string;
  input: TInput;
  asOf?: string;
  locale?: string;
  purpose?: string;
}

export interface KnowledgeResolution<TValue = unknown> {
  status: KnowledgeStatus;
  capability: string;
  providerId: string;
  providerVersion: string;
  sourceClass: KnowledgeSourceClass;
  value?: TValue;
  candidates?: TValue[];
  sourceId?: string;
  sourceVersion?: string;
  effectiveAt?: string;
  retrievedAt?: string;
  authority?: KnowledgeAuthority;
  confidence?: number;
  coverage?: unknown;
  lineage?: unknown;
  limitation?: string;
}

export interface KnowledgeProviderContext {
  now: string;
  signal?: AbortSignal;
}

export interface KnowledgeProvider {
  id: string;
  version: string;
  sourceClass: KnowledgeSourceClass;
  capabilities: readonly string[];
  priority?: number;
  readiness?: (
    capability: string,
    context: KnowledgeProviderContext
  ) => CapabilityReadiness | Promise<CapabilityReadiness>;
  resolve: (
    query: KnowledgeQuery,
    context: KnowledgeProviderContext
  ) => KnowledgeResolution | Promise<KnowledgeResolution>;
}

export interface KnowledgeAttempt {
  providerId: string;
  providerVersion: string;
  sourceClass: KnowledgeSourceClass;
  status: KnowledgeStatus;
  limitation?: string;
}

export interface KnowledgeRouteResult<TValue = unknown> {
  capability: string;
  status: KnowledgeStatus;
  resolution?: KnowledgeResolution<TValue>;
  attempts: KnowledgeAttempt[];
}

export type InformationNeedKind =
  | "MISSING"
  | "AMBIGUOUS"
  | "CONFLICTING"
  | "STALE"
  | "LOW_COVERAGE";

export type NeedPriorityClass =
  | "P0_BLOCKING"
  | "P1_HIGH_IMPACT"
  | "P2_HIGH_LEVERAGE"
  | "P3_CALIBRATION"
  | "P4_OPTIONAL";

export type InformationResolutionOption =
  | "CANONICAL_READ"
  | "DETERMINISTIC"
  | "REFERENCE_DATA"
  | "LIVE_EXTERNAL"
  | "PLAYER"
  | "PRESERVE_UNKNOWN";

export type InformationLifetime = "SESSION" | "TEMPORAL" | "STABLE";
export type InformationSensitivity = "LOW" | "MODERATE" | "HIGH";
export type InformationAnswerability = "HIGH" | "MEDIUM" | "LOW";

export interface CanonicalDestination {
  module: string;
  commandType?: string;
}

export interface QuestionValueSignals {
  uncertaintyReduction?: number;
  currentRelevance?: number;
  decisionImpact?: number;
  crossDomainLeverage?: number;
  futureReuse?: number;
  freshnessValue?: number;
  conflictResolutionValue?: number;
  requirementOrDeadlineImpact?: number;
  naturalTimingOpportunity?: number;
  userBurden?: number;
  interruptionCost?: number;
  redundancy?: number;
  recentRepetition?: number;
}

export interface InformationNeed {
  needId: string;
  concept: string;
  kind: InformationNeedKind;
  purpose: string;
  consumers: readonly string[];
  priorityClass: NeedPriorityClass;
  resolutionOptions: readonly InformationResolutionOption[];
  canonicalDestination?: CanonicalDestination;
  expectedLifetime?: InformationLifetime;
  sensitivity?: InformationSensitivity;
  answerability?: InformationAnswerability;
  expiresAt?: string;
  evidence?: unknown;
  questionSignals?: QuestionValueSignals;
}

export type QuestionMode = "TASK_DRIVEN" | "AMBIENT" | "DISCOVERY_SESSION";

export interface QuestionSpec {
  concept: string;
  questionKey: string;
  questionIntent: string;
  expectedAnswerShape?: string;
  whyThisMatters: string | ((need: InformationNeed) => string);
  mayPersistAnswer: boolean;
  requiresExplicitAuthorizationForWrite: boolean;
}

export interface QuestionOpportunity {
  opportunityId: string;
  questionKey: string;
  informationNeed: InformationNeed;
  mode: QuestionMode;
  questionIntent: string;
  expectedAnswerShape?: string;
  whyThisMatters: string;
  mayPersistAnswer: boolean;
  requiresExplicitAuthorizationForWrite: boolean;
  /** Ephemeral planner ordering only. Never persist as truth about the player. */
  planningScore: number;
}

export type CanonicalResolutionStatus =
  | "RESOLVED"
  | "PARTIAL"
  | "AMBIGUOUS"
  | "CONFLICTING"
  | "STALE"
  | "UNAVAILABLE"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export interface CanonicalResolution<TValue = unknown> {
  status: CanonicalResolutionStatus;
  resolverId: string;
  value?: TValue;
  candidates?: TValue[];
  coverage?: unknown;
  lineage?: unknown;
  limitation?: string;
}

export interface CanonicalResolverContext {
  now: string;
  signal?: AbortSignal;
  context?: unknown;
}

export interface CanonicalResolver {
  id: string;
  concepts: readonly string[] | "*";
  priority?: number;
  resolve: (
    need: InformationNeed,
    context: CanonicalResolverContext
  ) => CanonicalResolution | Promise<CanonicalResolution>;
}

export type AcquisitionStage =
  | "CANONICAL"
  | "DETERMINISTIC"
  | "REFERENCE_DATA"
  | "LIVE_EXTERNAL"
  | "PLAYER"
  | "PRESERVE_UNKNOWN";

export type InformationResolutionStatus = KnowledgeStatus | "NEEDS_PLAYER";

export interface InformationResolutionAttempt {
  stage: AcquisitionStage;
  resolverId: string;
  status: InformationResolutionStatus;
  limitation?: string;
}

export interface InformationResolutionResult<TValue = unknown> {
  need: InformationNeed;
  status: InformationResolutionStatus;
  stage: AcquisitionStage;
  value?: TValue;
  candidates?: TValue[];
  knowledge?: KnowledgeResolution<TValue>;
  canonical?: CanonicalResolution<TValue>;
  attempts: InformationResolutionAttempt[];
  limitation?: string;
}

export interface InformationResolutionRequest {
  need: InformationNeed;
  context?: unknown;
  knowledgeQueries?: Partial<
    Record<"DETERMINISTIC" | "REFERENCE_DATA" | "LIVE_EXTERNAL", KnowledgeQuery>
  >;
}
