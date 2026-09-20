import {
  buildSkillsProjection,
  practiceSkillProvider,
  trainingStrengthSkillCapabilityProvider,
  trainingStrengthSkillProvider,
  type PracticeSkillInputRead,
  type TrainingStrengthSkillCapabilityInputRead,
  type TrainingStrengthSkillInputRead
} from "../supabase/functions/_shared/intelligence/skill-projection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const DAY = 24 * 60 * 60;

function experienceRead(input: Partial<TrainingStrengthSkillInputRead> = {}): TrainingStrengthSkillInputRead {
  return {
    eligible_encounter_count: 4,
    first_evidenced_at: "2026-08-01T12:00:00.000Z",
    last_evidenced_at: "2026-08-22T12:00:00.000Z",
    cadence_sample_count: 3,
    typical_interval_seconds: 7 * DAY,
    recent_encounters: [
      { id: "s4", version: "s4-v1", kind: "STRENGTH", occurred_at: "2026-08-22T12:00:00.000Z" }
    ],
    count_coverage: { completeness: "COMPLETE" },
    cadence_coverage: { completeness: "COMPLETE" },
    epistemic_coverage: { completeness: "UNKNOWN" },
    ...input
  };
}

function capabilityRead(
  input: Partial<TrainingStrengthSkillCapabilityInputRead> = {}
): TrainingStrengthSkillCapabilityInputRead {
  return {
    provider: "training.strength-skill-capability-provider.v0.1",
    skill_key: "physical.strength_training",
    skill_label: "Strength Training",
    demonstrated_observation_count: 3,
    demonstrated_session_count: 2,
    demonstrated_exercise_count: 1,
    first_demonstrated_at: "2026-08-01T12:00:00.000Z",
    last_demonstrated_at: "2026-08-22T12:00:00.000Z",
    recent_demonstrations: [{
      session_id: "s4",
      session_version: "s4-v1",
      set_id: "set-4",
      exercise_key: "barbell_bench_press",
      exercise_label: "Barbell Bench Press",
      reps: 8,
      load_value: 185,
      load_unit: "LB",
      rpe: 8,
      occurred_at: "2026-08-22T12:00:00.000Z"
    }],
    result_coverage: {
      completeness: "COMPLETE",
      phenomenon: "current_canonical_loaded_repetition_demonstrations_through_as_of"
    },
    epistemic_coverage: {
      completeness: "UNKNOWN",
      reason: "Stored demonstrations do not establish complete human capability."
    },
    ...input
  };
}

function project(
  experience = experienceRead(),
  capability = capabilityRead(),
  computedAt = "2026-08-23T12:00:00.000Z"
) {
  return buildSkillsProjection({
    providers: [trainingStrengthSkillProvider(experience)],
    capabilityProviders: [trainingStrengthSkillCapabilityProvider(capability)],
    computedAt
  });
}

Deno.test("loaded repetitions establish bounded Strength Training Skill Capability", () => {
  const result = project();
  const skill = result.skills[0];

  assert(result.rule_version === "skills_v0.3", "Capability slice should advance the Skills rule version");
  assert(skill.capability.state === "EVIDENCED", "valid loaded repetition should evidence capability");
  assert(skill.capability.providerId === "training.strength-skill-capability-provider.v0.1", "capability lineage should name its own provider");
  assert(skill.capability.evidenceClass === "LOADED_REPETITION_DEMONSTRATION", "capability evidence class should be explicit");
  assert(skill.capability.demonstrationCount === 3, "exact recorded demonstration count should survive");
  assert(skill.capability.demonstratedSessionCount === 2, "session breadth should survive");
  assert(skill.capability.demonstratedExerciseCount === 1, "exercise breadth should survive");
  assert(skill.capability.recentDemonstrations[0].source.type === "exercise_set", "exact set evidence should remain inspectable");
  assert(skill.mastery.state === "NOT_EVALUATED", "capability must not manufacture mastery");
});

Deno.test("complete zero loaded demonstrations means insufficient evidence, not zero ability", () => {
  const skill = project(
    experienceRead({ eligible_encounter_count: 2 }),
    capabilityRead({
      demonstrated_observation_count: 0,
      demonstrated_session_count: 0,
      demonstrated_exercise_count: 0,
      first_demonstrated_at: null,
      last_demonstrated_at: null,
      recent_demonstrations: []
    })
  ).skills[0];

  assert(skill.experience.encounterCount === 2, "Skill Experience may exist without structured capability evidence");
  assert(skill.capability.state === "INSUFFICIENT_EVIDENCE", "complete zero evidence should not become UNKNOWN");
  assert(skill.capability.demonstrationCount === 0, "complete observed zero may stay zero as evidence count");
  assert(skill.capability.doesNotAssert.includes("zero ability"), "projection must explicitly reject zero-ability inference");
});

