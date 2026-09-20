export interface SkillExperienceInputRead {
  provider?: string;
  as_of?: string;
  eligible_encounter_count?: number;
  first_evidenced_at?: string | null;
  last_evidenced_at?: string | null;
  cadence_sample_count?: number;
  typical_interval_seconds?: number | null;
  recent_encounters?: Array<{
    id: string;
    version: string;
    kind?: string;
    label?: string | null;
    occurred_at?: string;
    recorded_at?: string;
    practice_id?: string;
    practice_name?: string;
  }>;
  count_coverage?: {
    completeness?: "COMPLETE" | "UNKNOWN";
    phenomenon?: string;
  };
  cadence_coverage?: {
    completeness?: "COMPLETE" | "UNKNOWN";
    phenomenon?: string;
  };
  epistemic_coverage?: {
    completeness?: "UNKNOWN" | "PARTIAL" | "COMPLETE";
    reason?: string;
  };
}

export interface SkillCapabilityInputRead {
  provider?: string;
  skill_key?: string;
  skill_label?: string;
  as_of?: string;
  demonstrated_observation_count?: number;
  demonstrated_session_count?: number;
  demonstrated_exercise_count?: number;
  first_demonstrated_at?: string | null;
  last_demonstrated_at?: string | null;
  performance_model?: "LOAD_REPS_PARETO_FRONTIER";
  capability_model?: "COMPLETED_PRACTICE_OUTPUT";
  evidence_basis?: "PLAYER_CONFIRMED_COMPLETED_OUTPUT";
  load_normalization?: {
    canonical_unit?: "KG";
    quantum_kg?: number;
    kg_per_lb?: number;
  };
  exercise_frontiers?: Array<{
    exercise_key?: string;
    exercise_label?: string;
    points?: Array<{
      reps?: number;
      load_value?: number;
      load_unit?: string;
      normalized_load_kg?: number;
      rpe?: number | null;
      occurred_at?: string;
      session_id?: string;
      session_version?: string;
      set_id?: string;
      matching_observation_count?: number;
    }>;
  }>;
  recent_outputs?: Array<{
    output_id?: string;
    output_version?: string;
    output_kind?: string;
    title?: string;
    external_url?: string | null;
    practice_id?: string;
    practice_name?: string;
    source_session_id?: string;
    captured_source_session_version?: string;
    current_source_session_version?: string;
    occurred_at?: string;
    recorded_at?: string;
  }>;
  recent_demonstrations?: Array<{
    session_id?: string;
    session_version?: string;
    set_id?: string;
    exercise_key?: string;
    exercise_label?: string;
    reps?: number;
    load_value?: number;
    load_unit?: string;
    normalized_load_kg?: number;
    rpe?: number | null;
    occurred_at?: string;
  }>;
  result_coverage?: {
    completeness?: "COMPLETE" | "UNKNOWN";
    phenomenon?: string;
  };
  epistemic_coverage?: {
    completeness?: "UNKNOWN" | "PARTIAL" | "COMPLETE";
    reason?: string;
  };
}

export type TrainingStrengthSkillInputRead = SkillExperienceInputRead;
export type PracticeSkillInputRead = SkillExperienceInputRead;
export type TrainingStrengthSkillCapabilityInputRead = SkillCapabilityInputRead;
export type PracticeOutputSkillCapabilityInputRead = SkillCapabilityInputRead;

export type SkillSharpnessMode =
  | "UNKNOWN"
  | "UNOBSERVED"
  | "RECENCY_ONLY"
  | "CADENCE_AWARE";

export type SkillSharpnessState =
  | "UNKNOWN"
  | "UNOBSERVED"
  | "UNESTABLISHED"
  | "SHARP"
  | "WARM"
  | "COOL"
  | "DORMANT";

export interface SkillExperienceProviderInput {
  skillKey: string;
  label: string;
  providerId: string;
  associationMode: "DETERMINISTIC_DOMAIN" | "GOVERNED_PRACTICE_ALIAS";
  sourceNamespace: "training" | "practice";
  sourceType: "session";
  encounterKeyPrefix: "training:session" | "practice:session";
  requiredKind?: string;
  read: SkillExperienceInputRead;
}

export interface SkillCapabilityProviderInput {
  skillKey: string;
  label: string;
  providerId: string;
  evidenceClass: "LOADED_REPETITION_DEMONSTRATION" | "COMPLETED_PRACTICE_OUTPUT";
  read: SkillCapabilityInputRead;
}

export interface SkillExperienceEncounter {
  encounterKey: string;
  skillExperienceKey: string;
  occurredAt: string;
  source: {
    namespace: "training" | "practice";
    type: "session";
    id: string;
    version: string;
  };
  practice?: {
    id: string;
    name: string;
  };
}

