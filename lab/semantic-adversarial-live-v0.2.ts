import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import {
  InMemorySemanticContextProvider,
  SemanticContextProviderRegistry,
  runReadOnlySemanticLoop,
  type ReadOnlySemanticLoopResult
} from "../supabase/functions/_shared/intelligence/context-assembler.ts";
import { LiveSemanticReasoner, OpenAIResponsesProvider } from "../supabase/functions/_shared/intelligence/live-semantic-reasoner.ts";
import type { CandidateLifeNode, SemanticContextBundle } from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
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
  maxOutputTokens: 5000
});
const concepts = createCoreLifeConceptRegistryV0();
const capacity = createWayfinderCapacityV0();

const contextCatalog = [
  { ref: "training:run:yesterday", kind: "event", summary: "Yesterday the player completed a 2.0 mile run.", concepts: ["RUNNING"], occurredAt: "2026-09-17T21:00:00.000Z", attributes: { distance: 2, unit: "MILE" } },
  { ref: "training:run:tuesday", kind: "event", summary: "Tuesday the player completed a 3.0 mile run.", concepts: ["RUNNING"], occurredAt: "2026-09-15T21:00:00.000Z", attributes: { distance: 3, unit: "MILE" } },
  { ref: "training:strength:legs:last", kind: "event", summary: "Most recent leg workout: squats, leg press, hamstring curls, calves.", concepts: ["STRENGTH_TRAINING"], occurredAt: "2026-09-16T22:00:00.000Z", attributes: { exercises: ["squats", "leg press", "hamstring curls", "calves"] } },
  { ref: "person:greg", kind: "entity", summary: "Greg is a known work contact.", concepts: ["PERSON"] },
  { ref: "person:john", kind: "entity", summary: "John is a known friend and work contact.", concepts: ["PERSON"] },
  { ref: "project:install:active", kind: "entity", summary: "Active Stage Presence install project.", concepts: ["PROJECT"] },
  { ref: "project:wedding:active", kind: "entity", summary: "Active wedding film edit project.", concepts: ["PROJECT"] },
  { ref: "nutrition:breakfast:1", kind: "event", summary: "Recent usual breakfast: three eggs and toast.", concepts: ["MEAL"], occurredAt: "2026-09-17T12:00:00.000Z", attributes: { eggs: 3, toast: true } },
  { ref: "nutrition:breakfast:2", kind: "event", summary: "Recent usual breakfast: three eggs and toast.", concepts: ["MEAL"], occurredAt: "2026-09-16T12:00:00.000Z", attributes: { eggs: 3, toast: true } },
  { ref: "finance:gas:last", kind: "event", summary: "Recent gas purchase was approximately 42 dollars.", concepts: ["EXPENSE"], occurredAt: "2026-09-16T18:00:00.000Z", attributes: { amount: 42, precision: "APPROXIMATE" } }
];

const providers = new SemanticContextProviderRegistry().register(new InMemorySemanticContextProvider(contextCatalog, [
  { phrase: "Stage", targetRef: "work:stage-presence", contextHint: "company/work context", strength: "HIGH" },
  { phrase: "Greg", targetRef: "person:greg", contextHint: "known work contact", strength: "HIGH" },
  { phrase: "John", targetRef: "person:john", contextHint: "known friend/work contact", strength: "HIGH" }
], concepts));

const initialContext: SemanticContextBundle = { asOf: "2026-09-18T22:30:00.000Z", items: [] };

type FailureClass = "LOSS" | "DISTORTION" | "FABRICATION";
type Finding = { class: FailureClass; code: string; detail: string };
type Scenario = { id: string; text: string; evaluate(result: ReadOnlySemanticLoopResult): Finding[] };