Deno.test("unknown capability read remains unknown rather than insufficient", () => {
  const skill = project(
    experienceRead(),
    capabilityRead({
      demonstrated_observation_count: undefined,
      demonstrated_session_count: undefined,
      demonstrated_exercise_count: undefined,
      first_demonstrated_at: null,
      last_demonstrated_at: null,
      recent_demonstrations: [],
      result_coverage: { completeness: "UNKNOWN" }
    })
  ).skills[0];

  assert(skill.capability.state === "UNKNOWN", "unknown result coverage must remain unknown");
  assert(skill.capability.demonstrationCount === null, "unknown count must not become zero");
});

Deno.test("positive exact demonstration can evidence Capability even while lived epistemic coverage remains unknown", () => {
  const skill = project().skills[0];
  assert(skill.capability.state === "EVIDENCED", "positive direct evidence is sufficient for bounded capability");
  assert(skill.capability.epistemicCoverage === "UNKNOWN", "bounded positive evidence must not manufacture complete human coverage");
});

Deno.test("Sharpness may become dormant without erasing demonstrated Capability", () => {
  const skill = project(
    experienceRead(),
    capabilityRead(),
    "2026-10-01T12:00:00.000Z"
  ).skills[0];

  assert(skill.sharpness.state === "DORMANT", "long gap should cool Sharpness");
  assert(skill.capability.state === "EVIDENCED", "time alone must not erase demonstrated capability");
  assert(skill.experience.encounterCount === 4, "time alone must not erase Experience");
});

Deno.test("Experience does not prove Capability when the Capability provider has no qualifying demonstration", () => {
  const skill = project(
    experienceRead({ eligible_encounter_count: 30 }),
    capabilityRead({
      demonstrated_observation_count: 0,
      demonstrated_session_count: 0,
      demonstrated_exercise_count: 0,
      first_demonstrated_at: null,
      last_demonstrated_at: null,
      recent_demonstrations: []
    })
  ).skills[0];

  assert(skill.experience.encounterCount === 30, "high Experience may be recorded");
  assert(skill.capability.state === "INSUFFICIENT_EVIDENCE", "encounter count cannot substitute for demonstration evidence");
});

Deno.test("Practice-derived Skills remain Capability UNKNOWN without a governed provider", () => {
  const practiceRead: PracticeSkillInputRead = {
    eligible_encounter_count: 5,
    first_evidenced_at: "2026-08-01T12:00:00Z",
    last_evidenced_at: "2026-09-01T12:00:00Z",
    cadence_sample_count: 4,
    typical_interval_seconds: 7 * DAY,
    recent_encounters: [],
    count_coverage: { completeness: "COMPLETE" },
    cadence_coverage: { completeness: "COMPLETE" },
    epistemic_coverage: { completeness: "UNKNOWN" }
  };

  const result = buildSkillsProjection({
    providers: [
      trainingStrengthSkillProvider(experienceRead()),
      practiceSkillProvider({
        skillKey: "creative.music_production",
        label: "Music Production",
        read: practiceRead
      })
    ],
    capabilityProviders: [
      trainingStrengthSkillCapabilityProvider(capabilityRead())
    ],
    computedAt: "2026-09-02T12:00:00Z"
  });

  const music = result.skills.find((skill) => skill.skillKey === "creative.music_production")!;
  assert(music.state === "OBSERVED", "Music Production Experience should remain independently observed");
  assert(music.capability.state === "UNKNOWN", "no capability provider means no Music Production capability claim");
  assert(music.capability.providerId === null, "no implicit provider may be invented");
});

Deno.test("duplicate Capability providers for one Skill fail closed", () => {
  let threw = false;
  try {
    buildSkillsProjection({
      providers: [trainingStrengthSkillProvider(experienceRead())],
      capabilityProviders: [
        trainingStrengthSkillCapabilityProvider(capabilityRead()),
        trainingStrengthSkillCapabilityProvider(capabilityRead())
      ],
      computedAt: "2026-09-02T12:00:00Z"
    });
  } catch (cause) {
    threw = cause instanceof Error && cause.message.includes("DUPLICATE_SKILL_CAPABILITY_PROVIDER");
  }
  assert(threw, "one Skill cannot have two authoritative capability providers");
});

Deno.test("orphan Capability provider fails closed", () => {
  let threw = false;
  try {
    buildSkillsProjection({
      providers: [],
      capabilityProviders: [trainingStrengthSkillCapabilityProvider(capabilityRead())],
      computedAt: "2026-09-02T12:00:00Z"
    });
  } catch (cause) {
    threw = cause instanceof Error && cause.message.includes("ORPHAN_SKILL_CAPABILITY_PROVIDER");
  }
  assert(threw, "Capability cannot silently create an unconfigured Skill identity");
});
