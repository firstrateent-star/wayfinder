import type { ConceptRegistry } from "./concept-registry.ts";
import { conceptMatchesRequested } from "./concept-resolution.ts";
import type { ContextResolution, SemanticContextProvider } from "./context-assembler.ts";
import type { ContextRequest, SemanticContextItem } from "./semantic-compiler.ts";
import type { SourceEnvelope } from "./semantic-admission.ts";

export type NavigatorReadRpc = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;

export interface NavigatorCanonicalContextProviderOptions {
  rpc: NavigatorReadRpc;
  concepts: ConceptRegistry;
}

type PersonRead = {
  person?: {
    ref?: { namespace?: string; type?: string; id?: string; version?: string };
    display_name?: string | null;
    recorded_at?: string | null;
  } | null;
};

type DirectionRead = {
  nodes?: Array<{
    id: string;
    version: string;
    kind: string;
    title: string;
    description?: string | null;
    intent_state?: string;
    lifecycle_status?: string;
    recorded_at?: string;
  }>;
  record_coverage?: unknown;
};

type ScheduleRead = {
  allocations?: Array<{
    id: string;
    version: string;
    label: string;
    kind: string;
    state: string;
    starts_at?: string | null;
    ends_at?: string | null;
    window_starts_at?: string | null;
    window_ends_at?: string | null;
    due_at?: string | null;
    expected_duration_seconds?: number | null;
    zone_id?: string | null;
    target?: unknown;
    recorded_at?: string;
  }>;
  result_coverage?: unknown;
  epistemic_coverage?: unknown;
};

type PracticeRead = {
  sessions?: Array<{
    id: string;
    version: string;
    practice?: { id?: string; name?: string; lifecycle_status?: string };
    occurrence?: {
      from?: string;
      to?: string | null;
      from_precision?: string;
      to_precision?: string | null;
      zone_id?: string | null;
    };
    duration_seconds?: number | null;
    focus?: string | null;
    recorded_at?: string;
  }>;
  result_coverage?: unknown;
  epistemic_coverage?: unknown;
};

type TrainingRead = {
  sessions?: Array<{
    id: string;
    version: string;
    kind?: string;
    label?: string | null;
    occurrence?: {
      from?: string;
      to?: string | null;
      precision?: string;
      zone_id?: string | null;
    };
    sets?: Array<{
      exercise_key?: string;
      exercise_label?: string;
      reps?: number | null;
      load_value?: number | null;
      load_unit?: string | null;
      rpe?: number | null;
    }>;
    recorded_at?: string;
  }>;
  result_coverage?: unknown;
  epistemic_coverage?: unknown;
};

const DAY = 86_400_000;

function clampLimit(request: ContextRequest, fallback = 8) {
  return Math.max(1, Math.min(request.limit ?? fallback, 20));
}

function recentRange(request: ContextRequest, source: SourceEnvelope) {
  const anchor = new Date(source.receivedAt);
  const from = request.from ?? new Date(anchor.getTime() - 90 * DAY).toISOString();
  const to = request.to ?? new Date(anchor.getTime() + DAY).toISOString();
  return { from, to };
}

function scheduleRange(request: ContextRequest, source: SourceEnvelope) {
  const anchor = new Date(source.receivedAt);
  const from = request.from ?? anchor.toISOString();
  const to = request.to ?? new Date(anchor.getTime() + 14 * DAY).toISOString();
  return { from, to };
}

function requestedConcepts(request: ContextRequest) {
  return new Set(request.concepts ?? []);
}

