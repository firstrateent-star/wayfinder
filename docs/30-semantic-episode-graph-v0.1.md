# Semantic Episode Graph v0.1

**Status:** LAB / read-only multi-turn intelligence spine  
**Date:** 2026-09-19

## Why this exists

Wayfinder can now interpret difficult single utterances with high fidelity, but Navigator conversations are inherently multi-turn:

```text
“I worked out today.”
“Legs.”
“Same as last time.”
“Mostly — I skipped calves.”
```

Treating each line as an isolated utterance loses meaning. Persisting the transcript as life truth is also wrong.

The Semantic Episode is the middle layer.

> **Conversation may carry meaning forward without becoming canonical reality.**

## Architecture

```text
TURN N
  -> Semantic Compiler
  -> Candidate Life Graph
  -> transient Semantic Episode turn
                 |
                 v
      bounded episode context
                 |
                 v
TURN N+1 -> Semantic Compiler
```

Each episode turn retains the candidate graph, routing result, context requests, and source identity needed for conversational continuity. It does not execute a domain command and it does not become a miscellaneous memory store.

## Laws

1. Semantic Episodes are transient working state.
2. Episode context is explicitly marked `canonical=false`.
3. Current-source meaning outranks all prior episode context.
4. Episode context is bounded and newest-first.
5. Rewind deletes only transient later turns.
6. Closed episodes cannot accept new turns.
7. Write-authorizing sources are rejected by the episode runtime.
8. Canonical persistence still requires Semantic Admission + owning-domain authorization.
9. Prior candidate meaning may resolve ellipsis, corrections, pronouns, references, and missing fields.
10. A prior candidate remains an interpretation, not a fact, merely because a later turn refers to it.
11. Prior-turn candidates are never replayed as fresh current-turn nodes solely to act as correction/reference targets.
12. Candidate graph edges connect current-turn candidates only; cross-turn relations resolve through full transient episode refs and provenance.

## v0.1 data flow

```text
SourceEnvelope(authorizesCanonicalWrite=false)
        +
existing SemanticEpisode
        |
        v
episode candidate nodes -> semantic_episode_candidate context items
        +
bounded canonical/reference context
        |
        v
runReadOnlySemanticLoop
        |
        v
new Candidate Life Graph
        |
        v
append transient episode turn
```

## What this proves

The deterministic lab proves:

- “I worked out today.” -> “Legs.” can refine unresolved prior-turn meaning.
- “I ran two miles.” -> “Actually 2.5.” remains correction semantics rather than a second occurrence.
- episode context is bounded and newest-first;
- episode context is explicitly noncanonical;
- rewind removes only transient working turns;
- closed episodes and write-authorizing sources fail closed.

## What it does not do yet

- persist episode state server-side;
- replace the existing Training-specific Navigator state machine;
- execute domain writes;
- merge every turn into one canonical-looking graph;
- decide which clarification question Navigator should ask;
- replace the current bounded episode-reference normalization with durable server-side episode storage;
- prove broader live-model multi-turn performance beyond the first torture corpus.

The next pressure test is a real-model Semantic Episode suite. Only after that is stable should Navigator chat be generalized from its Training-only episode shape onto this semantic episode spine.
