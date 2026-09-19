import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  compileLifeExpression,
  toAdmissionCandidateGraph,
  validateCandidateLifeGraph,
  type CandidateLifeGraph,
  type CandidateLifeNode,
  type SemanticContextBundle,
  type SemanticReasoner,
  type SemanticReasonerOutput
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(content: string): SourceEnvelope {
  return {
    sourceId: `source:${content}`,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-17T18:00:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}

function node(
  id: string,
  concept: string,
  realityMode: CandidateLifeNode["realityMode"],
  extras: Partial<CandidateLifeNode> = {}
): CandidateLifeNode {
  return {
    candidateId: id,
    nodeType: "EVENT",
    concept,
    subject: { kind: "SELF" },
    realityMode,
    attributes: {},
    certainty: "HIGH",
    ...extras
  };
}

function graph(sourceId: string, nodes: CandidateLifeNode[], extras: Partial<CandidateLifeGraph> = {}): CandidateLifeGraph {
  return {
    sourceId,
    nodes,
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: [],
    ...extras
  };
}

class FixtureReasoner implements SemanticReasoner {
  id = "fixture-semantic-reasoner";
  version = "0.1";
  constructor(private readonly fixtures: Record<string, (sourceId: string) => SemanticReasonerOutput>) {}
  propose(input: { source: SourceEnvelope }): SemanticReasonerOutput {
    const fixture = this.fixtures[input.source.content];
    if (!fixture) throw new Error(`MISSING_FIXTURE:${input.source.content}`);
    return fixture(input.source.sourceId);
  }
}

const context: SemanticContextBundle = {
  asOf: "2026-09-17T18:00:00.000Z",
  items: [
    { ref: "training:run:yesterday", kind: "event", summary: "Yesterday run, 2.0 miles", concepts: ["RUNNING"], occurredAt: "2026-09-16T22:00:00.000Z", attributes: { distance_miles: 2 } },
    { ref: "person:greg", kind: "entity", summary: "Greg", concepts: ["PERSON"] },
    { ref: "project:install:current", kind: "entity", summary: "Current Stage Presence install", concepts: ["PROJECT"] }
  ],
  personalAliases: [{ phrase: "Stage", targetRef: "work:stage-presence", contextHint: "work/company", strength: "HIGH" }]
};

const fixtures: Record<string, (sourceId: string) => SemanticReasonerOutput> = {
  "I ran today.": (sourceId) => ({
    graph: graph(sourceId, [node("run", "RUNNING", "OCCURRED", { claimType: "TRAINING_RUN_SESSION" })])
  }),
  "John ran today.": (sourceId) => ({
    graph: graph(sourceId, [node("run", "RUNNING", "REPORTED_ABOUT_OTHER", { subject: { kind: "KNOWN_OTHER", entityRef: "person:john", label: "John" } })])
  }),
  "I might run today.": (sourceId) => ({ graph: graph(sourceId, [node("run", "RUNNING", "POSSIBLE")]) }),
  "I didn't run today.": (sourceId) => ({ graph: graph(sourceId, [node("run", "RUNNING", "NEGATED")]) }),
  "I worked out today.": (sourceId) => ({
    graph: graph(sourceId, [node("training", "STRENGTH_TRAINING", "OCCURRED", { claimType: "TRAINING_STRENGTH_SESSION", proposedOwners: ["training"] })])
  }),
  "I was gonna work out but felt like crap so I just walked.": (sourceId) => ({
    graph: graph(sourceId, [
      node("plan", "STRENGTH_TRAINING", "INTENDED", { nodeType: "INTENTION" }),
      node("negated-workout", "STRENGTH_TRAINING", "NEGATED"),
      node("state", "ENERGY_STATE", "CURRENT_STATE", { nodeType: "STATE", attributes: { valence: { value: "poor", state: "RESOLVED", certainty: "MEDIUM", sourceSpans: ["felt like crap"] } } }),
      node("walk", "WALKING", "OCCURRED")
    ], {
      edges: [
        { edgeId: "negates", fromCandidateId: "negated-workout", relation: "NEGATES", toCandidateId: "plan", certainty: "HIGH" },
        { edgeId: "contrast", fromCandidateId: "walk", relation: "CONTRASTS_WITH", toCandidateId: "plan", certainty: "HIGH" },
        { edgeId: "related", fromCandidateId: "state", relation: "RELATED_TO", toCandidateId: "walk", certainty: "MEDIUM" }
      ]
    })
  }),
  "Greg called again and now I'm stressed about that install.": (sourceId) => ({
    graph: graph(sourceId, [
      node("call", "COMMUNICATION", "OCCURRED", { attributes: { other: { value: "person:greg", state: "RESOLVED", certainty: "HIGH", contextRefs: ["person:greg"] } } }),
      node("stress", "EMOTIONAL_STATE", "CURRENT_STATE", { nodeType: "STATE", attributes: { label: { value: "stressed", state: "RESOLVED", certainty: "HIGH" } } }),
      node("install-ref", "PROJECT", "CURRENT_STATE", { nodeType: "REFERENCE", certainty: "MEDIUM", unresolved: [{ code: "PROJECT_REFERENCE_AMBIGUOUS", description: "that install may refer to the current install but is not confirmed", blocking: false }] })
    ], {
      edges: [
        { edgeId: "about", fromCandidateId: "stress", relation: "ABOUT", toCandidateId: "install-ref", certainty: "HIGH" },
        { edgeId: "after", fromCandidateId: "stress", relation: "AFTER", toCandidateId: "call", certainty: "MEDIUM" }
      ],
      references: [{ referenceId: "that-install", phrase: "that install", candidateRefs: ["project:install:current"], status: "PARTIAL", certainty: "MEDIUM" }]
    })
  }),
  "Had my usual breakfast.": (sourceId) => ({
    graph: graph(sourceId, [node("meal", "MEAL", "OCCURRED", { attributes: { pattern: { value: "usual breakfast", state: "UNRESOLVED", precision: "RELATIVE", certainty: "HIGH" } }, unresolved: [{ code: "USUAL_MEAL_REFERENCE", description: "resolve against personal breakfast history", blocking: false }] })]),
    contextRequests: [{ requestId: "breakfast-history", kind: "DOMAIN_READ", concepts: ["MEAL"], purpose: "Resolve the player's usual breakfast from recent repeated meals.", limit: 10 }]
  }),
  "I think I spent like 40 bucks on gas.": (sourceId) => ({
    graph: graph(sourceId, [node("expense", "EXPENSE", "OCCURRED", { attributes: { amount: { value: 40, state: "PARTIAL", precision: "APPROXIMATE", certainty: "MEDIUM", sourceSpans: ["like 40 bucks"] }, category: { value: "fuel", state: "RESOLVED", certainty: "HIGH", sourceSpans: ["gas"] } } })])
  }),
  "Actually that was Tuesday, not yesterday.": (sourceId) => ({
    graph: graph(sourceId, [node("correction", "ACTIVITY", "CORRECTION", { nodeType: "CLAIM", attributes: { corrected_day: { value: "Tuesday", state: "RESOLVED", certainty: "HIGH" }, rejected_day: { value: "yesterday", state: "RESOLVED", certainty: "HIGH" } }, unresolved: [{ code: "CORRECTION_TARGET_REQUIRED", description: "The prior claim being corrected must be resolved from the episode.", blocking: true }] })])
  }),
  "I killed it today.": (sourceId) => ({
    graph: graph(sourceId, [node("success", "ACTIVITY", "REFLECTION", { nodeType: "REFLECTION", certainty: "MEDIUM", unresolved: [{ code: "DOMAIN_CONTEXT_REQUIRED", description: "Could refer to training, work, or another activity.", blocking: true }] })], {
      alternateInterpretations: [
        { interpretationId: "training-success", summary: "Strong workout performance", affectedCandidateIds: ["success"], certainty: "MEDIUM" },
        { interpretationId: "work-success", summary: "Strong work performance", affectedCandidateIds: ["success"], certainty: "MEDIUM" }
      ]
    })
  }),
  "Ran about two-ish after work. Felt a lot better.": (sourceId) => ({
    graph: graph(sourceId, [
      node("run", "RUNNING", "OCCURRED", { attributes: { distance: { value: 2, state: "PARTIAL", precision: "APPROXIMATE", certainty: "MEDIUM", sourceSpans: ["two-ish"] }, unit: { state: "UNRESOLVED", precision: "UNKNOWN", certainty: "UNKNOWN" } }, temporal: { relationToNodeId: "work", relation: "AFTER", precision: "RELATIVE", certainty: "HIGH" } }),
      node("work", "WORK_ACTIVITY", "OCCURRED"),
      node("better", "EMOTIONAL_STATE", "CURRENT_STATE", { nodeType: "STATE", attributes: { change: { value: "improved", state: "RESOLVED", certainty: "HIGH" } } })
    ], {
      edges: [
        { edgeId: "run-after-work", fromCandidateId: "run", relation: "AFTER", toCandidateId: "work", certainty: "HIGH" },
        { edgeId: "better-after-run", fromCandidateId: "better", relation: "AFTER", toCandidateId: "run", certainty: "HIGH" }
      ]
    })
  }),
  "Worked late, ran about two miles after, grabbed Chipotle, and felt way less stressed by the time I got home.": (sourceId) => ({
    graph: graph(sourceId, [
      node("work", "WORK_ACTIVITY", "OCCURRED"),
      node("run", "RUNNING", "OCCURRED", { attributes: { distance: { value: 2, state: "PARTIAL", precision: "APPROXIMATE", certainty: "HIGH" }, unit: { value: "MILE", state: "RESOLVED", precision: "EXACT", certainty: "HIGH" } } }),
      node("meal", "MEAL", "OCCURRED", { attributes: { merchant: { value: "Chipotle", state: "RESOLVED", certainty: "HIGH" } } }),
      node("stress", "EMOTIONAL_STATE", "CURRENT_STATE", { nodeType: "STATE", attributes: { change: { value: "decreased", state: "RESOLVED", certainty: "HIGH" } } })
    ], {
      edges: [
        { edgeId: "work-run", fromCandidateId: "run", relation: "AFTER", toCandidateId: "work", certainty: "HIGH" },
        { edgeId: "run-meal", fromCandidateId: "meal", relation: "AFTER", toCandidateId: "run", certainty: "HIGH" },
        { edgeId: "stress-after", fromCandidateId: "stress", relation: "AFTER", toCandidateId: "meal", certainty: "MEDIUM" }
      ]
    })
  }),
  "I went wing foiling.": (sourceId) => ({
    graph: graph(sourceId, [node("wing-foil", "WING_FOILING", "OCCURRED", { parentConcepts: ["PHYSICAL_ACTIVITY", "ACTIVITY"], certainty: "HIGH" })])
  }),
  "Did basically the same thing as yesterday but a little longer.": (sourceId) => ({
    graph: graph(sourceId, [node("run", "RUNNING", "OCCURRED", { attributes: { comparison: { value: "greater_than_previous", state: "PARTIAL", precision: "RELATIVE", certainty: "HIGH", contextRefs: ["training:run:yesterday"] }, comparison_dimension: { state: "UNRESOLVED", precision: "UNKNOWN", certainty: "MEDIUM" } }, unresolved: [{ code: "COMPARISON_DIMENSION_AMBIGUOUS", description: "longer could mean duration or distance", blocking: false }] })], {
      references: [{ referenceId: "yesterday-event", phrase: "same thing as yesterday", candidateRefs: ["training:run:yesterday"], status: "RESOLVED", resolvedRef: "training:run:yesterday", certainty: "HIGH" }]
    })
  })
};

const reasoner = new FixtureReasoner(fixtures);
const concepts = createCoreLifeConceptRegistryV0();
const capacity = createWayfinderCapacityV0();

async function compile(text: string) {
  return await compileLifeExpression({ source: source(text), context, reasoner, concepts, capacity });
}

Deno.test("run is understood even though current Wayfinder cannot canonically persist running yet", async () => {
  const result = await compile("I ran today.");
  assert(result.validationErrors.length === 0, "graph should be valid");
  assert(result.graph.nodes[0].realityMode === "OCCURRED", "run occurrence must be preserved");
  assert(result.capacity[0].supportedFacets.includes("RECOGNIZE"), "Wayfinder should recognize running");
  assert(!result.capacity[0].supportedFacets.includes("PERSIST"), "running must not pretend canonical persistence exists");
  assert(result.routing[0].route === "SESSION_ONLY", "understood-but-unsupported reality should remain session-only");
});

Deno.test("third-party activity preserves subject and cannot become player reality", async () => {
  const result = await compile("John ran today.");
  assert(result.graph.nodes[0].subject.kind === "KNOWN_OTHER", "John must remain the subject");
  assert(result.graph.nodes[0].realityMode === "REPORTED_ABOUT_OTHER", "third-party report mode must be explicit");
});

Deno.test("possible future activity is not treated as occurrence", async () => {
  const result = await compile("I might run today.");
  assert(result.graph.nodes[0].realityMode === "POSSIBLE", "possibility must remain possibility");
  assert(result.routing[0].route === "SESSION_ONLY", "possible event must not route to canonical occurrence");
});

Deno.test("negation survives semantic compilation", async () => {
  const result = await compile("I didn't run today.");
  assert(result.graph.nodes[0].realityMode === "NEGATED", "negation must not invert into a run occurrence");
});

Deno.test("current strength Training capacity can route a supported canonical claim to Training", async () => {
  const result = await compile("I worked out today.");
  assert(result.capacity[0].persistOwners.length === 1 && result.capacity[0].persistOwners[0] === "training", "Training should be the only persistence owner");
  assert(result.routing[0].route === "ROUTE_TO_DOMAIN", "supported Training reality should route to domain admission");
});

Deno.test("mixed plan, negation, subjective state and walk remain distinct semantic nodes", async () => {
  const result = await compile("I was gonna work out but felt like crap so I just walked.");
  assert(result.graph.nodes.length === 4, "expected four distinct semantic nodes");
  assert(result.graph.nodes.some((item) => item.realityMode === "NEGATED" && item.concept === "STRENGTH_TRAINING"), "planned workout non-occurrence must be represented");
  assert(result.graph.nodes.some((item) => item.concept === "WALKING" && item.realityMode === "OCCURRED"), "walk occurrence must be represented");
  assert(result.graph.edges.some((edge) => edge.relation === "CONTRASTS_WITH"), "plan substitution relation must survive");
});

Deno.test("Greg/install/stress sentence preserves unresolved reference instead of inventing project identity", async () => {
  const result = await compile("Greg called again and now I'm stressed about that install.");
  assert(result.graph.references[0].status === "PARTIAL", "install reference should remain partial");
  assert(!result.graph.references[0].resolvedRef, "install identity must not be fabricated");
  assert(result.graph.edges.some((edge) => edge.relation === "ABOUT"), "stress-about-install relation should be represented");
});

Deno.test("usual breakfast requests bounded personal context instead of inventing food", async () => {
  const result = await compile("Had my usual breakfast.");
  assert(result.contextRequests.some((item) => item.kind === "DOMAIN_READ"), "usual meal should request personal meal history");
  assert(result.graph.nodes[0].attributes.pattern.state === "UNRESOLVED", "meal identity must remain unresolved until context resolves it");
});

Deno.test("approximate expense preserves approximation and current Finance capacity gap", async () => {
  const result = await compile("I think I spent like 40 bucks on gas.");
  assert(result.graph.nodes[0].attributes.amount.precision === "APPROXIMATE", "approximate amount must not be silently exact");
  assert(!result.capacity[0].supportedFacets.includes("PERSIST"), "Finance is not a live canonical Wayfinder domain yet");
});

Deno.test("correction with unresolved target must clarify rather than duplicate reality", async () => {
  const result = await compile("Actually that was Tuesday, not yesterday.");
  assert(result.graph.nodes[0].realityMode === "CORRECTION", "correction mode must be explicit");
  assert(result.routing[0].route === "CLARIFY", "unresolved correction target must block routing");
});

Deno.test("ambiguous success retains alternate interpretations", async () => {
  const result = await compile("I killed it today.");
  assert(result.graph.alternateInterpretations.length === 2, "ambiguous colloquial success should retain alternatives");
  assert(result.routing[0].route === "CLARIFY", "domain ambiguity should create clarification opportunity");
});

Deno.test("relative run statement preserves unresolved units and event-state chronology", async () => {
  const result = await compile("Ran about two-ish after work. Felt a lot better.");
  const run = result.graph.nodes.find((item) => item.candidateId === "run")!;
  assert(run.attributes.distance.precision === "APPROXIMATE", "two-ish must remain approximate");
  assert(run.attributes.unit.state === "UNRESOLVED", "distance unit must not be guessed");
  assert(result.graph.edges.some((edge) => edge.edgeId === "better-after-run"), "reported improvement chronology should survive");
});

Deno.test("one natural utterance can produce a cross-domain candidate life graph", async () => {
  const result = await compile("Worked late, ran about two miles after, grabbed Chipotle, and felt way less stressed by the time I got home.");
  const conceptsSeen = new Set(result.graph.nodes.map((item) => item.concept));
  assert(conceptsSeen.has("WORK_ACTIVITY") && conceptsSeen.has("RUNNING") && conceptsSeen.has("FOOD_ACQUISITION") && conceptsSeen.has("EMOTIONAL_STATE"), "multi-domain meaning should decompose before ownership without upgrading food acquisition into consumption");
  assert(result.graph.edges.length >= 3, "cross-domain chronology should be represented relationally");
});

Deno.test("unknown leaf concept can inherit broad physical-activity capacity without becoming a fake known concept", async () => {
  const result = await compile("I went wing foiling.");
  assert(!concepts.get("WING_FOILING"), "specific concept should remain absent from current registry");
  assert(result.capacity[0].supportedFacets.includes("RECOGNIZE"), "parent physical-activity capacity should still apply");
  assert(result.routing[0].route === "SESSION_ONLY", "unknown leaf should not create a canonical write");
});

Deno.test("resolved yesterday reference does not force an exact interpretation of 'longer'", async () => {
  const result = await compile("Did basically the same thing as yesterday but a little longer.");
  assert(result.graph.references[0].status === "RESOLVED", "yesterday run reference should resolve from context");
  assert(result.graph.nodes[0].attributes.comparison_dimension.state === "UNRESOLVED", "longer dimension must remain unresolved");
  assert(result.routing[0].route === "SESSION_ONLY", "non-blocking optional ambiguity should not force interrogation when persistence is unavailable anyway");
});

Deno.test("Candidate Life Graph validator rejects dangling relations", () => {
  const bad = graph("source", [node("run", "RUNNING", "OCCURRED")], {
    edges: [{ edgeId: "dangling", fromCandidateId: "run", relation: "AFTER", toCandidateId: "missing", certainty: "HIGH" }]
  });
  const errors = validateCandidateLifeGraph(bad);
  assert(errors.some((item) => item.startsWith("EDGE_TARGET_MISSING")), "dangling graph edge must be rejected");
});

Deno.test("Candidate Life Graph can lower supported claim nodes into the existing Semantic Admission graph", async () => {
  const result = await compile("I worked out today.");
  const admission = toAdmissionCandidateGraph(result.graph);
  assert(admission.candidates.length === 1, "supported claim should lower into one admission candidate");
  assert(admission.candidates[0].claimType === "TRAINING_STRENGTH_SESSION", "claim type must survive compiler-to-admission seam");
  assert(admission.candidates[0].proposedOwner === "training", "proposed owner must survive lowering");
});
