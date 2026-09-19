import type { CanonicalProjectionRef } from "./requirement-providers.ts";
import {
  evaluateMightGrowth,
  type MightGrowthTrainingRead
} from "./might-growth.ts";

export type CharacterElement = "FIRE" | "EARTH" | "WATER" | "AIR";
export type CharacterFacet = "Might" | "Craft" | "Vigor" | "Fortune" | "Insight" | "Bond" | "Flow" | "Lore";
export type CharacterEvidenceClass = "EXPOSURE" | "CAPABILITY" | "GROWTH";
export type CharacterSignalState = "EVIDENCED" | "INSUFFICIENT_EVIDENCE";

export interface TrainingCharacterRead extends MightGrowthTrainingRead {
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
  rule_version: "character_v0.2";
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

function uniqueRefs(refs: CanonicalProjectionRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = [ref.namespace, ref.type, ref.id, ref.version].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
      (set.load_unit === "LB" || set.load_unit === "KG")
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
        summary: capabilitySessions.length + " recorded strength " + (capabilitySessions.length === 1 ? "session contains" : "sessions contain") + " structured loaded-repetition evidence that can support exercise-specific capability comparison.",
        sourceCount: capabilitySessions.length,
        lineage: capabilityRefs,
        doesNotAssert: [
          "that one loaded set defines overall strength",
          "that performances across different exercises are directly comparable",
          "that capability evidence by itself proves growth"
        ]
      }
    : null;

  const growthEvaluation = evaluateMightGrowth(read);
  const growthRefs = uniqueRefs(growthEvaluation.proofs.flatMap((proof) => [
    ...proof.baselineSessions.map((session) => ({
      namespace: "training",
      type: "session",
      id: session.sessionId,
      version: session.sessionVersion
    })),
    {
      namespace: "training",
      type: "session",
      id: proof.candidate.sessionId,
      version: proof.candidate.sessionVersion
    },
    {
      namespace: "training",
      type: "session",
      id: proof.confirmation.sessionId,
      version: proof.confirmation.sessionVersion
    }
  ]));
  const growthExerciseLabels = [...new Set(growthEvaluation.proofs.map((proof) => proof.exerciseLabel))];

  const growth: CharacterSignal = growthEvaluation.state === "EVIDENCED"
    ? {
        signalId: "character:might:growth",
        facet: "Might",
        element: "FIRE",
        evidenceClass: "GROWTH",
        state: "EVIDENCED",
        domain: "training",
        summary:
          "Recorded " +
          growthExerciseLabels.join(", ") +
          " capability expanded beyond an earlier two-session performance frontier and was independently repeated in a later session. This is bounded exercise-specific Might growth evidence.",
        sourceCount: growthRefs.length,
        lineage: growthRefs,
        doesNotAssert: growthEvaluation.doesNotAssert
      }
    : {
        signalId: "character:might:growth",
        facet: "Might",
        element: "FIRE",
        evidenceClass: "GROWTH",
        state: "INSUFFICIENT_EVIDENCE",
        domain: "training",
        summary:
          "Might growth is not established in the current evidence window. Character v0.2 requires a same-exercise two-session baseline plus two later independently recorded Pareto-frontier expansions under might_growth_v0.1.",
        sourceCount: growthEvaluation.comparableObservationCount,
        lineage: capabilityRefs,
        doesNotAssert: [
          "that repeated activity alone is growth",
          "that Requirement satisfaction is growth",
          "that a single personal record is durable growth",
          ...growthEvaluation.doesNotAssert
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
    rule_version: "character_v0.2",
    computed_at: input.computedAt,
    facets: projections,
    evidenced_facets: projections.filter((facet) => facet.state === "EVIDENCED").map((facet) => facet.facet),
    does_not_assert: [
      "numeric Character stats",
      "Character XP",
      "whole-person growth from one exercise-specific signal",
      "weakness from missing evidence",
      "that Requirement satisfaction changes permanent Character"
    ]
  };
}
