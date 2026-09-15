# Journey v0.1 — Flower + Stress Test

**Status:** first recursive pass complete  
**Date:** 2026-09-15

## Seed question

> What is the smallest Journey that answers **“How did I get here?”** without turning presentation into a second reality model?

## Context petal

The live backbone now contains enough distinct truth shapes to expose a useful temporal view:

- Direction intentions;
- Direction relationships;
- Practice identities;
- versioned PracticeSessions with lived occurrence time;
- exact EvidenceLinks;
- correction lineage;
- derived Bearing/Helm.

Real browser use showed the backbone is understandable enough to begin a second experience surface.

## Direction petal

Journey should make Wayfinder feel continuous through time rather than like a collection of dashboard cards.

The first target is not autobiography, AI storytelling, or RPG progression. It is a faithful reconstruction of selected records.

## Ontology petal

Candidate “timeline item” is **not** promoted to the canonical ontology.

A Journey item is a projection role played by an underlying record or relationship.

```text
PracticeSession --------→ Journey item role: lived activity
DirectionNode ----------→ Journey item role: intention recorded
DirectionEdge ----------→ Journey item role: relationship recorded
EvidenceLink -----------→ Journey item role: evidence connected
Session version change -→ Journey item role: correction recorded
```

This avoids a new universal `Event` table that would flatten fundamentally different concepts.

## Time petal

### Failure mode

A normal activity-feed design assumes one timestamp means one thing.

Wayfinder already knows that is false.

### Surviving model

Every item has:

```text
timeline_at
+
time_basis
```

Initial time bases:

```text
OCCURRED
RECORDED
```

`PRACTICE_SESSION` is anchored to `occurred_from`.

Direction, Evidence, and correction records are anchored to `recorded_at`.

### Boundary

One sorted timeline is a navigation device, not a mathematical claim that the timestamps are ontologically equivalent.

## Mathematics petal

### Set model

Let:

```text
J = R ∪ D ∪ E ∪ C
```

where:

- `R` = currently asserted PracticeSession occurrence items;
- `D` = Direction creation/relationship record items;
- `E` = exact EvidenceLink record items;
- `C` = PracticeSession correction transitions.

For scope `S=[a,b)`:

```text
J(S) = { x ∈ J | a ≤ timeline_at(x) < b }
```

The membership function depends on item type because `timeline_at` is a projection function:

```text
timeline_at(R) = occurred_from
timeline_at(D,E,C) = recorded_at
```

### Non-double-counting invariant

For one logical PracticeSession `s`, exactly one currently asserted lived item may exist in Journey:

```text
| { r ∈ R | logical_id(r)=s } | ≤ 1
```

Version supersession does not add another member to `R`. It adds a member to `C`.

This prevents correction history from inflating apparent lived activity.

### Result completeness

If `N = |J(S)|` and API limit is `L`:

```text
result_coverage = COMPLETE  iff N ≤ L
result_coverage = PARTIAL   iff N > L
```

This says nothing about complete lived-life coverage.

### Epistemic complement

Even if `result_coverage=COMPLETE`:

```text
P(complete lived history | complete stored Journey result) ≠ 1
```

Wayfinder therefore exposes lived-reality epistemic coverage as `UNKNOWN`.

## Evidence petal

An EvidenceLink already contains exact source/target versions.

Journey must not resolve an old EvidenceLink to today's current source version and pretend the link moved.

Instead:

```text
EvidenceLink(source=v1)
PracticeSession current=v2

→ history still points to v1
→ source.is_current=false
```

This makes stale lineage visible without deleting or rewriting history.

## Correction petal

### Rejected model

```text
Session v1 → Journey lived item
Session v2 → Journey lived item
```

This makes one real session appear to have happened twice.

### Accepted model

```text
current Session version → one lived item at occurrence time
v1 superseded by v2     → one correction item at v2.recorded_at
```

## Causality petal

Journey deliberately does not infer causality.

Temporal adjacency does not mean:

```text
A happened before B
therefore A caused B
```

No `because` language belongs in Journey v0.1 unless the user explicitly authored that meaning in a future Reflection/Interpretation layer.

## Meaning petal

Journey v0.1 does not generate narrative meaning.

A future intelligence layer may summarize the timeline, but must distinguish:

- canonical source records;
- derived pattern;
- AI interpretation;
- user-authored reflection.

The timeline itself stays pre-interpretive.

## UI petal

The screen should feel like memory/navigation, not accounting software.

Chosen presentation:

- grouped days;
- calm vertical timeline;
- four visual layers: Reality, Direction, Evidence, Correction;
- explicit Occurred/Recorded chip;
- no XP, score, streak, or percent;
- 7/30/90-day scopes;
- coverage language at bottom.

## Backend petal

New read:

```text
wf_journey_v0(from,to,limit)
```

No new canonical tables.

No use of `module_change_outbox` as life history.

Reason: ModuleChange records infrastructure changes. They are useful for integrations/rebuilds but are not automatically lived reality or user-meaningful history.

## Security petal

Journey follows the existing public read seam:

```text
authenticated browser
→ public SECURITY DEFINER RPC
→ auth.uid() owner resolution
→ owner-scoped private reads
→ projection JSON
```

Private schema grants remain unchanged.

## Adversarial stress tests

### 1. Empty scope

Expected:

- `items=[]`;
- result coverage COMPLETE;
- epistemic coverage UNKNOWN;
- UI says no matching stored Journey items, not “nothing happened.”

### 2. Limit truncation

Expected:

- deterministic newest-first ordering;
- `matching_item_count > returned_count`;
- result coverage PARTIAL + `RESULT_LIMIT`.

### 3. Corrected session

Rollback test sequence:

```text
attach Evidence to current session v1
correct v1 → v2
query Journey
```

Observed:

```text
lived_session_items = 1
correction_items    = 1
stale_evidence_items = 1
changed_fields      = ["focus"]
```

PASS.

### 4. Evidence after correction

Old EvidenceLink remains in Journey with exact source v1 and `source.is_current=false`.

PASS.

### 5. Direction is not reality

Direction creation items use layer `DIRECTION` and `time_basis=RECORDED`.

The UI does not describe them as actions that happened.

PASS by contract.

### 6. Owner isolation

The function derives owner via `wf_system.require_authenticated_owner()` and every branch scopes by that owner.

No owner id is accepted from the caller.

PASS by construction; remains part of live security regression suite.

### 7. Direct frontend access

Frontend calls only `getJourney → supabase.rpc('wf_journey_v0')`.

Existing boundary checker still forbids direct private-schema access.

CI required before gate closes.

## Pressure-test: what is Journey *not* yet?

Not yet:

- a universal event ontology;
- a journal;
- a Reflection store;
- a causal graph;
- a Character growth engine;
- a location history;
- a calendar replica;
- a chat transcript;
- a complete audit log;
- a gamified streak feed.

This narrowness is intentional.

## Expansion candidates after lived browser evidence

Possible next petals, only if actual use demands them:

1. user-authored Reflection entries attached to exact timeline records;
2. explicit “chapter” projection over periods of Direction change;
3. filters by domain/layer;
4. explain/drill-down lineage drawer;
5. Navigator-generated summaries clearly labeled as interpretation;
6. Character projections over evidence patterns;
7. cross-domain Journey once a second life domain exists.

## Gate decision

### Backend Journey v0.1

**PASS — stable enough for browser evidence.**

### Human experience

**OPEN.**

The next Flower input is whether the actual Journey screen feels like:

> “Yes, this helps me understand how I got here.”

rather than merely:

> “This is a technically correct activity feed.”
