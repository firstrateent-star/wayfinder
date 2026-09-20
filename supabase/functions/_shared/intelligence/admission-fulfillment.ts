import {
  AdmissionRegistry,
  runSemanticAdmission,
  type AdmissionDecision,
  type CandidateGraph,
  type SemanticCandidate,
  type SourceEnvelope
} from "./semantic-admission.ts";
import type { AdmissionPlan, DomainAdmissionProposal } from "./admission-planner.ts";
import type {
  CandidateLifeNode,
  SemanticCompilation,
  SemanticContextBundle,
  SemanticField
} from "./semantic-compiler.ts";
import {
  trainingAdmissionContract,
  type TrainingSessionCandidatePayload,
  type TrainingSetCandidate
} from "./training-semantic.ts";
import { resolveTrainingExercise } from "./training-exercises.ts";
import { directionAdmissionContract, type DirectionNodeCandidatePayload, type DirectionNodeKind } from "./direction-semantic.ts";
import { scheduleAdmissionContract, type ScheduleAllocationCandidatePayload, type ScheduleAllocationKind } from "./schedule-semantic.ts";
import { nutritionAdmissionContract, type NutritionIntakeCandidatePayload, type NutritionItemCandidate, type NutritionPrecision, type NutritionTotalsCandidate } from "./nutrition-semantic.ts";
import { trainingStrengthStandardAdmissionContract, nutritionProteinStandardAdmissionContract, type TrainingStrengthStandardPayload, type NutritionProteinStandardPayload } from "./standard-semantic.ts";
import { practiceAdmissionContract, type PracticeSessionCandidatePayload } from "./practice-semantic.ts";

export type FulfillmentDisposition =
  | "READY_FOR_CONFIRMATION"
  | "NEEDS_CLARIFICATION"
  | "SESSION_ONLY"
  | "REJECT";

export interface FulfillmentSourceContext {
  sourceId: string;
  receivedAt: string;
  occurredAt?: string;
  zoneId: string;
}

export interface AdmissionFulfillmentItem {
  proposalId: string;
  candidateId: string;
  owner: string;
  claimType: string;
  disposition: FulfillmentDisposition;
  summary?: string;
  question?: string;
  reason: string;
  normalizedPayload?: unknown;
  sourceContext?: FulfillmentSourceContext;
  semanticContextRefs: string[];
}

export interface AdmissionFulfillmentResult {
  sourceId: string;
  items: AdmissionFulfillmentItem[];
  invariants: {
    executesCommands: false;
    persistsCanonicalReality: false;
    requiresServerStagingBeforeConfirmation: true;
  };
}

export interface FulfillmentAdapterInput {
  proposal: DomainAdmissionProposal;
  node: CandidateLifeNode;
  compilation: SemanticCompilation;
  context: SemanticContextBundle;
}

export interface DomainFulfillmentAdapter {
  id: string;
  version: string;
  owner: string;
  claimTypes: readonly string[];
  lower(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> | AdmissionFulfillmentItem;
}

export class AdmissionFulfillmentRegistry {
  private readonly adapters: DomainFulfillmentAdapter[] = [];

  register(adapter: DomainFulfillmentAdapter) {
    if (this.adapters.some((item) => item.id === adapter.id)) throw new Error(`DUPLICATE_FULFILLMENT_ADAPTER:${adapter.id}`);
    this.adapters.push(adapter);
    return this;
  }

  matching(owner: string, claimType: string) {
    return this.adapters.filter((adapter) => adapter.owner === owner && adapter.claimTypes.includes(claimType));
  }
}

function field(node: CandidateLifeNode, ...names: string[]): SemanticField | undefined {
  for (const name of names) if (node.attributes[name]) return node.attributes[name];
  const normalized = new Map(Object.entries(node.attributes).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]));
  for (const name of names) {
    const hit = normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (hit) return hit;
  }
  return undefined;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : []);
  return [];
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function integerValue(value: unknown): number | undefined {
  const number = numberValue(value);
  return number != null && Number.isInteger(number) && number > 0 ? number : undefined;
}

function localDateInZone(instant: string, zoneId: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousLocalDate(instant: string, zoneId: string) {
  return localDateInZone(new Date(new Date(instant).getTime() - 86_400_000).toISOString(), zoneId);
}

function trainingOccurrence(node: CandidateLifeNode, source: SourceEnvelope) {
  const zoneId = source.zoneId ?? "UTC";
  if (node.temporal?.instant && Number.isFinite(Date.parse(node.temporal.instant))) {
    return {
      occurrencePrecision: node.temporal.precision === "APPROXIMATE" ? "APPROXIMATE" as const : "INSTANT" as const,
      occurredAt: node.temporal.instant
    };
  }
  if (node.temporal?.localDate && /^\d{4}-\d{2}-\d{2}$/.test(node.temporal.localDate)) {
    return { occurrencePrecision: "DAY" as const, localDate: node.temporal.localDate };
  }

  const relative = node.temporal?.relativeText?.trim().toLowerCase();
  const sourceText = source.content.toLowerCase();
  if (relative === "today" || /\btoday\b/.test(sourceText)) {
    return { occurrencePrecision: "DAY" as const, localDate: localDateInZone(source.receivedAt, zoneId) };
  }
  if (relative === "yesterday" || /\byesterday\b/.test(sourceText)) {
    return { occurrencePrecision: "DAY" as const, localDate: previousLocalDate(source.receivedAt, zoneId) };
  }
  if (source.occurredAt && Number.isFinite(Date.parse(source.occurredAt))) {
    return { occurrencePrecision: "INSTANT" as const, occurredAt: source.occurredAt };
  }
  return null;
}

function directExerciseNames(node: CandidateLifeNode) {
  const names = [
    ...strings(field(node, "exercises", "exercise", "movements", "movement")?.value)
  ];
  const skipped = new Set(strings(field(node, "skippedExercises", "skipped_exercises", "omittedExercises")?.value).map((item) => item.toLowerCase()));
  return [...new Set(names)].filter((name) => !skipped.has(name.toLowerCase()));
}

function parseDetailedSets(node: CandidateLifeNode): TrainingSetCandidate[] {
  const raw = field(node, "sets", "exerciseSets", "exercise_sets")?.value;
  if (!Array.isArray(raw)) return [];

  const result: TrainingSetCandidate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const exerciseText = typeof row.exercise === "string"
      ? row.exercise
      : typeof row.exerciseText === "string"
        ? row.exerciseText
        : typeof row.exercise_name === "string"
          ? row.exercise_name
          : null;
    if (!exerciseText) continue;
    const loadValue = numberValue(row.loadValue ?? row.load ?? row.weight);
    const reps = integerValue(row.reps ?? row.repetitions);
    const rpe = numberValue(row.rpe);
    const rawUnit = typeof (row.loadUnit ?? row.unit) === "string" ? String(row.loadUnit ?? row.unit).toUpperCase() : undefined;
    const loadUnit = rawUnit && /^(LB|LBS|POUNDS?)$/.test(rawUnit) ? "LB" as const : rawUnit && /^(KG|KGS|KILOGRAMS?)$/.test(rawUnit) ? "KG" as const : undefined;
    result.push({ exerciseText, reps, loadValue, loadUnit, rpe });
  }
  return result;
}

