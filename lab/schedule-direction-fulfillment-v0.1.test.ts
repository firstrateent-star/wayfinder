import { createCoreLifeConceptRegistryV0 } from "../supabase/functions/_shared/intelligence/concept-registry.ts";
import { createWayfinderCapacityV0 } from "../supabase/functions/_shared/intelligence/wayfinder-capacity.ts";
import { createWayfinderAdmissionPlanningRegistryV0, planSemanticAdmission } from "../supabase/functions/_shared/intelligence/admission-planner.ts";
import { createWayfinderFulfillmentRegistryV0, fulfillAdmissionPlan, authorizeStagedFulfillment, type StagedAdmissionEnvelope } from "../supabase/functions/_shared/intelligence/admission-fulfillment.ts";
import type { CandidateLifeGraph, CandidateLifeNode, SemanticCompilation } from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";
import type { SourceEnvelope } from "../supabase/functions/_shared/intelligence/semantic-admission.ts";
import { recoverExplicitScheduleInterval } from "../supabase/functions/_shared/intelligence/schedule-temporal-reconciliation.ts";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const concepts=createCoreLifeConceptRegistryV0(); const capacity=createWayfinderCapacityV0();
function source(content:string):SourceEnvelope{return{sourceId:"domain:"+content,sourceType:"PLAYER_TEXT",content,receivedAt:"2026-09-19T19:30:00.000Z",interactionIntent:"CONVERSATION",authorizesCanonicalWrite:false,zoneId:"America/New_York"};}
function compile(inputSource:SourceEnvelope,node:CandidateLifeNode):SemanticCompilation{
 const graph:CandidateLifeGraph={sourceId:inputSource.sourceId,nodes:[node],edges:[],references:[],alternateInterpretations:[],trace:[]};
 const assessment=capacity.assessNode(node); const routes=assessment.declaredPersistRoutes;
 return{source:inputSource,graph,capacity:[assessment],routing:[routes.length===1?{candidateId:node.candidateId,route:"ROUTE_TO_DOMAIN",owner:routes[0].owner,claimType:routes[0].claimType,reason:"DETERMINISTIC_DECLARED_CLAIM_ROUTE",capacity:assessment}:{candidateId:node.candidateId,route:"SESSION_ONLY",reason:"NO_ROUTE",capacity:assessment}],contextRequests:[],validationErrors:[]};
}
async function run(inputSource:SourceEnvelope,node:CandidateLifeNode){const compilation=compile(inputSource,node);const plan=planSemanticAdmission(compilation,createWayfinderAdmissionPlanningRegistryV0());const fulfillment=await fulfillAdmissionPlan(compilation,plan,{asOf:inputSource.receivedAt,items:[]},createWayfinderFulfillmentRegistryV0());return{compilation,plan,fulfillment};}

Deno.test("explicit relative schedule interval is recovered deterministically",()=>{
 const recovered=recoverExplicitScheduleInterval(source("Block tomorrow from 1 to 3 PM for editing the wedding film."));
 assert(recovered?.from==="2026-09-20T17:00:00.000Z","1 PM tomorrow should resolve through the player timezone");
 assert(recovered?.to==="2026-09-20T19:00:00.000Z","3 PM tomorrow should resolve through the player timezone");
 assert(recovered?.localDate==="2026-09-20","tomorrow local date should be preserved");
});
Deno.test("vague or meridiem-ambiguous schedule text is not upgraded",()=>{
 assert(recoverExplicitScheduleInterval(source("Schedule editing tomorrow."))===null,"day-only timing must stay unresolved");
 assert(recoverExplicitScheduleInterval(source("Block tomorrow from 11 to 1 PM for editing."))===null,"cross-meridiem shorthand must not be guessed");
});
Deno.test("explicit cross-noon meridiems resolve safely",()=>{
 const recovered=recoverExplicitScheduleInterval(source("Block tomorrow from 11 AM to 1 PM for editing."));
 assert(recovered?.from==="2026-09-20T15:00:00.000Z","explicit 11 AM should resolve");
 assert(recovered?.to==="2026-09-20T17:00:00.000Z","explicit 1 PM should resolve");
});

