import {
  buildVoyageProgression,
  practiceVoyageProvider,
  trainingVoyageProvider,
  type PracticeVoyageProgressionInputRead,
  type TrainingVoyageProgressionInputRead
} from "../supabase/functions/_shared/intelligence/voyage-progression.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const computedAt = "2026-09-20T01:00:00.000Z";

function trainingRead(
  count: number | undefined,
  recent: TrainingVoyageProgressionInputRead["recent_encounters"] = [],
  completeness: "COMPLETE" | "UNKNOWN" = "COMPLETE"
): TrainingVoyageProgressionInputRead {
  return {
    eligible_encounter_count: count,
    recent_encounters: recent,
    count_coverage: { completeness },
    epistemic_coverage: { completeness: "UNKNOWN" }
  };
}

function practiceRead(
  count: number | undefined,
  recent: PracticeVoyageProgressionInputRead["recent_encounters"] = [],
  completeness: "COMPLETE" | "UNKNOWN" = "COMPLETE"
): PracticeVoyageProgressionInputRead {
  return {
    eligible_encounter_count: count,
    recent_encounters: recent,
    count_coverage: { completeness },
    epistemic_coverage: { completeness: "UNKNOWN" }
  };
}

function project(
  training: TrainingVoyageProgressionInputRead,
  practice: PracticeVoyageProgressionInputRead
) {
  return buildVoyageProgression({
    providers: [
      trainingVoyageProvider(training),
      practiceVoyageProvider(practice)
    ],
    computedAt
  });
}

Deno.test("Training and governed Practice encounters both contribute Voyage XP", () => {
  const result = project(
    trainingRead(1, [{
      id: "training-1",
      version: "training-v1",
      kind: "STRENGTH",
      occurred_at: "2026-09-19T18:00:00Z",
      label: "Strength"
    }]),
    practiceRead(2, [
      {
        id: "practice-1",
        version: "practice-v1",
        practice_id: "music",
        practice_name: "Music Production",
        occurred_at: "2026-09-18T18:00:00Z"
      },
      {
        id: "practice-2",
        version: "practice-v2",
        practice_id: "drawing",
        practice_name: "Drawing",
        occurred_at: "2026-09-17T18:00:00Z"
      }
    ])
  );

  assert(result.rule_version === "voyage_progression_v0.2", "multi-provider progression should advance the rule version");
  assert(result.voyage_xp === 3, "one Training plus two governed Practice encounters should equal three Voyage XP");
  assert(result.encounter_count === 3, "one XP should correspond to each qualifying logical encounter");
  assert(result.configured_providers.length === 2, "two governed encounter keyspaces should be configured");
  assert(result.recent_encounters.length === 3, "recent lineage should compose both providers");
});

Deno.test("one Practice session counts once even when correction lineage repeats it", () => {
  const result = project(
    trainingRead(0),
    practiceRead(1, [
      {
        id: "same",
        version: "v1",
        practice_name: "Music Production",
        occurred_at: "2026-09-18T18:00:00Z",
        recorded_at: "2026-09-18T19:00:00Z"
      },
      {
        id: "same",
        version: "v2",
        practice_name: "Music Production",
        occurred_at: "2026-09-18T18:15:00Z",
        recorded_at: "2026-09-19T10:00:00Z"
      }
    ])
  );

  const practice = result.recent_encounters.filter((item) => item.domain === "practice");
  assert(result.voyage_xp === 1, "one logical corrected Practice encounter should contribute once");
  assert(practice.length === 1, "recent Practice lineage should dedupe logical session identity");
  assert(practice[0].encounterKey === "practice:session:same", "Practice encounter identity should be stable");
  assert(practice[0].source.version === "v2", "newer canonical lineage should survive");
});

Deno.test("Practice Voyage XP is provider-filtered rather than awarded to arbitrary labels in projection code", () => {
  const result = project(
    trainingRead(0),
    practiceRead(1, [{
      id: "governed",
      version: "gv",
      practice_name: "Drawing",
      occurred_at: "2026-09-19T16:00:00Z"
    }])
  );

  assert(result.voyage_xp === 1, "the exact governed Practice aggregate should contribute");
  assert(
    result.does_not_assert.some((item) => item.includes("arbitrary Practice labels")),
    "projection must disclose that arbitrary Practice capture is not enough"
  );
});