function sourceLoadUnit(source: SourceEnvelope): "LB" | "KG" | undefined {
  if (/\b(kg|kgs|kilograms?)\b/i.test(source.content)) return "KG";
  if (/\b(lb|lbs|pounds?)\b/i.test(source.content)) return "LB";
  return undefined;
}

function trainingSets(node: CandidateLifeNode, source: SourceEnvelope) {
  const detailed = parseDetailedSets(node);
  if (detailed.length) return { sets: detailed };

  const exercises = directExerciseNames(node);
  if (!exercises.length) return { sets: [] as TrainingSetCandidate[] };

  const unresolved = exercises.filter((name) => !resolveTrainingExercise(name));
  if (unresolved.length) {
    return {
      question: `I understood the exercise name${unresolved.length === 1 ? "" : "s"} ${unresolved.map((item) => `“${item}”`).join(", ")}, but Training does not have a deterministic reference for ${unresolved.length === 1 ? "it" : "them"} yet. Which standard exercise variant did you mean?`,
      reason: `UNRESOLVED_EXERCISE:${unresolved.join("|")}`
    };
  }

  const reps = integerValue(field(node, "reps", "repetitions")?.value);
  const loadValue = numberValue(field(node, "load", "loadValue", "weight")?.value);
  const setCount = integerValue(field(node, "setCount", "setsCount", "numberOfSets")?.value);
  const rawUnit = strings(field(node, "loadUnit", "unit", "weightUnit")?.value)[0];
  const loadUnit = rawUnit
    ? (/^kg/i.test(rawUnit) ? "KG" as const : /^(lb|pound)/i.test(rawUnit) ? "LB" as const : undefined)
    : sourceLoadUnit(source);

  if (loadValue != null && !loadUnit) {
    return {
      question: "I have the load amount, but not whether it was pounds or kilograms. Which unit did you use?",
      reason: "TRAINING_LOAD_UNIT_REQUIRED"
    };
  }

  if (exercises.length > 1 && (reps != null || loadValue != null || setCount != null)) {
    return {
      question: "I have workout-wide reps/load detail but multiple exercises. Tell me which exercise those numbers belong to, or leave the numbers unknown.",
      reason: "TRAINING_DETAIL_EXERCISE_AMBIGUOUS"
    };
  }

  const sets: TrainingSetCandidate[] = [];
  for (const exerciseText of exercises) {
    const count = exercises.length === 1 ? (setCount ?? 1) : 1;
    for (let index = 0; index < count; index++) {
      sets.push({ exerciseText, reps, loadValue, loadUnit });
    }
  }
  return { sets };
}

function trainingSummary(payload: TrainingSessionCandidatePayload) {
  if (payload.sets.length === 0) return `${payload.label ?? "Strength training"} — exercise details unknown.`;
  const rows = payload.sets.map((set, index) => {
    const resolved = resolveTrainingExercise(set.exerciseText);
    const load = set.loadValue != null ? `${set.loadValue} ${set.loadUnit ?? "unit unknown"}` : "load unknown";
    const reps = set.reps != null ? `${set.reps} reps` : "reps unknown";
    return `${index + 1}. ${resolved?.label ?? set.exerciseText} — ${load}, ${reps}`;
  });
  return `${payload.label ?? "Strength training"}\n${rows.join("\n")}`;
}

