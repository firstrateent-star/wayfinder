import {
  buildSkillsProjection,
  practiceOutputSkillCapabilityProvider,
  practiceSkillProvider,
  type PracticeOutputSkillCapabilityInputRead,
  type PracticeSkillInputRead
} from "../supabase/functions/_shared/intelligence/skill-projection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const DAY = 24 * 60 * 60;

function experienceRead(input: Partial<PracticeSkillInputRead> = {}): PracticeSkillInputRead {
  return {
    eligible_encounter_count: 3,
    first_evidenced_at: "2026-08-01T12:00:00.000Z",
    last_evidenced_at: "2026-08-20T12:00:00.000Z",
    cadence_sample_count: 2,
    typical_interval_seconds: 9 * DAY,
    recent_encounters: [{
      id: "practice-session-3",
      version: "practice-session-3-v1",
      practice_id: "practice-music",
      practice_name: "Music Production",
      occurred_at: "2026-08-20T12:00:00.000Z",
      recorded_at: "2026-08-20T13:00:00.000Z"
    }],
    count_coverage: { completeness: "COMPLETE" },
    cadence_coverage: { completeness: "COMPLETE" },
    epistemic_coverage: { completeness: "UNKNOWN" },
    ...input
  };
}

function outputRead(
  input: Partial<PracticeOutputSkillCapabilityInputRead> = {}
): PracticeOutputSkillCapabilityInputRead {
  return {
    provider: "practice.completed-output-skill-capability-provider.v0.1",
    as_of: "2026-08-21T12:00:00.000Z",
    capability_model: "COMPLETED_PRACTICE_OUTPUT",
    evidence_basis: "PLAYER_CONFIRMED_COMPLETED_OUTPUT",
    demonstrated_observation_count: 1,
    demonstrated_session_count: 1,
    first_demonstrated_at: "2026-08-20T12:00:00.000Z",
    last_demonstrated_at: "2026-08-20T12:00:00.000Z",
    recent_outputs: [{
      output_id: "output-1",
      output_version: "output-1-v1",
      output_kind: "COMPLETED_ARTIFACT",
      title: "Fool on Folly rough master",
      external_url: "https://example.com/fool-on-folly",
      practice_id: "practice-music",
      practice_name: "Music Production",
      source_session_id: "practice-session-3",
      captured_source_session_version: "practice-session-3-v1",
      current_source_session_version: "practice-session-3-v1",
      occurred_at: "2026-08-20T12:00:00.000Z",
      recorded_at: "2026-08-20T13:30:00.000Z"
    }],
    result_coverage: {
      completeness: "COMPLETE",
      phenomenon: "current_canonical_completed_practice_outputs_through_as_of"
    },
    epistemic_coverage: {
      completeness: "UNKNOWN",
      reason: "Recorded outputs do not establish complete creative capability."
    },
    ...input
  };
}

function project(
  capability = outputRead(),
  experience = experienceRead()
) {
  return buildSkillsProjection({
    providers: [
      practiceSkillProvider({
        skillKey: "creative.music_production",
        label: "Music Production",
        read: experience
      })
    ],
    capabilityProviders: [
      practiceOutputSkillCapabilityProvider({
        skillKey: "creative.music_production",
        label: "Music Production",
        read: capability
      })
    ],
    computedAt: "2026-08-21T12:00:00.000Z"
  });
}

Deno.test("player-confirmed completed output establishes bounded creative Capability", () => {
  const result = project();
  const skill = result.skills[0];

  assert(result.rule_version === "skills_v0.4", "creative capability should advance the Skills contract");
  assert(skill.capability.state === "EVIDENCED", "valid completed output should evidence bounded capability");
  assert(skill.capability.evidenceClass === "COMPLETED_PRACTICE_OUTPUT", "creative evidence class should stay explicit");
  assert(skill.capability.capabilityModel === "COMPLETED_PRACTICE_OUTPUT", "creative model should stay explicit");
  assert(skill.capability.evidenceBasis === "PLAYER_CONFIRMED_COMPLETED_OUTPUT", "authority basis should stay explicit");
  assert(skill.capability.demonstrationCount === 1, "exact output count should survive");
  assert(skill.capability.demonstratedSessionCount === 1, "source-session breadth should survive");
  assert(skill.capability.demonstratedExerciseCount === null, "creative capability must not pretend to be exercise evidence");
  assert(skill.capability.exerciseFrontiers.length === 0, "creative capability must not manufacture a strength frontier");
  assert(skill.capability.creativeOutputs.length === 1, "exact completed output lineage should remain inspectable");
  assert(skill.capability.creativeOutputs[0].title === "Fool on Folly rough master", "output title should survive");
  assert(skill.mastery.state === "NOT_EVALUATED", "completed output must not manufacture mastery");
});

