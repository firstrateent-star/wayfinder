import type { CanonicalProjectionRef } from "./requirement-providers.ts";

export type CharacterElement = "FIRE" | "EARTH" | "WATER" | "AIR";
export type CharacterFacet = "Might" | "Craft" | "Vigor" | "Fortune" | "Insight" | "Bond" | "Flow" | "Lore";
export type CharacterEvidenceClass = "EXPOSURE" | "CAPABILITY" | "GROWTH";
export type CharacterSignalState = "EVIDENCED" | "INSUFFICIENT_EVIDENCE";

export interface TrainingCharacterRead {
  sessions?: Array<{
    id: string;
    version: string;
    kind?: string;
    occurrence?: { from?: string; to?: string | null; precision?: string; zone_id?: string };
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
  result_coverage?: { completeness?: "COMPLETE" | "PARTIAL" };
  epistemic_coverage?: { completeness?: "UNKNOWN" | "PARTIAL" | "COMPLETE"; reason?: string };
}

export interface CharacterSignal {
  signalId: string;
  facet: CharacterFacet;
  element: CharacterElement;
  evidenceClass: CharacterEvidenceClass;
  state: CharacterSignalState;
  domain: string;
  summary: string;
  sourceCount: number;
  lineage: CanonicalProjectionRef[];
  doesNotAssert: string[];
}

export interface CharacterFacetProjection {
  facet: CharacterFacet;
  element: CharacterElement;
  state: "EVIDENCED" | "UNOBSERVED";
  exposure: CharacterSignal | null;
  capability: CharacterSignal | null;
  growth: CharacterSignal;
  epistemicCoverage: "UNKNOWN";
}

export interface CharacterProjection {
  projection_type: "character";
  rule_version: "character_v0.1";
  computed_at: string;
  facets: CharacterFacetProjection[];
  evidenced_facets: CharacterFacet[];
  does_not_assert: string[];
}

const facets: Array<{ facet: CharacterFacet; element: CharacterElement }> = [
  { facet: "Might", element: "FIRE" },
  { facet: "Craft", element: "FIRE" },
  { facet: "Vigor", element: "EARTH" },
  { facet: "Fortune", element: "EARTH" },
  { facet: "Insight", element: "WATER" },
  { facet: "Bond", element: "WATER" },
  { facet: "Flow", element: "AIR" },
  { facet: "Lore", element: "AIR" }
];

function trainingMightSignals(read: TrainingCharacterRead): CharacterSignal[] {
  const sessions = (read.sessions ?? []).filter((session) => session.kind === "STRENGTH" || !session.kind);
  const sessionRefs: CanonicalProjectionRef[] = sessions.map((session) => ({
    namespace: "training",
    type: "session",
    id: session.id,
    version: session.version
  }));

  const exposure: CharacterSignal | null = sessions.length
    ? {
        signalId: "character:might:training-exposure",
        facet: "Might",
        element: "FIRE",
        evidenceClass: "EXPOSURE",
        state: "EVIDENCED",
        domain: "training",
        summary: sessions.length + " recorded strength " + (sessions.length === 1 ? "session provides" : "sessions provide") + " Might exposure evidence in the bounded evidence window.",
        sourceCount: sessions.length,
        lineage: sessionRefs,
        doesNotAssert: [
          "that these are all strength sessions performed",
          "that exposure proves strength increased",
          "that activity should award permanent Character points"
        ]
      }
    : null;

  const capabilitySessions = sessions.filter((session) =>
    (session.sets ?? []).some((set) =>
      Number.isFinite(set.reps) && (set.reps as number) > 0 &&
      Number.isFinite(set.load_value) && (set.load_value as number) > 0 &&
      Boolean(set.load_unit)
    )
  );
  const capabilityRefs = capabilitySessions.map((session) => ({
    namespace: "training",
    type: "session",
    id: session.id,
    version: session.version
  }));

  const capability: CharacterSignal | null = capabilitySessions.length
    ? {
        signalId: "character:might:loaded-strength-capability",
        facet: "Might",
        element: "FIRE",
        evidenceClass: "CAPABILITY",
        state: "EVIDENCED",
        domain: "training",
        summary: capabilitySessions.length + " recorded strength " + (capabilitySessions.length === 1 ? "session contains" : "sessions contain") + " structured loaded-repetition evidence that can support future capability comparison.",
        sourceCount: capabilitySessions.length,
        lineage: capabilityRefs,
        doesNotAssert: [
          "that one loaded set defines overall strength",
          "that performances across different exercises are directly comparable",
          "that capability evidence proves growth"
        ]
      }
    : null;

  const growth: CharacterSignal = {
    signalId: "character:might:growth",
    facet: "Might",
    element: "FIRE",
    evidenceClass: "GROWTH",
    state: "INSUFFICIENT_EVIDENCE",
    domain: "training",
    summary: "Might growth is not asserted in Character v0.1. Comparable longitudinal capability evidence and a versioned growth rule are still required.",
    sourceCount: capabilitySessions.length,
    lineage: capabilityRefs,
    doesNotAssert: [
      "that repeated activity alone is growth",
      "that Requirement satisfaction is growth",
      "that XP or a numeric Might score has been earned"
    ]
  };

  return [exposure, capability, growth].filter((value): value is CharacterSignal => Boolean(value));
}

export function buildCharacterProjection(input: {
  training: TrainingCharacterRead;
  computedAt: string;
}): CharacterProjection {
  const signals = trainingMightSignals(input.training);
  const byFacet = new Map<CharacterFacet, CharacterSignal[]>();
  for (const signal of signals) {
    const list = byFacet.get(signal.facet) ?? [];
    list.push(signal);
    byFacet.set(signal.facet, list);
  }

  const projections = facets.map(({ facet, element }): CharacterFacetProjection => {
    const facetSignals = byFacet.get(facet) ?? [];
    const exposure = facetSignals.find((signal) => signal.evidenceClass === "EXPOSURE" && signal.state === "EVIDENCED") ?? null;
    const capability = facetSignals.find((signal) => signal.evidenceClass === "CAPABILITY" && signal.state === "EVIDENCED") ?? null;
    const growth = facetSignals.find((signal) => signal.evidenceClass === "GROWTH") ?? {
      signalId: "character:" + facet.toLowerCase() + ":growth",
      facet,
      element,
      evidenceClass: "GROWTH" as const,
      state: "INSUFFICIENT_EVIDENCE" as const,
      domain: "unconfigured",
      summary: "No governed growth provider exists for " + facet + " yet.",
      sourceCount: 0,
      lineage: [],
      doesNotAssert: ["that absence of a provider means the facet is weak or zero"]
    };

    return {
      facet,
      element,
      state: exposure || capability ? "EVIDENCED" : "UNOBSERVED",
      exposure,
      capability,
      growth,
      epistemicCoverage: "UNKNOWN"
    };
  });

  return {
    projection_type: "character",
    rule_version: "character_v0.1",
    computed_at: input.computedAt,
    facets: projections,
    evidenced_facets: projections.filter((facet) => facet.state === "EVIDENCED").map((facet) => facet.facet),
    does_not_assert: [
      "numeric Character stats",
      "Character XP",
      "permanent growth from activity alone",
      "weakness from missing evidence",
      "that Requirement satisfaction changes permanent Character"
    ]
  };
}
