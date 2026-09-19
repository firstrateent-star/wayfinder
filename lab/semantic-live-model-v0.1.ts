import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  InMemorySemanticContextProvider,
  SemanticContextProviderRegistry,
  runReadOnlySemanticLoop,
  type ReadOnlySemanticLoopResult
} from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import { LiveSemanticReasoner, OpenAIResponsesProvider } from "../supabase/functions/_shared/intelligence/live-semantic-reasoner.ts";
import type { SemanticContextBundle } from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";
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

const contextCatalog = [
  { ref: "training:run:yesterday", kind: "event", summary: "Yesterday the player completed a 2.0 mile run.", concepts: ["RUNNING"], occurredAt: "2026-09-16T21:00:00.000Z", attributes: { distance: 2, unit: "MILE" } },
  { ref: "training:strength:legs:last", kind: "event", summary: "Most recent lower-body strength session with squats, leg press, hamstring curls and calves.", concepts: ["STRENGTH_TRAINING"], occurredAt: "2026-09-15T22:00:00.000Z" },
  { ref: "person:greg", kind: "entity", summary: "Greg is a known work contact.", concepts: ["PERSON"] },
  { ref: "project:install:active", kind: "entity", summary: "Active Stage Presence install project.", concepts: ["PROJECT"] },
  { ref: "nutrition:breakfast:1", kind: "event", summary: "Recent breakfast: three eggs and toast.", concepts: ["MEAL"], occurredAt: "2026-09-16T12:00:00.000Z" },
  { ref: "nutrition:breakfast:2", kind: "event", summary: "Recent breakfast: three eggs and toast.", concepts: ["MEAL"], occurredAt: "2026-09-15T12:00:00.000Z" }
];

const providers = new SemanticContextProviderRegistry().register(new InMemorySemanticContextProvider(contextCatalog, [
  { phrase: "Stage", targetRef: "work:stage-presence", contextHint: "company/work context", strength: "HIGH" }
], concepts));

const initialContext: SemanticContextBundle = {
  asOf: "2026-09-17T23:50:00.000Z",
  items: []
};

type FailureClass = "LOSS" | "DISTORTION" | "FABRICATION";
type Finding = { class: FailureClass; code: string; detail: string };
type Scenario = { id: string; text: string; evaluate(result: ReadOnlySemanticLoopResult): Finding[] };