export interface SkillCapabilityFrontierPoint {
  reps: number;
  loadValue: number;
  loadUnit: "LB" | "KG";
  normalizedLoadKg: number;
  rpe: number | null;
  occurredAt: string;
  matchingObservationCount: number;
  source: {
    namespace: "training";
    type: "exercise_set";
    id: string;
    version: string;
    sessionId: string;
  };
}

export interface SkillCapabilityExerciseFrontier {
  exerciseKey: string;
  exerciseLabel: string;
  points: SkillCapabilityFrontierPoint[];
}

export interface SkillCapabilityOutput {
  outputId: string;
  outputVersion: string;
  outputKind: "COMPLETED_ARTIFACT";
  title: string;
  externalUrl: string | null;
  occurredAt: string;
  recordedAt: string;
  practice: {
    id: string;
    name: string;
  };
  sourceSession: {
    id: string;
    capturedVersion: string;
    currentVersion: string;
  };
  source: {
    namespace: "practice";
    type: "output";
    id: string;
    version: string;
  };
}

export interface SkillCapabilityDemonstration {
  sessionId: string;
  sessionVersion: string;
  setId: string;
  exerciseKey: string;
  exerciseLabel: string;
  reps: number;
  loadValue: number;
  loadUnit: "LB" | "KG";
  normalizedLoadKg: number | null;
  rpe: number | null;
  occurredAt: string;
  source: {
    namespace: "training";
    type: "exercise_set";
    id: string;
    version: string;
  };
}

export interface SkillProjection {
  skillKey: string;
  label: string;
  association: {
    mode: "DETERMINISTIC_DOMAIN" | "GOVERNED_PRACTICE_ALIAS";
    providerId: string;
  };
  state: "OBSERVED" | "UNOBSERVED" | "UNKNOWN";
  experience: {
    unit: "UNIQUE_GOVERNED_ENCOUNTER";
    encounterCount: number | null;
    firstEvidencedAt: string | null;
    lastEvidencedAt: string | null;
    recentEncounters: SkillExperienceEncounter[];
  };
  sharpness: {
    mode: SkillSharpnessMode;
    state: SkillSharpnessState;
    currentGapSeconds: number | null;
    typicalIntervalSeconds: number | null;
    cadenceSampleCount: number;
    cadenceRatio: number | null;
  };
  capability: {
    state: "EVIDENCED" | "INSUFFICIENT_EVIDENCE" | "UNKNOWN";
    providerId: string | null;
    evidenceClass: "LOADED_REPETITION_DEMONSTRATION" | "COMPLETED_PRACTICE_OUTPUT" | null;
    capabilityModel: "LOAD_REPS_PARETO_FRONTIER" | "COMPLETED_PRACTICE_OUTPUT" | null;
    evidenceBasis: "PLAYER_CONFIRMED_COMPLETED_OUTPUT" | null;
    demonstrationCount: number | null;
    demonstratedSessionCount: number | null;
    demonstratedExerciseCount: number | null;
    performanceModel: "LOAD_REPS_PARETO_FRONTIER" | null;
    loadNormalization: {
      canonicalUnit: "KG";
      quantumKg: number;
      kgPerLb: number;
    } | null;
    frontierPointCount: number | null;
    exerciseFrontiers: SkillCapabilityExerciseFrontier[];
    firstDemonstratedAt: string | null;
    lastDemonstratedAt: string | null;
    recentDemonstrations: SkillCapabilityDemonstration[];
    creativeOutputs: SkillCapabilityOutput[];
    resultCoverage: "COMPLETE" | "UNKNOWN";
    epistemicCoverage: "UNKNOWN" | "PARTIAL" | "COMPLETE";
    note: string;
    doesNotAssert: string[];
  };
  mastery: {
    state: "NOT_EVALUATED";
    note: string;
  };
  epistemicCoverage: "UNKNOWN" | "PARTIAL" | "COMPLETE";
  doesNotAssert: string[];
}

export interface SkillsProjection {
  projection_type: "skills";
  rule_version: "skills_v0.4";
  computed_at: string;
  configured_skill_count: number;
  observed_skill_count: number;
  skills: SkillProjection[];
  does_not_assert: string[];
}

