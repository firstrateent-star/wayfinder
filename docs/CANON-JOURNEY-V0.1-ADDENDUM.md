# Wayfinder Canon Addendum — Journey v0.1

**Status:** CANON ADDENDUM  
**Applies to:** Foundation v0.9 until folded into the next consolidated `docs/CANON.md` revision.

Journey v0.1 adds the following accepted architectural truths:

1. Journey is a reconstructable projection, not a canonical event store.
2. Journey must preserve explicit temporal semantics. `OCCURRED` and `RECORDED` may be sorted together for navigation but are not equivalent meanings.
3. A current PracticeSession appears at most once as lived activity in Journey. Corrections appear separately as record-time correction items.
4. Exact Evidence lineage is historical. Correction does not silently move an EvidenceLink from an old SessionVersion to a new one.
5. Temporal adjacency does not establish causality.
6. `module_change_outbox` remains infrastructure and is not automatically life history.
7. Journey result completeness does not imply complete lived-reality coverage.
8. Journey v0.1 remains pre-interpretive: it does not author Reflection, meaning, causality, growth scores, or AI narrative truth.

Deployed read:

```text
wf_journey_v0(from,to,limit)
```

Rule version:

```text
journey_v0.1
```

Included item families:

```text
PRACTICE_SESSION
DIRECTION_RECORDED
DIRECTION_RELATION_RECORDED
EVIDENCE_RECORDED
PRACTICE_SESSION_CORRECTED
```

Time rules:

```text
PRACTICE_SESSION             → OCCURRED → occurred_from
DIRECTION_*                  → RECORDED → recorded_at
EVIDENCE_RECORDED            → RECORDED → recorded_at
PRACTICE_SESSION_CORRECTED   → RECORDED → new-version recorded_at
```

Canonical references:

- `docs/16-journey-v0.md`
- `decisions/ADR-029-journey-preserves-multiple-time-semantics.md`
- `lab/journey-v0-flower-and-stress-test.md`
- `supabase/migrations/20260915171000_add_wayfinder_journey_v0.sql`

The next consolidated Canon revision should incorporate these points without changing their meaning unless new evidence explicitly supersedes them.
