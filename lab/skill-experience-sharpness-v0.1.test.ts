import {
  buildSkillsProjection,
  trainingStrengthSkillProvider,
  type TrainingStrengthSkillInputRead
} from "../supabase/functions/_shared/intelligence/skill-projection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const DAY = 24 * 60 * 60;

function read(input: Partial<TrainingStrengthSkillInputRead> = {}): TrainingStrengthSkillInputRead {
  return {
    provider: "training.strength-skill-provider.v0.1",
    as_of: "2026-09-19T20:00:00.000Z",
    eligible_encounter_count: 4,
    first_evidenced_at: "2026-08-26T18:00:00.000Z",
    last_evidenced_at: "2026-09-16T18:00:00.000Z",
    cadence_sample_count: 3,
    typical_interval_seconds: 7 * DAY,
    recent_encounters: [
      { id: "s4", version: "s4-v1", kind: "STRENGTH", occurred_at: "2026-09-16T18:00:00.000Z", recorded_at: "2026-09-16T19:00:00.000Z" },
      { id: "s3", version: "s3-v1", kind: "STRENGTH", occurred_at: "2026-09-09T18:00:00.000Z", recorded_at: "2026-09-09T19:00:00.000Z" }
    ],
    count_coverage: { completeness: "COMPLETE" },
    cadence_coverage: { completeness: "COMPLETE" },
    epistemic_coverage: { completeness: "UNKNOWN" },
    ...input
  };
}

function project(source = read(), computedAt = "2026-09-19T20:00:00.000Z") {
  return buildSkillsProjection({
    providers: [trainingStrengthSkillProvider(source)],
    computedAt
  });
}

Deno.test("governed strength encounters produce one stable Strength Training Skill projection", () => {
  const result = project();
  const skill = result.skills[0];

  assert(result.rule_version === "skills_v0.3", "expected generalized Skill projection rule version");
  assert(result.configured_skill_count === 1, "single provider should configure one skill");
  assert(skill.skillKey === "physical.strength_training", "skill identity should be stable and namespaced");
  assert(skill.association.mode === "DETERMINISTIC_DOMAIN", "Training association should be deterministic");
  assert(skill.experience.encounterCount === 4, "logical governed Training encounters should contribute once");
  assert(skill.capability.state === "UNKNOWN", "experience must not manufacture capability");
  assert(skill.mastery.state === "NOT_EVALUATED", "encounter count must not manufacture mastery");
});

Deno.test("one to three encounters expose recency but do not invent personal cadence", () => {
  const result = project(read({
    eligible_encounter_count: 3,
    first_evidenced_at: "2026-09-01T18:00:00.000Z",
    last_evidenced_at: "2026-09-18T18:00:00.000Z",
    cadence_sample_count: 2,
    typical_interval_seconds: 8.5 * DAY
  }), "2026-09-19T18:00:00.000Z");
  const sharpness = result.skills[0].sharpness;

  assert(sharpness.mode === "RECENCY_ONLY", "insufficient history should remain recency-only");
  assert(sharpness.state === "UNESTABLISHED", "Wayfinder must not invent cadence-aware Sharpness");
  assert(sharpness.currentGapSeconds === DAY, "last-evidenced recency should remain derivable");
  assert(sharpness.typicalIntervalSeconds === null, "unestablished cadence should not surface a pseudo-baseline");
});

Deno.test("four encounters and three positive intervals permit cadence-aware SHARP state", () => {
  const sharpness = project(read(), "2026-09-19T18:00:00.000Z").skills[0].sharpness;
  assert(sharpness.mode === "CADENCE_AWARE", "sufficient complete history should establish cadence-aware mode");
  assert(sharpness.state === "SHARP", "three-day gap against seven-day cadence should remain sharp");
});

Deno.test("Sharpness cools with time while Experience remains unchanged", () => {
  const source = read({
    last_evidenced_at: "2026-09-09T18:00:00.000Z",
    typical_interval_seconds: 7 * DAY
  });

  const warm = project(source, "2026-09-19T18:00:00.000Z").skills[0];
  const cool = project(source, "2026-09-29T18:00:00.000Z").skills[0];
  const dormant = project(source, "2026-10-19T18:00:00.000Z").skills[0];

  assert(warm.sharpness.state === "WARM", "roughly 1.4x normal interval should be warm");
  assert(cool.sharpness.state === "COOL", "roughly 2.9x normal interval should be cool");
  assert(dormant.sharpness.state === "DORMANT", "large cadence gap should become dormant");
  assert(warm.experience.encounterCount === 4, "Experience must not decay");
  assert(cool.experience.encounterCount === 4, "Experience must remain stable as Sharpness changes");
  assert(dormant.experience.encounterCount === 4, "dormancy must not erase practice history");
});