const MIN_CADENCE_ENCOUNTERS = 4;
const MIN_CADENCE_SAMPLES = 3;

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function positiveFinite(value: unknown): value is number {
  return Number.isFinite(value) && (value as number) > 0;
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function recentExperienceEncounters(
  provider: SkillExperienceProviderInput
): SkillExperienceEncounter[] {
  const byEncounter = new Map<string, { encounter: SkillExperienceEncounter; recordedAt: number }>();

  for (const row of provider.read.recent_encounters ?? []) {
    if (!row?.id?.trim() || !row?.version?.trim()) continue;
    if (provider.requiredKind && row.kind && row.kind !== provider.requiredKind) continue;
    if (!validIso(row.occurred_at)) continue;

    const encounterKey = `${provider.encounterKeyPrefix}:${row.id}`;
    const skillExperienceKey = `${encounterKey}:skill:${provider.skillKey}`;
    const recordedAt = validIso(row.recorded_at)
      ? Date.parse(row.recorded_at)
      : Number.NEGATIVE_INFINITY;

    const practice =
      provider.sourceNamespace === "practice" &&
      row.practice_id?.trim() &&
      row.practice_name?.trim()
        ? { id: row.practice_id, name: row.practice_name }
        : undefined;

    const encounter: SkillExperienceEncounter = {
      encounterKey,
      skillExperienceKey,
      occurredAt: row.occurred_at,
      source: {
        namespace: provider.sourceNamespace,
        type: provider.sourceType,
        id: row.id,
        version: row.version
      },
      ...(practice ? { practice } : {})
    };

    const existing = byEncounter.get(encounterKey);
    if (!existing || recordedAt >= existing.recordedAt) {
      byEncounter.set(encounterKey, { encounter, recordedAt });
    }
  }

  return [...byEncounter.values()]
    .map((item) => item.encounter)
    .sort((a, b) =>
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
      a.encounterKey.localeCompare(b.encounterKey)
    );
}

function recentCapabilityDemonstrations(
  provider: SkillCapabilityProviderInput
): SkillCapabilityDemonstration[] {
  const seen = new Set<string>();
  const result: SkillCapabilityDemonstration[] = [];

  for (const row of provider.read.recent_demonstrations ?? []) {
    if (
      !row.session_id?.trim() ||
      !row.session_version?.trim() ||
      !row.set_id?.trim() ||
      !row.exercise_key?.trim() ||
      !row.exercise_label?.trim() ||
      !nonNegativeInteger(row.reps) ||
      row.reps <= 0 ||
      !positiveFinite(row.load_value) ||
      (row.load_unit !== "LB" && row.load_unit !== "KG") ||
      !validIso(row.occurred_at)
    ) {
      continue;
    }

    const key = row.set_id;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      sessionId: row.session_id,
      sessionVersion: row.session_version,
      setId: row.set_id,
      exerciseKey: row.exercise_key,
      exerciseLabel: row.exercise_label,
      reps: row.reps,
      loadValue: row.load_value,
      loadUnit: row.load_unit,
      normalizedLoadKg: positiveFinite(row.normalized_load_kg)
        ? row.normalized_load_kg
        : null,
      rpe: Number.isFinite(row.rpe) ? (row.rpe as number) : null,
      occurredAt: row.occurred_at,
      source: {
        namespace: "training",
        type: "exercise_set",
        id: row.set_id,
        version: row.session_version
      }
    });
  }

  return result.sort((a, b) =>
    Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
    a.setId.localeCompare(b.setId)
  );
}

function recentCreativeOutputs(
  provider: SkillCapabilityProviderInput
): SkillCapabilityOutput[] {
  const seen = new Set<string>();
  const outputs: SkillCapabilityOutput[] = [];

  for (const row of provider.read.recent_outputs ?? []) {
    const externalUrl =
      row.external_url == null
        ? null
        : typeof row.external_url === "string" && /^https?:\/\/\S+$/i.test(row.external_url.trim())
          ? row.external_url.trim()
          : undefined;

    if (
      !row.output_id?.trim() ||
      !row.output_version?.trim() ||
      row.output_kind !== "COMPLETED_ARTIFACT" ||
      !row.title?.trim() ||
      externalUrl === undefined ||
      !row.practice_id?.trim() ||
      !row.practice_name?.trim() ||
      !row.source_session_id?.trim() ||
      !row.captured_source_session_version?.trim() ||
      !row.current_source_session_version?.trim() ||
      !validIso(row.occurred_at) ||
      !validIso(row.recorded_at)
    ) {
      continue;
    }

    if (seen.has(row.output_id)) continue;
    seen.add(row.output_id);

    outputs.push({
      outputId: row.output_id,
      outputVersion: row.output_version,
      outputKind: "COMPLETED_ARTIFACT",
      title: row.title.trim(),
      externalUrl,
      occurredAt: row.occurred_at,
      recordedAt: row.recorded_at,
      practice: {
        id: row.practice_id,
        name: row.practice_name
      },
      sourceSession: {
        id: row.source_session_id,
        capturedVersion: row.captured_source_session_version,
        currentVersion: row.current_source_session_version
      },
      source: {
        namespace: "practice",
        type: "output",
        id: row.output_id,
        version: row.output_version
      }
    });
  }

  return outputs.sort((a, b) =>
    Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
    a.outputId.localeCompare(b.outputId)
  );
}