const scenarios: Scenario[] = [
  scenario("double-negation-run", "I didn't not run today.", (r) => {
    const runs=findAll(r,"RUNNING"); const f:Finding[]=[];
    if (!runs.some(n=>n.subject.kind==="SELF" && n.realityMode==="OCCURRED")) f.push(loss("DOUBLE_NEGATION_LOST","Double negation should preserve an occurred run."));
    if (runs.some(n=>n.subject.kind==="SELF" && n.realityMode==="NEGATED")) f.push(distortion("DOUBLE_NEGATION_FLIPPED","Double negation was reduced to a negated run."));
    return f;
  }),
  scenario("quoted-speech", 'Greg said "I ran five miles today."', (r) => {
    const f:Finding[]=[]; const runs=findAll(r,"RUNNING");
    if (runs.some(n=>n.subject.kind==="SELF")) f.push(fabrication("QUOTE_BECAME_PLAYER_REALITY","Quoted first-person speech became the player's run."));
    if (runs.length && !runs.some(n=>n.subject.kind==="KNOWN_OTHER"||n.subject.kind==="UNKNOWN_OTHER")) f.push(distortion("QUOTE_SUBJECT_LOST","Quoted run was not attached to the speaker."));
    return f;
  }),
  scenario("sarcastic-workout", "Yeah, amazing workout today — I sat on the couch the whole time.", (r) => {
    const f:Finding[]=[];
    if (findAll(r,"STRENGTH_TRAINING").some(n=>n.realityMode==="OCCURRED")) f.push(fabrication("SARCASM_LOGGED_WORKOUT","Sarcastic workout reference became an occurrence."));
    return f;
  }),
  scenario("third-party-pronoun", "Greg called about the install. He said it got delayed.", (r) => {
    const f:Finding[]=[];
    if (!find(r,"COMMUNICATION")) f.push(loss("CALL_MISSED","Communication event was missed."));
    if (!r.compilation.graph.nodes.some(n=>n.subject.entityRef==="person:greg"||n.subject.label?.toLowerCase()==="greg") && r.executedRequests.length===0) f.push(loss("GREG_REFERENCE_UNRESOLVED","Known Greg reference was neither resolved nor looked up."));
    return f;
  }),
  scenario("ambiguous-pronoun-two-people", "Greg and John were both there. He called me later.", (r) => {
    const f:Finding[]=[]; const comm=find(r,"COMMUNICATION");
    if (comm?.subject.entityRef && ["person:greg","person:john"].includes(comm.subject.entityRef)) f.push(fabrication("AMBIGUOUS_HE_FORCED","Ambiguous 'he' was forced to one known person."));
    if (!r.compilation.graph.nodes.some(n=>n.unresolved?.some(u=>u.blocking)) && r.compilation.graph.alternateInterpretations.length===0) f.push(loss("AMBIGUOUS_HE_NOT_PRESERVED","Ambiguous pronoun did not remain unresolved."));
    return f;
  }),
  scenario("relative-day-before-yesterday", "I ran two miles the day before yesterday.", (r) => {
    const f:Finding[]=[]; const run=find(r,"RUNNING");
    if (!run) return [loss("RUN_MISSED","Run was missed.")];
    if (run.temporal && run.temporal.precision==="UNKNOWN" && !run.temporal.relativeText) f.push(loss("RELATIVE_TIME_MISSED","Relative time was not preserved."));
    return f;
  }),
  scenario("correction-no-target", "Actually it was three miles, not two.", (r) => {
    const f:Finding[]=[];
    if (r.compilation.graph.nodes.some(n=>n.realityMode==="OCCURRED" && attrNumber(n,"distance")===3)) f.push(fabrication("UNTARGETED_CORRECTION_BECAME_NEW_EVENT","A correction without a resolved target became a new occurred event."));
    if (!r.compilation.graph.nodes.some(n=>n.realityMode==="CORRECTION"||n.unresolved?.some(u=>u.blocking))) f.push(loss("CORRECTION_NOT_PRESERVED","Correction semantics were lost."));
    return f;
  }),
  scenario("contradicts-context", "I didn't run yesterday.", (r) => {
    const f:Finding[]=[]; const runs=findAll(r,"RUNNING");
    if (!runs.some(n=>n.realityMode==="NEGATED")) f.push(loss("NEGATION_MISSED","Player negation was not preserved."));
    if (runs.some(n=>n.realityMode==="OCCURRED" && n.subject.kind==="SELF" && !hasContext(r,"training:run:yesterday"))) f.push(fabrication("CONTEXT_OVERRULED_PLAYER","Existing history silently overruled the player's contradiction."));
    return f;
  }),
  scenario("partial-copy-exception", "Same leg workout as last time, except I skipped calves.", (r) => {
    const f:Finding[]=[]; const strength=find(r,"STRENGTH_TRAINING");
    if (!strength) f.push(loss("LEG_WORKOUT_MISSED","Leg workout repetition was missed."));
    if (r.executedRequests.length===0 && !hasContext(r,"training:strength:legs:last")) f.push(loss("LAST_WORKOUT_NOT_RETRIEVED","Previous leg workout was not retrieved."));
    const text=JSON.stringify(strength?.attributes??{}).toLowerCase();
    if (text.includes("calves") && !text.includes("skip") && !text.includes("negat")) f.push(fabrication("SKIPPED_CALVES_REINTRODUCED","Skipped calves appear as completed without negative/skip semantics."));
    return f;
  }),
  scenario("unknown-physical-activity", "I went wing foiling for an hour.", (r) => {
    const f:Finding[]=[]; const node=r.compilation.graph.nodes.find(n=>/foil/i.test(n.concept)||n.parentConcepts?.includes("PHYSICAL_ACTIVITY"));
    if (!node) f.push(loss("UNKNOWN_ACTIVITY_DROPPED","Unknown physical activity was not represented."));
    if (node && node.concept==="RUNNING") f.push(distortion("UNKNOWN_ACTIVITY_COLLAPSED","Wing foiling was incorrectly collapsed into RUNNING."));
    return f;
  }),
  scenario("fact-plan-feeling", "I ran two miles, felt great, and I'm going to lift tomorrow.", (r) => {
    const f:Finding[]=[];
    if (!findAll(r,"RUNNING").some(n=>n.realityMode==="OCCURRED")) f.push(loss("FACT_RUN_MISSED","Occurred run was missed."));
    if (!r.compilation.graph.nodes.some(n=>n.concept==="STRENGTH_TRAINING" && ["PLANNED","INTENDED"].includes(n.realityMode))) f.push(loss("FUTURE_LIFT_MISSED","Future lifting intent/plan was missed."));
    if (r.compilation.graph.nodes.some(n=>n.concept==="STRENGTH_TRAINING" && n.realityMode==="OCCURRED")) f.push(fabrication("FUTURE_LIFT_OCCURRED","Tomorrow's lift became an occurrence."));
    return f;
  }),
  scenario("hypothetical-run", "If I run tomorrow, I'll probably feel better.", (r) => {
    const f:Finding[]=[];
    if (findAll(r,"RUNNING").some(n=>n.realityMode==="OCCURRED")) f.push(fabrication("HYPOTHETICAL_BECAME_REALITY","Conditional future run became occurred."));
    if (!r.compilation.graph.nodes.some(n=>["HYPOTHETICAL","POSSIBLE","EXPECTED"].includes(n.realityMode))) f.push(loss("HYPOTHETICAL_MODE_MISSED","Conditional semantics were lost."));
    return f;
  }),
  scenario("question-not-event", "Should I run today?", (r) => {
    const f:Finding[]=[];
    if (findAll(r,"RUNNING").some(n=>n.realityMode==="OCCURRED")) f.push(fabrication("QUESTION_BECAME_RUN","Question became occurred run."));
    if (!r.compilation.graph.nodes.some(n=>n.realityMode==="QUESTION")) f.push(loss("QUESTION_MODE_MISSED","Question mode was not preserved."));
    return f;
  }),
  scenario("counterfactual-run", "I would've run if it wasn't raining.", (r) => {
    const f:Finding[]=[];
    if (findAll(r,"RUNNING").some(n=>n.realityMode==="OCCURRED")) f.push(fabrication("COUNTERFACTUAL_BECAME_RUN","Counterfactual run became occurred."));
    return f;
  }),
  scenario("future-plan", "I'll run tomorrow morning.", (r) => {
    const f:Finding[]=[];
    const runs=findAll(r,"RUNNING");
    if (runs.some(n=>n.realityMode==="OCCURRED")) f.push(fabrication("FUTURE_PLAN_OCCURRED","Future run became occurred."));
    if (!runs.some(n=>["PLANNED","INTENDED","EXPECTED"].includes(n.realityMode))) f.push(loss("FUTURE_PLAN_MISSED","Future plan was not represented."));
    return f;
  }),
  scenario("uncertain-past-distance", "I think I ran around two miles earlier.", (r) => {
    const f:Finding[]=[]; const run=find(r,"RUNNING");
    if (!run) return [loss("UNCERTAIN_RUN_MISSED","Possible past run was missed.")];
    const d=run.attributes.distance;
    if (d?.precision==="EXACT") f.push(fabrication("AROUND_TWO_UPGRADED","Around two miles became exact."));
    if (run.certainty==="HIGH") f.push(distortion("UNCERTAINTY_ERASED","'I think' was upgraded to high certainty."));
    return f;
  }),
  scenario("strength-missing-exercise", "Did three sets of eight at 185.", (r) => {
    const f:Finding[]=[];
    const strength=find(r,"STRENGTH_TRAINING");
    if (strength && !strength.unresolved?.length && JSON.stringify(strength.attributes).toLowerCase().includes("bench")) f.push(fabrication("EXERCISE_INVENTED","Exercise identity was invented from sets/reps/load alone."));
    return f;
  }),
  scenario("run-unit-ambiguous", "Ran 5 today.", (r) => {
    const f:Finding[]=[]; const run=find(r,"RUNNING");
    if (!run) return [loss("RUN_MISSED","Run was missed.")];
    const d=run.attributes.distance;
    if (d?.state==="RESOLVED" && JSON.stringify(d.value).match(/mile|kilometer|km|mi/i)) f.push(fabrication("DISTANCE_UNIT_INVENTED","Unit was invented for bare '5'."));
    return f;
  }),
  scenario("implied-self", "Ran two miles after work.", (r) => {
    const f:Finding[]=[]; const run=find(r,"RUNNING");
    if (!run) f.push(loss("ELLIPTICAL_SELF_RUN_MISSED","Elliptical self-report run was missed."));
    else if (run.subject.kind!=="SELF") f.push(distortion("ELLIPTICAL_SUBJECT_WRONG","Omitted first-person subject was not interpreted as SELF."));
    return f;
  }),
  scenario("meal-after-home", "After I got home, I ate dinner.", (r) => {
    const f:Finding[]=[];
    if (!find(r,"MEAL")) f.push(loss("DINNER_MISSED","Dinner was missed."));
    if (r.compilation.graph.edges.length===0) f.push(loss("TEMPORAL_RELATION_MISSED","After relation was not represented."));
    return f;
  }),
  scenario("player-attributed-effect", "That run made me feel way better.", (r) => {
    const f:Finding[]=[];
    if (!find(r,"RUNNING") && r.executedRequests.length===0) f.push(loss("RUN_REFERENT_MISSED","Run referent was neither represented nor retrieved."));
    const hasEffect=r.compilation.graph.edges.some(e=>e.relation==="PLAYER_ATTRIBUTES_EFFECT"||e.relation==="RELATED_TO");
    if (!hasEffect) f.push(loss("ATTRIBUTED_EFFECT_MISSED","Player-attributed effect relation was not represented."));
    return f;
  }),
  scenario("metaphor-legs-on-fire", "My legs were on fire after that workout.", (r) => {
    const f:Finding[]=[];
    if (r.compilation.graph.nodes.some(n=>/fire/i.test(n.concept) && n.nodeType==="EVENT")) f.push(fabrication("METAPHOR_LITERALIZED","Metaphorical 'on fire' became a literal event."));
    return f;
  }),
  scenario("idiom-blew-up", "I blew up at work and felt bad about it afterward.", (r) => {
    const f:Finding[]=[];
    if (!find(r,"EMOTIONAL_STATE") && !r.compilation.graph.nodes.some(n=>n.nodeType==="STATE")) f.push(loss("EMOTIONAL_IDIOM_MISSED","Emotional/behavioral meaning was missed."));
    if (r.compilation.graph.nodes.some(n=>/explosion|explode/i.test(n.concept))) f.push(fabrication("IDIOM_LITERALIZED","'Blew up' became a literal explosion."));
    return f;
  }),
  scenario("skipped-lunch", "I skipped lunch today.", (r) => {
    const f:Finding[]=[]; const meals=findAll(r,"MEAL");
    if (meals.some(n=>n.realityMode==="OCCURRED")) f.push(fabrication("SKIPPED_MEAL_LOGGED","Skipped lunch became an eaten meal."));
    if (!meals.some(n=>n.realityMode==="NEGATED") && !r.compilation.graph.nodes.some(n=>n.unresolved?.length)) f.push(loss("SKIPPED_MEAL_SEMANTICS_MISSED","Skipped meal semantics were lost."));
    return f;
  }),
  scenario("shared-run", "Greg and I ran two miles together.", (r) => {
    const f:Finding[]=[]; const runs=findAll(r,"RUNNING");
    if (!runs.some(n=>n.subject.kind==="SELF")) f.push(loss("SELF_PARTICIPATION_MISSED","Player participation in shared run was missed."));
    if (!runs.some(n=>n.subject.kind==="KNOWN_OTHER"||n.subject.kind==="UNKNOWN_OTHER") && !r.compilation.graph.nodes.some(n=>n.concept==="PERSON")) f.push(loss("OTHER_PARTICIPANT_MISSED","Greg's participation was missed."));
    return f;
  }),
  scenario("shared-expense", "Greg and I split a forty dollar gas bill.", (r) => {
    const f:Finding[]=[]; const expense=find(r,"EXPENSE");
    if (!expense) return [loss("SHARED_EXPENSE_MISSED","Expense was missed.")];
    const amount=expense.attributes.amount;
    if (amount?.state==="RESOLVED" && Number(amount.value)===20 && !JSON.stringify(expense.attributes).toLowerCase().includes("share")) f.push(fabrication("PERSONAL_SHARE_ASSUMED","A $20 personal share was inferred without explicit allocation semantics."));
    return f;
  }),
  scenario("time-correction", "I ran Monday — actually, Tuesday.", (r) => {
    const f:Finding[]=[]; const runs=findAll(r,"RUNNING");
    if (runs.length>=2 && runs.some(n=>n.realityMode==="OCCURRED") && !runs.some(n=>n.realityMode==="CORRECTION")) f.push(distortion("TIME_CORRECTION_DUPLICATED","Temporal correction became multiple independent occurrences."));
    if (!runs.some(n=>n.realityMode==="CORRECTION") && !r.compilation.graph.edges.some(e=>e.relation==="CORRECTS")) f.push(loss("TIME_CORRECTION_MISSED","Temporal correction semantics were missed."));
    return f;
  }),
  scenario("usual-breakfast-exception", "Had my usual breakfast, but only two eggs today.", (r) => {
    const f:Finding[]=[]; const meal=find(r,"MEAL");
    if (!meal) return [loss("USUAL_MEAL_MISSED","Meal was missed.")];
    if (r.executedRequests.length===0 && !hasContextPrefix(r,"nutrition:breakfast:")) f.push(loss("USUAL_CONTEXT_NOT_USED","Usual breakfast history was not retrieved."));
    const payload=JSON.stringify(meal.attributes).toLowerCase();
    if (payload.includes('"eggs":3')||payload.includes('"value":3')) f.push(fabrication("USUAL_EGG_COUNT_OVERRULED_EXCEPTION","Historical three eggs overrode explicit two-egg exception."));
    return f;
  }),
  scenario("multi-project-that-one", "I worked on the wedding edit and the install today. That one is almost done.", (r) => {
    const f:Finding[]=[];
    if (!r.compilation.graph.nodes.some(n=>n.unresolved?.some(u=>u.blocking)) && r.compilation.graph.alternateInterpretations.length===0) f.push(loss("THAT_ONE_AMBIGUITY_MISSED","Ambiguous project reference was not preserved."));
    return f;
  }),
  scenario("reported-other-plan", "John says he's going to run tomorrow.", (r) => {
    const f:Finding[]=[]; const runs=findAll(r,"RUNNING");
    if (runs.some(n=>n.subject.kind==="SELF")) f.push(fabrication("OTHER_PLAN_BECAME_SELF","John's plan became the player's."));
    if (runs.some(n=>n.realityMode==="OCCURRED")) f.push(fabrication("OTHER_PLAN_BECAME_OCCURRENCE","John's future plan became occurred."));
    return f;
  }),
  scenario("uncertain-merchant-meal", "I think I grabbed Chipotle or maybe Cava after the run.", (r) => {
    const f:Finding[]=[]; const meal=find(r,"MEAL");
    if (!meal) f.push(loss("MEAL_MISSED","Meal occurrence was missed."));
    const s=JSON.stringify(meal?.attributes??{}).toLowerCase();
    if ((s.includes("chipotle")&&!s.includes("cava"))||(s.includes("cava")&&!s.includes("chipotle"))) {
      if (!meal?.unresolved?.length && r.compilation.graph.alternateInterpretations.length===0) f.push(fabrication("MERCHANT_AMBIGUITY_FORCED","One merchant was selected without preserving uncertainty."));
    }
    return f;
  }),
  scenario("negated-correction-chain", "No, not three miles — two and a half.", (r) => {
    const f:Finding[]=[];
    if (r.compilation.graph.nodes.some(n=>n.realityMode==="OCCURRED" && attrNumber(n,"distance")===2.5)) f.push(fabrication("CHAIN_CORRECTION_NEW_EVENT","Correction fragment became standalone occurrence."));
    if (!r.compilation.graph.nodes.some(n=>n.realityMode==="CORRECTION"||n.unresolved?.some(u=>u.blocking))) f.push(loss("CHAIN_CORRECTION_MISSED","Correction fragment was not preserved."));
    return f;
  }),
  scenario("mixed-other-self", "Greg walked five miles; I only ran one.", (r) => {
    const f:Finding[]=[];
    const walks=findAll(r,"WALKING"); const runs=findAll(r,"RUNNING");
    if (!runs.some(n=>n.subject.kind==="SELF")) f.push(loss("SELF_RUN_MISSED","Player run was missed."));
    if (walks.some(n=>n.subject.kind==="SELF")) f.push(fabrication("GREG_WALK_BECAME_SELF","Greg's walk became the player's."));
    return f;
  }),
  scenario("approx-time", "I ran sometime around lunch.", (r) => {
    const f:Finding[]=[]; const run=find(r,"RUNNING");
    if (!run) return [loss("RUN_MISSED","Run was missed.")];
    if (run.temporal?.precision==="EXACT") f.push(fabrication("APPROX_TIME_UPGRADED","Approximate lunch-time reference became exact."));
    return f;
  })
];

