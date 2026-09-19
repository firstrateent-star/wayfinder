import {
  buildVoyageProgression,
  type TrainingVoyageProgressionInputRead
} from "../supabase/functions/_shared/intelligence/voyage-progression.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const computedAt = "2026-09-19T20:00:00.000Z";

function trainingRead(
  count: number | undefined,
  recent: TrainingVoyageProgressionInputRead["recent_encounters"] = [],
  completeness: "COMPLETE" | "UNKNOWN" = "COMPLETE"
): TrainingVoyageProgressionInputRead {
  return {
    provider: "training.strength-session-encounter.v0.1",
    as_of: computedAt,
    eligible_encounter_count: count,
    recent_encounters: recent,
    count_coverage: { completeness, phenomenon: "current_active_strength_training_sessions_through_as_of" },
    epistemic_coverage: {
      completeness: "UNKNOWN",
      reason: "Stored training records do not establish complete lived training coverage."
    }
  };
}

Deno.test("one canonical strength session earns one Voyage XP regardless of internal detail", () => {
  const projection = buildVoyageProgression({
    computedAt,
    training: trainingRead(1, [{
      id: "session-1",
      version: "session-1-v1",
      kind: "STRENGTH",
      occurred_at: "2026-09-19T18:00:00.000Z",
      recorded_at: "2026-09-19T18:45:00.000Z",
      label: "Heavy bench day"
    }])
  });

  assert(projection.state === "AVAILABLE", "complete canonical encounter count should make progression available");
  assert(projection.voyage_xp === 1, "one logical training encounter should earn exactly one Voyage XP in v0.1");
  assert(projection.encounter_count === 1, "encounter count should equal the exact canonical logical-session count");
  assert(projection.recent_encounters[0].xp === 1, "recent encounter should carry the same one-XP rule");
  assert(
    projection.recent_encounters[0].doesNotAssert.some((item) => item.includes("sets")),
    "set detail must not multiply XP"
  );
});

Deno.test("correction changes the version lineage but not the stable encounter identity or XP", () => {
  const projection = buildVoyageProgression({
    computedAt,
    training: trainingRead(1, [
      {
        id: "session-1",
        version: "session-1-v1",
        kind: "STRENGTH",
        occurred_at: "2026-09-18T18:00:00.000Z",
        recorded_at: "2026-09-18T19:00:00.000Z"
      },
      {
        id: "session-1",
        version: "session-1-v2",
        kind: "STRENGTH",
        occurred_at: "2026-09-18T18:15:00.000Z",
        recorded_at: "2026-09-19T10:00:00.000Z"
      }
    ])
  });

  assert(projection.voyage_xp === 1, "a corrected logical session must not mint a second XP event");
  assert(projection.recent_encounters.length === 1, "recent encounter list must dedupe logical session identity");
  assert(projection.recent_encounters[0].encounterKey === "training:session:session-1", "encounter key must ignore version");
  assert(projection.recent_encounters[0].source.version === "session-1-v2", "current/newer lineage should be retained");
});

Deno.test("canonical retry safety is represented by exact logical encounter count rather than event replay", () => {
  const projection = buildVoyageProgression({
    computedAt,
    training: trainingRead(3, [
      { id: "a", version: "av", kind: "STRENGTH", occurred_at: "2026-09-19T10:00:00Z" },
      { id: "b", version: "bv", kind: "STRENGTH", occurred_at: "2026-09-18T10:00:00Z" },
      { id: "c", version: "cv", kind: "STRENGTH", occurred_at: "2026-09-17T10:00:00Z" }
    ])
  });

  assert(projection.voyage_xp === 3, "three canonical logical encounters should produce three XP");
  assert(projection.configured_providers.length === 1, "v0.1 should expose only the proven Training provider");
  assert(
    projection.does_not_assert.includes("a permanent XP award ledger"),
    "projection must remain reconstructable rather than pretending a ledger exists"
  );
});

Deno.test("unknown exact count remains unknown instead of becoming zero XP", () => {
  const projection = buildVoyageProgression({
    computedAt,
    training: trainingRead(undefined, [], "UNKNOWN")
  });

  assert(projection.state === "UNKNOWN", "unknown source count should make progression unknown");
  assert(projection.voyage_xp === null, "missing evidence must never become zero XP");
  assert(projection.encounter_count === null, "missing encounter count must remain null");
});

Deno.test("zero is valid only when the canonical aggregate explicitly reports complete zero", () => {
  const projection = buildVoyageProgression({
    computedAt,
    training: trainingRead(0)
  });

  assert(projection.state === "AVAILABLE", "complete zero count is a valid configured-provider result");
  assert(projection.voyage_xp === 0, "complete canonical zero may be represented as zero");
  assert(projection.epistemic_coverage === "UNKNOWN", "stored zero must not claim the person did no meaningful practice in life");
});

Deno.test("non-strength rows cannot surface as recent Voyage encounters", () => {
  const projection = buildVoyageProgression({
    computedAt,
    training: trainingRead(1, [
      { id: "strength", version: "sv", kind: "STRENGTH", occurred_at: "2026-09-19T18:00:00Z" },
      { id: "future-kind", version: "fv", kind: "CARDIO", occurred_at: "2026-09-19T17:00:00Z" }
    ])
  });

  assert(projection.recent_encounters.length === 1, "only the configured encounter kind should surface");
  assert(projection.recent_encounters[0].source.id === "strength", "strength session should remain");
});

Deno.test("Voyage XP remains explicitly separate from Character growth", () => {
  const projection = buildVoyageProgression({
    computedAt,
    training: trainingRead(4)
  });

  assert(projection.voyage_xp === 4, "participation can earn experience");
  assert(
    projection.does_not_assert.some((item) => item.includes("Character attribute")),
    "Voyage XP must not masquerade as Character capability"
  );
  assert(
    projection.does_not_assert.some((item) => item.includes("proves growth")),
    "repeated participation must not become growth"
  );
});