function strictlyDominatesCapabilityPoint(
  a: SkillCapabilityFrontierPoint,
  b: SkillCapabilityFrontierPoint
) {
  return (
    a.normalizedLoadKg >= b.normalizedLoadKg &&
    a.reps >= b.reps &&
    (a.normalizedLoadKg > b.normalizedLoadKg || a.reps > b.reps)
  );
}

function capabilityFrontiers(
  provider: SkillCapabilityProviderInput
): SkillCapabilityExerciseFrontier[] {
  const frontiers: SkillCapabilityExerciseFrontier[] = [];

  for (const raw of provider.read.exercise_frontiers ?? []) {
    const exerciseKey = raw.exercise_key?.trim();
    const exerciseLabel = raw.exercise_label?.trim();
    if (!exerciseKey || !exerciseLabel) continue;

    const points: SkillCapabilityFrontierPoint[] = [];
    const seen = new Set<string>();

    for (const row of raw.points ?? []) {
      if (
        !nonNegativeInteger(row.reps) ||
        row.reps <= 0 ||
        !positiveFinite(row.load_value) ||
        (row.load_unit !== "LB" && row.load_unit !== "KG") ||
        !positiveFinite(row.normalized_load_kg) ||
        !validIso(row.occurred_at) ||
        !row.session_id?.trim() ||
        !row.session_version?.trim() ||
        !row.set_id?.trim()
      ) {
        continue;
      }

      const matchingObservationCount = nonNegativeInteger(row.matching_observation_count) &&
          row.matching_observation_count > 0
        ? row.matching_observation_count
        : 1;
      const key = [row.normalized_load_kg, row.reps].join(":");
      if (seen.has(key)) continue;
      seen.add(key);

      points.push({
        reps: row.reps,
        loadValue: row.load_value,
        loadUnit: row.load_unit,
        normalizedLoadKg: row.normalized_load_kg,
        rpe: Number.isFinite(row.rpe) ? (row.rpe as number) : null,
        occurredAt: row.occurred_at,
        matchingObservationCount,
        source: {
          namespace: "training",
          type: "exercise_set",
          id: row.set_id,
          version: row.session_version,
          sessionId: row.session_id
        }
      });
    }

    const nondominated = points
      .filter((point) => !points.some((other) => strictlyDominatesCapabilityPoint(other, point)))
      .sort((a, b) =>
        b.normalizedLoadKg - a.normalizedLoadKg ||
        b.reps - a.reps ||
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        a.source.id.localeCompare(b.source.id)
      );

    if (nondominated.length > 0) {
      frontiers.push({ exerciseKey, exerciseLabel, points: nondominated });
    }
  }

  return frontiers.sort((a, b) => a.exerciseKey.localeCompare(b.exerciseKey));
}

function buildSharpness(input: {
  computedAt: string;
  encounterCount: number | null;
  lastEvidencedAt: string | null;
  cadenceSampleCount: number;
  typicalIntervalSeconds: number | null;
  countCoverage: "COMPLETE" | "UNKNOWN";
  cadenceCoverage: "COMPLETE" | "UNKNOWN";
}) {
  if (input.countCoverage !== "COMPLETE" || input.encounterCount === null) {
    return {
      mode: "UNKNOWN" as const,
      state: "UNKNOWN" as const,
      currentGapSeconds: null,
      typicalIntervalSeconds: null,
      cadenceSampleCount: input.cadenceSampleCount,
      cadenceRatio: null
    };
  }

  if (input.encounterCount === 0) {
    return {
      mode: "UNOBSERVED" as const,
      state: "UNOBSERVED" as const,
      currentGapSeconds: null,
      typicalIntervalSeconds: null,
      cadenceSampleCount: 0,
      cadenceRatio: null
    };
  }

  if (!validIso(input.computedAt) || !validIso(input.lastEvidencedAt)) {
    return {
      mode: "UNKNOWN" as const,
      state: "UNKNOWN" as const,
      currentGapSeconds: null,
      typicalIntervalSeconds: null,
      cadenceSampleCount: input.cadenceSampleCount,
      cadenceRatio: null
    };
  }

  const currentGapSeconds = Math.max(
    0,
    (Date.parse(input.computedAt) - Date.parse(input.lastEvidencedAt)) / 1000
  );

  const cadenceEstablished =
    input.cadenceCoverage === "COMPLETE" &&
    input.encounterCount >= MIN_CADENCE_ENCOUNTERS &&
    input.cadenceSampleCount >= MIN_CADENCE_SAMPLES &&
    positiveFinite(input.typicalIntervalSeconds);

  if (!cadenceEstablished) {
    return {
      mode: "RECENCY_ONLY" as const,
      state: "UNESTABLISHED" as const,
      currentGapSeconds,
      typicalIntervalSeconds: null,
      cadenceSampleCount: input.cadenceSampleCount,
      cadenceRatio: null
    };
  }

  const typicalIntervalSeconds = input.typicalIntervalSeconds as number;
  const cadenceRatio = currentGapSeconds / typicalIntervalSeconds;

  const state: SkillSharpnessState =
    cadenceRatio <= 1.25 ? "SHARP" :
    cadenceRatio <= 2 ? "WARM" :
    cadenceRatio <= 4 ? "COOL" :
    "DORMANT";

  return {
    mode: "CADENCE_AWARE" as const,
    state,
    currentGapSeconds,
    typicalIntervalSeconds,
    cadenceSampleCount: input.cadenceSampleCount,
    cadenceRatio
  };
}

