import {
  SkillConceptRegistry,
  createWayfinderSkillConceptRegistryV0
} from "../supabase/functions/_shared/intelligence/skill-association.ts";
import {
  buildSkillsProjection,
  practiceSkillProvider,
  trainingStrengthSkillProvider,
  type PracticeSkillInputRead,
  type TrainingStrengthSkillInputRead
} from "../supabase/functions/_shared/intelligence/skill-projection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function practiceRead(input: Partial<PracticeSkillInputRead> = {}): PracticeSkillInputRead {
  return {
    provider: "practice.name-skill-provider.v0.1",
    eligible_encounter_count: 1,
    first_evidenced_at: "2026-09-15T06:58:29.329Z",
    last_evidenced_at: "2026-09-15T06:58:29.329Z",
    cadence_sample_count: 0,
    typical_interval_seconds: null,
    recent_encounters: [{
      id: "practice-session-1",
      version: "practice-session-v1",
      practice_id: "practice-record-a",
      practice_name: "Music Production",
      occurred_at: "2026-09-15T06:58:29.329Z",
      recorded_at: "2026-09-15T07:30:00.000Z"
    }],
    count_coverage: { completeness: "COMPLETE" },
    cadence_coverage: { completeness: "COMPLETE" },
    epistemic_coverage: { completeness: "UNKNOWN" },
    ...input
  };
}

function trainingRead(): TrainingStrengthSkillInputRead {
  return {
    eligible_encounter_count: 0,
    first_evidenced_at: null,
    last_evidenced_at: null,
    cadence_sample_count: 0,
    typical_interval_seconds: null,
    recent_encounters: [],
    count_coverage: { completeness: "COMPLETE" },
    cadence_coverage: { completeness: "COMPLETE" },
    epistemic_coverage: { completeness: "UNKNOWN" }
  };
}

Deno.test("case and whitespace variants resolve to one stable Music Production Skill", () => {
  const registry = createWayfinderSkillConceptRegistryV0();
  const a = registry.resolvePracticeName("Music Production");
  const b = registry.resolvePracticeName(" music   production ");

  assert(a?.skillKey === "creative.music_production", "canonical label should resolve");
  assert(b?.skillKey === "creative.music_production", "case/whitespace-equivalent Practice names should resolve identically");
  assert(a?.contributesExperience === true && b?.contributesExperience === true, "governed exact aliases may contribute");
});

Deno.test("different canonical Practice identities may project to the same Skill without being merged", () => {
  const registry = createWayfinderSkillConceptRegistryV0();
  const concept = registry.get("creative.music_production")!;
  const result = buildSkillsProjection({
    providers: [
      practiceSkillProvider({
        skillKey: concept.skillKey,
        label: concept.label,
        read: practiceRead({
          eligible_encounter_count: 2,
          first_evidenced_at: "2026-09-10T12:00:00.000Z",
          last_evidenced_at: "2026-09-15T12:00:00.000Z",
          cadence_sample_count: 1,
          typical_interval_seconds: 5 * 24 * 60 * 60,
          recent_encounters: [
            {
              id: "session-a",
              version: "session-a-v1",
              practice_id: "practice-record-a",
              practice_name: "Music Production",
              occurred_at: "2026-09-15T12:00:00.000Z"
            },
            {
              id: "session-b",
              version: "session-b-v1",
              practice_id: "practice-record-b",
              practice_name: "Music production",
              occurred_at: "2026-09-10T12:00:00.000Z"
            }
          ]
        })
      })
    ],
    computedAt: "2026-09-19T12:00:00.000Z"
  });

  const skill = result.skills[0];
  assert(skill.experience.encounterCount === 2, "two real sessions should remain two Experience encounters");
  assert(skill.experience.recentEncounters.length === 2, "both canonical session lineages should remain visible");
  assert(
    new Set(skill.experience.recentEncounters.map((item) => item.practice?.id)).size === 2,
    "projection must preserve distinct canonical Practice identities"
  );
  assert(skill.skillKey === "creative.music_production", "both records should converge only at the Skill projection");
});

Deno.test("Drawing and Music Production are independent configured Skill concepts", () => {
  const registry = createWayfinderSkillConceptRegistryV0();
  const drawing = registry.resolvePracticeName("Drawing");
  const music = registry.resolvePracticeName("Music Production");

  assert(drawing?.skillKey === "creative.drawing", "Drawing should resolve to its own stable Skill");
  assert(music?.skillKey === "creative.music_production", "Music Production should resolve independently");
  assert(
    new Set([drawing?.skillKey, music?.skillKey]).size === 2,
    "distinct governed concepts must not collapse"
  );
});

