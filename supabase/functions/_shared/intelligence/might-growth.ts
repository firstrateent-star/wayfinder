export type StrengthLoadUnit = "LB" | "KG";

export interface MightGrowthTrainingRead {
  result_coverage?: { completeness?: "COMPLETE" | "PARTIAL" };
  sessions?: Array<{
    id: string;
    version: string;
    kind?: string;
    occurrence?: {
      from?: string;
      to?: string | null;
      precision?: string;
      zone_id?: string;
    };
    sets?: Array<{
      id?: string;
      exercise_key?: string;
      exercise_label?: string;
      reps?: number | null;
      load_value?: number | null;
      load_unit?: string | null;
      rpe?: number | null;
    }>;
  }>;
}

export interface StrengthCapabilityObservation {
  observationId: string;
  sessionId: string;
  sessionVersion: string;
  occurredAt: string;
  exerciseKey: string;
  exerciseLabel: string;
  setId: string | null;
  reps: number;
  loadValue: number;
  loadUnit: StrengthLoadUnit;
  normalizedLoadKg: number;
  rpe: number | null;
}

export interface MightGrowthProof {
  exerciseKey: string;
  exerciseLabel: string;
  ruleVersion: "might_growth_v0.1";
  baselineSessionCount: number;
  baselineSessions: Array<{
    sessionId: string;
    sessionVersion: string;
    occurredAt: string;
  }>;
  baselineAnchor: StrengthCapabilityObservation;
  candidate: StrengthCapabilityObservation;
  confirmation: StrengthCapabilityObservation;
}

export interface MightGrowthEvaluation {
  ruleVersion: "might_growth_v0.1";
  state: "EVIDENCED" | "INSUFFICIENT_EVIDENCE";
  proofs: MightGrowthProof[];
  resultCoverage: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  comparableObservationCount: number;
  excludedObservationCount: number;
  doesNotAssert: string[];
}

const KG_PER_LB = 0.45359237;
const LOAD_QUANTUM_KG = 0.5;
const MIN_BASELINE_SESSIONS = 2;
const REQUIRED_POST_BASELINE_CONFIRMATIONS = 2;

function finitePositive(value: number | null | undefined): value is number {
  return Number.isFinite(value) && (value as number) > 0;
}

function canonicalLoadUnit(value: string | null | undefined): StrengthLoadUnit | null {
  const unit = value?.trim().toUpperCase();
  if (unit === "LB" || unit === "KG") return unit;
  return null;
}

function normalizeLoadKg(value: number, unit: StrengthLoadUnit) {
  const kg = unit === "KG" ? value : value * KG_PER_LB;
  return Math.round(kg / LOAD_QUANTUM_KG) * LOAD_QUANTUM_KG;
}

function strictlyDominates(a: StrengthCapabilityObservation, b: StrengthCapabilityObservation) {
  const noRegression = a.normalizedLoadKg >= b.normalizedLoadKg && a.reps >= b.reps;
  const strictExpansion = a.normalizedLoadKg > b.normalizedLoadKg || a.reps > b.reps;
  return noRegression && strictExpansion;
}

function isDominatedByAny(
  observation: StrengthCapabilityObservation,
  comparison: readonly StrengthCapabilityObservation[]
) {
  return comparison.some((other) => strictlyDominates(other, observation));
}

function paretoFrontier(observations: readonly StrengthCapabilityObservation[]) {
  return observations.filter((observation) => !isDominatedByAny(observation, observations));
}

export function extractStrengthCapabilityObservations(read: MightGrowthTrainingRead) {
  const observations: StrengthCapabilityObservation[] = [];
  let excludedObservationCount = 0;

  for (const session of read.sessions ?? []) {
    if (session.kind && session.kind !== "STRENGTH") continue;
    const occurredAt = session.occurrence?.from;
    if (!occurredAt || !Number.isFinite(Date.parse(occurredAt))) {
      excludedObservationCount += session.sets?.length ?? 0;
      continue;
    }

    for (const [index, set] of (session.sets ?? []).entries()) {
      const exerciseKey = set.exercise_key?.trim();
      const exerciseLabel = set.exercise_label?.trim() || exerciseKey;
      const unit = canonicalLoadUnit(set.load_unit);
      if (
        !exerciseKey ||
        !exerciseLabel ||
        !finitePositive(set.reps) ||
        !Number.isInteger(set.reps) ||
        !finitePositive(set.load_value) ||
        !unit
      ) {
        excludedObservationCount += 1;
        continue;
      }

      observations.push({
        observationId: `${session.id}:${set.id ?? index}`,
        sessionId: session.id,
        sessionVersion: session.version,
        occurredAt,
        exerciseKey,
        exerciseLabel,
        setId: set.id ?? null,
        reps: set.reps,
        loadValue: set.load_value,
        loadUnit: unit,
        normalizedLoadKg: normalizeLoadKg(set.load_value, unit),
        rpe: Number.isFinite(set.rpe) ? (set.rpe as number) : null
      });
    }
  }

  observations.sort((a, b) =>
    Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
    a.sessionId.localeCompare(b.sessionId) ||
    a.observationId.localeCompare(b.observationId)
  );

  return { observations, excludedObservationCount };
}