function unknownCapability(note: string): SkillProjection["capability"] {
  return {
    state: "UNKNOWN",
    providerId: null,
    evidenceClass: null,
    capabilityModel: null,
    evidenceBasis: null,
    demonstrationCount: null,
    demonstratedSessionCount: null,
    demonstratedExerciseCount: null,
    performanceModel: null,
    loadNormalization: null,
    frontierPointCount: null,
    exerciseFrontiers: [],
    firstDemonstratedAt: null,
    lastDemonstratedAt: null,
    recentDemonstrations: [],
    creativeOutputs: [],
    resultCoverage: "UNKNOWN",
    epistemicCoverage: "UNKNOWN",
    note,
    doesNotAssert: [
      "that missing capability evidence means zero ability",
      "that Skill Experience or Sharpness proves capability"
    ]
  };
}

function buildCompletedOutputCapability(
  provider: SkillCapabilityProviderInput,
  skillLabel: string
): SkillProjection["capability"] {
  const resultCoverage = provider.read.result_coverage?.completeness === "COMPLETE"
    ? "COMPLETE"
    : "UNKNOWN";
  const demonstrationCount = nonNegativeInteger(provider.read.demonstrated_observation_count)
    ? provider.read.demonstrated_observation_count
    : null;
  const demonstratedSessionCount = nonNegativeInteger(provider.read.demonstrated_session_count)
    ? provider.read.demonstrated_session_count
    : null;
  const creativeOutputs = recentCreativeOutputs(provider);
  const capabilityModel = provider.read.capability_model === "COMPLETED_PRACTICE_OUTPUT"
    ? "COMPLETED_PRACTICE_OUTPUT"
    : null;
  const evidenceBasis = provider.read.evidence_basis === "PLAYER_CONFIRMED_COMPLETED_OUTPUT"
    ? "PLAYER_CONFIRMED_COMPLETED_OUTPUT"
    : null;
  const firstDemonstratedAt = validIso(provider.read.first_demonstrated_at)
    ? provider.read.first_demonstrated_at
    : null;
  const lastDemonstratedAt = validIso(provider.read.last_demonstrated_at)
    ? provider.read.last_demonstrated_at
    : null;
  const epistemicCoverage = provider.read.epistemic_coverage?.completeness ?? "UNKNOWN";

  const evidenced =
    demonstrationCount !== null &&
    demonstrationCount > 0 &&
    capabilityModel === "COMPLETED_PRACTICE_OUTPUT" &&
    evidenceBasis === "PLAYER_CONFIRMED_COMPLETED_OUTPUT" &&
    creativeOutputs.length > 0 &&
    demonstrationCount >= creativeOutputs.length;

  if (evidenced) {
    return {
      state: "EVIDENCED",
      providerId: provider.providerId,
      evidenceClass: provider.evidenceClass,
      capabilityModel,
      evidenceBasis,
      demonstrationCount,
      demonstratedSessionCount,
      demonstratedExerciseCount: null,
      performanceModel: null,
      loadNormalization: null,
      frontierPointCount: null,
      exerciseFrontiers: [],
      firstDemonstratedAt,
      lastDemonstratedAt,
      recentDemonstrations: [],
      creativeOutputs,
      resultCoverage,
      epistemicCoverage,
      note:
        "Player-confirmed completed outputs provide bounded evidence that the player has completed " +
        skillLabel +
        " work. This demonstrates completion capability, not artistic quality or mastery.",
      doesNotAssert: [
        "creative quality",
        "originality",
        "commercial success",
        "Mastery",
        "a numeric Skill Level",
        "that completed-output count ranks creative ability",
        "complete human capability coverage"
      ]
    };
  }

  if (resultCoverage === "COMPLETE" && demonstrationCount === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      providerId: provider.providerId,
      evidenceClass: provider.evidenceClass,
      capabilityModel,
      evidenceBasis,
      demonstrationCount: 0,
      demonstratedSessionCount: demonstratedSessionCount ?? 0,
      demonstratedExerciseCount: null,
      performanceModel: null,
      loadNormalization: null,
      frontierPointCount: null,
      exerciseFrontiers: [],
      firstDemonstratedAt: null,
      lastDemonstratedAt: null,
      recentDemonstrations: [],
      creativeOutputs: [],
      resultCoverage,
      epistemicCoverage,
      note:
        "No current canonical completed Practice Output is recorded for this Skill. That is insufficient evidence for this capability projection, not evidence of zero ability.",
      doesNotAssert: [
        "zero ability",
        "that no unrecorded creative outputs exist",
        "creative quality",
        "Mastery"
      ]
    };
  }

  return {
    state: "UNKNOWN",
    providerId: provider.providerId,
    evidenceClass: provider.evidenceClass,
    capabilityModel,
    evidenceBasis,
    demonstrationCount,
    demonstratedSessionCount,
    demonstratedExerciseCount: null,
    performanceModel: null,
    loadNormalization: null,
    frontierPointCount: null,
    exerciseFrontiers: [],
    firstDemonstratedAt,
    lastDemonstratedAt,
    recentDemonstrations: [],
    creativeOutputs,
    resultCoverage,
    epistemicCoverage,
    note:
      "Creative capability remains unknown because the governed output read cannot establish coherent completed-output evidence or complete zero.",
    doesNotAssert: [
      "zero ability",
      "creative quality",
      "Mastery",
      "complete human capability coverage"
    ]
  };
}