Deno.test("bounded recent detail cannot multiply the exact provider aggregate", () => {
  const result = project(
    trainingRead(5, [{ id:"a",version:"av",kind:"STRENGTH",occurred_at:"2026-09-19T10:00:00Z" }]),
    practiceRead(8, [{ id:"b",version:"bv",practice_name:"Drawing",occurred_at:"2026-09-18T10:00:00Z" }])
  );

  assert(result.voyage_xp === 13, "exact aggregate counts, not bounded recent rows, own the total");
  assert(result.recent_encounters.length === 2, "recent explainability may be bounded independently");
});

Deno.test("unknown count in any configured provider makes exact Voyage total unknown", () => {
  const result = project(
    trainingRead(4),
    practiceRead(undefined, [], "UNKNOWN")
  );

  assert(result.state === "UNKNOWN", "incomplete provider count should prevent a false exact total");
  assert(result.voyage_xp === null, "unknown must not become a partial total presented as exact");
  assert(result.encounter_count === null, "exact encounter total should remain unknown");
  assert(result.configured_providers[0].encounterCount === 4, "known provider contribution remains inspectable");
  assert(result.configured_providers[1].encounterCount === null, "unknown provider contribution remains explicit");
});

Deno.test("complete zero across configured providers is a valid zero without implying zero lived experience", () => {
  const result = project(trainingRead(0), practiceRead(0));

  assert(result.state === "AVAILABLE", "complete provider zeros form a valid modeled result");
  assert(result.voyage_xp === 0, "complete modeled zero may be represented as zero");
  assert(result.epistemic_coverage === "UNKNOWN", "stored-record zero must not claim no meaningful lived experience");
});

Deno.test("non-strength Training rows cannot surface through the strength provider", () => {
  const result = project(
    trainingRead(1, [
      { id:"strength",version:"sv",kind:"STRENGTH",occurred_at:"2026-09-19T18:00:00Z" },
      { id:"cardio",version:"cv",kind:"CARDIO",occurred_at:"2026-09-19T17:00:00Z" }
    ]),
    practiceRead(0)
  );

  const training = result.recent_encounters.filter((item) => item.domain === "training");
  assert(training.length === 1, "only provider-owned Training kind should surface");
  assert(training[0].source.id === "strength", "Strength encounter should remain");
});

Deno.test("duplicate Voyage provider id fails closed", () => {
  const provider = trainingVoyageProvider(trainingRead(1));
  let threw = false;
  try {
    buildVoyageProgression({ providers:[provider,provider], computedAt });
  } catch (cause) {
    threw = cause instanceof Error && cause.message.includes("DUPLICATE_VOYAGE_PROVIDER");
  }
  assert(threw, "same provider must not be counted twice");
});

Deno.test("two providers cannot own the same logical encounter keyspace", () => {
  const a = trainingVoyageProvider(trainingRead(1));
  const b = { ...a, id: "another-provider" };
  let threw = false;
  try {
    buildVoyageProgression({ providers:[a,b], computedAt });
  } catch (cause) {
    threw = cause instanceof Error && cause.message.includes("DUPLICATE_VOYAGE_ENCOUNTER_KEYSPACE");
  }
  assert(threw, "overlapping keyspaces could double-award the same canonical encounter");
});

Deno.test("Voyage Experience remains separate from Skill Capability and Character growth", () => {
  const result = project(trainingRead(4), practiceRead(2));

  assert(result.voyage_xp === 6, "participation can accumulate across governed providers");
  assert(
    result.does_not_assert.some((item) => item.includes("Character attribute")),
    "Voyage XP must not masquerade as Character capability"
  );
  assert(
    result.does_not_assert.some((item) => item.includes("proves growth")),
    "participation must not become longitudinal growth"
  );
});

Deno.test("cross-domain real-world duplicate reconciliation remains explicitly unresolved", () => {
  const result = project(
    trainingRead(1, [{ id:"t",version:"tv",kind:"STRENGTH",occurred_at:"2026-09-19T18:00:00Z" }]),
    practiceRead(1, [{ id:"p",version:"pv",practice_name:"Drawing",occurred_at:"2026-09-19T18:00:00Z" }])
  );

  assert(result.voyage_xp === 2, "distinct canonical records in distinct keyspaces remain distinct until reconciliation exists");
  assert(
    result.does_not_assert.some((item) => item.includes("different domains")),
    "projection must disclose the cross-domain duplicate boundary"
  );
});