async function lowerTraining(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> {
  const { proposal, node, compilation } = input;
  const occurrence = trainingOccurrence(node, compilation.source);
  if (!occurrence) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: "When did that workout happen? A day like “today” or “yesterday” is enough.",
      reason: "TRAINING_OCCURRENCE_REQUIRED",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const setResult = trainingSets(node, compilation.source);
  if ("question" in setResult) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: setResult.question ?? "Training needs one more detail before it can accept this.",
      reason: setResult.reason ?? "TRAINING_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const focus = strings(field(node, "focus", "bodyArea", "body_area", "muscleGroup", "muscle_group")?.value)[0];
  const exerciseNames = directExerciseNames(node);
  const label = focus
    ? `${focus.replace(/\b\w/g, (char) => char.toUpperCase())} strength training`
    : exerciseNames.length
      ? `Strength training — ${exerciseNames.map((name) => resolveTrainingExercise(name)?.label ?? name).join(", ")}`
      : "Strength training";

  const payload: TrainingSessionCandidatePayload = {
    sessionKind: "STRENGTH",
    label,
    ...(occurrence.occurrencePrecision === "DAY" ? { localDate: occurrence.localDate } : {}),
    occurrencePrecision: occurrence.occurrencePrecision,
    sets: setResult.sets,
    genericStrengthSession: setResult.sets.length === 0
  };

  const candidate: SemanticCandidate<TrainingSessionCandidatePayload> = {
    candidateId: proposal.candidateId,
    claimType: proposal.claimType,
    proposedOwner: proposal.owner,
    sourceId: compilation.source.sourceId,
    extractionConfidence: node.certainty === "HIGH" ? 0.95 : node.certainty === "MEDIUM" ? 0.75 : 0.55,
    payload
  };

  const admissionSource: SourceEnvelope = {
    ...compilation.source,
    occurredAt: occurrence.occurrencePrecision === "DAY" ? undefined : occurrence.occurredAt,
    interactionIntent: "RECORD",
    authorizesCanonicalWrite: false
  };
  const registry = new AdmissionRegistry().register(trainingAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: compilation.source.sourceId, candidates: [candidate], relations: [] },
    registry,
    { now: compilation.source.receivedAt, source: admissionSource }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "REJECT",
      reason: "TRAINING_ADMISSION_DECISION_MISSING",
      semanticContextRefs: proposal.contextRefs
    };
  }

  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: decision.informationNeed?.questionIntent ?? "Training needs one more detail before it can accept this.",
      reason: decision.reason ?? "TRAINING_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }

  if (decision.disposition !== "NEEDS_AUTHORIZATION" || !decision.normalized) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: decision.disposition === "SESSION_ONLY" ? "SESSION_ONLY" : "REJECT",
      reason: decision.reason ?? `TRAINING_UNEXPECTED_ADMISSION_DISPOSITION:${decision.disposition}`,
      semanticContextRefs: proposal.contextRefs
    };
  }

  const normalized = decision.normalized as TrainingSessionCandidatePayload;
  return {
    proposalId: proposal.proposalId,
    candidateId: node.candidateId,
    owner: proposal.owner,
    claimType: proposal.claimType,
    disposition: "READY_FOR_CONFIRMATION",
    summary: trainingSummary(normalized),
    reason: "TRAINING_DOMAIN_ADMISSION_NEEDS_AUTHORIZATION",
    normalizedPayload: normalized,
    sourceContext: {
      sourceId: compilation.source.sourceId,
      receivedAt: compilation.source.receivedAt,
      ...(admissionSource.occurredAt ? { occurredAt: admissionSource.occurredAt } : {}),
      zoneId: compilation.source.zoneId ?? "UTC"
    },
    semanticContextRefs: proposal.contextRefs
  };
}


function firstText(node: CandidateLifeNode, ...names: string[]) {
  return strings(field(node, ...names)?.value)[0];
}

function practiceNameForConcept(node: CandidateLifeNode) {
  if (node.concept === "MUSIC_PRODUCTION") return "Music Production";
  if (node.concept === "DRAWING") return "Drawing";
  return undefined;
}

function practiceTemporalPrecision(node: CandidateLifeNode) {
  if (node.temporal?.precision === "EXACT") return "INSTANT" as const;
  if (node.temporal?.precision === "APPROXIMATE") return "HOUR" as const;
  return null;
}

async function lowerPractice(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> {
  const { proposal, node, compilation } = input;
  const practiceName = practiceNameForConcept(node);
  if (!practiceName) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "SESSION_ONLY",
      reason: "PRACTICE_CONCEPT_NOT_GOVERNED",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const from = node.temporal?.interval?.from;
  const to = node.temporal?.interval?.to;
  const precision = practiceTemporalPrecision(node);
  if (
    !from ||
    !to ||
    !precision ||
    !Number.isFinite(Date.parse(from)) ||
    !Number.isFinite(Date.parse(to)) ||
    Date.parse(to) <= Date.parse(from)
  ) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: `What time did that ${practiceName.toLowerCase()} session start and end? A rough range is enough.`,
      reason: "PRACTICE_EXACT_OR_APPROXIMATE_INTERVAL_REQUIRED",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const durationSeconds = Math.round((Date.parse(to) - Date.parse(from)) / 1000);
  const focus = firstText(node, "focus", "workedOn", "worked_on", "project", "details");
  const payload: PracticeSessionCandidatePayload = {
    practiceName,
    occurredFrom: from,
    occurredTo: to,
    fromPrecision: precision,
    toPrecision: precision,
    zoneId: compilation.source.zoneId ?? "UTC",
    durationSeconds,
    ...(focus ? { focus } : {})
  };

  const candidate: SemanticCandidate<PracticeSessionCandidatePayload> = {
    candidateId: proposal.candidateId,
    claimType: proposal.claimType,
    proposedOwner: proposal.owner,
    sourceId: compilation.source.sourceId,
    extractionConfidence: node.certainty === "HIGH" ? 0.95 : node.certainty === "MEDIUM" ? 0.75 : 0.55,
    payload
  };
  const registry = new AdmissionRegistry().register(practiceAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: compilation.source.sourceId, candidates: [candidate], relations: [] },
    registry,
    {
      now: compilation.source.receivedAt,
      source: { ...compilation.source, interactionIntent: "RECORD", authorizesCanonicalWrite: false }
    }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "REJECT",
      reason: "PRACTICE_ADMISSION_DECISION_MISSING",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: decision.informationNeed?.questionIntent ?? "Practice needs one more detail before it can accept this.",
      reason: decision.reason ?? "PRACTICE_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition !== "NEEDS_AUTHORIZATION" || !decision.normalized) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: decision.disposition === "SESSION_ONLY" ? "SESSION_ONLY" : "REJECT",
      reason: decision.reason ?? `PRACTICE_UNEXPECTED_ADMISSION_DISPOSITION:${decision.disposition}`,
      semanticContextRefs: proposal.contextRefs
    };
  }

  const normalized = decision.normalized as PracticeSessionCandidatePayload;
  const minutes = Math.max(1, Math.round(normalized.durationSeconds / 60));
  return {
    proposalId: proposal.proposalId,
    candidateId: node.candidateId,
    owner: proposal.owner,
    claimType: proposal.claimType,
    disposition: "READY_FOR_CONFIRMATION",
    summary: `${normalized.practiceName} — ${minutes} min practice session.`,
    reason: "PRACTICE_DOMAIN_ADMISSION_NEEDS_AUTHORIZATION",
    normalizedPayload: normalized,
    sourceContext: {
      sourceId: compilation.source.sourceId,
      receivedAt: compilation.source.receivedAt,
      zoneId: normalized.zoneId
    },
    semanticContextRefs: proposal.contextRefs
  };
}