const scenarios: Scenario[] = [
  {
    id: "occurred-run",
    text: "I ran today.",
    evaluate: (result) => {
      const run = find(result, "RUNNING");
      const findings: Finding[] = [];
      if (!run) findings.push(loss("RUN_MISSED", "RUNNING event was not recognized."));
      else {
        if (run.subject.kind !== "SELF") findings.push(distortion("RUN_SUBJECT", `Expected SELF, got ${run.subject.kind}.`));
        if (run.realityMode !== "OCCURRED") findings.push(distortion("RUN_REALITY_MODE", `Expected OCCURRED, got ${run.realityMode}.`));
      }
      return findings;
    }
  },
  {
    id: "negated-run",
    text: "I didn't run today.",
    evaluate: (result) => {
      const runs = findAll(result, "RUNNING");
      const findings: Finding[] = [];
      if (runs.some((item) => item.subject.kind === "SELF" && item.realityMode === "OCCURRED")) findings.push(fabrication("NEGATION_INVERTED", "Negated run became a player occurrence."));
      if (!runs.some((item) => item.subject.kind === "SELF" && item.realityMode === "NEGATED")) findings.push(loss("NEGATION_MISSED", "No explicit NEGATED run meaning was preserved."));
      return findings;
    }
  },
  {
    id: "third-party-run",
    text: "John ran five miles today.",
    evaluate: (result) => {
      const runs = findAll(result, "RUNNING");
      const findings: Finding[] = [];
      if (runs.some((item) => item.subject.kind === "SELF")) findings.push(fabrication("THIRD_PARTY_BECAME_SELF", "John's run was assigned to the player."));
      if (!runs.some((item) => item.subject.kind === "KNOWN_OTHER" || item.subject.kind === "UNKNOWN_OTHER")) findings.push(loss("THIRD_PARTY_SUBJECT_MISSED", "Third-party run subject was not preserved."));
      return findings;
    }
  },
  {
    id: "plan-negation-substitution",
    text: "I was gonna work out but felt like crap so I just walked.",
    evaluate: (result) => {
      const findings: Finding[] = [];
      if (findAll(result, "STRENGTH_TRAINING").some((item) => item.realityMode === "OCCURRED")) findings.push(fabrication("PLANNED_WORKOUT_LOGGED", "Uncompleted workout became an occurrence."));
      if (!findAll(result, "WALKING").some((item) => item.realityMode === "OCCURRED")) findings.push(loss("WALK_MISSED", "Substitute walk occurrence was missed."));
      if (!find(result, "ENERGY_STATE") && !find(result, "EMOTIONAL_STATE")) findings.push(loss("STATE_MISSED", "Subjective poor state was missed."));
      return findings;
    }
  },
  {
    id: "approximate-expense",
    text: "I think I spent like 40 bucks on gas.",
    evaluate: (result) => {
      const expense = find(result, "EXPENSE");
      const findings: Finding[] = [];
      if (!expense) return [loss("EXPENSE_MISSED", "Expense was not recognized.")];
      const amount = expense.attributes.amount;
      if (!amount) findings.push(loss("AMOUNT_MISSED", "Approximate amount was not represented."));
      else if (amount.precision === "EXACT") findings.push(fabrication("APPROXIMATION_ERASED", "'like 40' was upgraded to exact precision."));
      return findings;
    }
  },
  {
    id: "contextual-repeat",
    text: "Did basically the same thing as yesterday but a little longer.",
    evaluate: (result) => {
      const findings: Finding[] = [];
      const run = find(result, "RUNNING");
      if (!run) findings.push(loss("REPEAT_ACTIVITY_MISSED", "Yesterday's run was not recovered from context."));
      if (result.executedRequests.length === 0 && !result.compilation.graph.references.some((ref) => ref.resolvedRef === "training:run:yesterday")) findings.push(loss("CONTEXT_NOT_SOUGHT", "Reasoner neither requested nor resolved the necessary yesterday context."));
      const exactDistance = run?.attributes.distance;
      if (exactDistance?.precision === "EXACT" && exactDistance.value !== undefined) findings.push(fabrication("COMPARATIVE_DISTANCE_FABRICATED", "'a little longer' became an unsupported exact distance."));
      return findings;
    }
  },
  {
    id: "multi-domain-life-expression",
    text: "Worked late, ran about two miles after, grabbed Chipotle, and felt way less stressed by the time I got home.",
    evaluate: (result) => {
      const expected = ["WORK_ACTIVITY", "RUNNING", "FOOD_ACQUISITION", "EMOTIONAL_STATE"];
      const seen = new Set(result.compilation.graph.nodes.map((item) => item.concept));
      const findings: Finding[] = [];
      for (const concept of expected) if (!seen.has(concept)) findings.push(loss(`MULTI_${concept}_MISSED`, `${concept} was missing from multi-domain meaning.`));
      if (result.compilation.graph.edges.length < 2) findings.push(loss("RELATIONS_MISSED", "Cross-domain chronology/relations were not sufficiently represented."));
      return findings;
    }
  },
  {
    id: "ambiguous-colloquial",
    text: "I killed it today.",
    evaluate: (result) => {
      const findings: Finding[] = [];
      const confidentOccurrence = result.compilation.graph.nodes.find((item) => item.realityMode === "OCCURRED" && item.certainty === "HIGH" && ["STRENGTH_TRAINING", "WORK_ACTIVITY"].includes(item.concept));
      if (confidentOccurrence) findings.push(fabrication("COLLOQUIAL_OVERCOMMIT", `Ambiguous phrase became confident ${confidentOccurrence.concept} occurrence.`));
      const ambiguityPreserved = result.compilation.graph.alternateInterpretations.length > 0 || result.compilation.graph.nodes.some((item) => item.unresolved?.length);
      if (!ambiguityPreserved) findings.push(loss("COLLOQUIAL_AMBIGUITY_MISSED", "Ambiguous success phrase did not preserve alternatives or unresolved meaning."));
      return findings;
    }
  },
  {
    id: "usual-breakfast-context",
    text: "Had my usual breakfast.",
    evaluate: (result) => {
      const meal = find(result, "MEAL");
      const findings: Finding[] = [];
      if (!meal) findings.push(loss("MEAL_MISSED", "Breakfast occurrence was missed."));
      const usedBreakfastContext = result.compilation.graph.nodes.some((item) => Object.values(item.attributes).some((field) => field.contextRefs?.some((ref) => ref.startsWith("nutrition:breakfast:")))) || result.compilation.graph.references.some((ref) => ref.candidateRefs.some((candidate) => candidate.startsWith("nutrition:breakfast:")));
      if (result.executedRequests.length === 0 && !usedBreakfastContext) findings.push(loss("USUAL_PATTERN_CONTEXT_MISSED", "Personal breakfast history was not requested or used."));
      return findings;
    }
  }
];

