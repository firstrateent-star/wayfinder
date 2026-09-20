export interface CanonicalEncounterRef {
  namespace: string;
  type: string;
  id: string;
  version: string;
}

export interface VoyageProgressionInputRead {
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
    practice_id?: string;
    practice_name?: string;
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

export type TrainingVoyageProgressionInputRead = VoyageProgressionInputRead;
export type PracticeVoyageProgressionInputRead = VoyageProgressionInputRead;

export type VoyageDomain = "training" | "practice";
export type VoyageEncounterKind =
  | "TRAINING_STRENGTH_SESSION"
  | "GOVERNED_PRACTICE_SESSION";

export interface VoyageProgressionProviderInput {
  id: string;
  domain: VoyageDomain;
  encounterKind: VoyageEncounterKind;
  sourceNamespace: VoyageDomain;
  sourceType: "session";
  encounterKeyPrefix: "training:session" | "practice:session";
  requiredKind?: string;
  xpPerEncounter: 1;
  read: VoyageProgressionInputRead;
}

export interface VoyageEncounter {
  encounterKey: string;
  encounterKind: VoyageEncounterKind;
  providerId: string;
  domain: VoyageDomain;
  xp: 1;
  occurredAt: string;
  label: string | null;
  source: CanonicalEncounterRef;
  doesNotAssert: string[];
}

export interface VoyageProgressionProjection {
  projection_type: "voyage_progression";
  rule_version: "voyage_progression_v0.2";
  computed_at: string;
  state: "AVAILABLE" | "UNKNOWN";
  voyage_xp: number | null;
  encounter_count: number | null;
  xp_unit: "ONE_PER_UNIQUE_CANONICAL_ENCOUNTER";
  configured_providers: Array<{
    id: string;
    domain: VoyageDomain;
    encounterKind: VoyageEncounterKind;
    encounterKeyPrefix: string;
    xpPerEncounter: 1;
    encounterCount: number | null;
    status: "AVAILABLE" | "UNKNOWN";
  }>;
  recent_encounters: VoyageEncounter[];
  count_coverage: "COMPLETE" | "UNKNOWN";
  epistemic_coverage: "UNKNOWN" | "PARTIAL" | "COMPLETE";
  does_not_assert: string[];
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function providerEncounterCount(provider: VoyageProgressionProviderInput) {
  const complete = provider.read.count_coverage?.completeness === "COMPLETE";
  return complete && nonNegativeInteger(provider.read.eligible_encounter_count)
    ? provider.read.eligible_encounter_count
    : null;
}

function recentProviderEncounters(
  provider: VoyageProgressionProviderInput
): VoyageEncounter[] {
  const byKey = new Map<string, { encounter: VoyageEncounter; recordedAtMs: number }>();

  for (const item of provider.read.recent_encounters ?? []) {
    if (!item?.id?.trim() || !item?.version?.trim()) continue;
    if (provider.requiredKind && item.kind && item.kind !== provider.requiredKind) continue;
    if (!validIso(item.occurred_at)) continue;

    const encounterKey = `${provider.encounterKeyPrefix}:${item.id}`;
    const label =
      item.practice_name?.trim() ||
      item.label?.trim() ||
      null;

    const encounter: VoyageEncounter = {
      encounterKey,
      encounterKind: provider.encounterKind,
      providerId: provider.id,
      domain: provider.domain,
      xp: 1,
      occurredAt: item.occurred_at,
      label,
      source: {
        namespace: provider.sourceNamespace,
        type: provider.sourceType,
        id: item.id,
        version: item.version
      },
      doesNotAssert: provider.domain === "training"
        ? [
            "that the number of sets inside this session creates additional Voyage XP",
            "that participation proves Character growth",
            "that this canonical Training session cannot duplicate a separately recorded description in another domain"
          ]
        : [
            "that duration or focus detail inside this Practice session creates additional Voyage XP",
            "that Skill Experience proves Capability or Mastery",
            "that this canonical Practice session cannot duplicate a separately recorded description in another domain"
          ]
    };

    const recordedAtMs = validIso(item.recorded_at)
      ? Date.parse(item.recorded_at)
      : Number.NEGATIVE_INFINITY;
    const existing = byKey.get(encounterKey);
    if (!existing || recordedAtMs >= existing.recordedAtMs) {
      byKey.set(encounterKey, { encounter, recordedAtMs });
    }
  }

  return [...byKey.values()]
    .map((value) => value.encounter)
    .sort((a, b) =>
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
      a.encounterKey.localeCompare(b.encounterKey)
    );
}

function combineEpistemicCoverage(
  providers: VoyageProgressionProviderInput[]
): "UNKNOWN" | "PARTIAL" | "COMPLETE" {
  const states = providers.map(
    (provider) => provider.read.epistemic_coverage?.completeness ?? "UNKNOWN"
  );
  if (states.some((state) => state === "UNKNOWN")) return "UNKNOWN";
  if (states.some((state) => state === "PARTIAL")) return "PARTIAL";
  return states.length > 0 ? "COMPLETE" : "UNKNOWN";
}

export function buildVoyageProgression(input: {
  providers: VoyageProgressionProviderInput[];
  computedAt: string;
}): VoyageProgressionProjection {
  if (input.providers.length === 0) {
    return {
      projection_type: "voyage_progression",
      rule_version: "voyage_progression_v0.2",
      computed_at: input.computedAt,
      state: "UNKNOWN",
      voyage_xp: null,
      encounter_count: null,
      xp_unit: "ONE_PER_UNIQUE_CANONICAL_ENCOUNTER",
      configured_providers: [],
      recent_encounters: [],
      count_coverage: "UNKNOWN",
      epistemic_coverage: "UNKNOWN",
      does_not_assert: [
        "that no configured providers means the player has no lived experience",
        "a permanent XP award ledger",
        "a player level or rank"
      ]
    };
  }

  const providerIds = new Set<string>();
  const keyspaces = new Set<string>();

  for (const provider of input.providers) {
    if (providerIds.has(provider.id)) {
      throw new Error("DUPLICATE_VOYAGE_PROVIDER:" + provider.id);
    }
    providerIds.add(provider.id);

    if (keyspaces.has(provider.encounterKeyPrefix)) {
      throw new Error("DUPLICATE_VOYAGE_ENCOUNTER_KEYSPACE:" + provider.encounterKeyPrefix);
    }
    keyspaces.add(provider.encounterKeyPrefix);
  }

  const providerStates = input.providers.map((provider) => {
    const encounterCount = providerEncounterCount(provider);
    return {
      id: provider.id,
      domain: provider.domain,
      encounterKind: provider.encounterKind,
      encounterKeyPrefix: provider.encounterKeyPrefix,
      xpPerEncounter: 1 as const,
      encounterCount,
      status: encounterCount === null ? "UNKNOWN" as const : "AVAILABLE" as const
    };
  });

  const allCountsKnown = providerStates.every((provider) => provider.encounterCount !== null);
  const encounterCount = allCountsKnown
    ? providerStates.reduce((sum, provider) => sum + (provider.encounterCount ?? 0), 0)
    : null;

  const byEncounter = new Map<string, VoyageEncounter>();
  for (const provider of input.providers) {
    for (const encounter of recentProviderEncounters(provider)) {
      const existing = byEncounter.get(encounter.encounterKey);
      if (existing && existing.providerId !== encounter.providerId) {
        throw new Error("VOYAGE_RECENT_ENCOUNTER_PROVIDER_COLLISION:" + encounter.encounterKey);
      }
      byEncounter.set(encounter.encounterKey, encounter);
    }
  }

  const recentEncounters = [...byEncounter.values()].sort((a, b) =>
    Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
    a.encounterKey.localeCompare(b.encounterKey)
  );

  return {
    projection_type: "voyage_progression",
    rule_version: "voyage_progression_v0.2",
    computed_at: input.computedAt,
    state: encounterCount === null ? "UNKNOWN" : "AVAILABLE",
    voyage_xp: encounterCount,
    encounter_count: encounterCount,
    xp_unit: "ONE_PER_UNIQUE_CANONICAL_ENCOUNTER",
    configured_providers: providerStates,
    recent_encounters: recentEncounters,
    count_coverage: allCountsKnown ? "COMPLETE" : "UNKNOWN",
    epistemic_coverage: combineEpistemicCoverage(input.providers),
    does_not_assert: [
      "that Voyage XP is a Character attribute or capability score",
      "that repeated participation proves growth",
      "that Requirement satisfaction earns Voyage XP",
      "that logging nutrition, plans, schedules, or Direction earns Voyage XP",
      "that arbitrary Practice labels earn Voyage XP without a governed qualifying provider",
      "that stored canonical encounters cover all meaningful lived experience",
      "that one canonical encounter is worth more because it contains more detail",
      "that distinct canonical records across different domains never describe the same lived event",
      "a permanent XP award ledger",
      "a player level or rank"
    ]
  };
}

export function trainingVoyageProvider(
  read: TrainingVoyageProgressionInputRead
): VoyageProgressionProviderInput {
  return {
    id: "training.strength-session-encounter.v0.1",
    domain: "training",
    encounterKind: "TRAINING_STRENGTH_SESSION",
    sourceNamespace: "training",
    sourceType: "session",
    encounterKeyPrefix: "training:session",
    requiredKind: "STRENGTH",
    xpPerEncounter: 1,
    read
  };
}

export function practiceVoyageProvider(
  read: PracticeVoyageProgressionInputRead
): VoyageProgressionProviderInput {
  return {
    id: "practice.governed-skill-session-encounter.v0.1",
    domain: "practice",
    encounterKind: "GOVERNED_PRACTICE_SESSION",
    sourceNamespace: "practice",
    sourceType: "session",
    encounterKeyPrefix: "practice:session",
    xpPerEncounter: 1,
    read
  };
}
