# Navigator Semantic Cutover v0.2

**Status:** IMPLEMENTED ON WORK BRANCH / CI GATED / PRODUCTION DEPLOY PENDING LIVE SEMANTIC GATE  
**Date:** 2026-09-19

## Purpose

Wayfinder's semantic intelligence had become materially more general than the production Navigator, which was still a Training-specific conversation state machine.

This cutover makes the general Semantic Episode runtime the default conversational understanding path while preserving the proven Training command flow as the only conversational canonical write path.

> **Navigator may understand broadly. Only an owning domain may write narrowly.**

## Runtime shape

```text
PLAYER TURN
   |
   v
SourceEnvelope(authorizesCanonicalWrite=false)
   |
   v
Live Semantic Reasoner
   |
   v
Semantic Episode
   |
   +--> prior transient episode meaning
   |
   +--> bounded context loop
   |
   v
Candidate Life Graph
   |
   v
Wayfinder Capacity
   |
   v
SESSION_ONLY / CLARIFY / ROUTE_ELIGIBLE
   |
   +--> conversation continues transiently
   |
   +--> explicit "Log this as Training"
             |
             v
       existing Training capture flow
             |
             v
       explicit CONFIRM
             |
             v
       typed Training RPC
             |
             v
       canonical Training history
```

## What changed

The production-facing Navigator contract moves from `navigator-chat.v0.1` to `navigator-chat.v0.2`.

The client episode is now a union:

```text
SEMANTIC
  transient general conversation state

TRAINING_CAPTURE
  explicit domain write workflow
```

General conversation never sets `authorizesCanonicalWrite=true`.

A Semantic Episode can therefore preserve corrections, ellipsis, references, ambiguity, and conversational continuity without becoming a life-history table.

## Semantic Episode gate

The live multi-turn torture corpus exposed one remaining loss:

```text
"I worked out today."
"Legs."
```

The model correctly referenced the prior turn but represented `Legs` as an unowned reflection rather than a refinement of the prior event.

The episode boundary now contains a deterministic refinement normalizer:

- the current fragment must contain direct source evidence;
- it must target exactly one prior episode candidate;
- the prior target must be a known event concept;
- subject identity must remain compatible;
- ambiguity is preserved when there is more than one target;
- only current-source detail is added;
- the prior episode ref remains explicit provenance;
- this normalization never authorizes persistence.

A deterministic regression test reproduces the live-model failure shape.

## Safety invariants

This cutover does not change the canonical authority model.

```text
conversation != canonical history
semantic episode != memory table
understanding != persistence
model confidence != authority
route eligibility != write authorization
rewind != deletion of confirmed history
```

Training still requires explicit confirmation before the typed domain command executes.

## Provider failure

The Supabase production environment may not yet contain the model provider secret even though GitHub live evaluation does.

Navigator therefore degrades safely:

- if the live semantic provider is configured, general semantic mode runs;
- if it is unavailable, Navigator does not invent broad understanding;
- the already-proven Training capture path remains available;
- no missing provider credential can create a canonical write.

## Current cutover boundary

This is intentionally not yet the final Navigator.

The current general semantic path has Semantic Episode context, but its production Context Provider Registry is still minimal. It does not yet expose all canonical Wayfinder state to the reasoner.

The next runtime frontier is:

```text
Semantic Navigator
  -> real canonical context providers
  -> Admission Planner
  -> 0..N governed domain proposals
  -> explicit authorization
  -> owning-domain commands
  -> recompute Position / Requirements / Bearing
```

## Next build order

1. Finish and pass the live Semantic Episode gate.
2. Deploy Navigator v0.2 with general read-only semantic conversation.
3. Register grounded production context providers for Training, Person, Direction, Schedule, Practice/Journey, and later other domains.
4. Build the Admission Planner for multi-claim utterances.
5. Lower eligible semantic candidates into domain admission proposals without forcing the player to restate the meaning.
6. Recompute Position, Requirements, Character projections, and Bearing after confirmed writes.
7. Resume domain expansion, including Nutrition, through this common nervous system.

Nutrition remains important, but it is no longer the immediate architecture frontier. New domains should plug into the generalized Navigator/Admission spine rather than requiring another domain-specific chatbot.