function sourceTitle(node: CandidateLifeNode) {
  const explicit = firstText(node, "title", "goal", "objective", "name", "label");
  if (explicit) return explicit.trim().slice(0, 300);
  const span = (node.sourceSpans ?? []).find((item) => item.trim());
  return span?.trim().slice(0, 300);
}

function directionKind(node: CandidateLifeNode): DirectionNodeKind {
  const explicit = firstText(node, "directionKind", "kind")?.trim().toLowerCase();
  if (explicit && ["value", "direction", "outcome", "commitment", "quest", "plan", "action"].includes(explicit)) {
    return explicit as DirectionNodeKind;
  }
  return node.nodeType === "PLAN" ? "plan" : "direction";
}

async function lowerDirection(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> {
  const { proposal, node, compilation } = input;
  const title = sourceTitle(node);
  if (!title) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: "What should this direction be called?",
      reason: "DIRECTION_TITLE_REQUIRED",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const description = firstText(node, "description", "details", "why");
  const payload: DirectionNodeCandidatePayload = {
    kind: directionKind(node),
    title,
    ...(description ? { description } : {}),
    intentState: "ACTIVE"
  };
  const candidate: SemanticCandidate<DirectionNodeCandidatePayload> = {
    candidateId: proposal.candidateId,
    claimType: proposal.claimType,
    proposedOwner: proposal.owner,
    sourceId: compilation.source.sourceId,
    extractionConfidence: node.certainty === "HIGH" ? 0.95 : node.certainty === "MEDIUM" ? 0.75 : 0.55,
    payload
  };
  const registry = new AdmissionRegistry().register(directionAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: compilation.source.sourceId, candidates: [candidate], relations: [] },
    registry,
    {
      now: compilation.source.receivedAt,
      source: { ...compilation.source, interactionIntent: "RECORD", authorizesCanonicalWrite: false }
    }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "REJECT", reason: "DIRECTION_ADMISSION_DECISION_MISSING", semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: decision.informationNeed?.questionIntent ?? "Direction needs one more detail before it can accept this.",
      reason: decision.reason ?? "DIRECTION_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition !== "NEEDS_AUTHORIZATION" || !decision.normalized) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: decision.disposition === "SESSION_ONLY" ? "SESSION_ONLY" : "REJECT",
      reason: decision.reason ?? `DIRECTION_UNEXPECTED_ADMISSION_DISPOSITION:${decision.disposition}`,
      semanticContextRefs: proposal.contextRefs
    };
  }

  const normalized = decision.normalized as DirectionNodeCandidatePayload;
  return {
    proposalId: proposal.proposalId,
    candidateId: node.candidateId,
    owner: proposal.owner,
    claimType: proposal.claimType,
    disposition: "READY_FOR_CONFIRMATION",
    summary: `${normalized.kind}: ${normalized.title}${normalized.description ? `\n${normalized.description}` : ""}`,
    reason: "DIRECTION_DOMAIN_ADMISSION_NEEDS_AUTHORIZATION",
    normalizedPayload: normalized,
    sourceContext: {
      sourceId: compilation.source.sourceId,
      receivedAt: compilation.source.receivedAt,
      zoneId: compilation.source.zoneId ?? "UTC"
    },
    semanticContextRefs: proposal.contextRefs
  };
}

function scheduleDurationSeconds(node: CandidateLifeNode) {
  const seconds = integerValue(field(node, "expectedDurationSeconds", "durationSeconds")?.value);
  if (seconds) return seconds;
  const minutes = numberValue(field(node, "durationMinutes")?.value);
  if (minutes != null && minutes > 0) return Math.round(minutes * 60);
  const hours = numberValue(field(node, "durationHours")?.value);
  if (hours != null && hours > 0) return Math.round(hours * 3600);
  return undefined;
}

function validIso(value?: string) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function explicitScheduleKind(node: CandidateLifeNode): ScheduleAllocationKind | undefined {
  const raw = firstText(node, "allocationKind", "scheduleKind", "kind")?.trim().toUpperCase();
  if (raw && ["HARD", "SOFT", "WINDOWED", "FLOATING"].includes(raw)) return raw as ScheduleAllocationKind;
  return undefined;
}

