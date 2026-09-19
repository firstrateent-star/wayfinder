export type ConceptKind = "ENTITY" | "ACTIVITY" | "STATE" | "RESOURCE" | "RELATION" | "ABSTRACT";

export interface ConceptDefinition {
  id: string;
  label: string;
  kind: ConceptKind;
  aliases?: string[];
  parentIds?: string[];
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

export class ConceptRegistry {
  private readonly concepts = new Map<string, ConceptDefinition>();
  private readonly aliases = new Map<string, Set<string>>();

  register(concept: ConceptDefinition) {
    if (this.concepts.has(concept.id)) throw new Error(`DUPLICATE_CONCEPT:${concept.id}`);
    this.concepts.set(concept.id, concept);

    for (const alias of [concept.label, concept.id, ...(concept.aliases ?? [])]) {
      const key = normalize(alias);
      const existing = this.aliases.get(key) ?? new Set<string>();
      existing.add(concept.id);
      this.aliases.set(key, existing);
    }
    return this;
  }

  get(id: string) {
    return this.concepts.get(id);
  }

  list() {
    return [...this.concepts.values()];
  }

  resolveExact(value: string) {
    const ids = [...(this.aliases.get(normalize(value)) ?? [])];
    return ids.map((id) => this.concepts.get(id)).filter((item): item is ConceptDefinition => Boolean(item));
  }

  ancestors(id: string) {
    const result: ConceptDefinition[] = [];
    const seen = new Set<string>();
    const queue = [...(this.concepts.get(id)?.parentIds ?? [])];

    while (queue.length > 0) {
      const nextId = queue.shift()!;
      if (seen.has(nextId)) continue;
      seen.add(nextId);
      const concept = this.concepts.get(nextId);
      if (!concept) continue;
      result.push(concept);
      queue.push(...(concept.parentIds ?? []));
    }

    return result;
  }
}

export function createCoreLifeConceptRegistryV0() {
  return new ConceptRegistry()
    .register({ id: "ACTIVITY", label: "activity", kind: "ACTIVITY" })
    .register({ id: "PHYSICAL_ACTIVITY", label: "physical activity", kind: "ACTIVITY", parentIds: ["ACTIVITY"] })
    .register({ id: "STRENGTH_TRAINING", label: "strength training", kind: "ACTIVITY", aliases: ["lifting", "weights", "workout"], parentIds: ["PHYSICAL_ACTIVITY"] })
    .register({ id: "RUNNING", label: "running", kind: "ACTIVITY", aliases: ["run", "ran", "jog", "jogging"], parentIds: ["PHYSICAL_ACTIVITY"] })
    .register({ id: "WALKING", label: "walking", kind: "ACTIVITY", aliases: ["walk", "walked"], parentIds: ["PHYSICAL_ACTIVITY"] })
    .register({ id: "WORK_ACTIVITY", label: "work activity", kind: "ACTIVITY", aliases: ["worked", "work"], parentIds: ["ACTIVITY"] })
    .register({ id: "FOOD_EVENT", label: "food event", kind: "ACTIVITY", aliases: ["food"], parentIds: ["ACTIVITY"] })
    .register({ id: "FOOD_ACQUISITION", label: "food acquisition", kind: "ACTIVITY", aliases: ["grabbed food", "picked up food", "got food", "bought food", "ordered food"], parentIds: ["FOOD_EVENT"] })
    .register({ id: "FOOD_INTAKE", label: "food intake", kind: "ACTIVITY", aliases: ["ate", "eating", "consumed"], parentIds: ["FOOD_EVENT"] })
    .register({ id: "MEAL", label: "meal", kind: "ACTIVITY", aliases: ["breakfast", "lunch", "dinner"], parentIds: ["FOOD_INTAKE"] })
    .register({ id: "EXPENSE", label: "expense", kind: "RESOURCE", aliases: ["spent", "purchase", "paid", "cost"] })
    .register({ id: "EMOTIONAL_STATE", label: "emotional state", kind: "STATE", aliases: ["stressed", "less stressed", "calm", "happy", "frustrated", "relieved"] })
    .register({ id: "ENERGY_STATE", label: "energy state", kind: "STATE", aliases: ["tired", "exhausted", "drained", "energized", "felt like crap", "feel like crap", "felt awful", "feel awful", "felt terrible", "feel terrible"] })
    .register({ id: "COMMUNICATION", label: "communication", kind: "ACTIVITY", aliases: ["called", "texted", "emailed", "talked"] })
    .register({ id: "PERSON", label: "person", kind: "ENTITY" })
    .register({ id: "PROJECT", label: "project", kind: "ENTITY", aliases: ["job", "install", "edit", "wedding"] });
}
