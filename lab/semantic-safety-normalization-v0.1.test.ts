import {
  applySemanticSafetyNormalization,
  downgradeSarcasmRisk,
  normalizeFoodAcquisitionVsConsumption,
  normalizeInlineCorrections,
  preserveExplicitClauseFinalChronology
} from "../supabase/functions/_shared/intelligence/semantic-safety-normalization.ts";
import type { CandidateLifeGraph, CandidateLifeNode, SemanticReasonerOutput } from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("reasoner-flagged sarcasm cannot remain an OCCURRED canonical-looking event", () => {
  const graph = baseGraph([{
    ...event("workout", "STRENGTH_TRAINING", "OCCURRED"),
    unresolved: [{
      code: "POSSIBLE_SARCASM_OR_CONTRAST",
      description: "The phrase may be sarcastic given the couch statement.",
      blocking: false
    }]
  }]);
  const result = downgradeSarcasmRisk(graph);
  assert(result.nodes[0].realityMode === "POSSIBLE", "sarcasm-risk occurrence must downgrade to POSSIBLE");
  assert(result.nodes[0].unresolved?.[0].blocking === true, "sarcasm ambiguity must block admission");
});

Deno.test("inline temporal self-correction prevents duplicate independent occurrences", () => {
  const graph = baseGraph([
    { ...event("monday", "RUNNING", "OCCURRED"), sourceSpans: ["I ran Monday"] },
    { ...event("tuesday", "RUNNING", "OCCURRED"), sourceSpans: ["Tuesday"] }
  ]);
  const result = normalizeInlineCorrections(graph, "I ran Monday — actually, Tuesday.");
  const runs = result.nodes.filter((node) => node.concept === "RUNNING");
  assert(runs.some((node) => node.realityMode === "CORRECTION"), "earlier competing event should be marked CORRECTION");
  assert(runs.filter((node) => node.realityMode === "OCCURRED").length === 1, "only final corrected event should remain OCCURRED");
  assert(result.edges.some((edge) => edge.relation === "CORRECTS"), "correction relationship should be explicit");
});

Deno.test("leading correction fragment does not become a fresh occurrence", () => {
  const output: SemanticReasonerOutput = {
    graph: baseGraph([event("distance-fix", "RUNNING", "OCCURRED")]),
    contextRequests: []
  };
  const result = applySemanticSafetyNormalization(output, source("Actually it was three miles, not two."));
  assert(result.graph.nodes[0].realityMode === "CORRECTION", "leading correction should not remain OCCURRED");
  assert(result.graph.nodes[0].unresolved?.some((item) => item.code === "CORRECTION_TARGET_UNRESOLVED"), "unresolved prior target should be explicit");
});

Deno.test("inline correction emitted as only final event still retains correction semantics", () => {
  const graph = baseGraph([{ ...event("tuesday", "RUNNING", "OCCURRED"), sourceSpans: ["Tuesday"] }]);
  const result = normalizeInlineCorrections(graph, "I ran Monday — actually, Tuesday.");
  assert(result.nodes.some((node) => node.realityMode === "CORRECTION"), "correction claim should be synthesized");
  assert(result.edges.some((edge) => edge.relation === "CORRECTS"), "synthesized correction should connect to final event");
});

Deno.test("explicit clause-final after chronology is preserved between adjacent grounded events", () => {
  const graph = baseGraph([
    { ...event("work", "WORK_ACTIVITY", "OCCURRED"), sourceSpans: ["Worked late"] },
    { ...event("run", "RUNNING", "OCCURRED"), sourceSpans: ["ran about two miles"] },
    { ...event("food", "FOOD_ACQUISITION", "OCCURRED"), sourceSpans: ["grabbed Chipotle"] }
  ]);
  const result = preserveExplicitClauseFinalChronology(
    graph,
    "Worked late, ran about two miles after, grabbed Chipotle."
  );
  assert(
    result.edges.some((edge) =>
      edge.fromCandidateId === "run" &&
      edge.toCandidateId === "work" &&
      edge.relation === "AFTER"
    ),
    "clause-final 'after' should preserve RUNNING AFTER WORK_ACTIVITY"
  );
  assert(
    !result.edges.some((edge) => edge.fromCandidateId === "food"),
    "later listed food acquisition must not receive invented chronology"
  );
});

Deno.test("food acquisition language cannot silently become consumed nutrition", () => {
  const node = {
    ...event("food", "FOOD_INTAKE", "OCCURRED"),
    claimType: "nutrition.intake.recorded",
    proposedOwners: ["nutrition"],
    unresolved: [{
      code: "CONSUMPTION_UNCLEAR",
      description: "Grabbing food does not establish that it was eaten.",
      blocking: false,
      field: "consumption"
    }]
  };
  const result = normalizeFoodAcquisitionVsConsumption(baseGraph([node]), "I grabbed Chipotle after the run.");
  assert(result.nodes[0].concept === "FOOD_ACQUISITION", "unproven consumption should reduce to FOOD_ACQUISITION");
  assert(!result.nodes[0].claimType, "nutrition claim type should be removed when consumption is not established");
  assert(!(result.nodes[0].proposedOwners?.length), "canonical nutrition owner should be removed when consumption is not established");
  assert(result.nodes[0].parentConcepts?.includes("FOOD_EVENT"), "food acquisition should retain its broader food-event class");
});

Deno.test("explicit eating prevents acquisition-only downgrade", () => {
  const graph = baseGraph([event("food", "MEAL", "OCCURRED")]);
  const result = normalizeFoodAcquisitionVsConsumption(graph, "I grabbed Chipotle and ate it after the run.");
  assert(result.nodes[0].concept === "MEAL", "explicit consumption should remain consumptive meaning");
});

function event(id: string, concept: string, realityMode: CandidateLifeNode["realityMode"]): CandidateLifeNode {
  return {
    candidateId: id,
    nodeType: "EVENT",
    concept,
    subject: { kind: "SELF" },
    realityMode,
    attributes: {},
    certainty: "HIGH",
    sourceSpans: [id]
  };
}

function baseGraph(nodes: CandidateLifeNode[]): CandidateLifeGraph {
  return {
    sourceId: "test",
    nodes,
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
}

function source(content: string): SourceEnvelope {
  return {
    sourceId: "test-source",
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-19T14:00:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}