function buildCapability(
  provider: SkillCapabilityProviderInput | undefined,
  skillLabel: string
): SkillProjection["capability"] {
  if (!provider) {
    return unknownCapability("No governed capability provider exists for " + skillLabel + " yet.");
  }

  if (provider.evidenceClass === "COMPLETED_PRACTICE_OUTPUT") {
    return buildCompletedOutputCapability(provider, skillLabel);
  }

  const resultCoverage = provider.read.result_coverage?.completeness === "COMPLETE"
    ? "COMPLETE"
    : "UNKNOWN";
  const demonstrationCount = nonNegativeInteger(provider.read.demonstrated_observation_count)
    ? provider.read.demonstrated_observation_count
    : null;
  const demonstratedSessionCount = nonNegativeInteger(provider.read.demonstrated_session_count)
    ? provider.read.demonstrated_session_count
    : null;
  const demonstratedExerciseCount = nonNegativeInteger(provider.read.demonstrated_exercise_count)
    ? provider.read.demonstrated_exercise_count
    : null;
  const recentDemonstrations = recentCapabilityDemonstrations(provider);
  const exerciseFrontiers = capabilityFrontiers(provider);
  const frontierPointCount = exerciseFrontiers.reduce(
    (sum, frontier) => sum + frontier.points.length,
    0
  );
  const performanceModel = provider.read.performance_model === "LOAD_REPS_PARETO_FRONTIER"
    ? "LOAD_REPS_PARETO_FRONTIER"
    : null;
  const loadNormalization =
    provider.read.load_normalization?.canonical_unit === "KG" &&
    positiveFinite(provider.read.load_normalization.quantum_kg) &&
    positiveFinite(provider.read.load_normalization.kg_per_lb)
      ? {
          canonicalUnit: "KG" as const,
          quantumKg: provider.read.load_normalization.quantum_kg,
          kgPerLb: provider.read.load_normalization.kg_per_lb
        }
      : null;
  const firstDemonstratedAt = validIso(provider.read.first_demonstrated_at)
    ? provider.read.first_demonstrated_at
    : null;
  const lastDemonstratedAt = validIso(provider.read.last_demonstrated_at)
    ? provider.read.last_demonstrated_at
    : null;
  const epistemicCoverage = provider.read.epistemic_coverage?.completeness ?? "UNKNOWN";

  const frontierExerciseCountMatches =
    demonstratedExerciseCount === null ||
    demonstratedExerciseCount === exerciseFrontiers.length;
  const evidenced =
    demonstrationCount !== null &&
    demonstrationCount > 0 &&
    performanceModel === "LOAD_REPS_PARETO_FRONTIER" &&
    loadNormalization !== null &&
    frontierPointCount > 0 &&
    frontierExerciseCountMatches;

  if (evidenced) {
    return {
      state: "EVIDENCED",
      providerId: provider.providerId,
      evidenceClass: provider.evidenceClass,
      capabilityModel: "LOAD_REPS_PARETO_FRONTIER",
      evidenceBasis: null,
      demonstrationCount,
      demonstratedSessionCount,
      demonstratedExerciseCount,
      performanceModel,
      loadNormalization,
      frontierPointCount,
      exerciseFrontiers,
      firstDemonstratedAt,
      lastDemonstratedAt,
      recentDemonstrations,
      creativeOutputs: [],
      resultCoverage,
      epistemicCoverage,
      note:
        "Structured loaded-repetition observations provide bounded evidence that the player has demonstrated " +
        skillLabel +
        " capability. This is not a numeric skill level or mastery claim.",
      doesNotAssert: [
        "a numeric Skill Level",
        "a single overall Strength Training capability score",
        "Mastery",
        "whole-body strength from one exercise",
        "direct comparability between different exercises",
        "a measured or estimated one-repetition maximum",
        "physiological adaptation",
        "growth from capability evidence alone",
        "complete human capability coverage"
      ]
    };
  }

  if (resultCoverage === "COMPLETE" && demonstrationCount === 0) {
    return {
      state: "INSUFFICIENT_EVIDENCE",
      providerId: provider.providerId,
      evidenceClass: provider.evidenceClass,
      capabilityModel: performanceModel,
      evidenceBasis: null,
      demonstrationCount: 0,
      demonstratedSessionCount: demonstratedSessionCount ?? 0,
      demonstratedExerciseCount: demonstratedExerciseCount ?? 0,
      performanceModel,
      loadNormalization,
      frontierPointCount: 0,
      exerciseFrontiers: [],
      firstDemonstratedAt: null,
      lastDemonstratedAt: null,
      recentDemonstrations: [],
      creativeOutputs: [],
      resultCoverage,
      epistemicCoverage,
      note:
        "No current canonical loaded-repetition demonstration is recorded. That is insufficient evidence for this capability projection, not evidence of zero ability.",
      doesNotAssert: [
        "zero ability",
        "that no unrecorded capability exists",
        "that unloaded or differently measured capability does not exist"
      ]
    };
  }

  return {
    state: "UNKNOWN",
    providerId: provider.providerId,
    evidenceClass: provider.evidenceClass,
    capabilityModel: performanceModel,
    evidenceBasis: null,
    demonstrationCount,
    demonstratedSessionCount,
    demonstratedExerciseCount,
    performanceModel,
    loadNormalization,
    frontierPointCount: frontierPointCount || null,
    exerciseFrontiers,
    firstDemonstratedAt,
    lastDemonstratedAt,
    recentDemonstrations,
    creativeOutputs: [],
    resultCoverage,
    epistemicCoverage,
    note:
      "Capability remains unknown because the governed evidence read cannot establish a coherent exercise-specific performance frontier or complete zero.",
    doesNotAssert: [
      "zero ability",
      "Mastery",
      "growth",
      "complete human capability coverage"
    ]
  };
}

