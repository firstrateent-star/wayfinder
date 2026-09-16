import {
  InformationResolutionRouter,
  KnowledgeProviderRegistry,
  KnowledgeRouter,
  QuestionPlanner,
  type InformationNeed,
  type KnowledgeProvider
} from "../supabase/functions/_shared/intelligence/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

const now = "2026-09-16T01:53:00.000Z";

const unavailablePrimary: KnowledgeProvider = {
  id: "geo.primary",
  version: "1",
  sourceClass: "REFERENCE_DATA",
  capabilities: ["geo.resolve_place"],
  priority: 100,
  readiness: () => ({ status: "UNAVAILABLE", reason: "simulated outage" }),
  resolve: () => {
    throw new Error("unavailable provider must not be called");
  }
};

const referenceFallback: KnowledgeProvider = {
  id: "geo.fallback",
  version: "1",
  sourceClass: "REFERENCE_DATA",
  capabilities: ["geo.resolve_place"],
  priority: 50,
  resolve: (query) => ({
    status: "RESOLVED",
    capability: query.capability,
    providerId: "geo.fallback",
    providerVersion: "1",
    sourceClass: "REFERENCE_DATA",
    value: { placeId: "key-west-fl", label: "Key West, Florida, USA" },
    sourceId: "fixture:places",
    sourceVersion: "2026-09"
  })
};

const ambiguousProvider: KnowledgeProvider = {
  id: "geo.ambiguous",
  version: "1",
  sourceClass: "REFERENCE_DATA",
  capabilities: ["geo.resolve_ambiguous"],
  resolve: (query) => ({
    status: "AMBIGUOUS",
    capability: query.capability,
    providerId: "geo.ambiguous",
    providerVersion: "1",
    sourceClass: "REFERENCE_DATA",
    candidates: [{ label: "Springfield A" }, { label: "Springfield B" }]
  })
};

const registry = new KnowledgeProviderRegistry()
  .register(unavailablePrimary)
  .register(referenceFallback)
  .register(ambiguousProvider);
const knowledgeRouter = new KnowledgeRouter(registry);

const fallbackResult = await knowledgeRouter.resolve(
  {
    requestId: "q1",
    capability: "geo.resolve_place",
    input: { label: "Key West, FL" }
  },
  { now },
  { sourceClasses: ["REFERENCE_DATA"] }
);
assert(fallbackResult.status === "RESOLVED", "fallback provider should resolve");
assert(fallbackResult.attempts.length === 2, "unavailable primary should be recorded before fallback");

const ambiguousResult = await knowledgeRouter.resolve(
  {
    requestId: "q2",
    capability: "geo.resolve_ambiguous",
    input: { label: "Springfield" }
  },
  { now }
);
assert(ambiguousResult.status === "AMBIGUOUS", "ambiguity must survive routing");
assert(ambiguousResult.resolution?.candidates?.length === 2, "ambiguity must retain candidates");

const acquisition = new InformationResolutionRouter(knowledgeRouter);
acquisition.registerCanonicalResolver({
  id: "person.current",
  concepts: ["person.birth_place_resolution"],
  resolve: () => ({
    status: "UNKNOWN",
    resolverId: "person.current",
    limitation: "Only a free-text birthplace label is canonical."
  })
});

const birthPlaceNeed: InformationNeed = {
  needId: "need.birthplace",
  concept: "person.birth_place_resolution",
  kind: "MISSING",
  purpose: "Resolve birth place for deterministic natal readiness.",
  consumers: ["astro.natal_readiness"],
  priorityClass: "P1_HIGH_IMPACT",
  resolutionOptions: ["CANONICAL_READ", "REFERENCE_DATA", "PLAYER", "PRESERVE_UNKNOWN"],
  expectedLifetime: "STABLE",
  sensitivity: "LOW",
  answerability: "HIGH",
  questionSignals: {
    currentRelevance: 1,
    decisionImpact: 0.9,
    futureReuse: 1,
    userBurden: 0.2
  }
};

const acquired = await acquisition.resolve(
  {
    need: birthPlaceNeed,
    knowledgeQueries: {
      REFERENCE_DATA: {
        requestId: "q3",
        capability: "geo.resolve_place",
        input: { label: "Key West, FL" },
        purpose: birthPlaceNeed.purpose
      }
    }
  },
  { now }
);
assert(acquired.status === "RESOLVED", "acquisition should fall through canonical unknown to knowledge");
assert(acquired.stage === "REFERENCE_DATA", "reference knowledge should resolve after canonical miss");

const playerNeed: InformationNeed = {
  needId: "need.training-access",
  concept: "training.access",
  kind: "MISSING",
  purpose: "Determine which workouts are feasible.",
  consumers: ["training", "inventory", "capability"],
  priorityClass: "P2_HIGH_LEVERAGE",
  resolutionOptions: ["CANONICAL_READ", "PLAYER", "PRESERVE_UNKNOWN"],
  expectedLifetime: "STABLE",
  sensitivity: "LOW",
  answerability: "HIGH",
  questionSignals: {
    uncertaintyReduction: 0.9,
    crossDomainLeverage: 1,
    futureReuse: 0.9,
    userBurden: 0.2
  }
};

const playerResolution = await acquisition.resolve({ need: playerNeed }, { now });
assert(playerResolution.status === "NEEDS_PLAYER", "player must only be used after preceding resolvers fail");

const optionalNeed: InformationNeed = {
  needId: "need.favorite-movie",
  concept: "preference.favorite_movie",
  kind: "MISSING",
  purpose: "Optional flavor only.",
  consumers: ["character.flavor"],
  priorityClass: "P4_OPTIONAL",
  resolutionOptions: ["PLAYER", "PRESERVE_UNKNOWN"],
  expectedLifetime: "STABLE",
  sensitivity: "LOW",
  answerability: "HIGH"
};

const planner = new QuestionPlanner()
  .registerSpec({
    concept: "training.access",
    questionKey: "training.access.v1",
    questionIntent: "Ask where the player normally strength trains and what equipment is usually available.",
    expectedAnswerShape: "Natural-language training location and equipment access.",
    whyThisMatters: "This determines feasible workouts and improves training, inventory, capability, and scheduling guidance.",
    mayPersistAnswer: true,
    requiresExplicitAuthorizationForWrite: true
  })
  .registerSpec({
    concept: "preference.favorite_movie",
    questionKey: "preference.favorite_movie.v1",
    questionIntent: "Ask the player's favorite movie.",
    whyThisMatters: "Optional character flavor.",
    mayPersistAnswer: false,
    requiresExplicitAuthorizationForWrite: false
  });

const ambient = planner.plan([optionalNeed, playerNeed], {
  mode: "AMBIENT",
  now,
  budget: 1
});
assert(ambient.length === 1, "ambient budget should cap proactive questions");
assert(ambient[0]?.informationNeed.needId === "need.training-access", "high-leverage question should outrank optional curiosity");

const discovery = planner.plan([optionalNeed, playerNeed], {
  mode: "DISCOVERY_SESSION",
  now,
  budget: 2,
  includeOptional: true
});
assert(discovery.length === 2, "opt-in discovery may include optional questions within budget");
assert(discovery[0]?.informationNeed.needId === "need.training-access", "discovery still preserves priority ordering");

console.log(
  JSON.stringify(
    {
      knowledge_fallback: fallbackResult.status,
      ambiguity_preserved: ambiguousResult.status,
      acquisition_stage: acquired.stage,
      player_fallback: playerResolution.status,
      ambient_question: ambient[0]?.questionKey,
      discovery_question_count: discovery.length
    },
    null,
    2
  )
);
