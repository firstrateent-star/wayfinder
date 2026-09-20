# Wayfinder Character Skills Surface v0.1

**Status:** IMPLEMENTED ON BRANCH — WEB GATE PENDING  
**Route:** `/character`  
**Source:** `wayfinder-state.v0.6`

## Purpose

Expose the evidence architecture the player has already earned without inventing conventional RPG numbers that Wayfinder cannot support.

The surface answers:

> What does Wayfinder currently know about my Character and Skills?

It does not answer:

> What arbitrary level should the app assign me?

## Player-facing model

Each configured Skill shows three independent axes:

```text
Experience
  governed recorded practice encounters

Sharpness
  recency relative to evidenced personal cadence

Capability
  governed demonstrated ability evidence
```

Mastery remains unshown as a positive status because it is not yet evaluated.

## Unknown law

The UI preserves backend epistemic states.

Examples:

```text
Experience count unknown
 -> "Unknown"

no governed encounter recorded
 -> "No recorded encounters"

Sharpness history insufficient
 -> "Cadence not established"

Capability provider absent
 -> "Unknown"

Capability provider complete with zero qualifying evidence
 -> "Not established"
 -> explicit note that this is not a zero-ability claim
```

No missing value becomes a zero-level meter.

## Strength capability

When Strength Training Capability is evidenced, the page may show the exercise-specific non-dominated load × reps frontier supplied by `skills_v0.3`.

Example:

```text
Barbell Bench Press
185 LB × 8
205 LB × 5
```

The page explicitly avoids:

- one overall strength score;
- estimated one-repetition maximum;
- comparing unlike exercises;
- Skill Level;
- Mastery score.

## Other Skills

Music Production and Drawing can show Experience + Sharpness from governed Practice history.

Their Capability remains `UNKNOWN` until a domain/provider earns a performance-evidence contract.

The UI does not infer creative capability from practice count.

## Character summary

The top of the page may show:

- Voyage XP as participation experience;
- number of observed governed Skills;
- qualitative Character facets with evidence.

The copy distinguishes Voyage XP from capability.

## Navigation

Authenticated players can open:

```text
Helm -> Character
Character -> Helm
```

The Character route remains behind the same Person/owner gate as Helm.

## Player-surface law

Internal Skill keys, provider ids, canonical UUIDs, and database mechanics remain out of the normal surface.

Evidence details are optional/expandable.

The interface should become simpler as the backend becomes more rigorous.
