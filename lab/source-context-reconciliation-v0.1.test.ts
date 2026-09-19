import { reconcileSourceAuthority } from "../supabase/functions/_shared/intelligence/source-context-reconciliation.ts";
import type { CandidateLifeGraph, CandidateLifeNode, SemanticField } from "../supabase/functions/_shared/intelligence/semantic-compiler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("explicit current-source quantity overrides conflicting historical usual-pattern context", () => {
  const source = graph(mealNode({ eggs: field(2, ["two eggs"]) }));
  const enriched = graph(mealNode({
    eggs: { ...field(3, ["usual breakfast"]), contextRefs: ["nutrition:breakfast:1"] },
    toast: { ...field(true), contextRefs: ["nutrition:breakfast:1"] }
  }));

  const result = reconcileSourceAuthority(source, enriched);
  const meal = result.graph.nodes[0];
  assert(meal.attributes.eggs.value === 2, "explicit two eggs must survive context enrichment");
  assert(meal.attributes.toast.value === true, "context may still fill a missing toast detail");
  assert(result.conflicts === 1, "conflicting context should be visible");
  assert(meal.unresolved?.some((item) => item.code === "CONTEXT_ENRICHMENT_CONFLICT"), "conflict should retain lineage");
});

Deno.test("context may add missing fields without changing explicit source fields", () => {
  const source = graph(mealNode({ eggs: field(2, ["two eggs"]) }));
  const enriched = graph(mealNode({
    eggs: { ...field(2, ["two eggs"]), contextRefs: ["nutrition:breakfast:1"] },
    toast: { ...field(true), contextRefs: ["nutrition:breakfast:1"] }
  }));

  const result = reconcileSourceAuthority(source, enriched);
  assert(result.graph.nodes[0].attributes.eggs.value === 2, "same explicit value should remain");
  assert(result.graph.nodes[0].attributes.toast.value === true, "missing detail may be enriched");
  assert(result.conflicts === 0, "equal value is not a conflict");
});

Deno.test("context cannot upgrade approximate source precision to exact", () => {
  const source = graph(mealNode({
    amount: { value: 2, state: "PARTIAL", precision: "APPROXIMATE", certainty: "MEDIUM", sourceSpans: ["around two"] }
  }));
  const enriched = graph(mealNode({
    amount: { value: 2, state: "RESOLVED", precision: "EXACT", certainty: "HIGH", sourceSpans: ["around two"], contextRefs: ["history:1"] }
  }));

  const result = reconcileSourceAuthority(source, enriched);
  const amount = result.graph.nodes[0].attributes.amount;
  assert(amount.precision === "APPROXIMATE", "player wording controls precision");
  assert(amount.certainty === "MEDIUM", "context cannot upgrade current-source certainty");
});

Deno.test("source field omitted by context pass is restored", () => {
  const source = graph(mealNode({ eggs: field(2, ["two eggs"]) }));
  const enriched = graph(mealNode({}));
  const result = reconcileSourceAuthority(source, enriched);
  assert(result.graph.nodes[0].attributes.eggs.value === 2, "explicit source field should not disappear");
});

function graph(node: CandidateLifeNode): CandidateLifeGraph {
  return {
    sourceId: "test",
    nodes: [node],
    edges: [],
    references: [],
    alternateInterpretations: [],
    trace: []
  };
}

function mealNode(attributes: Record<string, SemanticField>): CandidateLifeNode {
  return {
    candidateId: "meal",
    nodeType: "EVENT",
    concept: "MEAL",
    subject: { kind: "SELF" },
    realityMode: "OCCURRED",
    attributes,
    certainty: "HIGH",
    sourceSpans: ["Had my usual breakfast, but only two eggs today."]
  };
}

function field(value: unknown, sourceSpans: string[] = []): SemanticField {
  return {
    value,
    state: "RESOLVED",
    precision: "EXACT",
    certainty: "HIGH",
    ...(sourceSpans.length ? { sourceSpans } : {})
  };
}
