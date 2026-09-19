import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import { createNavigatorCanonicalContextProvider } from "../supabase/functions/_shared/intelligence/navigator-canonical-context.ts";
import { SemanticContextProviderRegistry, runReadOnlySemanticLoop } from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import type {
  ContextRequest,
  SemanticReasoner,
  SemanticReasonerInput,
  SemanticReasonerOutput
} from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const source: SourceEnvelope = {
  sourceId: "source-1",
  sourceType: "PLAYER_TEXT",
  content: "test",
  receivedAt: "2026-09-19T18:00:00.000Z",
  interactionIntent: "CONVERSATION",
  authorizesCanonicalWrite: false,
  zoneId: "America/New_York"
};

function request(kind: ContextRequest["kind"], extra: Partial<ContextRequest> = {}): ContextRequest {
  return {
    requestId: crypto.randomUUID(),
    kind,
    purpose: "test",
    ...extra
  };
}

function fixtureRpc() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    calls.push({ name, args });
    if (name === "wf_person_current_v0") {
      return {
        person: {
          ref: { namespace: "person", type: "person", id: "p1", version: "pv1" },
          display_name: "Sean",
          recorded_at: "2026-09-16T00:00:00.000Z"
        }
      } as T;
    }
    if (name === "wf_direction_current") {
      return {
        nodes: [
          {
            id: "d1", version: "dv1", kind: "quest", title: "Ship Wayfinder",
            description: "Move the semantic runtime into the app.",
            intent_state: "ACTIVE", lifecycle_status: "ACTIVE", recorded_at: "2026-09-19T12:00:00.000Z"
          },
          {
            id: "d2", version: "dv2", kind: "action", title: "Old paused thing",
            intent_state: "PAUSED", lifecycle_status: "ACTIVE", recorded_at: "2026-09-18T12:00:00.000Z"
          }
        ],
        record_coverage: { completeness: "COMPLETE" }
      } as T;
    }
    if (name === "wf_schedule_current_v0") {
      return {
        allocations: [
          {
            id: "s1", version: "sv1", label: "Edit wedding film", kind: "HARD", state: "PLANNED",
            starts_at: "2026-09-20T13:00:00.000Z", ends_at: "2026-09-20T15:00:00.000Z",
            zone_id: "America/New_York", recorded_at: "2026-09-19T12:00:00.000Z"
          },
          {
            id: "s2", version: "sv2", label: "Cancelled old plan", kind: "SOFT", state: "CANCELLED",
            starts_at: "2026-09-20T16:00:00.000Z", ends_at: "2026-09-20T17:00:00.000Z",
            zone_id: "America/New_York", recorded_at: "2026-09-19T12:10:00.000Z"
          }
        ],
        result_coverage: { completeness: "COMPLETE" },
        epistemic_coverage: { completeness: "UNKNOWN" }
      } as T;
    }
    if (name === "wf_practice_recent") {
      return {
        sessions: [{
          id: "r1", version: "rv1",
          practice: { id: "practice-running", name: "Running", lifecycle_status: "ACTIVE" },
          occurrence: { from: "2026-09-18T12:00:00.000Z", to: null, from_precision: "INSTANT", zone_id: "America/New_York" },
          duration_seconds: 1800, focus: "easy run"
        }],
        result_coverage: { completeness: "COMPLETE" },
        epistemic_coverage: { completeness: "UNKNOWN" }
      } as T;
    }
    if (name === "wf_training_recent_v0") {
      return {
        sessions: [{
          id: "t1", version: "tv1", kind: "STRENGTH", label: "Strength training",
          occurrence: { from: "2026-09-17T12:00:00.000Z", to: null, precision: "INSTANT", zone_id: "America/New_York" },
          sets: [{ exercise_key: "barbell_bench_press", exercise_label: "Barbell Bench Press", reps: 8, load_value: 185, load_unit: "LB" }]
        }],
        result_coverage: { completeness: "COMPLETE" },
        epistemic_coverage: { completeness: "UNKNOWN" }
      } as T;
    }
    if (name === "wf_nutrition_recent_v0") {
      return {
        intakes: [{
          id: "n1", version: "nv1", kind: "MEAL", label: "Breakfast",
          occurrence: { from: "2026-09-18T12:30:00.000Z", to: null, precision: "INSTANT", zone_id: "America/New_York" },
          nutrition: { calories_kcal: null, calories_precision: null, protein_g: 24, protein_precision: "EXACT", carbs_g: null, carbs_precision: null, fat_g: null, fat_precision: null },
          items: [{ item_label: "three eggs", quantity_value: null, quantity_unit: null, quantity_precision: null }]
        }],
        result_coverage: { completeness: "COMPLETE" },
        epistemic_coverage: { completeness: "UNKNOWN" }
      } as T;
    }
    throw new Error(`Unexpected RPC: ${name}`);
  };
  return { rpc, calls };
}

