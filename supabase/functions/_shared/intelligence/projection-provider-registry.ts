export type ProviderProjection = "REQUIREMENTS" | "CHARACTER" | "PROGRESSION" | "SKILLS";

export interface ProjectionProviderDescriptor {
  id: string;
  version: string;
  projection: ProviderProjection;
  dependsOnModules: readonly string[];
  provides: readonly string[];
}

export class ProjectionProviderRegistry {
  private readonly providers = new Map<string, ProjectionProviderDescriptor>();

  register(provider: ProjectionProviderDescriptor) {
    if (this.providers.has(provider.id)) throw new Error("DUPLICATE_PROJECTION_PROVIDER:" + provider.id);
    this.providers.set(provider.id, provider);
    return this;
  }

  list() {
    return [...this.providers.values()];
  }

  affectedByModules(moduleIds: readonly string[]) {
    const modules = new Set(moduleIds);
    return this.list().filter((provider) => provider.dependsOnModules.some((moduleId) => modules.has(moduleId)));
  }

  affectedProjectionTargets(moduleIds: readonly string[]): ProviderProjection[] {
    return [...new Set(this.affectedByModules(moduleIds).map((provider) => provider.projection))];
  }
}

export function createWayfinderProjectionProviderRegistryV0() {
  return new ProjectionProviderRegistry()
    .register({
      id: "training.strength-requirement-provider.v0.1",
      version: "0.1",
      projection: "REQUIREMENTS",
      dependsOnModules: ["training"],
      provides: ["training.strength_sessions.weekly"]
    })
    .register({
      id: "nutrition.protein-requirement-provider.v0.1",
      version: "0.1",
      projection: "REQUIREMENTS",
      dependsOnModules: ["nutrition"],
      provides: ["nutrition.protein.daily"]
    })
    .register({
      id: "training.might-character-provider.v0.1",
      version: "0.1",
      projection: "CHARACTER",
      dependsOnModules: ["training"],
      provides: ["Might:EXPOSURE", "Might:CAPABILITY", "Might:GROWTH"]
    })
    .register({
      id: "training.voyage-progression-provider.v0.1",
      version: "0.1",
      projection: "PROGRESSION",
      dependsOnModules: ["training"],
      provides: ["TRAINING_STRENGTH_SESSION:VOYAGE_XP"]
    })
    .register({
      id: "training.strength-skill-provider.v0.1",
      version: "0.1",
      projection: "SKILLS",
      dependsOnModules: ["training"],
      provides: ["physical.strength_training:EXPERIENCE", "physical.strength_training:SHARPNESS"]
    });
}