function uniqueSessions(observations: readonly StrengthCapabilityObservation[]) {
  return new Set(observations.map((observation) => observation.sessionId));
}

function proofForExercise(observations: readonly StrengthCapabilityObservation[]): MightGrowthProof | null {
  const sessions = [...new Set(observations.map((observation) => observation.sessionId))];
  if (sessions.length < MIN_BASELINE_SESSIONS + REQUIRED_POST_BASELINE_CONFIRMATIONS) return null;

  const sessionOrder = [...new Map(
    observations.map((observation) => [
      observation.sessionId,
      { id: observation.sessionId, version: observation.sessionVersion, occurredAt: observation.occurredAt }
    ])
  ).values()].sort((a, b) =>
    Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id)
  );

  for (let candidateIndex = MIN_BASELINE_SESSIONS; candidateIndex < sessionOrder.length - 1; candidateIndex += 1) {
    const candidateSession = sessionOrder[candidateIndex];
    const candidateTime = Date.parse(candidateSession.occurredAt);
    const baselineSessions = sessionOrder.filter((session) => Date.parse(session.occurredAt) < candidateTime);
    const baselineSessionIds = new Set(baselineSessions.map((session) => session.id));
    const baseline = observations.filter((observation) => baselineSessionIds.has(observation.sessionId));
    if (uniqueSessions(baseline).size < MIN_BASELINE_SESSIONS) continue;

    const frontier = paretoFrontier(baseline);
    const candidates = observations.filter((observation) => observation.sessionId === candidateSession.id);

    for (const anchor of frontier) {
      const candidate = candidates.find((observation) =>
        strictlyDominates(observation, anchor) && !isDominatedByAny(observation, baseline)
      );
      if (!candidate) continue;

      const laterSessionIds = new Set(
        sessionOrder
          .filter((session) => Date.parse(session.occurredAt) > candidateTime)
          .map((session) => session.id)
      );
      const confirmation = observations.find((observation) =>
        laterSessionIds.has(observation.sessionId) &&
        strictlyDominates(observation, anchor) &&
        !isDominatedByAny(observation, baseline)
      );
      if (!confirmation) continue;

      return {
        exerciseKey: anchor.exerciseKey,
        exerciseLabel: anchor.exerciseLabel,
        ruleVersion: "might_growth_v0.1",
        baselineSessionCount: baselineSessionIds.size,
        baselineSessions: baselineSessions.map((session) => ({
          sessionId: session.id,
          sessionVersion: session.version,
          occurredAt: session.occurredAt
        })),
        baselineAnchor: anchor,
        candidate,
        confirmation
      };
    }
  }

  return null;
}

export function evaluateMightGrowth(read: MightGrowthTrainingRead): MightGrowthEvaluation {
  const extracted = extractStrengthCapabilityObservations(read);
  const resultCoverage = read.result_coverage?.completeness ?? "UNKNOWN";
  const byExercise = new Map<string, StrengthCapabilityObservation[]>();

  for (const observation of extracted.observations) {
    const list = byExercise.get(observation.exerciseKey) ?? [];
    list.push(observation);
    byExercise.set(observation.exerciseKey, list);
  }

  const proofs: MightGrowthProof[] = [];
  if (resultCoverage === "COMPLETE") {
    for (const observations of byExercise.values()) {
      const proof = proofForExercise(observations);
      if (proof) proofs.push(proof);
    }
  }

  proofs.sort((a, b) =>
    Date.parse(a.confirmation.occurredAt) - Date.parse(b.confirmation.occurredAt) ||
    a.exerciseKey.localeCompare(b.exerciseKey)
  );

  return {
    ruleVersion: "might_growth_v0.1",
    state: proofs.length > 0 ? "EVIDENCED" : "INSUFFICIENT_EVIDENCE",
    proofs,
    resultCoverage,
    comparableObservationCount: extracted.observations.length,
    excludedObservationCount: extracted.excludedObservationCount,
    doesNotAssert: [
      "that a partial or unknown bounded Training result can establish growth",
      "that exercise-specific performance growth is whole-body strength growth",
      "that the observed change was caused by training rather than another factor",
      "that the observations establish physiological adaptation",
      "that performances across different exercises are directly comparable",
      "that an estimated one-repetition maximum was measured",
      "that growth earns XP or a numeric Might score"
    ]
  };
}
