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
        { concept: "MEAL", facets: ["RECOGNIZE", "REPRESENT"], notes: "Nutrition canonical capacity is not live yet." },
        { concept: "FOOD_INTAKE", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "EXPENSE", facets: ["RECOGNIZE", "REPRESENT"], notes: "Finance canonical capacity is not live yet." },
        { concept: "EMOTIONAL_STATE", facets: ["RECOGNIZE", "REPRESENT"], notes: "Emotional-state canonical capacity is not live yet." },
        { concept: "ENERGY_STATE", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "COMMUNICATION", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "WORK_ACTIVITY", facets: ["RECOGNIZE", "REPRESENT"] },
        { concept: "PERSON", facets: ["RECOGNIZE", "RESOLVE", "REPRESENT"] },
        { concept: "PROJECT", facets: ["RECOGNIZE", "RESOLVE", "REPRESENT"] }
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
          notes: "Current canonical Training v0.1 supports strength sessions only."
        }
      ],
      claimTypesOwned: ["TRAINING_STRENGTH_SESSION"],
      contextReadsProvided: ["training.recent_strength_sessions"],
      emittedChanges: ["training.session.recorded"]
    });
}
