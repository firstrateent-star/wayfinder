# First Vertical Slice Stress Test — v0.1

**Target:** `docs/09-first-vertical-slice.md` v0.1  
**Result:** viable, with four important semantic clarifications before schema design

## 1. Evidence exists but Action remains ACTIVE

A 42-minute session has a user-authorized EvidenceLink supporting Action fulfillment.

**Question:** does the Action automatically become completed?

**Answer:** no. Canonical Direction intent state must not be rewritten from evidence alone.

**Change:** add a small **Action Fulfillment read projection**. It can report evidence state (`EVIDENCE_PRESENT`, `NO_EVIDENCE_RECORDED`, `STALE_EVIDENCE_ONLY`, `DISPUTED`) without changing DirectionNode. Helm may visually distinguish evidence-backed fulfillment while leaving canonical Direction semantics intact.

Do not introduce a task-manager-style `completed=true` field.

## 2. Database query is complete, lived-life coverage is not

The database reliably returns zero PracticeSessions for Tuesday.

**Trap:** marking Coverage COMPLETE could be read as “we know no practice occurred.” Manual Wayfinder logging does not provide complete observation coverage of lived practice.

**Clarification:**

- query execution completeness is operational readiness, not epistemic Coverage;
- Coverage describes how completely the declared sources capture the target phenomenon;
- manual self-logging usually has `UNKNOWN`/`PARTIAL` lived-reality coverage unless the user/source explicitly establishes otherwise;
- Wayfinder may still truthfully say “no PracticeSession is logged” because that claim is about its own canonical records.

This distinction should be added to the core Coverage law.

## 3. Evidence workflow silently auto-links

If logging a session automatically creates fulfillment evidence merely because the user launched logging from an Action screen, the UI context could become hidden epistemic authority.

**Change:** EvidenceLink creation must be explicit in the command semantics. A combined user gesture may orchestrate Practice + Evidence commands, but the user intent to link must be represented. If Evidence fails, Practice stays committed and the UI shows unlinked/pending state.

## 4. Session correction leaves historical evidence

Session v1 supports Action v1. Session is corrected to v2.

**Pass with clarification:** the old EvidenceLink remains historical; current Action Fulfillment/Bearing ignores it as current evidence because its source version is superseded. Re-linking v2 is explicit/re-evaluated, not silently inherited.

## 5. Direction title edit strands evidence

Action v1 is reworded into v2 after evidence was linked.

**Result:** historically correct. Evidence does not silently carry across target versions. For harmless text edits, a future deterministic rebind may be possible, but 1A can conservatively show stale evidence until re-evaluated.

## 6. Spontaneous session later becomes relevant

A session is logged without Direction and later linked to an Action.

**Pass.** Practice truth is independent of planning; Evidence can be added later.

## 7. One session supports two Actions

**Pass.** Separate EvidenceLinks can bear on multiple Direction targets. Ancestry rules prevent treating derived descendants as independent source evidence.

## 8. Journey accidentally displays infrastructure

Raw ModuleChanges/command receipts would make Journey look like an audit log.

**Change:** Journey v0 composes user-meaningful canonical records, not infrastructure notifications. Audit/debug views remain separate.

## 9. Hard-delete a referenced session from the UI

**Boundary:** normal correction/removal uses supersession/retraction. Privacy deletion is a separate policy path and may leave explicit tombstone resolution. Do not make ordinary “delete” a silent lineage destroyer.

## 10. Source registry table before any external source exists

Slice 1A only needs user-entry and system-derived sources.

**Economy finding:** source identity can begin with stable built-in machine identifiers. A persisted source registry table is not required until external/user-configured sources appear.

## 11. Persist Journey/Bearing tables immediately

**Not needed.** Both can be computed on demand in 1A. This exercises read contracts while avoiding cache invalidation infrastructure before product evidence demands it.

## 12. AI unavailable

**Pass.** No 1A command/read requires AI.

## Reflection

The slice is small enough to build early and rich enough to prove the architecture. The most important correction is that **evidence-backed fulfillment is a projection, not a Direction-node mutation**.

Revise the slice and then run one more convergence pass before physical schema design.