Deno.test("new semantic concepts are explicitly registered",()=>{assert(concepts.get("DIRECTION_INTENT")?.kind==="ABSTRACT","Direction concept missing");assert(concepts.get("SCHEDULE_ALLOCATION")?.kind==="ABSTRACT","Schedule concept missing");});
Deno.test("durable player intention routes only to Direction",async()=>{
 const node:CandidateLifeNode={candidateId:"d",nodeType:"INTENTION",concept:"DIRECTION_INTENT",subject:{kind:"SELF"},realityMode:"INTENDED",attributes:{title:{value:"Build a sustainable business",state:"RESOLVED",certainty:"HIGH",sourceSpans:["Build a sustainable business"]}},certainty:"HIGH",sourceSpans:["My goal is to build a sustainable business."]};
 const {plan,fulfillment}=await run(source("My goal is to build a sustainable business."),node);
 assert(plan.proposals[0]?.owner==="direction","Direction should own durable intent"); assert(fulfillment.items[0]?.disposition==="READY_FOR_CONFIRMATION","Direction should lower");
});
Deno.test("occurred or third-party direction-looking content cannot become player Direction",async()=>{for(const [subject,reality] of [["SELF","OCCURRED"],["KNOWN_OTHER","INTENDED"]] as const){const node:CandidateLifeNode={candidateId:"d",nodeType:"INTENTION",concept:"DIRECTION_INTENT",subject:{kind:subject,...(subject==="KNOWN_OTHER"?{label:"Greg"}:{})},realityMode:reality,attributes:{title:{value:"Grow the company",state:"RESOLVED"}},certainty:"HIGH"};const {plan}=await run(source("goal"),node);assert(plan.proposals.length===0,subject+"/"+reality+" must not create Direction proposal");}});
Deno.test("planned exact interval becomes SOFT Schedule block by default",async()=>{
 const node:CandidateLifeNode={candidateId:"s",nodeType:"PLAN",concept:"SCHEDULE_ALLOCATION",subject:{kind:"SELF"},realityMode:"PLANNED",attributes:{title:{value:"Edit wedding film",state:"RESOLVED",sourceSpans:["Edit wedding film"]}},temporal:{interval:{from:"2026-09-20T17:00:00.000Z",to:"2026-09-20T19:00:00.000Z"},precision:"EXACT",certainty:"HIGH"},certainty:"HIGH",sourceSpans:["Block 1 to 3 tomorrow for editing."]};
 const {plan,fulfillment}=await run(source("Block 1 to 3 tomorrow for editing."),node); const payload=fulfillment.items[0]?.normalizedPayload as any;
 assert(plan.proposals[0]?.owner==="schedule","Schedule should own planned allocation"); assert(fulfillment.items[0]?.disposition==="READY_FOR_CONFIRMATION","interval should be confirmable"); assert(payload.allocationKind==="SOFT","default must be SOFT");
});
Deno.test("day-level schedule meaning clarifies instead of inventing clock time",async()=>{const node:CandidateLifeNode={candidateId:"s",nodeType:"PLAN",concept:"SCHEDULE_ALLOCATION",subject:{kind:"SELF"},realityMode:"PLANNED",attributes:{title:{value:"Edit wedding film",state:"RESOLVED"}},temporal:{localDate:"2026-09-20",precision:"RELATIVE",certainty:"HIGH"},certainty:"HIGH"};const {fulfillment}=await run(source("Schedule editing tomorrow."),node);assert(fulfillment.items[0]?.disposition==="NEEDS_CLARIFICATION","day-level plan must clarify");assert(fulfillment.items[0]?.reason==="SCHEDULE_TIME_WINDOW_REQUIRED","time gap explicit");});
Deno.test("schedule occurrence never routes as a planned allocation",async()=>{const node:CandidateLifeNode={candidateId:"s",nodeType:"EVENT",concept:"SCHEDULE_ALLOCATION",subject:{kind:"SELF"},realityMode:"OCCURRED",attributes:{title:{value:"Meeting",state:"RESOLVED"}},certainty:"HIGH"};const {plan}=await run(source("The meeting happened."),node);assert(plan.proposals.length===0,"occurred must not become Schedule plan");});
Deno.test("authorized Direction and Schedule envelopes rerun owning AdmissionContracts",async()=>{
 const cases:[StagedAdmissionEnvelope,string,string][]=[
 [{proposalId:"11111111-1111-4111-8111-111111111111",plannerProposalId:"p:d",episodeId:"e",turnId:"t",candidateId:"d",owner:"direction",claimType:"DIRECTION_NODE",normalizedPayload:{kind:"direction",title:"Build a sustainable business",intentState:"ACTIVE"},sourceContext:{sourceId:"s",receivedAt:"2026-09-19T19:30:00Z",zoneId:"America/New_York"},summary:"direction",commandId:"22222222-2222-4222-8222-222222222222"},"direction","direction.create_node"],
 [{proposalId:"33333333-3333-4333-8333-333333333333",plannerProposalId:"p:s",episodeId:"e",turnId:"t",candidateId:"s",owner:"schedule",claimType:"SCHEDULE_ALLOCATION",normalizedPayload:{label:"Edit",allocationKind:"SOFT",startsAt:"2026-09-20T17:00:00Z",endsAt:"2026-09-20T19:00:00Z",zoneId:"America/New_York"},sourceContext:{sourceId:"s",receivedAt:"2026-09-19T19:30:00Z",zoneId:"America/New_York"},summary:"schedule",commandId:"44444444-4444-4444-8444-444444444444"},"schedule","schedule.create_allocation"]
 ];
 for(const [envelope,module,commandType] of cases){const decision=await authorizeStagedFulfillment(envelope);assert(decision.disposition==="ACCEPT",module+" should accept");assert(decision.command?.module===module&&decision.command.commandType===commandType,module+" owns command");assert(decision.command.args.p_command_id===envelope.commandId,"staged id controls idempotency");}
});
