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
  return new AdmissionFulfillmentRegistry().register(createTrainingFulfillmentAdapter());
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
  if (envelope.owner !== "training" || envelope.claimType !== "TRAINING_STRENGTH_SESSION") {
    return {
      contractId: "admission-fulfillment-router.v0.1",
      candidateId: envelope.candidateId,
      claimType: envelope.claimType,
      owner: envelope.owner,
      disposition: "REJECT",
      reason: "UNSUPPORTED_STAGED_FULFILLMENT"
    };
  }

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
  const registry = new AdmissionRegistry().register(trainingAdmissionContract);
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