Deno.test("active direction context excludes paused intent", async () => {
  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({ rpc: fixture.rpc, concepts: createCoreLifeConceptRegistryV0() });
  const result = await provider.resolve(request("ACTIVE_DIRECTION"), { asOf: source.receivedAt, items: [] }, source);
  assert(result.items?.length === 1, "only active direction should be returned");
  assert(result.items[0].summary.includes("Ship Wayfinder"), "active direction title should be grounded");
  assert(!result.items[0].summary.includes("paused"), "paused direction must not leak into active context");
});

Deno.test("schedule context remains explicitly planned and never becomes occurred evidence", async () => {
  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({ rpc: fixture.rpc, concepts: createCoreLifeConceptRegistryV0() });
  const result = await provider.resolve(request("SCHEDULE"), { asOf: source.receivedAt, items: [] }, source);
  const item = result.items?.[0];
  assert(result.items?.length === 1, "cancelled allocations must not enter current planning context");
  assert(item?.kind === "canonical_schedule_allocation", "schedule item should be typed");
  assert(item.summary.includes("Edit wedding film"), "current planned allocation should remain available");
  assert(!item.summary.includes("Cancelled old plan"), "cancelled allocation must be excluded");
  assert(item.occurredAt === undefined, "planned schedule must never expose occurredAt");
  assert(item.attributes?.planned_not_occurred === true, "planned-not-occurred boundary must be explicit");
  assert(item.summary.startsWith("Planned"), "schedule summary must say planned");
});

Deno.test("RUNNING recent-event context selects matching Practice reality and not strength Training", async () => {
  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({ rpc: fixture.rpc, concepts: createCoreLifeConceptRegistryV0() });
  const result = await provider.resolve(
    request("RECENT_EVENTS", { concepts: ["RUNNING"], limit: 8 }),
    { asOf: source.receivedAt, items: [] },
    source
  );
  assert(result.items?.length === 1, "one running context item expected");
  assert(result.items[0].kind === "canonical_practice_session", "running should resolve through Practice when available");
  assert(result.items[0].concepts?.includes("RUNNING"), "running concept should be explicit");
  assert(!fixture.calls.some((call) => call.name === "wf_training_recent_v0"), "RUNNING request must not query strength Training");
});

Deno.test("STRENGTH_TRAINING context returns canonical training session without fabricating exercise detail", async () => {
  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({ rpc: fixture.rpc, concepts: createCoreLifeConceptRegistryV0() });
  const result = await provider.resolve(
    request("RECENT_EVENTS", { concepts: ["STRENGTH_TRAINING"], limit: 8 }),
    { asOf: source.receivedAt, items: [] },
    source
  );
  assert(result.items?.some((item) => item.kind === "canonical_training_session"), "strength session should be returned");
  const training = result.items?.find((item) => item.kind === "canonical_training_session");
  assert(training?.summary.includes("185 LB"), "recorded load should survive context mapping");
  assert(training?.summary.includes("× 8"), "recorded reps should survive context mapping");
});

Deno.test("MEAL recent-event context returns canonical Nutrition without estimated macros", async () => {
  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({ rpc: fixture.rpc, concepts: createCoreLifeConceptRegistryV0() });
  const result = await provider.resolve(
    request("RECENT_EVENTS", { concepts: ["MEAL"], limit: 8 }),
    { asOf: source.receivedAt, items: [] },
    source
  );
  assert(result.items?.length === 1, "one canonical meal expected");
  const intake = result.items[0];
  assert(intake.kind === "canonical_nutrition_intake", "meal history should resolve through Nutrition");
  assert(intake.summary.includes("three eggs"), "recorded food detail should survive");
  assert(intake.summary.includes("24 g protein"), "explicit recorded protein should survive");
  assert(!intake.summary.toLowerCase().includes("calories"), "unknown calories must not be estimated into context");
  assert(fixture.calls.some((call) => call.name === "wf_nutrition_recent_v0"), "Nutrition RPC should supply meal context");
  assert(!fixture.calls.some((call) => call.name === "wf_training_recent_v0"), "MEAL request must not query strength Training");
});