Deno.test("creative output evidence proves completion, not quality or ranking", () => {
  const capability = project().skills[0].capability;
  assert(capability.doesNotAssert.includes("creative quality"), "quality must stay outside the claim");
  assert(capability.doesNotAssert.includes("originality"), "originality must stay outside the claim");
  assert(capability.doesNotAssert.includes("commercial success"), "commercial outcome must stay outside the claim");
  assert(capability.doesNotAssert.includes("that completed-output count ranks creative ability"), "count must not become ranking");
});

Deno.test("complete zero creative outputs means insufficient evidence, not zero ability", () => {
  const skill = project(outputRead({
    demonstrated_observation_count: 0,
    demonstrated_session_count: 0,
    first_demonstrated_at: null,
    last_demonstrated_at: null,
    recent_outputs: []
  })).skills[0];

  assert(skill.experience.encounterCount === 3, "Practice Experience may exist without a completed output");
  assert(skill.capability.state === "INSUFFICIENT_EVIDENCE", "complete zero output evidence should be bounded insufficient evidence");
  assert(skill.capability.demonstrationCount === 0, "exact modeled zero should remain zero");
  assert(skill.capability.doesNotAssert.includes("zero ability"), "zero-output evidence must never mean zero ability");
});

Deno.test("many Practice encounters do not substitute for completed-output evidence", () => {
  const skill = project(
    outputRead({
      demonstrated_observation_count: 0,
      demonstrated_session_count: 0,
      first_demonstrated_at: null,
      last_demonstrated_at: null,
      recent_outputs: []
    }),
    experienceRead({ eligible_encounter_count: 40 })
  ).skills[0];

  assert(skill.experience.encounterCount === 40, "high Practice Experience may be observed");
  assert(skill.capability.state === "INSUFFICIENT_EVIDENCE", "Experience count cannot become creative Capability");
});

Deno.test("positive aggregate with malformed output evidence fails closed", () => {
  const skill = project(outputRead({
    demonstrated_observation_count: 1,
    recent_outputs: [{
      output_id: "output-1",
      output_version: "output-1-v1",
      output_kind: "COMPLETED_ARTIFACT",
      title: "Output",
      external_url: "javascript:alert(1)",
      practice_id: "practice-music",
      practice_name: "Music Production",
      source_session_id: "practice-session-3",
      captured_source_session_version: "practice-session-3-v1",
      current_source_session_version: "practice-session-3-v1",
      occurred_at: "2026-08-20T12:00:00.000Z",
      recorded_at: "2026-08-20T13:30:00.000Z"
    }]
  })).skills[0];

  assert(skill.capability.state === "UNKNOWN", "malformed proof must fail closed rather than assert capability");
  assert(skill.capability.creativeOutputs.length === 0, "invalid evidence URL should not enter the projection");
});

Deno.test("external URL is optional for player-confirmed completion evidence", () => {
  const skill = project(outputRead({
    recent_outputs: [{
      output_id: "output-no-url",
      output_version: "output-no-url-v1",
      output_kind: "COMPLETED_ARTIFACT",
      title: "Offline mix",
      external_url: null,
      practice_id: "practice-music",
      practice_name: "Music Production",
      source_session_id: "practice-session-3",
      captured_source_session_version: "practice-session-3-v1",
      current_source_session_version: "practice-session-3-v1",
      occurred_at: "2026-08-20T12:00:00.000Z",
      recorded_at: "2026-08-20T13:30:00.000Z"
    }]
  })).skills[0];

  assert(skill.capability.state === "EVIDENCED", "explicit completion should not require publishing the artifact online");
  assert(skill.capability.creativeOutputs[0].externalUrl === null, "missing URL should stay null");
});

Deno.test("duplicate output lineage cannot mint multiple creative demonstrations in the projection", () => {
  const duplicate = outputRead().recent_outputs![0];
  const skill = project(outputRead({
    demonstrated_observation_count: 1,
    recent_outputs: [duplicate, { ...duplicate }]
  })).skills[0];

  assert(skill.capability.state === "EVIDENCED", "one valid logical output should remain evidenced");
  assert(skill.capability.creativeOutputs.length === 1, "duplicate logical output ids must dedupe");
});

Deno.test("unknown creative output coverage stays UNKNOWN", () => {
  const skill = project(outputRead({
    demonstrated_observation_count: undefined,
    demonstrated_session_count: undefined,
    recent_outputs: [],
    result_coverage: { completeness: "UNKNOWN" }
  })).skills[0];

  assert(skill.capability.state === "UNKNOWN", "unknown output coverage must not become insufficient evidence");
  assert(skill.capability.demonstrationCount === null, "unknown count must not become zero");
});
