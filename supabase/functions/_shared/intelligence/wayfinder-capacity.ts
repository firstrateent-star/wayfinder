import type { CandidateLifeNode } from "./semantic-compiler.ts";

export type CapacityFacet = "RECOGNIZE" | "RESOLVE" | "REPRESENT" | "PERSIST" | "ANALYZE" | "PROJECT" | "GUIDE" | "SURFACE";

export interface ConceptCapacity {
  concept: string;
  facets: readonly CapacityFacet[];
  claimTypes?: readonly string[];
  notes?: string;
}

export interface DomainCapability {
  domainId: string;
  version: string;
  concepts: readonly ConceptCapacity[];
  claimTypesOwned?: readonly string[];
  contextReadsProvided?: readonly string[];
  analysesProvided?: readonly string[];
  characterMappingsProvided?: readonly string[];
  requirementMetricsProvided?: readonly string[];
  emittedChanges?: readonly string[];
}

export interface DeclaredPersistRoute {
  owner: string;
  claimType: string;
  viaConcept: string;
}

export interface CapacityAssessment {
  candidateId: string;
  concept: string;
  supportedFacets: CapacityFacet[];
  contributingDomains: string[];
  persistOwners: string[];
  declaredPersistRoutes: DeclaredPersistRoute[];
  missingFacets: CapacityFacet[];
  notes: string[];
}

const ALL_FACETS: CapacityFacet[] = ["RECOGNIZE", "RESOLVE", "REPRESENT", "PERSIST", "ANALYZE", "PROJECT", "GUIDE", "SURFACE"];

export class WayfinderCapacityRegistry {
  private readonly domains = new Map<string, DomainCapability>();

  register(domain: DomainCapability) {
    if (this.domains.has(domain.domainId)) throw new Error(`DUPLICATE_DOMAIN_CAPABILITY:${domain.domainId}`);
    this.domains.set(domain.domainId, domain);
    return this;
  }

  get(domainId: string) {
    return this.domains.get(domainId);
  }

  assessNode(node: CandidateLifeNode): CapacityAssessment {
    const facets = new Set<CapacityFacet>();
    const contributingDomains = new Set<string>();
    const persistOwners = new Set<string>();
    const declaredPersistRoutes = new Map<string, DeclaredPersistRoute>();
    const notes: string[] = [];

    for (const domain of this.domains.values()) {
      for (const capability of domain.concepts) {
        const conceptMatches = capability.concept === node.concept || node.parentConcepts?.includes(capability.concept);
        if (!conceptMatches) continue;
        contributingDomains.add(domain.domainId);
        capability.facets.forEach((facet) => facets.add(facet));
        if (capability.notes) notes.push(`${domain.domainId}:${capability.notes}`);

        if (capability.facets.includes("PERSIST")) {
          for (const claimType of capability.claimTypes ?? []) {
            if (!domain.claimTypesOwned?.includes(claimType)) {
              notes.push(`${domain.domainId}:PERSIST_CLAIM_NOT_OWNED:${claimType}`);
              continue;
            }
            const route = { owner: domain.domainId, claimType, viaConcept: capability.concept };
            declaredPersistRoutes.set(`${route.owner}:${route.claimType}`, route);
            persistOwners.add(domain.domainId);
          }
        }
      }
    }

    return {
      candidateId: node.candidateId,
      concept: node.concept,
      supportedFacets: [...facets],
      contributingDomains: [...contributingDomains],
      persistOwners: [...persistOwners],
      declaredPersistRoutes: [...declaredPersistRoutes.values()],
      missingFacets: ALL_FACETS.filter((facet) => !facets.has(facet)),
      notes
    };
  }
}