async function lowerSchedule(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> {
  const { proposal, node, compilation } = input;
  const label = sourceTitle(node);
  if (!label) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION", question: "What should this scheduled item be called?",
      reason: "SCHEDULE_LABEL_REQUIRED", semanticContextRefs: proposal.contextRefs
    };
  }

  const zoneId = compilation.source.zoneId ?? "UTC";
  const explicitKind = explicitScheduleKind(node);
  const interval = node.temporal?.interval;
  const instant = node.temporal?.instant;
  const dueAt = firstText(node, "dueAt", "due_at");
  const duration = scheduleDurationSeconds(node);
  let payload: ScheduleAllocationCandidatePayload;

  if (interval?.from || interval?.to) {
    if (!validIso(interval.from) || !validIso(interval.to)) {
      return {
        proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
        disposition: "NEEDS_CLARIFICATION",
        question: "What exact start and end time should I use for that schedule block?",
        reason: "SCHEDULE_INTERVAL_INCOMPLETE",
        semanticContextRefs: proposal.contextRefs
      };
    }
    payload = explicitKind === "WINDOWED"
      ? {
          label,
          allocationKind: "WINDOWED",
          windowStartsAt: interval.from!,
          windowEndsAt: interval.to!,
          zoneId,
          ...(duration ? { expectedDurationSeconds: duration } : {})
        }
      : {
          label,
          allocationKind: explicitKind === "HARD" ? "HARD" : "SOFT",
          startsAt: interval.from!,
          endsAt: interval.to!,
          zoneId,
          ...(duration ? { expectedDurationSeconds: duration } : {})
        };
  } else if (instant && validIso(instant)) {
    if (!duration) {
      return {
        proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
        disposition: "NEEDS_CLARIFICATION",
        question: "How long should I block for that?",
        reason: "SCHEDULE_DURATION_REQUIRED",
        semanticContextRefs: proposal.contextRefs
      };
    }
    payload = {
      label,
      allocationKind: explicitKind === "HARD" ? "HARD" : "SOFT",
      startsAt: instant,
      endsAt: new Date(Date.parse(instant) + duration * 1000).toISOString(),
      expectedDurationSeconds: duration,
      zoneId
    };
  } else if (node.temporal?.localDate || node.temporal?.daypart || node.temporal?.relativeText) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: "What time or time window should I use? I won’t turn a day-level plan into an exact calendar block by guessing.",
      reason: "SCHEDULE_TIME_WINDOW_REQUIRED",
      semanticContextRefs: proposal.contextRefs
    };
  } else {
    payload = {
      label,
      allocationKind: "FLOATING",
      zoneId,
      ...(dueAt && validIso(dueAt) ? { dueAt } : {}),
      ...(duration ? { expectedDurationSeconds: duration } : {})
    };
  }

  const candidate: SemanticCandidate<ScheduleAllocationCandidatePayload> = {
    candidateId: proposal.candidateId,
    claimType: proposal.claimType,
    proposedOwner: proposal.owner,
    sourceId: compilation.source.sourceId,
    extractionConfidence: node.certainty === "HIGH" ? 0.95 : node.certainty === "MEDIUM" ? 0.75 : 0.55,
    payload
  };
  const registry = new AdmissionRegistry().register(scheduleAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: compilation.source.sourceId, candidates: [candidate], relations: [] },
    registry,
    {
      now: compilation.source.receivedAt,
      source: { ...compilation.source, interactionIntent: "RECORD", authorizesCanonicalWrite: false }
    }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "REJECT", reason: "SCHEDULE_ADMISSION_DECISION_MISSING", semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: decision.informationNeed?.questionIntent ?? "Schedule needs one more detail before it can accept this.",
      reason: decision.reason ?? "SCHEDULE_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition !== "NEEDS_AUTHORIZATION" || !decision.normalized) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: decision.disposition === "SESSION_ONLY" ? "SESSION_ONLY" : "REJECT",
      reason: decision.reason ?? `SCHEDULE_UNEXPECTED_ADMISSION_DISPOSITION:${decision.disposition}`,
      semanticContextRefs: proposal.contextRefs
    };
  }

  const normalized = decision.normalized as ScheduleAllocationCandidatePayload;
  const timing = normalized.startsAt
    ? `${normalized.startsAt} → ${normalized.endsAt}`
    : normalized.windowStartsAt
      ? `window ${normalized.windowStartsAt} → ${normalized.windowEndsAt}`
      : normalized.dueAt
        ? `floating; due ${normalized.dueAt}`
        : "floating";
  return {
    proposalId: proposal.proposalId,
    candidateId: node.candidateId,
    owner: proposal.owner,
    claimType: proposal.claimType,
    disposition: "READY_FOR_CONFIRMATION",
    summary: `Schedule: ${normalized.label}\n${timing}`,
    reason: "SCHEDULE_DOMAIN_ADMISSION_NEEDS_AUTHORIZATION",
    normalizedPayload: normalized,
    sourceContext: {
      sourceId: compilation.source.sourceId,
      receivedAt: compilation.source.receivedAt,
      zoneId
    },
    semanticContextRefs: proposal.contextRefs
  };
}


function nutritionPrecision(value: SemanticField["precision"] | undefined): NutritionPrecision {
  if (value === "EXACT" || value === "APPROXIMATE") return value;
  return "UNKNOWN";
}

function nutritionNumber(node: CandidateLifeNode, ...names: string[]) {
  const semanticField = field(node, ...names);
  const value = numberValue(semanticField?.value);
  if (value == null || value < 0) return null;
  return { value, precision: nutritionPrecision(semanticField?.precision) };
}