const report = {
  status: "COMPLETED",
  provider: "openai-responses",
  model,
  writesPermitted: false,
  scenarios: [] as Array<Record<string, unknown>>,
  summary: { scenarios: scenarios.length, passed: 0, loss: 0, distortion: 0, fabrication: 0 }
};

for (const scenario of scenarios) {
  try {
    const result = await runReadOnlySemanticLoop({
      source: source(scenario.text),
      initialContext,
      reasoner,
      concepts,
      capacity,
      providers,
      limits: { maxReasonerPasses: 2, maxRequestsPerPass: 3, maxContextItems: 20, maxItemsPerRequest: 6, maxPersonalAliases: 8 }
    });
    const findings = scenario.evaluate(result);
    if (findings.length === 0) report.summary.passed += 1;
    for (const finding of findings) report.summary[finding.class.toLowerCase() as "loss" | "distortion" | "fabrication"] += 1;
    report.scenarios.push({
      id: scenario.id,
      input: scenario.text,
      pass: findings.length === 0,
      findings,
      reasonerPasses: result.reasonerPasses,
      executedContextRequests: result.executedRequests.map((request) => ({ kind: request.kind, concepts: request.concepts ?? [], purpose: request.purpose })),
      nodes: result.compilation.graph.nodes.map((node) => ({ id: node.candidateId, concept: node.concept, subject: node.subject.kind, realityMode: node.realityMode, certainty: node.certainty })),
      routing: result.compilation.routing.map((route) => ({ candidateId: route.candidateId, route: route.route, reason: route.reason })),
      validationErrors: result.compilation.validationErrors
    });
  } catch (error) {
    report.summary.distortion += 1;
    report.scenarios.push({ id: scenario.id, input: scenario.text, pass: false, runtimeError: error instanceof Error ? error.message : String(error) });
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.summary.fabrication > 0) Deno.exit(2);

function source(content: string): SourceEnvelope {
  return {
    sourceId: `live-eval:${crypto.randomUUID()}`,
    sourceType: "PLAYER_TEXT",
    content,
    receivedAt: "2026-09-17T23:50:00.000Z",
    interactionIntent: "CONVERSATION",
    authorizesCanonicalWrite: false,
    zoneId: "America/New_York"
  };
}

function find(result: ReadOnlySemanticLoopResult, concept: string) {
  return result.compilation.graph.nodes.find((item) => item.concept === concept);
}

function findAll(result: ReadOnlySemanticLoopResult, concept: string) {
  return result.compilation.graph.nodes.filter((item) => item.concept === concept);
}

function loss(code: string, detail: string): Finding { return { class: "LOSS", code, detail }; }
function distortion(code: string, detail: string): Finding { return { class: "DISTORTION", code, detail }; }
function fabrication(code: string, detail: string): Finding { return { class: "FABRICATION", code, detail }; }
