# Wayfinder Player Experience v0

**Status:** CANDIDATE

## Purpose

Define the product-facing experience after the first backend slice proved that Wayfinder can preserve reality, direction, evidence, correction, and derived state without requiring the player to interact with those mechanisms directly.

## Core principle

> Complex underneath. Quiet on the surface.

The player interface is not a database administration surface, a journaling form collection, or a manual ontology editor.

Wayfinder should eventually feel like a living navigation instrument that helps a person understand:

1. Where am I?
2. Where am I headed?
3. How am I changing?
4. What deserves attention now?

The canonical backend may require detailed structures to answer those questions, but the player should not have to operate those structures directly.

## Current product stance

For this phase, Player Mode is intentionally **read-only and quiet**.

No ordinary player-facing inputs are required yet.

The current UI should not ask the person to manually:

- create Direction nodes;
- log PracticeSessions;
- attach EvidenceLinks;
- correct versions;
- reason about provenance, coverage, or lineage;
- manage backend concepts merely because they exist.

Those capabilities remain available in code and can later become system/lab tooling, automated capture targets, or Navigator-authorized operations.

## Experience hierarchy

```text
WAYFINDER
   ↓
HELM
"Where am I?"
   ↓
JOURNEY
"How did I get here?"
   ↓
CHARACTER
"How am I changing?"
   ↓
DIRECTION
"Where am I choosing to go?"
   ↓
NAVIGATOR
"What should I notice or consider?"
```

This hierarchy is conceptual, not permission to build all screens immediately.

## Interaction principle

When input returns, the preferred direction is not a collection of structured forms.

The target interaction is closer to:

```text
natural language / voice / passive context
        ↓
Wayfinder interprets a possible meaning
        ↓
proposes a canonical change
        ↓
human confirms / edits / rejects
        ↓
approved command path
        ↓
canonical backend
```

AI may help interpret and propose, but it does not become authoritative over canonical reality.

## What the current shell should do

The current shell should establish tone and information restraint rather than feature density.

It should:

- feel calm;
- avoid asking for data;
- avoid showing backend diagnostics;
- make no unsupported claims about the person's life;
- leave room for future Position, Journey, Character, Direction, and Navigator experiences;
- prefer silence over fabricated insight.

If Wayfinder does not yet have enough reliable signal to say something useful, the correct response is not to fill the screen. It is to remain quiet.

## Product gate

Before reintroducing player input, answer these questions through design and architecture:

1. What is the smallest useful read-only answer Wayfinder can give when opened?
2. What information can be inferred or imported without burdening the player?
3. What should Navigator be allowed to propose?
4. What requires explicit confirmation before it becomes canonical?
5. Which backend capabilities belong only in Lab/System Mode?

## Current decision

The next development work should improve the **experience model and read-side intelligence**, not add more forms.
