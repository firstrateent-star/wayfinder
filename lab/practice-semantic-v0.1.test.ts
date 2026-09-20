import {
  practiceAdmissionContract,
  type PracticeSessionCandidatePayload
} from "../supabase/functions/_shared/intelligence/practice-semantic.ts";
import {
  createWayfinderAdmissionPlanningRegistryV0,
  planSemanticAdmission
} from "../supabase/functions/_shared/intelligence/admission-planner.ts";
import {
  authorizeStagedFulfillment,
  createWayfinderFulfillmentRegistryV0,
  fulfillAdmissionPlan
} from "../supabase/functions/_shared/intelligence/admission-fulfillment.ts";
import type {
  CandidateLifeNode,
  SemanticCompilation
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type {
  SemanticCandidate,
  SourceEnvelope
} from "../supabase/functions/_shared/intelligence/semantic-admission.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const source: SourceEnvelope = {
  sourceId: "practice-source",
  sourceType: "PLAYER_TEXT",
  content: "I worked on music production from 2 to 3 PM.",
  receivedAt: "2026-09-19T20:00:00.000Z",
  interactionIntent: "CONVERSATION",
  authorizesCanonicalWrite: false,
  zoneId: "America/New_York"
};

function node(input: Partial<CandidateLifeNode> = {}): CandidateLifeNode {
  return {
    candidateId: "practice-candidate",
    nodeType: "EVENT",
    concept: "MUSIC_PRODUCTION",
    claimType: "PRACTICE_SESSION",
    subject: { kind: "SELF" },
    realityMode: "OCCURRED",
    attributes: {},
    temporal: {
      interval: {
        from: "2026-09-19T18:00:00.000Z",
        to: "2026-09-19T19:00:00.000Z"
      },
      precision: "EXACT",
      certainty: "HIGH"
    },
    certainty: "HIGH",
    sourceSpans: ["worked on music production from 2 to 3 PM"],
    parentConcepts: ["CREATIVE_PRACTICE", "ACTIVITY"],
    ...input
  };
}

function compilationFor(n: CandidateLifeNode): SemanticCompilation {
  return {
    source,
    graph: {
      sourceId: source.sourceId,
      nodes: [n],
      edges: [],
      references: [],
      alternateInterpretations: [],
      trace: []
    },
    contextRequests: [],
    capacity: [{
      candidateId: n.candidateId,
      concept: n.concept,
      supportedFacets: ["RECOGNIZE", "REPRESENT", "PERSIST", "SURFACE"],
      contributingDomains: ["semantic-core", "practice"],
      persistOwners: ["practice"],
      declaredPersistRoutes: [{
        owner: "practice",
        claimType: "PRACTICE_SESSION",
        viaConcept: n.concept
      }],
      missingFacets: ["RESOLVE", "ANALYZE", "PROJECT", "GUIDE"],
      notes: []
    }],
    routing: [{
      candidateId: n.candidateId,
      route: "ROUTE_TO_DOMAIN",
      owner: "practice",
      claimType: "PRACTICE_SESSION",
      reason: "DETERMINISTIC_DECLARED_CLAIM_ROUTE",
      capacity: {
        candidateId: n.candidateId,
        concept: n.concept,
        supportedFacets: ["RECOGNIZE", "REPRESENT", "PERSIST", "SURFACE"],
        contributingDomains: ["semantic-core", "practice"],
        persistOwners: ["practice"],
        declaredPersistRoutes: [{ owner: "practice", claimType: "PRACTICE_SESSION", viaConcept: n.concept }],
        missingFacets: ["RESOLVE", "ANALYZE", "PROJECT", "GUIDE"],
        notes: []
      }
    }],
    validationErrors: []
  };
}

Deno.test("Practice semantic contract requires authorization before canonical write", () => {
  const payload: PracticeSessionCandidatePayload = {
    practiceName: "Music Production",
    occurredFrom: "2026-09-19T18:00:00.000Z",
    occurredTo: "2026-09-19T19:00:00.000Z",
    fromPrecision: "INSTANT",
    toPrecision: "INSTANT",
    zoneId: "America/New_York",
    durationSeconds: 3600
  };
  const candidate: SemanticCandidate<PracticeSessionCandidatePayload> = {
    candidateId: "c",
    claimType: "PRACTICE_SESSION",
    proposedOwner: "practice",
    sourceId: source.sourceId,
    payload
  };

  const decision = practiceAdmissionContract.admit(candidate, {
    now: source.receivedAt,
    source: { ...source, interactionIntent: "RECORD", authorizesCanonicalWrite: false }
  });

  assert(decision.disposition === "NEEDS_AUTHORIZATION", "understood Practice must remain noncanonical before confirmation");
  assert(!decision.command, "no command should exist before authorization");
});

