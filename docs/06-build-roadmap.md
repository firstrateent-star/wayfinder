# Wayfinder Build Roadmap

**Version:** 0.3  
**Status:** CANDIDATE — realigned after player-UI rollback and Life RPG Flower

The roadmap prioritizes architectural leverage, complete vertical slices, and real evidence over feature count or screen count.

## Phase 0 — Foundation

**Status: stable enough / recursive**

Constitution, ontology, architecture, object contracts, domain protocol, validation loop, physical schema, ADR process, and recovery documentation exist and have survived multiple recursive passes.

## Phase 1 — Executable kernel

**Status: passed for Slice 1A**

Proven:
- owner identity;
- command envelope + idempotency;
- private module boundaries;
- Direction graph;
- exact Evidence links;
- versioned correction lineage;
- read/projection seam;
- result coverage vs epistemic coverage;
- atomic user-intent command boundaries.

## Phase 2 — Practice proving slice

**Status: backend proven**

Practice remains architectural evidence, not the shape of the final product.

Proven:
- Practice identity;
- atomic PracticeSession capture;
- occurrence time vs record time;
- correction;
- exact Evidence to Action;
- current/stale evidence behavior;
- Practice catalog;
- browser command boundary.

## Phase 3 — Projection proving slices

**Status: backend proven / player surface intentionally reduced**

Implemented:
- Action Fulfillment;
- Bearing;
- Helm projection;
- Journey projection.

These remain evidence that reconstructable projections work. They do not force the final player experience to expose their technical detail.

## Phase 4 — Quiet player shell

**Status: live**

The player UI was intentionally rolled back to a quiet read-only Helm.

Current law:

> Build the intelligence/model first. Add player UI only when the system has something genuinely useful to show or ask.

No manual Practice/Direction/Evidence/correction inputs are currently part of normal player mode.

## Phase 5 — Life RPG architectural freeze

**Status: active**

Before new physical domains, freeze the next high-leverage laws:

- four epistemic layers: Recorded Reality → Deterministic Derivation → Intelligent Inference → Symbolic Interpretation;
- player-facing RPG mechanics are projections by default;
- inventory/gear modifies effective state, not permanent base mastery;
- Discovery produces candidates/hypotheses and routes factual mutations through owning modules;
- Navigator questions are information-need driven, not blank-field driven;
- astrology uses canonical birth data + deterministic chart calculation + separately labeled symbolic interpretation;
- no universal life/facts table.

Reference: `docs/17-life-rpg-discovery-architecture-v0.1.md` and ADR-030.

## Phase 6 — Person / Character Creation vertical slice

**Status: next executable candidate**

Build the smallest canonical Person module.

Candidate first facts:
- preferred/display name;
- birth date;
- birth time optional;
- birth place optional.

Do not store Role, XP, Level, Skill, or archetypal interpretation as Person facts.

Height/weight should wait for Body rather than being temporarily stored in Person.

The Character Creation player experience may eventually collect Person + Body + present-context information in one flow, while routing each fact to its proper owner.

## Phase 7 — Discovery contract

**Status: follows Person**

Prove the structured path:

```text
source/conversation
 -> candidate
 -> provenance
 -> reconciliation
 -> user/system authorization
 -> owning module command
```

Do not create a universal persistent candidate table until multiple real sources demonstrate that durable candidate state is necessary.

## Phase 8 — Body asymmetric slice

**Status: candidate**

Use Body to pressure-test time-varying observations and AI extraction.

Example proof:

```text
“I weigh 152 lb”
 -> DIRECT_EXTRACTION candidate
 -> authorized Body command
 -> temporal weight observation
 -> current Body projection
```

Prove correction, provenance, duplicate semantics, uncertainty, and read coverage.

## Phase 9 — Inventory / effective-state slice

**Status: candidate**

Prove one real item and one explainable modifier.

```text
item ownership
 -> capability metadata
 -> available/equipped/in-use relationship
 -> loadout/context
 -> effective capability modifier
```

Ownership alone must not create permanent Skill/Mastery growth.

## Phase 10 — Skill discovery projection

**Status: candidate**

Infer one narrow skill family from evidence instead of accepting a user-entered level.

Prove:
- evidence lineage;
- confidence/uncertainty;
- recency/frequency/depth effects;
- explainability;
- no permanent skill rewrite from equipment alone.

Role/Class remains a higher-order projection over skills + behavior, not an onboarding choice.

## Phase 11 — Navigator read / question / propose loop

**Status: candidate**

Navigator should prove:
- bounded context assembly;
- KNOWN / INFERRED / CONFLICTING / UNKNOWN separation;
- supported answer first;
- one high-value missing-information question when necessary;
- proposal separate from command;
- explicit authorization before consequential canonical mutation;
- lineage explanation.

Question selection should optimize information value versus user burden.

## Phase 12 — Astrology lens

**Status: candidate after Person birth facts**

Build:

```text
canonical birth facts
 -> deterministic ephemeris/chart calculation
 -> natal geometry / houses / aspects
 -> symbolic interpretation
```

Current transits may be deterministically calculated and compared to natal geometry.

Astrological interpretation must remain a symbolic guidance lens rather than factual evidence about guaranteed traits or outcomes.

## Phase 13 — Position + Character composition

Once Person, Body, Inventory, Discovery, and Navigator seams are proven, compose:

- Position: “Where am I?”
- Character: “Who am I becoming?”
- Effective Player State: base capability + equipment + context + conditions.

Do not persist these if they can be reconstructed reliably.

## Phase 14 — Expand domains under pressure

Admit new modules only when they have distinct factual semantics:
- Training;
- Nutrition;
- Finance;
- World / Atlas;
- Social / Relationships;
- Knowledge/Lore;
- other domains proven by real use.

The goal is to validate asymmetry, not accumulate modules.

## Deferred until architecture earns them

- permanent XP ledger;
- universal skill taxonomy;
- persisted Role/Class;
- giant stat table;
- autonomous canonical AI writes;
- arbitrary gear-score persistence;
- universal life-events/facts table;
- astrology interpretations stored as facts;
- large fixed domain enum;
- broad frontend forms;
- universal Journey event table.

## Build discipline

For every expansion:

1. define the smallest useful human question;
2. identify whether new canonical reality actually exists;
3. prefer reconstructable projection when possible;
4. assign exactly one canonical owner for each factual mutation;
5. preserve provenance/time/epistemic distinctions;
6. define what Discovery may recognize;
7. define what Navigator may ask only if materially useful;
8. implement one end-to-end slice;
9. stress invariants and complements;
10. observe real use;
11. promote, adapt, or reject assumptions.

The measure of progress is how much real life Wayfinder can model, discover, explain, and guide correctly while asking less of the player — not the number of screens, tables, or game mechanics.