Deno.test("unregistered Practice names remain unresolved rather than being guessed into a Skill", () => {
  const registry = createWayfinderSkillConceptRegistryV0();
  assert(registry.resolvePracticeName("Wedding video editing") === null, "unregistered name should not auto-map");
  assert(registry.resolvePracticeName("Small engine repair") === null, "semantic plausibility is not association authority");
});

Deno.test("semantic proposals never mint Skill Experience directly", () => {
  const registry = createWayfinderSkillConceptRegistryV0();
  const known = registry.assessSemanticProposal({
    proposedSkillKey: "creative.music_production",
    sourceSummary: "worked on a song"
  });
  const unknown = registry.assessSemanticProposal({
    proposedSkillKey: "marine.small_engine_repair",
    sourceSummary: "cleaned a carburetor"
  });

  assert(known.state === "PROPOSED_NOT_GOVERNED", "known concept still needs governed association");
  assert(known.contributesExperience === false, "model proposal must not award Experience");
  assert(unknown.state === "UNRESOLVED", "unregistered concept should stay unresolved");
  assert(unknown.contributesExperience === false, "unknown semantic concept cannot award Experience");
});

Deno.test("alias collisions across Skills fail closed", () => {
  let threw = false;
  try {
    new SkillConceptRegistry()
      .register({
        skillKey: "creative.one",
        label: "One",
        version: "v1",
        practiceNameAliases: ["same practice"]
      })
      .register({
        skillKey: "creative.two",
        label: "Two",
        version: "v1",
        practiceNameAliases: ["Same   Practice"]
      });
  } catch (cause) {
    threw = cause instanceof Error && cause.message.includes("AMBIGUOUS_SKILL_PRACTICE_ALIAS");
  }
  assert(threw, "one governed normalized Practice alias cannot silently map to two Skills");
});

Deno.test("Practice session correction preserves Skill Experience identity", () => {
  const registry = createWayfinderSkillConceptRegistryV0();
  const concept = registry.get("creative.music_production")!;
  const result = buildSkillsProjection({
    providers: [
      practiceSkillProvider({
        skillKey: concept.skillKey,
        label: concept.label,
        read: practiceRead({
          eligible_encounter_count: 1,
          recent_encounters: [
            {
              id: "same-session",
              version: "v1",
              practice_id: "practice-a",
              practice_name: "Music Production",
              occurred_at: "2026-09-15T12:00:00.000Z",
              recorded_at: "2026-09-15T13:00:00.000Z"
            },
            {
              id: "same-session",
              version: "v2",
              practice_id: "practice-a",
              practice_name: "Music Production",
              occurred_at: "2026-09-15T12:05:00.000Z",
              recorded_at: "2026-09-16T13:00:00.000Z"
            }
          ]
        })
      })
    ],
    computedAt: "2026-09-19T12:00:00.000Z"
  });

  const encounter = result.skills[0].experience.recentEncounters[0];
  assert(result.skills[0].experience.recentEncounters.length === 1, "correction must not duplicate the logical PracticeSession");
  assert(encounter.source.version === "v2", "current/newer lineage should survive");
  assert(
    encounter.skillExperienceKey === "practice:session:same-session:skill:creative.music_production",
    "Skill Experience identity must remain logical session + stable Skill"
  );
});

Deno.test("one engine composes Training and multiple Practice-derived Skills without cross-mutation", () => {
  const registry = createWayfinderSkillConceptRegistryV0();
  const music = registry.get("creative.music_production")!;
  const drawing = registry.get("creative.drawing")!;

  const result = buildSkillsProjection({
    providers: [
      trainingStrengthSkillProvider(trainingRead()),
      practiceSkillProvider({
        skillKey: music.skillKey,
        label: music.label,
        read: practiceRead()
      }),
      practiceSkillProvider({
        skillKey: drawing.skillKey,
        label: drawing.label,
        read: practiceRead({
          eligible_encounter_count: 0,
          first_evidenced_at: null,
          last_evidenced_at: null,
          recent_encounters: []
        })
      })
    ],
    computedAt: "2026-09-19T12:00:00.000Z"
  });

  assert(result.configured_skill_count === 3, "three governed Skill concepts should compose");
  assert(result.observed_skill_count === 1, "only Music Production is observed in this fixture");
  assert(result.skills.find((item) => item.skillKey === "creative.music_production")?.state === "OBSERVED", "music should be observed");
  assert(result.skills.find((item) => item.skillKey === "creative.drawing")?.state === "UNOBSERVED", "drawing should remain unobserved");
  assert(result.skills.find((item) => item.skillKey === "physical.strength_training")?.state === "UNOBSERVED", "training should remain independently unobserved");
});
