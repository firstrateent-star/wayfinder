# ADR-040 — Understanding precedes persistence

**Status:** ACCEPTED  
**Date:** 2026-09-16

## Context

Wayfinder accepts natural input through conversation, voice, connectors, sensors and structured interfaces. A Life OS that saves every utterance first and tries to understand it later becomes a transcript archive or miscellaneous-facts database rather than a trustworthy model of a person.

The system therefore needs a semantic boundary between receiving information and establishing canonical player state.

## Decision

### 1. Input is not canonical player state

Raw text, voice transcripts and connector payloads are processing/source material. They may contain zero, one or many candidate claims.

```text
input
 -> semantic recognition
 -> candidate graph
 -> knowledge/context resolution
 -> domain admission
 -> authorized command
 -> canonical reality
```

No input is persisted as player reality merely because it was received.

### 2. Understanding precedes persistence

A candidate may reach a canonical write only after Wayfinder can identify:

- its semantic claim type;
- the one canonical module that owns that kind of truth;
- sufficient temporal meaning;
- provenance/source authority;
- unresolved ambiguity that would invalidate the write;
- applicable authorization;
- a typed command boundary owned by that module.

Model confidence alone is never sufficient authority to persist a claim.

### 3. No owner, no persistence

A candidate with no legitimate canonical owner is not routed into a miscellaneous facts, notes, memory or unknown-data table. It is discarded unless it has a justified session-only, reflection or clarification purpose.

### 4. One canonical owner per claim

Many projections may consume a fact, but one semantic claim has one canonical owner. Multiple admission contracts claiming the same candidate are treated as an architecture error rather than resolved by registration order.

One source may contain multiple distinct claims with different owners.

### 5. Domain admission is an epistemic firewall

Recognition proposes meaning. Knowledge resolution identifies referenced concepts. The owning domain decides whether the candidate is sufficiently grounded to become canonical reality.

Admission outcomes are:

```text
ACCEPT
ACCEPT_PARTIAL
NEEDS_CLARIFICATION
NEEDS_AUTHORIZATION
SESSION_ONLY
REFLECTION
REJECT
```

`ACCEPT_PARTIAL` is valid only when the known part is itself true and missing detail remains explicitly unknown. Admission must never invent missing exercises, reps, loads, foods, quantities or other semantic detail.

### 6. Conversational disclosure is not automatic write authorization

A player may discuss a fact without intending to record it. v0 distinguishes an explicit RECORD intent/authorization from ordinary conversation. Standing domain-specific capture permissions may be added later, but AI inference alone may not create that authority.

### 7. Candidates are transient by default

Semantic candidates and candidate graphs are runtime artifacts in v0. Do not create a universal persistent candidate backlog merely because the runtime can produce candidates.

Durable candidate persistence must be earned by a concrete need such as asynchronous connector processing, delayed reconciliation or cross-session human review, and should carry expiry/lifecycle semantics.

### 8. Raw input is not archived by the admission layer

Accepted canonical records preserve provenance through source references or the minimum support needed for lineage. The Semantic Admission layer does not duplicate entire conversations or voice transcripts into life-domain tables.

### 9. Persistence is followed by recomputation

A canonical write is not the end of ingestion. A successful domain command must make changed domain understanding available to downstream projections, requirement evaluation, Position and Information Need generation.

Semantic Admission v0.1 proves this locally by re-reading recent Training state after a successful Training write. Broader cross-domain invalidation/recomposition remains a later slice.

## First proving slice

Training v0.1 is the first domain implementing the rule:

```text
natural player input
 -> bounded Training recognition
 -> exercise reference resolution
 -> Training admission contract
 -> clarification or authorization when required
 -> wf_training_capture_strength_session
 -> wf_training_recent_v0 recomputation
```

Examples:

```text
"I benched 185 lbs for 8 reps for 3 sets today"
 -> ACCEPT when explicitly authorized
 -> three structured Barbell Bench Press sets

"I benched 185 for 8 three times today"
 -> NEEDS_CLARIFICATION
 -> no write

"I crushed legs today"
 -> ACCEPT_PARTIAL
 -> generic lower-body strength session
 -> no invented exercise sets

"I saw a cool red Corvette"
 -> no Training claim
 -> no owner
 -> no persistence
```

## Consequences

### Positive

- natural input can become structured reality without turning Wayfinder into a logging/notebook system;
- each life domain protects its own semantics;
- future recognition models can improve without receiving authority over canonical truth;
- irrelevant/unplaced information does not accumulate indefinitely;
- clarification questions arise from concrete admission failures rather than generic questionnaires;
- voice can eventually decompose one utterance across multiple legitimate owners.

### Costs

- domains must define admission semantics as they are added;
- some apparently understandable statements require clarification or explicit authorization before persistence;
- v0 recognition coverage is intentionally narrow;
- cross-domain natural-language recognition remains future work.

## Non-goals

This ADR does not authorize:

- generic AI memory as canonical state;
- automatic persistence based on confidence thresholds;
- a universal facts table;
- a universal candidate queue;
- storing raw transcripts as the life model;
- derived RPG projections writing directly from unadmitted natural-language candidates.
