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

export type TrainingStrengthSkillInputRead = SkillExperienceInputRead;
export type PracticeSkillInputRead = SkillExperienceInputRead;

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
  rule_version: "skills_v0.2";
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

function buildSkillProjection(
  provider: SkillExperienceProviderInput,
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
    capability: {
      state: "UNKNOWN",
      note: "Skill Experience does not establish " + provider.label + " capability in skills_v0.2."
    },
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
  computedAt: string;
}): SkillsProjection {
  const seenSkills = new Set<string>();
  const skills = input.providers.map((provider) => {
    if (seenSkills.has(provider.skillKey)) {
      throw new Error("DUPLICATE_SKILL_EXPERIENCE_PROVIDER:" + provider.skillKey);
    }
    seenSkills.add(provider.skillKey);
    return buildSkillProjection(provider, input.computedAt);
  });

  return {
    projection_type: "skills",
    rule_version: "skills_v0.2",
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