function buildSkillProjection(
  provider: SkillExperienceProviderInput,
  capabilityProvider: SkillCapabilityProviderInput | undefined,
  computedAt: string
): SkillProjection {
  const countCoverage = provider.read.count_coverage?.completeness === "COMPLETE"
    ? "COMPLETE"
    : "UNKNOWN";
  const cadenceCoverage = provider.read.cadence_coverage?.completeness === "COMPLETE"
    ? "COMPLETE"
    : "UNKNOWN";

  const encounterCount =
    countCoverage === "COMPLETE" && nonNegativeInteger(provider.read.eligible_encounter_count)
      ? provider.read.eligible_encounter_count
      : null;

  const firstEvidencedAt = validIso(provider.read.first_evidenced_at)
    ? provider.read.first_evidenced_at
    : null;
  const lastEvidencedAt = validIso(provider.read.last_evidenced_at)
    ? provider.read.last_evidenced_at
    : null;
  const cadenceSampleCount = nonNegativeInteger(provider.read.cadence_sample_count)
    ? provider.read.cadence_sample_count
    : 0;
  const typicalIntervalSeconds = positiveFinite(provider.read.typical_interval_seconds)
    ? provider.read.typical_interval_seconds
    : null;

  const state =
    encounterCount === null ? "UNKNOWN" :
    encounterCount === 0 ? "UNOBSERVED" :
    "OBSERVED";

  return {
    skillKey: provider.skillKey,
    label: provider.label,
    association: {
      mode: provider.associationMode,
      providerId: provider.providerId
    },
    state,
    experience: {
      unit: "UNIQUE_GOVERNED_ENCOUNTER",
      encounterCount,
      firstEvidencedAt,
      lastEvidencedAt,
      recentEncounters: recentExperienceEncounters(provider)
    },
    sharpness: buildSharpness({
      computedAt,
      encounterCount,
      lastEvidencedAt,
      cadenceSampleCount,
      typicalIntervalSeconds,
      countCoverage,
      cadenceCoverage
    }),
    capability: buildCapability(capabilityProvider, provider.label),
    mastery: {
      state: "NOT_EVALUATED",
      note: "Mastery requires a future governed depth/reliability/transferability rule."
    },
    epistemicCoverage: provider.read.epistemic_coverage?.completeness ?? "UNKNOWN",
    doesNotAssert: [
      "that Skill Experience proves capability",
      "that Sharpness proves capability",
      "that lower Sharpness means learned capability was lost",
      "that encounter count establishes mastery",
      "that unrecorded practice did not occur",
      "that this skill has a numeric level",
      "that one canonical encounter can create more than one Experience contribution to this same skill"
    ]
  };
}

