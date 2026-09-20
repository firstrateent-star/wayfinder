import { buildRequirementsProjection, type RequirementInputRead } from "../supabase/functions/_shared/intelligence/requirement-providers.ts";
import { buildCharacterProjection, type TrainingCharacterRead } from "../supabase/functions/_shared/intelligence/character-projection.ts";
import { createWayfinderProjectionProviderRegistryV0 } from "../supabase/functions/_shared/intelligence/projection-provider-registry.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const evaluatedAt = "2026-09-19T18:00:00.000Z";

function proteinRead(value: number | null, target = 150, coverage: "COMPLETE" | "PARTIAL" | "UNKNOWN" = "UNKNOWN"): RequirementInputRead {
  return {
    standard: { namespace: "nutrition", type: "standard", id: "n-standard", version: "n-v1" },
    spec: {
      requirementKey: "nutrition.protein.daily",
      domain: "nutrition",
      metric: "protein_g",
      unit: "g",
      rule: "AT_LEAST",
      target,
      aggregation: "MONOTONIC_ACCUMULATING",
      scope: {
        startsAt: "2026-09-19T04:00:00.000Z",
        endsAt: "2026-09-20T04:00:00.000Z",
        zoneId: "America/New_York",
        intervalSemantics: "[start,end)",
        recurrenceKey: "2026-09-19"
      }
    },
    observation: {
      value,
      coverage,
      sourceCount: value == null ? 0 : 2,
      observedThrough: evaluatedAt
    },
    lineage: value == null ? [] : [{ namespace: "nutrition", type: "intake", id: "meal-1", version: "meal-v1" }],
    does_not_assert: ["that missing protein is zero"]
  };
}

Deno.test("projection providers declare actual module dependencies", () => {
  const registry = createWayfinderProjectionProviderRegistryV0();
  const trainingTargets = registry.affectedProjectionTargets(["training"]).sort();
  const nutritionTargets = registry.affectedProjectionTargets(["nutrition"]).sort();
  const practiceTargets = registry.affectedProjectionTargets(["practice"]).sort();
  assert(
    trainingTargets.join(",") === "CHARACTER,PROGRESSION,REQUIREMENTS,SKILLS",
    "Training should independently feed Requirements, Character, Voyage Progression, and Skills"
  );
  assert(nutritionTargets.join(",") === "REQUIREMENTS", "Nutrition should feed Requirements only in Character v0.1");
  assert(practiceTargets.join(",") === "SKILLS", "Practice should feed Skills through governed association providers");
});

Deno.test("no domain Standard means no Requirement is invented", () => {
  const empty: RequirementInputRead = { standard: null, spec: null, observation: null, lineage: [] };
  const projection = buildRequirementsProjection([
    { domain: "nutrition", read: empty },
    { domain: "training", read: empty }
  ], evaluatedAt);

  assert(projection.configured_requirement_count === 0, "no configured Standards should mean no Requirement evaluations");
  assert(projection.evaluations.length === 0, "Requirement projection must stay empty");
  assert(projection.unconfigured_domains.join(",") === "nutrition,training", "unconfigured domains should be explicit");
  assert(projection.guidance_candidates.length === 0, "no target means no guidance");
});

Deno.test("partial recorded protein below an active standard stays IN_PROGRESS and coverage-aware", () => {
  const projection = buildRequirementsProjection([{ domain: "nutrition", read: proteinRead(110) }], evaluatedAt);
  const item = projection.evaluations[0];
  assert(item.evaluation.state === "IN_PROGRESS", "open minimum should remain in progress");
  assert(item.evaluation.remainingToMinimum === 40, "recorded gap should be 40g");
  assert(item.evaluation.coverage === "UNKNOWN", "lived coverage must remain unknown");
  assert(projection.guidance_candidates.length === 1, "recorded gap may become a guidance candidate");
  assert(projection.guidance_candidates[0].summary.includes("recorded gap"), "guidance must describe recorded evidence, not a true-life deficit");
  assert(projection.guidance_candidates[0].summary.includes("incomplete"), "guidance must disclose incomplete lived coverage");
});