function nutritionItems(node: CandidateLifeNode): NutritionItemCandidate[] {
  const semanticField = field(node, "items", "foods", "foodItems", "mealItems", "food", "item");
  const raw = semanticField?.value;
  const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const items: NutritionItemCandidate[] = [];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      items.push({ itemLabel: value.trim().slice(0, 300) });
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const rawLabel = row.itemLabel ?? row.item_label ?? row.name ?? row.label ?? row.food ?? row.item;
    if (typeof rawLabel !== "string" || !rawLabel.trim()) continue;

    const q = numberValue(row.quantityValue ?? row.quantity_value ?? row.quantity ?? row.amount);
    const rawUnit = row.quantityUnit ?? row.quantity_unit ?? row.unit;
    const unit = typeof rawUnit === "string" && rawUnit.trim() ? rawUnit.trim() : undefined;
    const rawPrecision = row.quantityPrecision ?? row.quantity_precision ?? row.precision;
    const precision: NutritionPrecision =
      typeof rawPrecision === "string" && ["EXACT", "APPROXIMATE", "UNKNOWN"].includes(rawPrecision.toUpperCase())
        ? rawPrecision.toUpperCase() as NutritionPrecision
        : "UNKNOWN";

    items.push({
      itemLabel: rawLabel.trim().slice(0, 300),
      ...(q != null && q > 0 && unit ? { quantityValue: q, quantityUnit: unit.slice(0, 80), quantityPrecision: precision } : {})
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);
}

function nutritionTotals(node: CandidateLifeNode): NutritionTotalsCandidate {
  const calories = nutritionNumber(node, "caloriesKcal", "calories_kcal", "calories", "calorieTotal");
  const protein = nutritionNumber(node, "proteinG", "protein_g", "protein", "proteinGrams");
  const carbs = nutritionNumber(node, "carbsG", "carbs_g", "carbs", "carbohydrates", "carbohydrateGrams");
  const fat = nutritionNumber(node, "fatG", "fat_g", "fat", "fatGrams");

  return {
    ...(calories ? { caloriesKcal: calories.value, caloriesPrecision: calories.precision } : {}),
    ...(protein ? { proteinG: protein.value, proteinPrecision: protein.precision } : {}),
    ...(carbs ? { carbsG: carbs.value, carbsPrecision: carbs.precision } : {}),
    ...(fat ? { fatG: fat.value, fatPrecision: fat.precision } : {})
  };
}

function nutritionLabel(node: CandidateLifeNode, items: NutritionItemCandidate[]) {
  const explicit = firstText(node, "mealType", "meal_type", "label", "name");
  if (explicit) return explicit.trim().replace(/\b\w/g, (character) => character.toUpperCase()).slice(0, 300);
  if (items.length === 1) return items[0].itemLabel;
  return node.concept === "MEAL" ? "Meal" : "Food intake";
}

async function lowerNutrition(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> {
  const { proposal, node, compilation } = input;
  const occurrence = trainingOccurrence(node, compilation.source);
  if (!occurrence) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: "When did you eat or drink that? A day like “today” or “yesterday” is enough.",
      reason: "NUTRITION_OCCURRENCE_REQUIRED",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const items = nutritionItems(node);
  const payload: NutritionIntakeCandidatePayload = {
    intakeKind: node.concept === "MEAL" ? "MEAL" : "FOOD_INTAKE",
    label: nutritionLabel(node, items),
    ...(occurrence.occurrencePrecision === "DAY" ? { localDate: occurrence.localDate } : {}),
    occurrencePrecision: occurrence.occurrencePrecision,
    items,
    nutrition: nutritionTotals(node),
    ...(items.length === 0 ? { genericIntake: true } : {})
  };

  const candidate: SemanticCandidate<NutritionIntakeCandidatePayload> = {
    candidateId: proposal.candidateId,
    claimType: proposal.claimType,
    proposedOwner: proposal.owner,
    sourceId: compilation.source.sourceId,
    extractionConfidence: node.certainty === "HIGH" ? 0.95 : node.certainty === "MEDIUM" ? 0.75 : 0.55,
    payload
  };
  const admissionSource: SourceEnvelope = {
    ...compilation.source,
    occurredAt: occurrence.occurrencePrecision === "DAY" ? undefined : occurrence.occurredAt,
    interactionIntent: "RECORD",
    authorizesCanonicalWrite: false
  };
  const registry = new AdmissionRegistry().register(nutritionAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: compilation.source.sourceId, candidates: [candidate], relations: [] },
    registry,
    { now: compilation.source.receivedAt, source: admissionSource }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "REJECT",
      reason: "NUTRITION_ADMISSION_DECISION_MISSING",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: decision.informationNeed?.questionIntent ?? "Nutrition needs one more detail before it can accept this.",
      reason: decision.reason ?? "NUTRITION_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition !== "NEEDS_AUTHORIZATION" || !decision.normalized) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: decision.disposition === "SESSION_ONLY" ? "SESSION_ONLY" : "REJECT",
      reason: decision.reason ?? `NUTRITION_UNEXPECTED_ADMISSION_DISPOSITION:${decision.disposition}`,
      semanticContextRefs: proposal.contextRefs
    };
  }

  const normalized = decision.normalized as NutritionIntakeCandidatePayload;
  const itemSummary = normalized.items.length
    ? normalized.items.map((item) => item.itemLabel).join(", ")
    : "item detail unknown";
  const totals = [
    normalized.nutrition.caloriesKcal != null ? `${normalized.nutrition.caloriesKcal} kcal (${normalized.nutrition.caloriesPrecision})` : null,
    normalized.nutrition.proteinG != null ? `${normalized.nutrition.proteinG} g protein (${normalized.nutrition.proteinPrecision})` : null,
    normalized.nutrition.carbsG != null ? `${normalized.nutrition.carbsG} g carbs (${normalized.nutrition.carbsPrecision})` : null,
    normalized.nutrition.fatG != null ? `${normalized.nutrition.fatG} g fat (${normalized.nutrition.fatPrecision})` : null
  ].filter((value): value is string => Boolean(value));

  return {
    proposalId: proposal.proposalId,
    candidateId: node.candidateId,
    owner: proposal.owner,
    claimType: proposal.claimType,
    disposition: "READY_FOR_CONFIRMATION",
    summary: `${normalized.label ?? "Nutrition intake"} — ${itemSummary}${totals.length ? `\n${totals.join(" · ")}` : "\nNutrition totals unknown."}`,
    reason: "NUTRITION_DOMAIN_ADMISSION_NEEDS_AUTHORIZATION",
    normalizedPayload: normalized,
    sourceContext: {
      sourceId: compilation.source.sourceId,
      receivedAt: compilation.source.receivedAt,
      ...(admissionSource.occurredAt ? { occurredAt: admissionSource.occurredAt } : {}),
      zoneId: compilation.source.zoneId ?? "UTC"
    },
    semanticContextRefs: proposal.contextRefs
  };
}


function standardNumericValue(node: CandidateLifeNode, ...names: string[]) {
  const semanticField = field(node, ...names);
  const direct = numberValue(semanticField?.value);
  if (direct != null) return direct;
  const raw = semanticField?.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  for (const key of ["value", "count", "amount", "target", "minimum"]) {
    const parsed = numberValue(row[key]);
    if (parsed != null) return parsed;
  }
  return undefined;
}