export function createWayfinderCapacityV0() {
  return new WayfinderCapacityRegistry()
    .register({
      domainId: "semantic-core",
      version: "0.1",
      concepts: [
        { concept: "ACTIVITY", facets: ["RECOGNIZE", "REPRESENT"], notes: "Broad activity can be understood without a canonical owner." },
        { concept: "PHYSICAL_ACTIVITY", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "RUNNING", facets: ["RECOGNIZE", "REPRESENT"], notes: "Running is understood semantically but has no canonical persistence contract yet." },
        { concept: "WALKING", facets: ["RECOGNIZE", "REPRESENT"], notes: "Walking is understood semantically but has no canonical persistence contract yet." },
        { concept: "MEAL", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "FOOD_INTAKE", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "EXPENSE", facets: ["RECOGNIZE", "REPRESENT"], notes: "Finance canonical capacity is not live yet." },
        { concept: "EMOTIONAL_STATE", facets: ["RECOGNIZE", "REPRESENT"], notes: "Emotional-state canonical capacity is not live yet." },
        { concept: "ENERGY_STATE", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "COMMUNICATION", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "WORK_ACTIVITY", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "CREATIVE_PRACTICE", facets: ["RECOGNIZE", "REPRESENT"], notes: "Creative Practice may be understood without granting generic persistence." },
        { concept: "MUSIC_PRODUCTION", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "DRAWING", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "PERSON", facets: ["RECOGNIZE", "RESOLVE", "REPRESENT"] },
        { concept: "PROJECT", facets: ["RECOGNIZE", "RESOLVE", "REPRESENT"] },
        { concept: "DIRECTION_INTENT", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "SCHEDULE_ALLOCATION", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "STRENGTH_SESSION_STANDARD", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "PROTEIN_STANDARD", facets: ["RECOGNIZE", "REPRESENT"] }
      ]
    })
    .register({
      domainId: "training",
      version: "0.1",
      concepts: [
        {
          concept: "STRENGTH_TRAINING",
          facets: ["RECOGNIZE", "RESOLVE", "REPRESENT", "PERSIST", "SURFACE"],
          claimTypes: ["TRAINING_STRENGTH_SESSION"],
          notes: "Canonical Training supports occurred strength sessions."
        },
        {
          concept: "STRENGTH_SESSION_STANDARD",
          facets: ["RECOGNIZE", "REPRESENT", "PERSIST", "PROJECT", "SURFACE"],
          claimTypes: ["TRAINING_STRENGTH_STANDARD"],
          notes: "Player-authored recurring weekly strength-session minimum; not a Schedule event or occurred workout."
        }
      ],
      claimTypesOwned: ["TRAINING_STRENGTH_SESSION", "TRAINING_STRENGTH_STANDARD"],
      contextReadsProvided: ["training.recent_strength_sessions", "training.strength_requirement_input"],
      requirementMetricsProvided: ["strength_session_count"],
      characterMappingsProvided: ["Might:EXPOSURE", "Might:CAPABILITY"],
      emittedChanges: ["training.session.recorded", "training.standard_changed"]
    })
    .register({
      domainId: "practice",
      version: "0.1",
      concepts: [
        {
          concept: "MUSIC_PRODUCTION",
          facets: ["RECOGNIZE", "REPRESENT", "PERSIST", "SURFACE"],
          claimTypes: ["PRACTICE_SESSION"],
          notes: "Occurred Music Production sessions may be stored in the canonical Practice module after confirmation."
        },
        {
          concept: "DRAWING",
          facets: ["RECOGNIZE", "REPRESENT", "PERSIST", "SURFACE"],
          claimTypes: ["PRACTICE_SESSION"],
          notes: "Occurred Drawing sessions may be stored in the canonical Practice module after confirmation."
        }
      ],
      claimTypesOwned: ["PRACTICE_SESSION"],
      contextReadsProvided: ["practice.recent", "practice.catalog"],
      emittedChanges: ["practice.session.created", "practice.session.corrected"]
    })
    .register({
      domainId: "direction",
      version: "0.1",
      concepts: [{
        concept: "DIRECTION_INTENT",
        facets: ["RECOGNIZE", "REPRESENT", "PERSIST", "SURFACE"],
        claimTypes: ["DIRECTION_NODE"],
        notes: "Durable player goals and directions only; time allocation remains Schedule-owned."
      }],
      claimTypesOwned: ["DIRECTION_NODE"],
      contextReadsProvided: ["direction.active"],
      emittedChanges: ["direction.node.created"]
    })
    .register({
      domainId: "schedule",
      version: "0.1",
      concepts: [{
        concept: "SCHEDULE_ALLOCATION",
        facets: ["RECOGNIZE", "REPRESENT", "PERSIST", "SURFACE"],
        claimTypes: ["SCHEDULE_ALLOCATION"],
        notes: "Planned temporal allocation only; occurred reality remains owned by its activity domain."
      }],
      claimTypesOwned: ["SCHEDULE_ALLOCATION"],
      contextReadsProvided: ["schedule.current"],
      emittedChanges: ["schedule.allocation_created"]
    })
    .register({
      domainId: "nutrition",
      version: "0.1",
      concepts: [
        {
          concept: "FOOD_INTAKE",
          facets: ["RECOGNIZE", "REPRESENT", "PERSIST", "SURFACE"],
          claimTypes: ["NUTRITION_INTAKE"],
          notes: "Consumed food and drink only. Acquisition does not establish intake; nutrition totals remain unknown unless explicitly supplied."
        },
        {
          concept: "PROTEIN_STANDARD",
          facets: ["RECOGNIZE", "REPRESENT", "PERSIST", "PROJECT", "SURFACE"],
          claimTypes: ["NUTRITION_PROTEIN_STANDARD"],
          notes: "Player-authored recurring daily protein minimum; no default or model recommendation is implied."
        }
      ],
      claimTypesOwned: ["NUTRITION_INTAKE", "NUTRITION_PROTEIN_STANDARD"],
      contextReadsProvided: ["nutrition.recent_intakes", "nutrition.protein_requirement_input"],
      requirementMetricsProvided: ["protein_g"],
      emittedChanges: ["nutrition.intake_captured", "nutrition.standard_changed"]
    });
}