Deno.test("session correction changes lineage version without creating a second Skill Experience encounter", () => {
  const result = project(read({
    eligible_encounter_count: 1,
    first_evidenced_at: "2026-09-18T18:00:00.000Z",
    last_evidenced_at: "2026-09-18T18:15:00.000Z",
    cadence_sample_count: 0,
    typical_interval_seconds: null,
    recent_encounters: [
      { id: "same-session", version: "v1", kind: "STRENGTH", occurred_at: "2026-09-18T18:00:00.000Z", recorded_at: "2026-09-18T19:00:00.000Z" },
      { id: "same-session", version: "v2", kind: "STRENGTH", occurred_at: "2026-09-18T18:15:00.000Z", recorded_at: "2026-09-19T10:00:00.000Z" }
    ]
  }), "2026-09-19T18:00:00.000Z");
  const skill = result.skills[0];

  assert(skill.experience.encounterCount === 1, "correcting the logical session must not mint another experience");
  assert(skill.experience.recentEncounters.length === 1, "recent lineage should dedupe the logical encounter");
  assert(skill.experience.recentEncounters[0].source.version === "v2", "newer lineage version should survive");
  assert(
    skill.experience.recentEncounters[0].skillExperienceKey ===
      "training:session:same-session:skill:physical.strength_training",
    "Skill Experience identity should be encounter plus stable skill key"
  );
});

Deno.test("complete zero means no recorded experience, not zero human ability", () => {
  const result = project(read({
    eligible_encounter_count: 0,
    first_evidenced_at: null,
    last_evidenced_at: null,
    cadence_sample_count: 0,
    typical_interval_seconds: null,
    recent_encounters: []
  }));
  const skill = result.skills[0];

  assert(skill.state === "UNOBSERVED", "complete zero stored encounters may establish no recorded experience");
  assert(skill.experience.encounterCount === 0, "exact complete zero is allowed");
  assert(skill.sharpness.state === "UNOBSERVED", "Sharpness should be unobserved without encounters");
  assert(skill.capability.state === "UNKNOWN", "no recorded experience must not become zero ability");
});

Deno.test("unknown exact encounter count stays unknown instead of becoming zero", () => {
  const result = project(read({
    eligible_encounter_count: undefined,
    first_evidenced_at: null,
    last_evidenced_at: null,
    cadence_sample_count: undefined,
    typical_interval_seconds: undefined,
    count_coverage: { completeness: "UNKNOWN" },
    cadence_coverage: { completeness: "UNKNOWN" },
    recent_encounters: []
  }));
  const skill = result.skills[0];

  assert(skill.state === "UNKNOWN", "unknown source count should keep skill observation unknown");
  assert(skill.experience.encounterCount === null, "unknown must never become zero");
  assert(skill.sharpness.state === "UNKNOWN", "Sharpness cannot be established without count coverage");
});

Deno.test("non-strength recent rows cannot create Strength Training Skill lineage", () => {
  const result = project(read({
    eligible_encounter_count: 1,
    recent_encounters: [
      { id: "strength", version: "sv", kind: "STRENGTH", occurred_at: "2026-09-18T18:00:00Z" },
      { id: "cardio", version: "cv", kind: "CARDIO", occurred_at: "2026-09-18T17:00:00Z" }
    ]
  }));

  assert(result.skills[0].experience.recentEncounters.length === 1, "only provider-owned encounter kind should contribute");
  assert(result.skills[0].experience.recentEncounters[0].source.id === "strength", "strength encounter should remain");
});

Deno.test("duplicate providers for one Skill fail closed", () => {
  let threw = false;
  try {
    buildSkillsProjection({
      providers: [
        trainingStrengthSkillProvider(read()),
        trainingStrengthSkillProvider(read())
      ],
      computedAt: "2026-09-19T20:00:00.000Z"
    });
  } catch (cause) {
    threw = cause instanceof Error && cause.message.includes("DUPLICATE_SKILL_EXPERIENCE_PROVIDER");
  }
  assert(threw, "one Skill must have one authoritative Experience provider in a projection");
});
