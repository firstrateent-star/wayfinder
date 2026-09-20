export type SkillAssociationMode =
  | "DETERMINISTIC_DOMAIN"
  | "GOVERNED_PRACTICE_ALIAS"
  | "SEMANTIC_PROPOSAL";

export interface SkillConceptDescriptor {
  skillKey: string;
  label: string;
  version: string;
  practiceNameAliases?: readonly string[];
}

export interface AcceptedSkillAssociation {
  state: "ACCEPTED";
  contributesExperience: true;
  skillKey: string;
  label: string;
  mode: "GOVERNED_PRACTICE_ALIAS";
  matchedAlias: string;
  ruleVersion: string;
}

export interface NonAuthoritativeSkillAssociation {
  state: "PROPOSED_NOT_GOVERNED" | "UNRESOLVED";
  contributesExperience: false;
  skillKey?: string;
  label?: string;
  mode: "SEMANTIC_PROPOSAL";
  reason: string;
}

export type SkillAssociationDecision =
  | AcceptedSkillAssociation
  | NonAuthoritativeSkillAssociation;

export function normalizePracticeSkillAlias(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export class SkillConceptRegistry {
  private readonly concepts = new Map<string, SkillConceptDescriptor>();
  private readonly practiceAliases = new Map<string, SkillConceptDescriptor>();

  register(concept: SkillConceptDescriptor) {
    if (!concept.skillKey.trim()) throw new Error("SKILL_KEY_REQUIRED");
    if (!concept.label.trim()) throw new Error("SKILL_LABEL_REQUIRED");
    if (this.concepts.has(concept.skillKey)) {
      throw new Error("DUPLICATE_SKILL_CONCEPT:" + concept.skillKey);
    }

    for (const rawAlias of concept.practiceNameAliases ?? []) {
      const alias = normalizePracticeSkillAlias(rawAlias);
      if (!alias) throw new Error("EMPTY_SKILL_PRACTICE_ALIAS:" + concept.skillKey);
      const existing = this.practiceAliases.get(alias);
      if (existing && existing.skillKey !== concept.skillKey) {
        throw new Error(
          "AMBIGUOUS_SKILL_PRACTICE_ALIAS:" +
            alias +
            ":" +
            existing.skillKey +
            ":" +
            concept.skillKey
        );
      }
      this.practiceAliases.set(alias, concept);
    }

    this.concepts.set(concept.skillKey, concept);
    return this;
  }

  get(skillKey: string) {
    return this.concepts.get(skillKey);
  }

  list() {
    return [...this.concepts.values()];
  }

  resolvePracticeName(value: string): AcceptedSkillAssociation | null {
    const alias = normalizePracticeSkillAlias(value);
    const concept = this.practiceAliases.get(alias);
    if (!concept) return null;

    return {
      state: "ACCEPTED",
      contributesExperience: true,
      skillKey: concept.skillKey,
      label: concept.label,
      mode: "GOVERNED_PRACTICE_ALIAS",
      matchedAlias: alias,
      ruleVersion: concept.version
    };
  }

  practiceAliasesFor(skillKey: string) {
    return [...(this.concepts.get(skillKey)?.practiceNameAliases ?? [])].map(
      normalizePracticeSkillAlias
    );
  }

  assessSemanticProposal(input: {
    proposedSkillKey: string;
    sourceSummary?: string;
  }): NonAuthoritativeSkillAssociation {
    const concept = this.concepts.get(input.proposedSkillKey);
    return {
      state: concept ? "PROPOSED_NOT_GOVERNED" : "UNRESOLVED",
      contributesExperience: false,
      ...(concept ? { skillKey: concept.skillKey, label: concept.label } : {}),
      mode: "SEMANTIC_PROPOSAL",
      reason: concept
        ? "SEMANTIC_SKILL_ASSOCIATION_REQUIRES_GOVERNED_ACCEPTANCE"
        : "SEMANTIC_SKILL_CONCEPT_NOT_REGISTERED"
    };
  }
}

export function createWayfinderSkillConceptRegistryV0() {
  return new SkillConceptRegistry()
    .register({
      skillKey: "physical.strength_training",
      label: "Strength Training",
      version: "strength-training-skill.v0.1"
    })
    .register({
      skillKey: "creative.music_production",
      label: "Music Production",
      version: "music-production-skill.v0.1",
      practiceNameAliases: ["music production"]
    })
    .register({
      skillKey: "creative.drawing",
      label: "Drawing",
      version: "drawing-skill.v0.1",
      practiceNameAliases: ["drawing"]
    });
}
