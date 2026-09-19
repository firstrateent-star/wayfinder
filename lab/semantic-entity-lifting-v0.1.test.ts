import {
  liftExplicitPersonParticipants,
  liftExplicitPersonParticipantsInOutput
} from "../supabase/functions/_shared/intelligence/entity-lifting.ts";
import { inferDeterministicContextRequests } from "../supabase/functions/_shared/intelligence/context-needs.ts";
import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import type {
  CandidateLifeGraph,
  SemanticContextBundle,
  SemanticReasonerOutput
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const emptyContext: SemanticContextBundle = {
  asOf: "2026-09-19T13:30:00.000Z",
  items: []
};

Deno.test("explicit co-participant attribute lifts to PERSON node and INVOLVES edge", () => {
  const result = liftExplicitPersonParticipants(sharedRunGraph("Greg"), emptyContext);
  const person = result.nodes.find((node) => node.concept === "PERSON");
  assert(person?.subject.kind === "UNKNOWN_OTHER", "unresolved Greg should remain UNKNOWN_OTHER");
  assert(person?.subject.label === "Greg", "person label should preserve explicit participant");
  assert(result.edges.some((edge) => edge.fromCandidateId === "run" && edge.toCandidateId === person?.candidateId && edge.relation === "INVOLVES"), "run must involve lifted participant");
});

Deno.test("known person context resolves lifted participant without fabricating a new ref", () => {
  const context: SemanticContextBundle = {
    asOf: emptyContext.asOf,
    items: [{ ref: "person:greg", kind: "entity", summary: "Greg is a known work contact.", concepts: ["PERSON"] }]
  };
  const result = liftExplicitPersonParticipants(sharedRunGraph("Greg"), context);
  const person = result.nodes.find((node) => node.concept === "PERSON");
  assert(person?.subject.kind === "KNOWN_OTHER", "known context should resolve participant kind");
  assert(person?.subject.entityRef === "person:greg", "known canonical context ref should be reused");
  assert(!person?.unresolved?.length, "resolved person should not retain identity ambiguity");
});

Deno.test("existing PERSON node is reused rather than duplicated", () => {
  const graph = sharedRunGraph("Greg");
  graph.nodes.push({
    candidateId: "greg",
    nodeType: "ENTITY",
    concept: "PERSON",
    subject: { kind: "UNKNOWN_OTHER", label: "Greg" },
    realityMode: "CURRENT_STATE",
    attributes: {},
    certainty: "HIGH"
  });
  const result = liftExplicitPersonParticipants(graph, emptyContext);
  const people = result.nodes.filter((node) => node.concept === "PERSON");
  assert(people.length === 1, "existing PERSON node should be reused");
  assert(result.edges.some((edge) => edge.toCandidateId === "greg" && edge.relation === "INVOLVES"), "existing person should receive INVOLVES edge");
});

Deno.test("unresolved lifted person creates a bounded KNOWN_ENTITIES context request", () => {
  const output: SemanticReasonerOutput = {
    graph: sharedRunGraph("Greg"),
    contextRequests: []
  };
  const lifted = liftExplicitPersonParticipantsInOutput(output, emptyContext);
  const requests = inferDeterministicContextRequests(source("Greg and I ran two miles together."), lifted.graph, createCoreLifeConceptRegistryV0());
  assert(requests.some((request) => request.kind === "KNOWN_ENTITIES" && request.concepts?.includes("PERSON") && request.query === "Greg"), "unresolved participant should trigger known-person lookup");
});

Deno.test("generic self labels are not lifted into third-party person nodes", () => {
  const result = liftExplicitPersonParticipants(sharedRunGraph("me"), emptyContext);
  assert(!result.nodes.some((node) => node.concept === "PERSON"), "self label should not create UNKNOWN_OTHER");
});

function sharedRunGraph(participant: string): CandidateLifeGraph {
  return {
    sourceId: "shared-run",
    nodes: [{
      candidateId: "run",
      nodeType: "EVENT",
      concept: "RUNNING",
      subject: { kind: "SELF" },
      realityMode: "OCCURRED",
      attributes: {
        distance: { value: 2, state: "RESOLVED", precision: "EXACT", certainty: "HIGH", sourceSpans: ["two miles"] },
        co_participant: { value: participant, state: "PARTIAL", certainty: "HIGH", sourceSpans: [participant] }
      },
      certainty: "HIGH",
      sourceSpans: [`${participant} and I ran two miles together.`],
      unresolved: [{
        code: "PERSON_IDENTITY_UNRESOLVED",
        description: `The specific identity represented by "${participant}" is not resolved from available context.`,
        blocking: false,
        field: "attributes.co_participant"
      }]
    }],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
}

function source(content: string): SourceEnvelope {
  return {
    sourceId: "entity-lifting-test",
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: emptyContext.asOf,
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}
