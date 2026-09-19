import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import { SemanticContextProviderRegistry, type ReadOnlySemanticLoopResult } from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import {
  runSemanticEpisodeTurn,
  type SemanticEpisode
} from "../supabase/functions/_shared/intelligence/semantic-episode.ts";
import type { SemanticContextBundle } from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";
import { LiveSemanticReasoner, OpenAIResponsesProvider } from "../supabase/functions/_shared/intelligence/live-semantic-reasoner.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";

const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
if (!apiKey) {
  console.log(JSON.stringify({ status: "SKIPPED", reason: "OPENAI_API_KEY_NOT_CONFIGURED", writesPermitted: false }));
  Deno.exit(0);
}

const model = Deno.env.get("WAYFINDER_SEMANTIC_MODEL")?.trim() || "gpt-5.6-luna";
const reasoner = new LiveSemanticReasoner({
  provider: new OpenAIResponsesProvider({ apiKey }),
  model,
  maxOutputTokens: 4500
});
const concepts = createCoreLifeConceptRegistryV0();
const capacity = createWayfinderCapacityV0();
const providers = new SemanticContextProviderRegistry();
const initialContext: SemanticContextBundle = {
  asOf: "2026-09-19T18:00:00.000Z",
  items: []
};

type FailureClass = "LOSS" | "DISTORTION" | "FABRICATION";
type Finding = { class: FailureClass; code: string; detail: string };
type EpisodeScenario = {
  id: string;
  turns: string[];
  evaluate(results: ReadOnlySemanticLoopResult[], episode: SemanticEpisode): Finding[];
};