function compact(value?: string | null, max = 140) {
  const text = value?.trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function contextRef(namespace: string, type: string, id: string, version?: string | null) {
  return version ? `canonical:${namespace}:${type}:${id}@${version}` : `canonical:${namespace}:${type}:${id}`;
}

function matchesRequestedConcepts(itemConcepts: string[], request: ContextRequest, concepts: ConceptRegistry) {
  const requested = request.concepts ?? [];
  if (requested.length === 0) return true;
  return itemConcepts.some((itemConcept) =>
    requested.some((wanted) => conceptMatchesRequested(itemConcept, wanted, concepts))
  );
}

function practiceConcepts(name: string | undefined, concepts: ConceptRegistry) {
  const base = ["ACTIVITY"];
  if (!name) return base;
  const exact = concepts.resolveExact(name);
  for (const item of exact) {
    base.push(item.id, ...concepts.ancestors(item.id).map((ancestor) => ancestor.id));
  }
  return [...new Set(base)];
}

function trainingSetSummary(session: NonNullable<TrainingRead["sessions"]>[number]) {
  const sets = session.sets ?? [];
  if (sets.length === 0) return "";
  const unique: string[] = [];
  for (const set of sets) {
    const label = set.exercise_label ?? set.exercise_key ?? "exercise";
    const load = set.load_value == null ? "" : ` ${set.load_value}${set.load_unit ? ` ${set.load_unit}` : ""}`;
    const reps = set.reps == null ? "" : ` × ${set.reps}`;
    const text = `${label}${load}${reps}`;
    if (!unique.includes(text)) unique.push(text);
    if (unique.length >= 4) break;
  }
  return unique.join("; ");
}

export class NavigatorCanonicalContextProvider implements SemanticContextProvider {
  readonly id = "navigator-canonical-context.v0.1";
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(private readonly options: NavigatorCanonicalContextProviderOptions) {}

  supports(kind: ContextRequest["kind"]) {
    return [
      "RECENT_EVENTS",
      "KNOWN_ENTITIES",
      "PERSONAL_ALIASES",
      "ACTIVE_DIRECTION",
      "SCHEDULE",
      "DOMAIN_READ",
      "LIFE_GRAPH"
    ].includes(kind);
  }

  async resolve(request: ContextRequest, _current: unknown, source: SourceEnvelope): Promise<ContextResolution> {
    switch (request.kind) {
      case "RECENT_EVENTS":
        return this.recentEvents(request, source);
      case "KNOWN_ENTITIES":
        return this.knownEntities(request);
      case "PERSONAL_ALIASES":
        return this.personalAliases(request);
      case "ACTIVE_DIRECTION":
        return this.activeDirection(request);
      case "SCHEDULE":
        return this.schedule(request, source);
      case "DOMAIN_READ":
        return this.domainRead(request, source);
      case "LIFE_GRAPH":
        return this.lifeGraph(request);
      default:
        return {};
    }
  }

  private read<T>(name: string, args: Record<string, unknown> = {}) {
    const key = `${name}:${JSON.stringify(args)}`;
    let value = this.cache.get(key);
    if (!value) {
      value = this.options.rpc<T>(name, args);
      this.cache.set(key, value);
    }
    return value as Promise<T>;
  }

  private async person() {
    return this.read<PersonRead>("wf_person_current_v0");
  }

  private async direction() {
    return this.read<DirectionRead>("wf_direction_current");
  }

  private async knownEntities(request: ContextRequest): Promise<ContextResolution> {
    const requested = requestedConcepts(request);
    if (requested.size > 0 && !requested.has("PERSON")) {
      return { notes: ["No canonical entity provider is registered for the requested concept."] };
    }

    const read = await this.person();
    const person = read.person;
    if (!person?.ref?.id) return { notes: ["No canonical Person record is available."] };

    const ref = contextRef(
      person.ref.namespace ?? "person",
      person.ref.type ?? "person",
      person.ref.id,
      person.ref.version
    );
    const item: SemanticContextItem = {
      ref,
      kind: "canonical_person",
      summary: `Player identity: ${compact(person.display_name) || "display name not recorded"}.`,
      concepts: ["PERSON"],
      attributes: {
        canonical: true,
        namespace: person.ref.namespace ?? "person",
        type: person.ref.type ?? "person",
        version: person.ref.version ?? null,
        display_name: person.display_name ?? null,
        recorded_at: person.recorded_at ?? null
      }
    };
    return { items: [item] };
  }

  private async personalAliases(request: ContextRequest): Promise<ContextResolution> {
    const read = await this.person();
    const person = read.person;
    const phrase = person?.display_name?.trim();
    if (!person?.ref?.id || !phrase) return { notes: ["No canonical personal alias source is available."] };
    if (request.query && !phrase.toLowerCase().includes(request.query.toLowerCase())) return {};

    const targetRef = contextRef(
      person.ref.namespace ?? "person",
      person.ref.type ?? "person",
      person.ref.id,
      person.ref.version
    );
    return {
      personalAliases: [{
        phrase,
        targetRef,
        contextHint: "The player's own canonical Person identity.",
        strength: "HIGH"
      }]
    };
  }

  private async activeDirection(request: ContextRequest): Promise<ContextResolution> {
    const read = await this.direction();
    const limit = clampLimit(request);
    const items = (read.nodes ?? [])
      .filter((node) => node.lifecycle_status === "ACTIVE" && node.intent_state === "ACTIVE")
      .slice(0, limit)
      .map<SemanticContextItem>((node) => ({
        ref: contextRef("direction", node.kind || "node", node.id, node.version),
        kind: "canonical_active_direction",
        summary: `Active ${node.kind}: ${compact(node.title)}${node.description ? ` — ${compact(node.description)}` : ""}`,
        attributes: {
          canonical: true,
          id: node.id,
          version: node.version,
          kind: node.kind,
          title: node.title,
          description: node.description ?? null,
          intent_state: node.intent_state,
          recorded_at: node.recorded_at ?? null,
          record_coverage: read.record_coverage ?? null
        }
      }));
    return { items };
  }

  private async schedule(request: ContextRequest, source: SourceEnvelope): Promise<ContextResolution> {
    const { from, to } = scheduleRange(request, source);
    const limit = clampLimit(request);
    const read = await this.read<ScheduleRead>("wf_schedule_current_v0", {
      p_from: from,
      p_to: to,
      p_limit: limit
    });

    const items = (read.allocations ?? []).slice(0, limit).map<SemanticContextItem>((item) => {
      const timing = item.starts_at
        ? `starts ${item.starts_at}${item.ends_at ? `, ends ${item.ends_at}` : ""}`
        : item.window_starts_at
          ? `window ${item.window_starts_at} to ${item.window_ends_at ?? "unknown"}`
          : item.due_at
            ? `due ${item.due_at}`
            : "timing is floating";
      return {
        ref: contextRef("schedule", "allocation", item.id, item.version),
        kind: "canonical_schedule_allocation",
        summary: `Planned ${item.kind.toLowerCase()} allocation: ${compact(item.label)}; ${timing}.`,
        attributes: {
          canonical: true,
          planned_not_occurred: true,
          id: item.id,
          version: item.version,
          label: item.label,
          kind: item.kind,
          state: item.state,
          starts_at: item.starts_at ?? null,
          ends_at: item.ends_at ?? null,
          window_starts_at: item.window_starts_at ?? null,
          window_ends_at: item.window_ends_at ?? null,
          due_at: item.due_at ?? null,
          expected_duration_seconds: item.expected_duration_seconds ?? null,
          zone_id: item.zone_id ?? null,
          target: item.target ?? null,
          result_coverage: read.result_coverage ?? null,
          epistemic_coverage: read.epistemic_coverage ?? null
        }
      };
    });
    return { items };
  }

  private async recentEvents(request: ContextRequest, source: SourceEnvelope): Promise<ContextResolution> {
    const limit = clampLimit(request);
    const { from, to } = recentRange(request, source);
    const requested = request.concepts ?? [];
    const wantsTraining = requested.length === 0 || requested.some((concept) =>
      ["ACTIVITY", "PHYSICAL_ACTIVITY", "STRENGTH_TRAINING"].includes(concept)
    );
    const wantsPractice = requested.length === 0 || requested.some((concept) =>
      concept === "ACTIVITY" || concept === "PHYSICAL_ACTIVITY" || concept === "RUNNING" || concept === "WALKING" ||
      this.options.concepts.get(concept)?.kind === "ACTIVITY"
    );

    const items: SemanticContextItem[] = [];

    if (wantsTraining) {
      const read = await this.read<TrainingRead>("wf_training_recent_v0", {
        p_from: from,
        p_to: to,
        p_limit: Math.min(limit, 20)
      });
      for (const session of read.sessions ?? []) {
        const itemConcepts = ["STRENGTH_TRAINING", "PHYSICAL_ACTIVITY", "ACTIVITY"];
        if (!matchesRequestedConcepts(itemConcepts, request, this.options.concepts)) continue;
        const detail = trainingSetSummary(session);
        items.push({
          ref: contextRef("training", "session", session.id, session.version),
          kind: "canonical_training_session",
          summary: `${compact(session.label) || "Strength training"}${detail ? `: ${detail}` : ""}`,
          concepts: itemConcepts,
          occurredAt: session.occurrence?.from,
          attributes: {
            canonical: true,
            id: session.id,
            version: session.version,
            session_kind: session.kind ?? "STRENGTH",
            occurrence: session.occurrence ?? null,
            sets: session.sets ?? [],
            result_coverage: read.result_coverage ?? null,
            epistemic_coverage: read.epistemic_coverage ?? null
          }
        });
      }
    }

    if (wantsPractice) {
      const read = await this.read<PracticeRead>("wf_practice_recent", {
        p_from: from,
        p_to: to,
        p_limit: Math.min(limit, 50)
      });
      for (const session of read.sessions ?? []) {
        const name = session.practice?.name;
        const itemConcepts = practiceConcepts(name, this.options.concepts);
        if (!matchesRequestedConcepts(itemConcepts, request, this.options.concepts)) continue;
        items.push({
          ref: contextRef("practice", "session", session.id, session.version),
          kind: "canonical_practice_session",
          summary: `Practice: ${compact(name) || "unnamed"}${session.focus ? ` — ${compact(session.focus)}` : ""}`,
          concepts: itemConcepts,
          occurredAt: session.occurrence?.from,
          attributes: {
            canonical: true,
            id: session.id,
            version: session.version,
            practice: session.practice ?? null,
            occurrence: session.occurrence ?? null,
            duration_seconds: session.duration_seconds ?? null,
            focus: session.focus ?? null,
            result_coverage: read.result_coverage ?? null,
            epistemic_coverage: read.epistemic_coverage ?? null
          }
        });
      }
    }

    return {
      items: items
        .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""))
        .slice(0, limit)
    };
  }

  private async domainRead(request: ContextRequest, source: SourceEnvelope): Promise<ContextResolution> {
    const requested = request.concepts ?? [];
    if (requested.length === 0) {
      return { notes: ["DOMAIN_READ requires a semantic concept; broad domain dumping is disabled."] };
    }
    return this.recentEvents(request, source);
  }

  private async lifeGraph(request: ContextRequest): Promise<ContextResolution> {
    const [personResolution, directionResolution] = await Promise.all([
      this.knownEntities({ ...request, concepts: ["PERSON"] }),
      this.activeDirection(request)
    ]);
    const limit = clampLimit(request);
    return {
      items: [...(personResolution.items ?? []), ...(directionResolution.items ?? [])].slice(0, limit),
      personalAliases: personResolution.personalAliases,
      notes: [
        "LIFE_GRAPH is intentionally bounded to canonical Person identity and active Direction in v0.1; no universal life dump exists."
      ]
    };
  }
}

export function createNavigatorCanonicalContextProvider(options: NavigatorCanonicalContextProviderOptions) {
  return new NavigatorCanonicalContextProvider(options);
}