Deno.test("monotonic minimum may be proven satisfied without complete lived coverage", () => {
  const projection = buildRequirementsProjection([{ domain: "nutrition", read: proteinRead(155) }], evaluatedAt);
  assert(projection.evaluations[0].evaluation.state === "SATISFIED", "known positive accumulation can prove the minimum");
  assert(projection.evaluations[0].evaluation.coverage === "UNKNOWN", "satisfaction must not manufacture complete coverage");
  assert(projection.guidance_candidates.length === 0, "satisfied requirement should stay quiet");
});

Deno.test("missing explicit protein values remain UNKNOWN rather than zero", () => {
  const projection = buildRequirementsProjection([{ domain: "nutrition", read: proteinRead(null) }], evaluatedAt);
  assert(projection.evaluations[0].evaluation.state === "UNKNOWN", "null observation should stay unknown");
  assert(projection.evaluations[0].evaluation.observedValue === null, "unknown must not become zero");
  assert(projection.guidance_candidates.length === 0, "unknown intake should not create a deficit claim");
});

function trainingRead(withLoadedSet = true): TrainingCharacterRead {
  return {
    sessions: [{
      id: "session-1",
      version: "session-v1",
      kind: "STRENGTH",
      occurrence: { from: "2026-09-18T22:00:00.000Z", precision: "INSTANT", zone_id: "America/New_York" },
      sets: withLoadedSet ? [{
        id: "set-1",
        exercise_key: "barbell_bench_press",
        exercise_label: "Barbell Bench Press",
        reps: 8,
        load_value: 185,
        load_unit: "LB"
      }] : []
    }],
    result_coverage: { completeness: "COMPLETE" },
    epistemic_coverage: { completeness: "UNKNOWN", reason: "Stored records do not establish all lived training." }
  };
}

Deno.test("recorded strength practice evidences Might exposure without claiming growth", () => {
  const character = buildCharacterProjection({ training: trainingRead(false), computedAt: evaluatedAt });
  const might = character.facets.find((facet) => facet.facet === "Might")!;
  assert(might.state === "EVIDENCED", "recorded strength session should evidence Might");
  assert(might.exposure?.state === "EVIDENCED", "exposure should be evidenced");
  assert(might.capability === null, "session without structured loaded reps should not claim capability");
  assert(might.growth.state === "INSUFFICIENT_EVIDENCE", "activity alone must not become growth");
  assert(character.evidenced_facets.join(",") === "Might", "only supported facet should be evidenced");
});

Deno.test("loaded repetitions add capability evidence but still not growth", () => {
  const character = buildCharacterProjection({ training: trainingRead(true), computedAt: evaluatedAt });
  const might = character.facets.find((facet) => facet.facet === "Might")!;
  assert(might.capability?.state === "EVIDENCED", "structured loaded reps may evidence capability");
  assert(might.growth.state === "INSUFFICIENT_EVIDENCE", "one capability observation must not prove growth");
});

Deno.test("no training evidence leaves Might UNOBSERVED rather than zero", () => {
  const character = buildCharacterProjection({ training: { sessions: [], epistemic_coverage: { completeness: "UNKNOWN" } }, computedAt: evaluatedAt });
  const might = character.facets.find((facet) => facet.facet === "Might")!;
  assert(might.state === "UNOBSERVED", "absence of recorded evidence should remain unobserved");
  assert(might.exposure === null && might.capability === null, "no evidence should not create synthetic signals");
  assert(might.growth.state === "INSUFFICIENT_EVIDENCE", "growth remains unknown");
});

Deno.test("Requirement satisfaction does not change permanent Character projection", () => {
  const before = buildCharacterProjection({ training: trainingRead(false), computedAt: evaluatedAt });
  const requirements = buildRequirementsProjection([{ domain: "nutrition", read: proteinRead(155) }], evaluatedAt);
  const after = buildCharacterProjection({ training: trainingRead(false), computedAt: evaluatedAt });
  assert(requirements.evaluations[0].evaluation.state === "SATISFIED", "test requires satisfied Requirement");
  assert(JSON.stringify(before) === JSON.stringify(after), "Requirement state must not mutate Character");
});