Deno.test("authorized Practice semantic contract lowers to existing idempotent Practice command", () => {
  const payload: PracticeSessionCandidatePayload = {
    practiceName: "Drawing",
    occurredFrom: "2026-09-19T18:00:00.000Z",
    occurredTo: "2026-09-19T18:30:00.000Z",
    fromPrecision: "INSTANT",
    toPrecision: "INSTANT",
    zoneId: "America/New_York",
    durationSeconds: 1800,
    focus: "figure study"
  };
  const candidate: SemanticCandidate<PracticeSessionCandidatePayload> = {
    candidateId: "c",
    claimType: "PRACTICE_SESSION",
    proposedOwner: "practice",
    sourceId: source.sourceId,
    payload
  };

  const decision = practiceAdmissionContract.admit(candidate, {
    now: source.receivedAt,
    source: { ...source, interactionIntent: "RECORD", authorizesCanonicalWrite: true }
  });

  assert(decision.disposition === "ACCEPT", "authorized exact Practice interval should be admissible");
  assert(decision.command?.module === "practice", "Practice owns the write");
  assert(decision.command?.commandType === "practice.capture_session", "existing Practice command should be reused");
  assert(decision.command?.args.p_new_practice_name === "Drawing", "canonical Practice label should remain player/domain grounded");
  assert(decision.command?.args.p_duration_seconds === 1800, "duration should remain exact");
});

Deno.test("planner permits occurred self Practice but not planned or other-person Practice", () => {
  const registry = createWayfinderAdmissionPlanningRegistryV0();

  const occurred = planSemanticAdmission(compilationFor(node()), registry, source.receivedAt);
  assert(occurred.items[0].disposition === "NEEDS_AUTHORIZATION", "occurred self Practice should stage for authorization");

  const plannedNode = node({ realityMode: "PLANNED" });
  const plannedCompilation = compilationFor(plannedNode);
  plannedCompilation.routing[0].capacity = plannedCompilation.capacity[0];
  const planned = planSemanticAdmission(plannedCompilation, registry, source.receivedAt);
  assert(planned.items[0].disposition === "SESSION_ONLY", "planned practice must not become occurred Practice");

  const otherNode = node({ subject: { kind: "KNOWN_OTHER", label: "friend" } });
  const otherCompilation = compilationFor(otherNode);
  otherCompilation.routing[0].capacity = otherCompilation.capacity[0];
  const other = planSemanticAdmission(otherCompilation, registry, source.receivedAt);
  assert(other.items[0].disposition === "SESSION_ONLY", "someone else's Practice must not become player reality");
});

Deno.test("fulfillment stages exact Music Production interval and asks when timing is insufficient", async () => {
  const registry = createWayfinderAdmissionPlanningRegistryV0();
  const fulfillmentRegistry = createWayfinderFulfillmentRegistryV0();

  const exactCompilation = compilationFor(node());
  const exactPlan = planSemanticAdmission(exactCompilation, registry, source.receivedAt);
  const exact = await fulfillAdmissionPlan(exactCompilation, exactPlan, { asOf: source.receivedAt, items: [] }, fulfillmentRegistry);
  assert(exact.items[0].disposition === "READY_FOR_CONFIRMATION", "exact occurred interval should reach confirmation");
  assert(exact.items[0].summary?.includes("Music Production"), "confirmation should name the governed Practice");
  assert((exact.items[0].normalizedPayload as PracticeSessionCandidatePayload).durationSeconds === 3600, "interval should deterministically define duration");

  const vagueNode = node({
    temporal: {
      localDate: "2026-09-19",
      relativeText: "today",
      precision: "RELATIVE",
      certainty: "HIGH"
    }
  });
  const vagueCompilation = compilationFor(vagueNode);
  const vaguePlan = planSemanticAdmission(vagueCompilation, registry, source.receivedAt);
  const vague = await fulfillAdmissionPlan(vagueCompilation, vaguePlan, { asOf: source.receivedAt, items: [] }, fulfillmentRegistry);
  assert(vague.items[0].disposition === "NEEDS_CLARIFICATION", "Practice must not invent a time interval");
  assert(vague.items[0].reason === "PRACTICE_EXACT_OR_APPROXIMATE_INTERVAL_REQUIRED", "timing uncertainty should remain explicit");
});

Deno.test("server-staged Practice confirmation re-runs owning admission with authorization", async () => {
  const decision = await authorizeStagedFulfillment({
    proposalId: "proposal",
    plannerProposalId: "planner-proposal",
    episodeId: "episode",
    turnId: "turn",
    candidateId: "practice-candidate",
    owner: "practice",
    claimType: "PRACTICE_SESSION",
    normalizedPayload: {
      practiceName: "Music Production",
      occurredFrom: "2026-09-19T18:00:00.000Z",
      occurredTo: "2026-09-19T19:00:00.000Z",
      fromPrecision: "INSTANT",
      toPrecision: "INSTANT",
      zoneId: "America/New_York",
      durationSeconds: 3600
    } satisfies PracticeSessionCandidatePayload,
    sourceContext: {
      sourceId: source.sourceId,
      receivedAt: source.receivedAt,
      zoneId: "America/New_York"
    },
    summary: "Music Production — 60 min practice session.",
    commandId: "11111111-1111-4111-8111-111111111111"
  });

  assert(decision.disposition === "ACCEPT", "confirmation should re-run Practice admission authoritatively");
  assert(decision.command?.module === "practice", "authorized command should remain Practice-owned");
  assert(
    decision.command?.args.p_command_id === "11111111-1111-4111-8111-111111111111",
    "server-staged command identity must replace any regenerated command id"
  );
});
