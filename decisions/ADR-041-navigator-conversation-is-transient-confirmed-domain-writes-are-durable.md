# ADR-041 — Navigator conversation is transient; confirmed domain writes are durable

**Status:** ACCEPTED  
**Date:** 2026-09-16

## Context

Wayfinder needs a conversational Navigator that can gather incomplete information over several turns, offer suggestions from existing player context, ask clarifying questions, and let the player back up before committing an interpretation.

Treating every chat turn as durable memory would violate the architecture: raw input is not player state, unresolved meaning has no canonical owner, and conversation frequently contains corrections, abandoned branches, and session-only context.

At the same time, once the player explicitly confirms a structured proposal and the owning domain accepts it, the resulting record is canonical history and must obey that domain's correction/versioning rules.

## Decision

1. Navigator conversation and unresolved episode state are transient working context by default.
2. The client may keep a bounded rewindable cache for conversational continuity.
3. Rewinding or clearing chat may change only unconfirmed working context.
4. Navigator must route persistent meaning through Semantic Admission and typed owning-domain commands.
5. Explicit confirmation is the v0.1 authorization boundary for conversational Training writes.
6. A confirmed domain write cannot be erased by rewinding chat.
7. Later changes to confirmed records must use domain correction/versioning semantics.
8. `Skip` is first-class. Missing information remains unknown unless the domain can safely admit a partial claim.
9. Inputs with no legitimate live owner are not persisted into a miscellaneous memory store.
10. Suggestions may be generated from bounded relevant reads, but suggestions do not establish reality.

## Consequences

- Navigator can feel conversational without becoming an unstructured memory database.
- The player can experiment, correct wording, or backtrack before commitment.
- Confirmed history remains auditable and lineage-preserving.
- Adding future domains requires registering semantic ownership/admission rather than teaching chat to store arbitrary facts.
- The current browser cache is an experience mechanism, not canonical state.

## First proof

Training v0.1 provides the first live conversational flow:

```text
“I worked out today”
  -> ask scope
“legs”
  -> inspect recent Training
  -> offer reuse/new/generic/skip
  -> resolve occurrence time
  -> show structured proposal
  -> explicit confirm
  -> wf_training command
```

This ADR does not make the current narrow recognizer the long-term intelligence implementation. A future LLM may improve semantic discovery and phrasing, but it remains upstream of domain admission and authority.