const scenarios: EpisodeScenario[] = [
  scenario("elliptical-workout-focus", [
    "I worked out today.",
    "Legs."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    const workout = find(current, "STRENGTH_TRAINING");
    if (!workout) findings.push(loss("ELLIPSIS_WORKOUT_MISSED", "Legs did not resolve against the prior workout."));
    else {
      if (workout.subject.kind !== "SELF") findings.push(distortion("ELLIPSIS_SUBJECT_DRIFT", "Prior self workout changed subject."));
      if (!hasEpisodeRef(current)) findings.push(loss("ELLIPSIS_PRIOR_TURN_NOT_USED", "Workout refinement did not cite transient episode context."));
      const payload = JSON.stringify(workout.attributes).toLowerCase();
      if (!payload.includes("leg")) findings.push(loss("ELLIPSIS_FOCUS_MISSED", "Leg focus was not represented on the refined workout."));
    }
    return findings;
  }),

  scenario("cross-turn-distance-correction", [
    "I ran two miles earlier.",
    "Actually 2.5."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    const runs = findAll(current, "RUNNING");
    if (runs.some((node) => node.realityMode === "OCCURRED")) {
      findings.push(fabrication("CORRECTION_BECAME_NEW_RUN", "Distance correction became a fresh occurred run."));
    }
    if (!runs.some((node) => node.realityMode === "CORRECTION") && !current.compilation.graph.nodes.some((node) => node.realityMode === "CORRECTION")) {
      findings.push(loss("CORRECTION_SEMANTICS_MISSED", "Correction semantics were not preserved."));
    }
    if (!hasEpisodeRef(current)) findings.push(loss("CORRECTION_TARGET_NOT_LINKED", "Correction did not cite the prior transient run."));
    return findings;
  }),

  scenario("third-party-pronoun-followup", [
    "Greg said he ran five miles today.",
    "He said it felt great."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    if (current.compilation.graph.nodes.some((node) => node.subject.kind === "SELF" && ["RUNNING", "EMOTIONAL_STATE", "COMMUNICATION"].includes(node.concept))) {
      findings.push(fabrication("THIRD_PARTY_PRONOUN_BECAME_SELF", "Greg's follow-up was reassigned to the player."));
    }
    if (!hasEpisodeRef(current)) findings.push(loss("THIRD_PARTY_PRONOUN_CONTEXT_MISSED", "Pronoun follow-up did not cite transient prior-turn context."));
    return findings;
  }),

  scenario("ambiguous-two-person-pronoun", [
    "Greg and John were both at the install.",
    "He called me later."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    const graph = current.compilation.graph;
    const communication = find(current, "COMMUNICATION");
    if (!communication) findings.push(loss("AMBIGUOUS_CALL_MISSED", "The call meaning was not represented."));
    const ambiguityPreserved =
      graph.alternateInterpretations.length > 0 ||
      graph.nodes.some((node) => node.unresolved?.some((item) => item.blocking || /refer|subject|person|pronoun|who/i.test(item.code + " " + item.description))) ||
      graph.references.some((ref) => ref.status !== "RESOLVED" || ref.candidateRefs.length > 1);
    if (!ambiguityPreserved) {
      const forced = graph.nodes.some((node) =>
        node.subject.kind === "KNOWN_OTHER" &&
        Boolean(node.subject.label) &&
        node.certainty === "HIGH"
      );
      if (forced) findings.push(fabrication("AMBIGUOUS_PRONOUN_FORCED", "He was resolved to one person without support."));
      else findings.push(loss("AMBIGUOUS_PRONOUN_NOT_PRESERVED", "Two-person pronoun ambiguity was not represented."));
    }
    return findings;
  }),

  scenario("cross-turn-negation", [
    "I worked out today.",
    "Actually, no—I didn't."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    if (findAll(current, "STRENGTH_TRAINING").some((node) => node.realityMode === "OCCURRED")) {
      findings.push(fabrication("NEGATION_LEFT_FRESH_OCCURRENCE", "Negating follow-up emitted a fresh occurred workout."));
    }
    if (!current.compilation.graph.nodes.some((node) => node.realityMode === "NEGATED" || node.realityMode === "CORRECTION")) {
      findings.push(loss("NEGATING_FOLLOWUP_MISSED", "The follow-up did not preserve negation/correction semantics."));
    }
    if (!hasEpisodeRef(current)) findings.push(loss("NEGATION_PRIOR_TURN_NOT_LINKED", "Negation did not link to the prior transient workout."));
    return findings;
  }),

  scenario("unknowns-stay-unknown", [
    "I worked out this morning.",
    "That's all I remember."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    for (const node of current.compilation.graph.nodes) {
      const payload = JSON.stringify(node.attributes).toLowerCase();
      if (/(squat|bench|deadlift|curl|press|calf|rep|set)/i.test(payload)) {
        findings.push(fabrication("MEMORY_GAP_FILLED_WITH_DETAIL", "Unremembered workout detail was invented."));
        break;
      }
    }
    return findings;
  }),

  scenario("ambiguous-project-reference", [
    "I worked on the wedding edit and the install today.",
    "That one is almost done."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    const graph = current.compilation.graph;
    const ambiguityPreserved =
      graph.alternateInterpretations.length > 0 ||
      graph.nodes.some((node) => node.unresolved?.some((item) => item.blocking || /refer|project|which/i.test(item.code + " " + item.description))) ||
      graph.references.some((ref) => ref.status !== "RESOLVED" || ref.candidateRefs.length > 1);
    if (!ambiguityPreserved) {
      const forcedProject = graph.nodes.find((node) =>
        node.concept === "PROJECT" &&
        node.certainty === "HIGH" &&
        (Boolean(node.subject.label) || Object.keys(node.attributes).length > 0)
      );
      if (forcedProject) findings.push(fabrication("AMBIGUOUS_PROJECT_FORCED", "That one was assigned to one project without support."));
      else findings.push(loss("AMBIGUOUS_PROJECT_NOT_PRESERVED", "Ambiguous project reference was not preserved."));
    }
    return findings;
  }),

  scenario("shared-run-distance-refinement", [
    "Greg and I ran earlier.",
    "About two miles."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    const run = find(current, "RUNNING");
    if (!run) findings.push(loss("SHARED_RUN_REFINEMENT_MISSED", "Distance fragment did not resolve against the shared run."));
    else {
      if (run.subject.kind !== "SELF") findings.push(distortion("SHARED_RUN_SELF_LOST", "Shared run refinement lost SELF as the event subject."));
      const distance = run.attributes.distance;
      if (!distance) findings.push(loss("SHARED_RUN_DISTANCE_MISSED", "Approximate distance was not attached to the prior run."));
      else if (distance.precision === "EXACT") findings.push(fabrication("APPROX_DISTANCE_UPGRADED", "About two miles became exact."));
      if (!hasEpisodeRef(current)) findings.push(loss("SHARED_RUN_PRIOR_TURN_NOT_USED", "Distance refinement did not cite transient prior-turn context."));
    }
    return findings;
  }),

  scenario("repeat-with-explicit-exception", [
    "Yesterday I did squats, leg press, hamstring curls, and calves.",
    "Same thing today, except I skipped calves."
  ], (results) => {
    const current = last(results);
    const findings: Finding[] = [];
    const workout = find(current, "STRENGTH_TRAINING");
    if (!workout) findings.push(loss("REPEAT_WORKOUT_MISSED", "Repeated workout pattern was not recognized."));
    if (!hasEpisodeRef(current)) findings.push(loss("REPEAT_PRIOR_PATTERN_NOT_USED", "Same thing did not cite prior transient context."));

    if (workout) {
      for (const [name, field] of Object.entries(workout.attributes)) {
        const value = JSON.stringify(field.value ?? "").toLowerCase();
        if (!value.includes("calf")) continue;
        const key = name.toLowerCase();
        if (!/(skip|omit|exclude|negat|not_done|notdone)/.test(key)) {
          findings.push(fabrication("EXPLICIT_EXCEPTION_OVERRIDDEN", "Skipped calves were carried forward as completed workout detail."));
          break;
        }
      }
    }
    return findings;
  })
];