Deno.test("broad DOMAIN_READ without a concept fails closed", async () => {
  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({ rpc: fixture.rpc, concepts: createCoreLifeConceptRegistryV0() });
  const result = await provider.resolve(request("DOMAIN_READ"), { asOf: source.receivedAt, items: [] }, source);
  assert((result.items ?? []).length === 0, "broad domain read must not dump canonical data");
  assert(fixture.calls.length === 0, "broad domain read should make no canonical RPC calls");
  assert(result.notes?.some((note) => note.includes("disabled")), "boundedness should be explicit");
});

Deno.test("LIFE_GRAPH v0.1 is bounded to Person plus active Direction", async () => {
  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({ rpc: fixture.rpc, concepts: createCoreLifeConceptRegistryV0() });
  const result = await provider.resolve(request("LIFE_GRAPH", { limit: 8 }), { asOf: source.receivedAt, items: [] }, source);
  assert(result.items?.length === 2, "bounded graph should include one Person and one active Direction item");
  assert(result.items.some((item) => item.kind === "canonical_person"), "Person identity should be present");
  assert(result.items.some((item) => item.kind === "canonical_active_direction"), "active Direction should be present");
  assert(!fixture.calls.some((call) => call.name === "wf_schedule_current_v0"), "LIFE_GRAPH must not silently widen into Schedule");
  assert(!fixture.calls.some((call) => call.name === "wf_training_recent_v0"), "LIFE_GRAPH must not silently widen into Training");
});


Deno.test("repeat language deterministically retrieves canonical recent activity for a second semantic pass", async () => {
  class RepeatReasoner implements SemanticReasoner {
    readonly id = "navigator-context-repeat";
    readonly version = "0.1";

    propose(input: SemanticReasonerInput): SemanticReasonerOutput {
      const recentRun = input.context.items.find((item) =>
        item.kind === "canonical_practice_session" &&
        item.concepts?.includes("RUNNING")
      );

      return {
        graph: {
          sourceId: input.source.sourceId,
          nodes: [{
            candidateId: "activity",
            nodeType: "EVENT",
            concept: recentRun ? "RUNNING" : "ACTIVITY",
            subject: { kind: "SELF" },
            realityMode: "OCCURRED",
            attributes: recentRun ? {
              repeatedFrom: {
                value: recentRun.summary,
                state: "RESOLVED",
                certainty: "HIGH",
                contextRefs: [recentRun.ref],
                sourceSpans: ["same as yesterday"]
              }
            } : {},
            certainty: "HIGH",
            sourceSpans: ["same as yesterday"]
          }],
          edges: [],
          references: recentRun ? [{
            referenceId: "repeat-ref",
            phrase: "same as yesterday",
            candidateRefs: ["activity"],
            status: "RESOLVED",
            resolvedRef: recentRun.ref,
            certainty: "HIGH"
          }] : [],
          alternateInterpretations: [],
          trace: []
        },
        contextRequests: []
      };
    }
  }

  const fixture = fixtureRpc();
  const provider = createNavigatorCanonicalContextProvider({
    rpc: fixture.rpc,
    concepts: createCoreLifeConceptRegistryV0()
  });
  const providers = new SemanticContextProviderRegistry().register(provider);
  const repeatSource: SourceEnvelope = {
    ...source,
    sourceId: "repeat-source",
    content: "I did basically the same thing as yesterday."
  };

  const result = await runReadOnlySemanticLoop({
    source: repeatSource,
    initialContext: { asOf: repeatSource.receivedAt, items: [] },
    reasoner: new RepeatReasoner(),
    concepts: createCoreLifeConceptRegistryV0(),
    capacity: createWayfinderCapacityV0(),
    providers
  });

  assert(result.reasonerPasses === 2, "repeat cue should force a context-informed second pass");
  assert(result.executedRequests.some((item) => item.kind === "RECENT_EVENTS"), "repeat cue should execute RECENT_EVENTS");
  assert(result.compilation.graph.nodes[0].concept === "RUNNING", "canonical Running history should resolve the broad repeated activity");
  const canonicalRef = result.compilation.graph.references[0]?.resolvedRef ?? "";
  assert(canonicalRef.startsWith("canonical:practice:session:r1@rv1"), "resolution must cite the exact canonical Practice version");
  assert(fixture.calls.some((call) => call.name === "wf_practice_recent"), "canonical Practice read should supply the recent event");
});