async function lowerTrainingStrengthStandard(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> {
  const { proposal, node, compilation } = input;
  const targetSessions = standardNumericValue(node, "targetSessions", "sessionsPerWeek", "weeklySessions", "sessionTarget", "target", "frequencyCount");
  if (targetSessions == null || !Number.isInteger(targetSessions) || targetSessions < 1 || targetSessions > 21) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: "How many strength sessions per week do you want Wayfinder to use as your standard?",
      reason: "STRENGTH_STANDARD_TARGET_REQUIRED",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const payload: TrainingStrengthStandardPayload = {
    targetSessions,
    zoneId: compilation.source.zoneId ?? "UTC"
  };
  const candidate: SemanticCandidate<TrainingStrengthStandardPayload> = {
    candidateId: proposal.candidateId,
    claimType: proposal.claimType,
    proposedOwner: proposal.owner,
    sourceId: compilation.source.sourceId,
    extractionConfidence: node.certainty === "HIGH" ? 0.95 : node.certainty === "MEDIUM" ? 0.75 : 0.55,
    payload
  };
  const registry = new AdmissionRegistry().register(trainingStrengthStandardAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: compilation.source.sourceId, candidates: [candidate], relations: [] },
    registry,
    {
      now: compilation.source.receivedAt,
      source: { ...compilation.source, interactionIntent: "RECORD", authorizesCanonicalWrite: false }
    }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "REJECT", reason: "TRAINING_STANDARD_ADMISSION_DECISION_MISSING", semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: decision.informationNeed?.questionIntent ?? "The training standard needs one more detail.",
      reason: decision.reason ?? "TRAINING_STANDARD_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition !== "NEEDS_AUTHORIZATION" || !decision.normalized) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: decision.disposition === "SESSION_ONLY" ? "SESSION_ONLY" : "REJECT",
      reason: decision.reason ?? "TRAINING_STANDARD_NOT_ADMISSIBLE",
      semanticContextRefs: proposal.contextRefs
    };
  }
  const normalized = decision.normalized as TrainingStrengthStandardPayload;
  return {
    proposalId: proposal.proposalId,
    candidateId: node.candidateId,
    owner: proposal.owner,
    claimType: proposal.claimType,
    disposition: "READY_FOR_CONFIRMATION",
    summary: "Training standard — at least " + normalized.targetSessions + " strength " + (normalized.targetSessions === 1 ? "session" : "sessions") + " per local week.",
    reason: "TRAINING_STANDARD_DOMAIN_ADMISSION_NEEDS_AUTHORIZATION",
    normalizedPayload: normalized,
    sourceContext: {
      sourceId: compilation.source.sourceId,
      receivedAt: compilation.source.receivedAt,
      zoneId: normalized.zoneId
    },
    semanticContextRefs: proposal.contextRefs
  };
}

async function lowerNutritionProteinStandard(input: FulfillmentAdapterInput): Promise<AdmissionFulfillmentItem> {
  const { proposal, node, compilation } = input;
  const targetGrams = standardNumericValue(node, "targetGrams", "proteinGrams", "dailyProteinGrams", "proteinTarget", "target", "minimum");
  if (targetGrams == null || targetGrams <= 0 || targetGrams > 1000) {
    return {
      proposalId: proposal.proposalId,
      candidateId: node.candidateId,
      owner: proposal.owner,
      claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: "What daily protein target in grams do you want Wayfinder to use?",
      reason: "PROTEIN_STANDARD_TARGET_REQUIRED",
      semanticContextRefs: proposal.contextRefs
    };
  }

  const payload: NutritionProteinStandardPayload = {
    targetGrams,
    zoneId: compilation.source.zoneId ?? "UTC"
  };
  const candidate: SemanticCandidate<NutritionProteinStandardPayload> = {
    candidateId: proposal.candidateId,
    claimType: proposal.claimType,
    proposedOwner: proposal.owner,
    sourceId: compilation.source.sourceId,
    extractionConfidence: node.certainty === "HIGH" ? 0.95 : node.certainty === "MEDIUM" ? 0.75 : 0.55,
    payload
  };
  const registry = new AdmissionRegistry().register(nutritionProteinStandardAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: compilation.source.sourceId, candidates: [candidate], relations: [] },
    registry,
    {
      now: compilation.source.receivedAt,
      source: { ...compilation.source, interactionIntent: "RECORD", authorizesCanonicalWrite: false }
    }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "REJECT", reason: "PROTEIN_STANDARD_ADMISSION_DECISION_MISSING", semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition === "NEEDS_CLARIFICATION") {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: "NEEDS_CLARIFICATION",
      question: decision.informationNeed?.questionIntent ?? "The protein standard needs one more detail.",
      reason: decision.reason ?? "PROTEIN_STANDARD_NEEDS_CLARIFICATION",
      semanticContextRefs: proposal.contextRefs
    };
  }
  if (decision.disposition !== "NEEDS_AUTHORIZATION" || !decision.normalized) {
    return {
      proposalId: proposal.proposalId, candidateId: node.candidateId, owner: proposal.owner, claimType: proposal.claimType,
      disposition: decision.disposition === "SESSION_ONLY" ? "SESSION_ONLY" : "REJECT",
      reason: decision.reason ?? "PROTEIN_STANDARD_NOT_ADMISSIBLE",
      semanticContextRefs: proposal.contextRefs
    };
  }
  const normalized = decision.normalized as NutritionProteinStandardPayload;
  return {
    proposalId: proposal.proposalId,
    candidateId: node.candidateId,
    owner: proposal.owner,
    claimType: proposal.claimType,
    disposition: "READY_FOR_CONFIRMATION",
    summary: "Nutrition standard — at least " + normalized.targetGrams + " g protein per local day.",
    reason: "PROTEIN_STANDARD_DOMAIN_ADMISSION_NEEDS_AUTHORIZATION",
    normalizedPayload: normalized,
    sourceContext: {
      sourceId: compilation.source.sourceId,
      receivedAt: compilation.source.receivedAt,
      zoneId: normalized.zoneId
    },
    semanticContextRefs: proposal.contextRefs
  };
}

export function createTrainingStandardFulfillmentAdapter(): DomainFulfillmentAdapter {
  return {
    id: "training.strength-standard.admission-fulfillment.v0.1",
    version: "0.1",
    owner: "training",
    claimTypes: ["TRAINING_STRENGTH_STANDARD"],
    lower: lowerTrainingStrengthStandard
  };
}

export function createNutritionStandardFulfillmentAdapter(): DomainFulfillmentAdapter {
  return {
    id: "nutrition.protein-standard.admission-fulfillment.v0.1",
    version: "0.1",
    owner: "nutrition",
    claimTypes: ["NUTRITION_PROTEIN_STANDARD"],
    lower: lowerNutritionProteinStandard
  };
}

export function createNutritionFulfillmentAdapter(): DomainFulfillmentAdapter {
  return {
    id: "nutrition.admission-fulfillment.v0.1",
    version: "0.1",
    owner: "nutrition",
    claimTypes: ["NUTRITION_INTAKE"],
    lower: lowerNutrition
  };
}

