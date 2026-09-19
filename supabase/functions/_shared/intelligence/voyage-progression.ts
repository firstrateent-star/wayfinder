export interface CanonicalEncounterRef {
  namespace: string;
  type: string;
  id: string;
  version: string;
}

export interface TrainingVoyageProgressionInputRead {
  provider?: string;
  as_of?: string;
  eligible_encounter_count?: number;
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
  epistemic_coverage?: {
    completeness?: "UNKNOWN" | "PARTIAL" | "COMPLETE";
    reason?: string;
  };
}

export interface VoyageEncounter {
  encounterKey: string;
  encounterKind: "TRAINING_STRENGTH_SESSION";
  providerId: "training.strength-session-encounter.v0.1";
  domain: "training";
  xp: 1;
  occurredAt: string;
  label: string | null;
  source: CanonicalEncounterRef;
  doesNotAssert: string[];
}

export interface VoyageProgressionProjection {
  projection_type: "voyage_progression";
  rule_version: "voyage_progression_v0.1";
  computed_at: string;
  state: "AVAILABLE" | "UNKNOWN";
  voyage_xp: number | null;
  encounter_count: number | null;
  xp_unit: "ONE_PER_UNIQUE_CANONICAL_ENCOUNTER";
  configured_providers: Array<{
    id: "training.strength-session-encounter.v0.1";
    domain: "training";
    encounterKind: "TRAINING_STRENGTH_SESSION";
    xpPerEncounter: 1;
    status: "AVAILABLE" | "UNKNOWN";
  }>;
  recent_encounters: VoyageEncounter[];
  count_coverage: "COMPLETE" | "UNKNOWN";
  epistemic_coverage: "UNKNOWN" | "PARTIAL" | "COMPLETE";
  does_not_assert: string[];
}

const TRAINING_PROVIDER_ID = "training.strength-session-encounter.v0.1" as const;
const XP_PER_TRAINING_ENCOUNTER = 1 as const;

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function recentTrainingEncounters(read: TrainingVoyageProgressionInputRead): VoyageEncounter[] {
  const byKey = new Map<string, VoyageEncounter>();

  for (const item of read.recent_encounters ?? []) {
    if (!item?.id?.trim() || !item?.version?.trim()) continue;
    if (item.kind && item.kind !== "STRENGTH") continue;
    if (!validIso(item.occurred_at)) continue;

    const encounterKey = `training:session:${item.id}`;
    const candidate: VoyageEncounter = {
      encounterKey,
      encounterKind: "TRAINING_STRENGTH_SESSION",
      providerId: TRAINING_PROVIDER_ID,
      domain: "training",
      xp: XP_PER_TRAINING_ENCOUNTER,
      occurredAt: item.occurred_at,
      label: item.label?.trim() || null,
      source: {
        namespace: "training",
        type: "session",
        id: item.id,
        version: item.version
      },
      doesNotAssert: [
        "that the number of sets inside this session creates additional Voyage XP",
        "that participation proves Character growth",
        "that this canonical session cannot duplicate another separately recorded description of the same lived workout"
      ]
    };

    const existing = byKey.get(encounterKey);
    if (!existing) {
      byKey.set(encounterKey, candidate);
      continue;
    }

    const candidateRecorded = validIso(item.recorded_at) ? Date.parse(item.recorded_at) : Number.NEGATIVE_INFINITY;
    const existingSourceItem = (read.recent_encounters ?? []).find((row) =>
      row.id === existing.source.id && row.version === existing.source.version
    );
    const existingRecorded = validIso(existingSourceItem?.recorded_at)
      ? Date.parse(existingSourceItem?.recorded_at)
      : Number.NEGATIVE_INFINITY;

    if (candidateRecorded >= existingRecorded) byKey.set(encounterKey, candidate);
  }

  return [...byKey.values()].sort((a, b) =>
    Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
    a.encounterKey.localeCompare(b.encounterKey)
  );
}

export function buildVoyageProgression(input: {
  training: TrainingVoyageProgressionInputRead;
  computedAt: string;
}): VoyageProgressionProjection {
  const countCoverage = input.training.count_coverage?.completeness === "COMPLETE"
    ? "COMPLETE"
    : "UNKNOWN";
  const encounterCount = countCoverage === "COMPLETE" && nonNegativeInteger(input.training.eligible_encounter_count)
    ? input.training.eligible_encounter_count
    : null;
  const state = encounterCount === null ? "UNKNOWN" : "AVAILABLE";
  const epistemicCoverage = input.training.epistemic_coverage?.completeness ?? "UNKNOWN";

  return {
    projection_type: "voyage_progression",
    rule_version: "voyage_progression_v0.1",
    computed_at: input.computedAt,
    state,
    voyage_xp: encounterCount === null ? null : encounterCount * XP_PER_TRAINING_ENCOUNTER,
    encounter_count: encounterCount,
    xp_unit: "ONE_PER_UNIQUE_CANONICAL_ENCOUNTER",
    configured_providers: [{
      id: TRAINING_PROVIDER_ID,
      domain: "training",
      encounterKind: "TRAINING_STRENGTH_SESSION",
      xpPerEncounter: XP_PER_TRAINING_ENCOUNTER,
      status: state
    }],
    recent_encounters: recentTrainingEncounters(input.training),
    count_coverage: countCoverage,
    epistemic_coverage: epistemicCoverage,
    does_not_assert: [
      "that Voyage XP is a Character attribute or capability score",
      "that repeated participation proves growth",
      "that Requirement satisfaction earns Voyage XP",
      "that logging nutrition, plans, schedules, or Direction earns Voyage XP",
      "that currently unconfigured life domains contribute to Voyage XP",
      "that stored canonical encounters cover all meaningful lived experience",
      "that one canonical encounter is worth more because it contains more sets or detail",
      "a permanent XP award ledger",
      "a player level or rank"
    ]
  };
}