const report = {
  status: "COMPLETED",
  suite: "semantic-adversarial-live-v0.2",
  provider: "openai-responses",
  model,
  writesPermitted: false,
  scenarios: [] as Array<Record<string, unknown>>,
  summary: { scenarios: scenarios.length, passed: 0, loss: 0, distortion: 0, fabrication: 0 }
};

for (const s of scenarios) {
  try {
    const result=await runReadOnlySemanticLoop({
      source: source(s.text),
      initialContext,
      reasoner,
      concepts,
      capacity,
      providers,
      limits: { maxReasonerPasses: 2, maxRequestsPerPass: 3, maxContextItems: 20, maxItemsPerRequest: 6, maxPersonalAliases: 8 }
    });
    const findings=s.evaluate(result);
    if (!findings.length) report.summary.passed++;
    for (const finding of findings) report.summary[finding.class.toLowerCase() as "loss"|"distortion"|"fabrication"]++;
    report.scenarios.push({
      id:s.id,input:s.text,pass:findings.length===0,findings,
      reasonerPasses:result.reasonerPasses,
      executedContextRequests:result.executedRequests.map(q=>({kind:q.kind,concepts:q.concepts??[],query:q.query??null,purpose:q.purpose})),
      nodes:result.compilation.graph.nodes.map(n=>({id:n.candidateId,concept:n.concept,subject:n.subject,realityMode:n.realityMode,certainty:n.certainty,temporal:n.temporal??null,unresolved:n.unresolved??[]})),
      edges:result.compilation.graph.edges.map(e=>({relation:e.relation,from:e.fromCandidateId,to:e.toCandidateId,contextRefs:e.contextRefs??[]})),
      validationErrors:result.compilation.validationErrors
    });
  } catch (error) {
    report.summary.distortion++;
    report.scenarios.push({id:s.id,input:s.text,pass:false,runtimeError:error instanceof Error?error.message:String(error)});
  }
}

