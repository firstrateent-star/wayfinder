# ADR-034 — Reference Knowledge and Helm Relevance Are Separate from Player Canonical State

**Status:** ACCEPTED

## Context

Wayfinder increasingly needs domain knowledge: nutrition composition, exercise definitions, equipment capabilities, geography, ephemeris data, domain guidelines, and live external context. At the same time, the player home must remain calm and should not become a dashboard containing one widget per domain.

Two risks emerged:

1. mixing global/reference knowledge into the player's canonical life record;
2. letting every domain push data to Home merely because that data exists.

## Decision

### 1. Reference Knowledge is not Player Reality

Wayfinder will distinguish:

```text
Personal Reality
Reference Knowledge
Live External Context
AI Inference
```

Reference/global/domain knowledge must not be written into canonical player domains as though it were a fact about the player.

The language model is a reasoner/interface, not an authoritative encyclopedia. Prefer deterministic/versioned reference sources when available and retrieve live external context only when current information materially matters.

### 2. Knowledge retains provenance/version semantics

Meaningful knowledge resolution should preserve source class, source/version, effective/retrieved time where relevant, authority/confidence where meaningful, and lineage.

Knowledge source classes:

```text
DETERMINISTIC
REFERENCE_DATA
GUIDANCE
LIVE_EXTERNAL
```

### 3. Helm/Home is a Guidance projection

No canonical domain receives permanent Home real estate by default.

Helm answers:

> What matters now?

A domain contribution appears only when Guidance determines it is currently relevant enough to surface.

Candidate relevance factors include Direction alignment, urgency, consequence, confidence/coverage, novelty/change, unresolved attention need, actionability, interruption cost, and repetition/clutter cost.

The exact scoring/routing algorithm is intentionally not frozen yet.

### 4. Every Helm item requires a reason to exist

A surfaced item should be able to explain:

```text
why now?
what type of claim/guidance is this?
what supports it?
what can the player do?
when does it stop mattering?
```

If it cannot, it should normally remain in its domain/detail surface rather than Home.

### 5. Progressive disclosure

```text
Helm -> relevant orientation/attention
Domain surfaces -> structured area of life/game
Detail -> measurements/history/models
Lineage -> why Wayfinder believes/says it
```

Complexity belongs underneath the player surface.

## Consequences

- Adding Nutrition does not create a permanent macro widget on Helm.
- Adding Training does not create a permanent workout widget.
- Adding Calendar does not create a full calendar dashboard on Home.
- Inventory appears when equipment/capability matters to the current situation.
- Astrology may appear as an optional, clearly symbolic lens when relevant; it must not crowd out grounded urgent information.
- RPG achievements/stats may surface briefly when meaningful/novel, then remain available in Character/Journey rather than permanently occupying Home.
- Knowledge infrastructure can grow independently of player canonical schemas.

## Architectural laws

> A domain earns canonical storage through distinct truth semantics; an item earns Home visibility through current relevance.

> Complex underneath. Quiet on the surface.

## Reference

`docs/20-knowledge-and-home-surface-v0.1.md`
