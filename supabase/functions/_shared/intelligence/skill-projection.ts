export interface TrainingStrengthSkillInputRead {
  provider?: string;
  skill_key?: string;
  skill_label?: string;
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

export interface SkillExperienceEncounter {
  encounterKey: string;
  skillExperienceKey: string;
  occurredAt: string;
  source: {
    namespace: "training";
    type: "session";
    id: string;
    version: string;
  };
}

export interface SkillProjection {
  skillKey: "physical.strength_training";
  label: "Strength Training";
  association: {
    mode: "DETERMINISTIC";
    providerId: "training.strength-skill-provider.v0.1";
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
    state: "UNKNOWN";
    note: string;
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
  rule_version: "skills_v0.1";
  computed_at: string;
  configured_skill_count: 1;
  observed_skill_count: number;
  skills: SkillProjection[];
  does_not_assert: string[];
}

const SKILL_KEY = "physical.strength_training" as const;
const SKILL_LABEL = "Strength Training" as const;
const PROVIDER_ID = "training.strength-skill-provider.v0.1" as const;
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
  read: TrainingStrengthSkillInputRead
): SkillExperienceEncounter[] {
  const byEncounter = new Map<string, { encounter: SkillExperienceEncounter; recordedAt: number }>();

  for (const row of read.recent_encounters ?? []) {
    if (!row?.id?.trim() || !row?.version?.trim()) continue;
    if (row.kind && row.kind !== "STRENGTH") continue;
    if (!validIso(row.occurred_at)) continue;

    const encounterKey = `training:session:${row.id}`;
    const skillExperienceKey = `${encounterKey}:skill:${SKILL_KEY}`;
    const recordedAt = validIso(row.recorded_at)
      ? Date.parse(row.recorded_at)
      : Number.NEGATIVE_INFINITY;

    const encounter: SkillExperienceEncounter = {
      encounterKey,
      skillExperienceKey,
      occurredAt: row.occurred_at,
      source: {
        namespace: "training",
        type: "session",
        id: row.id,
        version: row.version
      }
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

export function buildSkillsProjection(input: {
  training: TrainingStrengthSkillInputRead;
  computedAt: string;
}): SkillsProjection {
  const countCoverage = input.training.count_coverage?.completeness === "COMPLETE"
    ? "COMPLETE"
    : "UNKNOWN";
  const cadenceCoverage = input.training.cadence_coverage?.completeness === "COMPLETE"
    ? "COMPLETE"
    : "UNKNOWN";

  const encounterCount =
    countCoverage === "COMPLETE" && nonNegativeInteger(input.training.eligible_encounter_count)
      ? input.training.eligible_encounter_count
      : null;

  const firstEvidencedAt = validIso(input.training.first_evidenced_at)
    ? input.training.first_evidenced_at
    : null;
  const lastEvidencedAt = validIso(input.training.last_evidenced_at)
    ? input.training.last_evidenced_at
    : null;
  const cadenceSampleCount = nonNegativeInteger(input.training.cadence_sample_count)
    ? input.training.cadence_sample_count
    : 0;
  const typicalIntervalSeconds = positiveFinite(input.training.typical_interval_seconds)
    ? input.training.typical_interval_seconds
    : null;

  const state =
    encounterCount === null ? "UNKNOWN" :
    encounterCount === 0 ? "UNOBSERVED" :
    "OBSERVED";

  const skill: SkillProjection = {
    skillKey: SKILL_KEY,
    label: SKILL_LABEL,
    association: {
      mode: "DETERMINISTIC",
      providerId: PROVIDER_ID
    },
    state,
    experience: {
      unit: "UNIQUE_GOVERNED_ENCOUNTER",
      encounterCount,
      firstEvidencedAt,
      lastEvidencedAt,
      recentEncounters: recentExperienceEncounters(input.training)
    },
    sharpness: buildSharpness({
      computedAt: input.computedAt,
      encounterCount,
      lastEvidencedAt,
      cadenceSampleCount,
      typicalIntervalSeconds,
      countCoverage,
      cadenceCoverage
    }),
    capability: {
      state: "UNKNOWN",
      note: "Skill Experience does not establish Strength Training capability in v0.1."
    },
    mastery: {
      state: "NOT_EVALUATED",
      note: "Mastery requires a future governed depth/reliability/transferability rule."
    },
    epistemicCoverage: input.training.epistemic_coverage?.completeness ?? "UNKNOWN",
    doesNotAssert: [
      "that Skill Experience proves capability",
      "that Sharpness proves capability",
      "that lower Sharpness means learned capability was lost",
      "that encounter count establishes mastery",
      "that unrecorded Strength Training did not occur",
      "that this skill has a numeric level",
      "that one canonical Training session can create more than one Experience contribution to this same skill"
    ]
  };

  return {
    projection_type: "skills",
    rule_version: "skills_v0.1",
    computed_at: input.computedAt,
    configured_skill_count: 1,
    observed_skill_count: state === "OBSERVED" ? 1 : 0,
    skills: [skill],
    does_not_assert: [
      "a universal fixed skill taxonomy",
      "Skill Level",
      "Skill XP points",
      "that Experience, Sharpness, Capability, and Mastery are interchangeable",
      "that absence of recorded skill evidence means zero human ability"
    ]
  };
}