export function createDirectionFulfillmentAdapter(): DomainFulfillmentAdapter {
  return {
    id: "direction.admission-fulfillment.v0.1",
    version: "0.1",
    owner: "direction",
    claimTypes: ["DIRECTION_NODE"],
    lower: lowerDirection
  };
}

export function createScheduleFulfillmentAdapter(): DomainFulfillmentAdapter {
  return {
    id: "schedule.admission-fulfillment.v0.1",
    version: "0.1",
    owner: "schedule",
    claimTypes: ["SCHEDULE_ALLOCATION"],
    lower: lowerSchedule
  };
}

export function createPracticeFulfillmentAdapter(): DomainFulfillmentAdapter {
  return {
    id: "practice.admission-fulfillment.v0.1",
    version: "0.1",
    owner: "practice",
    claimTypes: ["PRACTICE_SESSION"],
    lower: lowerPractice
  };
}

export function createTrainingFulfillmentAdapter(): DomainFulfillmentAdapter {
  return {
    id: "training.admission-fulfillment.v0.1",
    version: "0.1",
    owner: "training",
    claimTypes: ["TRAINING_STRENGTH_SESSION"],
    lower: lowerTraining
  };
}

export function createWayfinderFulfillmentRegistryV0() {
  return new AdmissionFulfillmentRegistry()
    .register(createTrainingFulfillmentAdapter())
    .register(createTrainingStandardFulfillmentAdapter())
    .register(createPracticeFulfillmentAdapter())
    .register(createDirectionFulfillmentAdapter())
    .register(createScheduleFulfillmentAdapter())
    .register(createNutritionFulfillmentAdapter())
    .register(createNutritionStandardFulfillmentAdapter());
}

export async function fulfillAdmissionPlan(
  compilation: SemanticCompilation,
  plan: AdmissionPlan,
  context: SemanticContextBundle,
  registry: AdmissionFulfillmentRegistry
): Promise<AdmissionFulfillmentResult> {
  const nodeById = new Map(compilation.graph.nodes.map((node) => [node.candidateId, node]));
  const items: AdmissionFulfillmentItem[] = [];

  for (const planItem of plan.items) {
    if (!["NEEDS_AUTHORIZATION", "READY_FOR_DOMAIN_ADMISSION"].includes(planItem.disposition)) continue;
    if (!planItem.proposalId || !planItem.owner || !planItem.claimType) continue;

    const proposal = plan.proposals.find((item) => item.proposalId === planItem.proposalId);
    const node = nodeById.get(planItem.candidateId);
    if (!proposal || !node) {
      items.push({
        proposalId: planItem.proposalId,
        candidateId: planItem.candidateId,
        owner: planItem.owner,
        claimType: planItem.claimType,
        disposition: "REJECT",
        reason: "FULFILLMENT_PROPOSAL_OR_NODE_MISSING",
        semanticContextRefs: []
      });
      continue;
    }

    const matches = registry.matching(planItem.owner, planItem.claimType);
    if (matches.length !== 1) {
      items.push({
        proposalId: proposal.proposalId,
        candidateId: node.candidateId,
        owner: proposal.owner,
        claimType: proposal.claimType,
        disposition: "REJECT",
        reason: matches.length === 0 ? "FULFILLMENT_ADAPTER_MISSING" : "MULTIPLE_FULFILLMENT_ADAPTERS",
        semanticContextRefs: proposal.contextRefs
      });
      continue;
    }

    items.push(await matches[0].lower({ proposal, node, compilation, context }));
  }

  return {
    sourceId: compilation.source.sourceId,
    items,
    invariants: {
      executesCommands: false,
      persistsCanonicalReality: false,
      requiresServerStagingBeforeConfirmation: true
    }
  };
}

export interface StagedAdmissionEnvelope {
  proposalId: string;
  plannerProposalId: string;
  episodeId: string;
  turnId: string;
  candidateId: string;
  owner: string;
  claimType: string;
  normalizedPayload: unknown;
  sourceContext: FulfillmentSourceContext;
  summary: string;
  commandId: string;
}

export async function authorizeStagedFulfillment(envelope: StagedAdmissionEnvelope): Promise<AdmissionDecision> {
  const source: SourceEnvelope = {
    sourceId: envelope.sourceContext.sourceId,
    sourceType: "PLAYER_TEXT",
    content: "[server-staged semantic admission]",
    receivedAt: envelope.sourceContext.receivedAt,
    ...(envelope.sourceContext.occurredAt ? { occurredAt: envelope.sourceContext.occurredAt } : {}),
    interactionIntent: "RECORD",
    authorizesCanonicalWrite: true,
    zoneId: envelope.sourceContext.zoneId
  };
  const candidate: SemanticCandidate = {
    candidateId: envelope.candidateId,
    claimType: envelope.claimType,
    proposedOwner: envelope.owner,
    sourceId: source.sourceId,
    extractionConfidence: 1,
    payload: envelope.normalizedPayload
  };
  const registry = new AdmissionRegistry()
    .register(trainingAdmissionContract)
    .register(trainingStrengthStandardAdmissionContract)
    .register(practiceAdmissionContract)
    .register(directionAdmissionContract)
    .register(scheduleAdmissionContract)
    .register(nutritionAdmissionContract)
    .register(nutritionProteinStandardAdmissionContract);
  const admitted = await runSemanticAdmission(
    { sourceId: source.sourceId, candidates: [candidate], relations: [] },
    registry,
    { now: new Date().toISOString(), source }
  );
  const decision = admitted.decisions[0];
  if (!decision) {
    return {
      contractId: "admission-fulfillment-router.v0.1",
      candidateId: envelope.candidateId,
      claimType: envelope.claimType,
      owner: envelope.owner,
      disposition: "REJECT",
      reason: "AUTHORIZED_ADMISSION_DECISION_MISSING"
    };
  }
  if (decision.command) {
    decision.command = {
      ...decision.command,
      args: { ...decision.command.args, p_command_id: envelope.commandId }
    };
  }
  return decision;
}
