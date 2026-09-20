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
import { createWayfinderAdmissionPlanningRegistryV0, planSemanticAdmission } from "../supabase/functions/_shared/intelligence/admission-planner.ts";

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
    id: "weekly-strength-standard",
    text: "I want at least 3 strength sessions per week.",
    evaluate: (result) => {
      const standard = find(result, "STRENGTH_SESSION_STANDARD");
      const findings: Finding[] = [];
      if (!standard) return [loss("STRENGTH_STANDARD_MISSED", "Recurring weekly strength target was not represented as STRENGTH_SESSION_STANDARD.")];
      if (standard.subject.kind !== "SELF") findings.push(distortion("STRENGTH_STANDARD_SUBJECT", "Player-authored Standard must remain SELF."));
      if (!["INTENDED", "CURRENT_STATE"].includes(standard.realityMode)) findings.push(distortion("STRENGTH_STANDARD_MODE", "Recurring Standard must remain normative rather than occurred."));
      const target = firstNumericAttribute(standard, ["targetSessions", "sessionsPerWeek", "weeklySessions", "sessionTarget", "target", "frequencyCount"]);
      if (target !== 3) findings.push(loss("STRENGTH_STANDARD_TARGET_MISSED", "Explicit weekly target of 3 was not preserved."));
      const plan = admissionPlan(result);
      if (!plan.proposals.some((proposal) => proposal.candidateId === standard.candidateId && proposal.owner === "training" && proposal.claimType === "TRAINING_STRENGTH_STANDARD")) {
        findings.push(loss("STRENGTH_STANDARD_NOT_ADMISSIBLE", "Recurring strength Standard did not reach Training admission."));
      }
      if (findAll(result, "STRENGTH_TRAINING").some((node) => node.realityMode === "OCCURRED")) {
        findings.push(fabrication("STRENGTH_STANDARD_BECAME_WORKOUT", "A recurring strength Standard was converted into an occurred workout."));
      }
      return findings;
    }
  },
  {
    id: "daily-protein-standard",
    text: "My daily protein target is 150 grams.",
    evaluate: (result) => {
      const standard = find(result, "PROTEIN_STANDARD");
      const findings: Finding[] = [];
      if (!standard) return [loss("PROTEIN_STANDARD_MISSED", "Recurring daily protein target was not represented as PROTEIN_STANDARD.")];
      if (standard.subject.kind !== "SELF") findings.push(distortion("PROTEIN_STANDARD_SUBJECT", "Player-authored Standard must remain SELF."));
      if (!["INTENDED", "CURRENT_STATE"].includes(standard.realityMode)) findings.push(distortion("PROTEIN_STANDARD_MODE", "Recurring Standard must remain normative rather than occurred."));
      const target = firstNumericAttribute(standard, ["targetGrams", "proteinGrams", "dailyProteinGrams", "proteinTarget", "target", "minimum"]);
      if (target !== 150) findings.push(loss("PROTEIN_STANDARD_TARGET_MISSED", "Explicit protein target of 150 grams was not preserved."));
      const plan = admissionPlan(result);
      if (!plan.proposals.some((proposal) => proposal.candidateId === standard.candidateId && proposal.owner === "nutrition" && proposal.claimType === "NUTRITION_PROTEIN_STANDARD")) {
        findings.push(loss("PROTEIN_STANDARD_NOT_ADMISSIBLE", "Recurring protein Standard did not reach Nutrition admission."));
      }
      if (findAll(result, "FOOD_INTAKE").some((node) => node.realityMode === "OCCURRED") || findAll(result, "MEAL").some((node) => node.realityMode === "OCCURRED")) {
        findings.push(fabrication("PROTEIN_STANDARD_BECAME_INTAKE", "A recurring protein Standard was converted into occurred intake."));
      }
      return findings;
    }
  },
  {
    id: "consumed-food-routes-nutrition",
    text: "I ate a turkey sandwich today.",
    evaluate: (result) => {
      const intake = find(result, "MEAL") ?? find(result, "FOOD_INTAKE");
      const findings: Finding[] = [];
      if (!intake) return [loss("CONSUMED_FOOD_MISSED", "Explicitly consumed food was not represented as MEAL or FOOD_INTAKE.")];
      if (intake.subject.kind !== "SELF" || intake.realityMode !== "OCCURRED") findings.push(distortion("CONSUMED_FOOD_REALITY", "Player consumption must remain SELF + OCCURRED."));
      const plan = admissionPlan(result);
      if (!plan.proposals.some((proposal) => proposal.candidateId === intake.candidateId && proposal.owner === "nutrition" && proposal.claimType === "NUTRITION_INTAKE")) {
        findings.push(loss("CONSUMED_FOOD_NOT_ADMISSIBLE", "Explicit consumption did not become a Nutrition admission proposal."));
      }
      const nutritionKeys = Object.entries(intake.attributes).filter(([key, field]) =>
        /calor|protein|carb|fat/i.test(key) && field.value != null
      );
      if (nutritionKeys.length) findings.push(fabrication("NUTRITION_TOTALS_INVENTED", "Calories or macros were supplied even though the player did not state them."));
      return findings;
    }
  },
  {
    id: "food-acquisition-does-not-route-nutrition",
    text: "I bought a turkey sandwich today.",
    evaluate: (result) => {
      const findings: Finding[] = [];
      const acquisition = find(result, "FOOD_ACQUISITION");
      if (!acquisition) findings.push(loss("FOOD_ACQUISITION_MISSED", "Buying food was not represented as FOOD_ACQUISITION."));
      if (findAll(result, "MEAL").some((node) => node.realityMode === "OCCURRED") || findAll(result, "FOOD_INTAKE").some((node) => node.realityMode === "OCCURRED")) {
        findings.push(fabrication("ACQUISITION_BECAME_CONSUMPTION", "Buying food was upgraded into eating it."));
      }
      if (admissionPlan(result).proposals.some((proposal) => proposal.owner === "nutrition")) {
        findings.push(fabrication("ACQUISITION_ADMITTED_TO_NUTRITION", "Food acquisition became a Nutrition admission proposal without evidence of consumption."));
      }
      return findings;
    }
  },
  {
    id: "acquisition-plus-explicit-consumption-routes-nutrition",
    text: "I grabbed Chipotle and ate it after the run.",
    evaluate: (result) => {
      const findings: Finding[] = [];
      const intake = find(result, "MEAL") ?? find(result, "FOOD_INTAKE");
      if (!intake || intake.realityMode !== "OCCURRED") return [loss("EXPLICIT_CONSUMPTION_MISSED", "Explicit eating after acquisition was not preserved as consumed intake.")];
      const plan = admissionPlan(result);
      if (!plan.proposals.some((proposal) => proposal.candidateId === intake.candidateId && proposal.owner === "nutrition")) findings.push(loss("EXPLICIT_CONSUMPTION_NOT_ADMISSIBLE", "Explicitly eaten food did not become a Nutrition admission proposal."));
      return findings;
    }
  },
  {
    id: "durable-direction-intent",
    text: "My long-term goal is to build a sustainable business.",
    evaluate: (result) => {
      const direction = find(result, "DIRECTION_INTENT");
      const findings: Finding[] = [];
      if (!direction) findings.push(loss("DIRECTION_INTENT_MISSED", "Durable player goal was not represented as DIRECTION_INTENT."));
      else {
        if (direction.subject.kind !== "SELF") findings.push(distortion("DIRECTION_SUBJECT", `Expected SELF, got ${direction.subject.kind}.`));
        if (!["INTENDED", "CURRENT_STATE"].includes(direction.realityMode)) findings.push(distortion("DIRECTION_REALITY_MODE", `Expected durable intent, got ${direction.realityMode}.`));
      }
      if (find(result, "SCHEDULE_ALLOCATION")) findings.push(distortion("DIRECTION_BECAME_SCHEDULE", "Long-term direction was incorrectly represented as a calendar allocation."));
      if (direction) {
        const route = result.compilation.routing.find((item) => item.candidateId === direction.candidateId);
        if (route?.route !== "ROUTE_TO_DOMAIN" || route.owner !== "direction") findings.push(loss("DIRECTION_NOT_ROUTED", "Durable direction did not reach the declared Direction owner."));
      }
      return findings;
    }
  },
  {
    id: "explicit-schedule-allocation",
    text: "Block tomorrow from 1 to 3 PM for editing the wedding film.",
    evaluate: (result) => {
      const allocation = find(result, "SCHEDULE_ALLOCATION");
      const findings: Finding[] = [];
      if (!allocation) findings.push(loss("SCHEDULE_ALLOCATION_MISSED", "Explicit time block was not represented as SCHEDULE_ALLOCATION."));
      else {
        if (allocation.subject.kind !== "SELF") findings.push(distortion("SCHEDULE_SUBJECT", `Expected SELF, got ${allocation.subject.kind}.`));
        if (allocation.realityMode !== "PLANNED") findings.push(distortion("SCHEDULE_REALITY_MODE", `Expected PLANNED, got ${allocation.realityMode}.`));
        if (!allocation.temporal?.interval?.from || !allocation.temporal?.interval?.to) findings.push(loss("SCHEDULE_INTERVAL_MISSED", "Explicit start/end block did not survive as a semantic interval."));
        const route = result.compilation.routing.find((item) => item.candidateId === allocation.candidateId);
        if (route?.route !== "ROUTE_TO_DOMAIN" || route.owner !== "schedule") findings.push(loss("SCHEDULE_NOT_ROUTED", "Explicit schedule allocation did not reach the declared Schedule owner."));
      }
      if (find(result, "DIRECTION_INTENT")) findings.push(distortion("SCHEDULE_BECAME_DIRECTION", "One-off calendar allocation was incorrectly represented as durable Direction."));
      return findings;
    }
  },
  {
    id: "occurred-music-production-routes-practice",
    text: "I worked on music production from 2 to 3 PM today.",
    evaluate: (result) => {
      const practice = find(result, "MUSIC_PRODUCTION");
      const findings: Finding[] = [];
      if (!practice) return [loss("MUSIC_PRODUCTION_MISSED", "Explicit Music Production practice was not represented.")];
      if (practice.subject.kind !== "SELF") findings.push(distortion("MUSIC_PRODUCTION_SUBJECT", "Player practice must remain SELF."));
      if (practice.realityMode !== "OCCURRED") findings.push(distortion("MUSIC_PRODUCTION_REALITY", "Completed practice must remain OCCURRED."));
      if (!practice.temporal?.interval?.from || !practice.temporal?.interval?.to) {
        findings.push(loss("MUSIC_PRODUCTION_INTERVAL_MISSED", "Explicit 2-to-3 PM interval was not preserved."));
      }
      const plan = admissionPlan(result);
      if (!plan.proposals.some((proposal) =>
        proposal.candidateId === practice.candidateId &&
        proposal.owner === "practice" &&
        proposal.claimType === "PRACTICE_SESSION"
      )) {
        findings.push(loss("MUSIC_PRODUCTION_NOT_ADMISSIBLE", "Occurred Music Production did not reach the Practice owner."));
      }
      return findings;
    }
  },
  {
    id: "occurred-drawing-routes-practice",
    text: "I drew from 7 to 7:30 PM today.",
    evaluate: (result) => {
      const practice = find(result, "DRAWING");
      const findings: Finding[] = [];
      if (!practice) return [loss("DRAWING_MISSED", "Explicit Drawing practice was not represented.")];
      if (practice.subject.kind !== "SELF") findings.push(distortion("DRAWING_SUBJECT", "Player Drawing practice must remain SELF."));
      if (practice.realityMode !== "OCCURRED") findings.push(distortion("DRAWING_REALITY", "Completed Drawing practice must remain OCCURRED."));
      if (!practice.temporal?.interval?.from || !practice.temporal?.interval?.to) {
        findings.push(loss("DRAWING_INTERVAL_MISSED", "Explicit drawing interval was not preserved."));
      }
      const plan = admissionPlan(result);
      if (!plan.proposals.some((proposal) =>
        proposal.candidateId === practice.candidateId &&
        proposal.owner === "practice" &&
        proposal.claimType === "PRACTICE_SESSION"
      )) {
        findings.push(loss("DRAWING_NOT_ADMISSIBLE", "Occurred Drawing did not reach the Practice owner."));
      }
      return findings;
    }
  },
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
      const work = find(result, "WORK_ACTIVITY");
      const run = find(result, "RUNNING");
      const explicitAfter = work && run && result.compilation.graph.edges.some((edge) =>
        edge.fromCandidateId === run.candidateId &&
        edge.toCandidateId === work.candidateId &&
        edge.relation === "AFTER"
      );
      if (!explicitAfter) findings.push(loss("EXPLICIT_AFTER_MISSED", "The source-supported RUNNING AFTER WORK_ACTIVITY relation was not preserved."));
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
      edges: result.compilation.graph.edges.map((edge) => ({ fromCandidateId: edge.fromCandidateId, relation: edge.relation, toCandidateId: edge.toCandidateId })),
      validationErrors: result.compilation.validationErrors
    });
  } catch (error) {
    report.summary.distortion += 1;
    report.scenarios.push({ id: scenario.id, input: scenario.text, pass: false, runtimeError: error instanceof Error ? error.message : String(error) });
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.summary.loss > 0 || report.summary.distortion > 0 || report.summary.fabrication > 0) Deno.exit(2);

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

function admissionPlan(result: ReadOnlySemanticLoopResult) {
  return planSemanticAdmission(result.compilation, createWayfinderAdmissionPlanningRegistryV0(), result.compilation.source.receivedAt);
}

function firstNumericAttribute(resultNode: ReadOnlySemanticLoopResult["compilation"]["graph"]["nodes"][number], names: string[]) {
  const normalized = new Map(Object.entries(resultNode.attributes).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]));
  for (const name of names) {
    const field = resultNode.attributes[name] ?? normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (!field) continue;
    if (typeof field.value === "number" && Number.isFinite(field.value)) return field.value;
    if (typeof field.value === "string" && field.value.trim() && Number.isFinite(Number(field.value))) return Number(field.value);
    if (field.value && typeof field.value === "object" && !Array.isArray(field.value)) {
      const row = field.value as Record<string, unknown>;
      for (const key of ["value", "count", "amount", "target", "minimum"]) {
        const candidate = row[key];
        if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
        if (typeof candidate === "string" && candidate.trim() && Number.isFinite(Number(candidate))) return Number(candidate);
      }
    }
  }
  return undefined;
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