console.log(JSON.stringify(report,null,2));
if (report.summary.fabrication>0) Deno.exit(2);

function scenario(id:string,text:string,evaluate:Scenario["evaluate"]):Scenario { return {id,text,evaluate}; }
function source(content:string):SourceEnvelope {
  return {
    sourceId:`adversarial:${crypto.randomUUID()}`,
    sourceType:"PLAYER_TEXT",
    content,
    receivedAt:"2026-09-18T22:30:00.000Z",
    interactionIntent:"CONVERSATION",
    authorizesCanonicalWrite:false,
    zoneId:"America/New_York"
  };
}
function find(r:ReadOnlySemanticLoopResult,concept:string){return r.compilation.graph.nodes.find(n=>n.concept===concept);}
function findAll(r:ReadOnlySemanticLoopResult,concept:string){return r.compilation.graph.nodes.filter(n=>n.concept===concept);}
function attrNumber(n:CandidateLifeNode,name:string){const v=n.attributes[name]?.value; return typeof v==="number"?v:Number.NaN;}
function hasContext(r:ReadOnlySemanticLoopResult,ref:string){return r.context.items.some(i=>i.ref===ref)||JSON.stringify(r.compilation.graph).includes(ref);}
function hasContextPrefix(r:ReadOnlySemanticLoopResult,prefix:string){return r.context.items.some(i=>i.ref.startsWith(prefix))||JSON.stringify(r.compilation.graph).includes(prefix);}
function loss(code:string,detail:string):Finding{return{class:"LOSS",code,detail};}
function distortion(code:string,detail:string):Finding{return{class:"DISTORTION",code,detail};}
function fabrication(code:string,detail:string):Finding{return{class:"FABRICATION",code,detail};}