const report = {
  status: "COMPLETED",
  suite: "semantic-episode-live-v0.1",
  provider: "openai-responses",
  model,
  writesPermitted: false,
  scenarios: [] as Array<Record<string, unknown>>,
  summary: { scenarios: scenarios.length, passed: 0, loss: 0, distortion: 0, fabrication: 0 }
};

for (const s of scenarios) {
  let episode: SemanticEpisode | undefined;
  const results: ReadOnlySemanticLoopResult[] = [];

  try {
    for (let turnIndex = 0; turnIndex < s.turns.length; turnIndex++) {
      const outcome = await runSemanticEpisodeTurn({
        episode,
        episodeId: "live:" + s.id,
        source: source(s.id, turnIndex, s.turns[turnIndex]),
        initialContext,
        reasoner,
        concepts,
        capacity,
        providers,
        episodeLimits: { maxTurns: 12, maxContextNodes: 12 },
        semanticLimits: {
          maxReasonerPasses: 2,
          maxRequestsPerPass: 3,
          maxContextItems: 20,
          maxItemsPerRequest: 6,
          maxPersonalAliases: 8
        }
      });
      episode = outcome.episode;
      results.push(outcome.result);
    }

    if (!episode) throw new Error("EPISODE_NOT_CREATED");
    const findings = s.evaluate(results, episode);
    if (findings.length === 0) report.summary.passed += 1;
    for (const finding of findings) {
      report.summary[finding.class.toLowerCase() as "loss" | "distortion" | "fabrication"] += 1;
    }

    report.scenarios.push({
      id: s.id,
      turns: s.turns,
      pass: findings.length === 0,
      findings,
      episodeTurns: episode.turns.length,
      outputs: results.map((result, index) => ({
        turn: index + 1,
        nodes: result.compilation.graph.nodes.map((node) => ({
          id: node.candidateId,
          concept: node.concept,
          subject: node.subject,
          realityMode: node.realityMode,
          certainty: node.certainty,
          attributes: node.attributes,
          unresolved: node.unresolved ?? []
        })),
        references: result.compilation.graph.references,
        alternateInterpretations: result.compilation.graph.alternateInterpretations,
        routing: result.compilation.routing.map((route) => ({
          candidateId: route.candidateId,
          route: route.route,
          reason: route.reason
        })),
        validationErrors: result.compilation.validationErrors
      }))
    });
  } catch (error) {
    report.summary.distortion += 1;
    report.scenarios.push({
      id: s.id,
      turns: s.turns,
      pass: false,
      runtimeError: error instanceof Error ? error.message : String(error)
    });
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.summary.fabrication > 0) Deno.exit(2);

function scenario(id: string, turns: string[], evaluate: EpisodeScenario["evaluate"]): EpisodeScenario {
  return { id, turns, evaluate };
}

function source(scenarioId: string, turnIndex: number, content: string): SourceEnvelope {
  const minute = String(turnIndex).padStart(2, "0");
  return {
    sourceId: "episode-live:" + scenarioId + ":turn:" + (turnIndex + 1),
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-19T18:" + minute + ":00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}

function last(results: ReadOnlySemanticLoopResult[]) {
  const result = results.at(-1);
  if (!result) throw new Error("MISSING_EPISODE_RESULT");
  return result;
}

function find(result: ReadOnlySemanticLoopResult, concept: string) {
  return result.compilation.graph.nodes.find((node) => node.concept === concept);
}

function findAll(result: ReadOnlySemanticLoopResult, concept: string) {
  return result.compilation.graph.nodes.filter((node) => node.concept === concept);
}

function hasEpisodeRef(result: ReadOnlySemanticLoopResult) {
  return JSON.stringify(result.compilation.graph).includes("episode:");
}

function loss(code: string, detail: string): Finding {
  return { class: "LOSS", code, detail };
}

function distortion(code: string, detail: string): Finding {
  return { class: "DISTORTION", code, detail };
}

function fabrication(code: string, detail: string): Finding {
  return { class: "FABRICATION", code, detail };
}