export function buildSkillsProjection(input: {
  providers: SkillExperienceProviderInput[];
  capabilityProviders?: SkillCapabilityProviderInput[];
  computedAt: string;
}): SkillsProjection {
  const experienceBySkill = new Set<string>();
  const capabilityBySkill = new Map<string, SkillCapabilityProviderInput>();

  for (const provider of input.capabilityProviders ?? []) {
    if (capabilityBySkill.has(provider.skillKey)) {
      throw new Error("DUPLICATE_SKILL_CAPABILITY_PROVIDER:" + provider.skillKey);
    }
    capabilityBySkill.set(provider.skillKey, provider);
  }

  const skills = input.providers.map((provider) => {
    if (experienceBySkill.has(provider.skillKey)) {
      throw new Error("DUPLICATE_SKILL_EXPERIENCE_PROVIDER:" + provider.skillKey);
    }
    experienceBySkill.add(provider.skillKey);
    return buildSkillProjection(
      provider,
      capabilityBySkill.get(provider.skillKey),
      input.computedAt
    );
  });

  for (const skillKey of capabilityBySkill.keys()) {
    if (!experienceBySkill.has(skillKey)) {
      throw new Error("ORPHAN_SKILL_CAPABILITY_PROVIDER:" + skillKey);
    }
  }

  return {
    projection_type: "skills",
    rule_version: "skills_v0.4",
    computed_at: input.computedAt,
    configured_skill_count: skills.length,
    observed_skill_count: skills.filter((skill) => skill.state === "OBSERVED").length,
    skills,
    does_not_assert: [
      "a universal fixed skill taxonomy",
      "Skill Level",
      "Skill XP points",
      "that Experience, Sharpness, Capability, and Mastery are interchangeable",
      "that absence of recorded skill evidence means zero human ability",
      "that semantic model proposals directly contribute Skill Experience"
    ]
  };
}

export function trainingStrengthSkillProvider(
  read: TrainingStrengthSkillInputRead
): SkillExperienceProviderInput {
  return {
    skillKey: "physical.strength_training",
    label: "Strength Training",
    providerId: "training.strength-skill-provider.v0.1",
    associationMode: "DETERMINISTIC_DOMAIN",
    sourceNamespace: "training",
    sourceType: "session",
    encounterKeyPrefix: "training:session",
    requiredKind: "STRENGTH",
    read
  };
}

export function trainingStrengthSkillCapabilityProvider(
  read: TrainingStrengthSkillCapabilityInputRead
): SkillCapabilityProviderInput {
  return {
    skillKey: "physical.strength_training",
    label: "Strength Training",
    providerId: "training.strength-skill-capability-provider.v0.1",
    evidenceClass: "LOADED_REPETITION_DEMONSTRATION",
    read
  };
}

export function practiceSkillProvider(input: {
  skillKey: string;
  label: string;
  read: PracticeSkillInputRead;
}): SkillExperienceProviderInput {
  return {
    skillKey: input.skillKey,
    label: input.label,
    providerId: "practice.name-skill-provider.v0.1",
    associationMode: "GOVERNED_PRACTICE_ALIAS",
    sourceNamespace: "practice",
    sourceType: "session",
    encounterKeyPrefix: "practice:session",
    read: input.read
  };
}


export function practiceOutputSkillCapabilityProvider(input: {
  skillKey: string;
  label: string;
  read: PracticeOutputSkillCapabilityInputRead;
}): SkillCapabilityProviderInput {
  return {
    skillKey: input.skillKey,
    label: input.label,
    providerId: "practice.completed-output-skill-capability-provider.v0.1",
    evidenceClass: "COMPLETED_PRACTICE_OUTPUT",
    read: input.read
  };
}
