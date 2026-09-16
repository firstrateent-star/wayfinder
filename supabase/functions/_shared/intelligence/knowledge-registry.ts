import type {
  CapabilityReadiness,
  KnowledgeProvider,
  KnowledgeProviderContext,
  KnowledgeSourceClass
} from "./contracts.ts";

function providerSort(a: KnowledgeProvider, b: KnowledgeProvider) {
  const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
  if (byPriority !== 0) return byPriority;
  return a.id.localeCompare(b.id);
}

export class KnowledgeProviderRegistry {
  private readonly providers = new Map<string, KnowledgeProvider>();

  register(provider: KnowledgeProvider) {
    if (!provider.id.trim()) throw new Error("KNOWLEDGE_PROVIDER_ID_REQUIRED");
    if (!provider.version.trim()) throw new Error("KNOWLEDGE_PROVIDER_VERSION_REQUIRED");
    if (provider.capabilities.length === 0) {
      throw new Error(`KNOWLEDGE_PROVIDER_CAPABILITY_REQUIRED:${provider.id}`);
    }
    if (this.providers.has(provider.id)) {
      throw new Error(`KNOWLEDGE_PROVIDER_ALREADY_REGISTERED:${provider.id}`);
    }

    this.providers.set(provider.id, provider);
    return this;
  }

  get(providerId: string) {
    return this.providers.get(providerId);
  }

  providersFor(
    capability: string,
    sourceClasses?: readonly KnowledgeSourceClass[]
  ): KnowledgeProvider[] {
    const allowed = sourceClasses ? new Set(sourceClasses) : null;
    return [...this.providers.values()]
      .filter(
        (provider) =>
          provider.capabilities.includes(capability) &&
          (!allowed || allowed.has(provider.sourceClass))
      )
      .sort(providerSort);
  }

  capabilities() {
    return [...new Set([...this.providers.values()].flatMap((p) => p.capabilities))].sort();
  }

  async readiness(
    capability: string,
    context: KnowledgeProviderContext,
    sourceClasses?: readonly KnowledgeSourceClass[]
  ): Promise<Array<{ providerId: string; readiness: CapabilityReadiness }>> {
    const providers = this.providersFor(capability, sourceClasses);
    return Promise.all(
      providers.map(async (provider) => ({
        providerId: provider.id,
        readiness: provider.readiness
          ? await provider.readiness(capability, context)
          : { status: "READY" as const }
      }))
    );
  }
}
