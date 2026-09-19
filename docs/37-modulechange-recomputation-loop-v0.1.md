# ModuleChange-driven recomputation loop v0.1

**Status:** IMPLEMENTED / CI GREEN / LIVE INVALIDATION GATE PASSED  
**Date:** 2026-09-19

## Goal served

This slice is the first implementation outcome under the canonical Direction:

```text
Make Wayfinder work as my daily Life OS
            ↑ SUPPORTS
Close the living reality to guidance loop
            ↑ SUPPORTS
Build ModuleChange-driven recomputation
```

## Runtime

```text
canonical domain command
 -> wf_system.module_change_outbox
 -> wf_module_changes_v0
 -> deterministic recomputation impact planner
 -> current canonical reads
 -> Position
 -> Bearing
 -> Helm State
 -> frontend refresh
```

ModuleChange is an invalidation signal only. It is not replayed as life truth and does not become a projection store.

## New pieces

- `wf_module_changes_v0`: owner-scoped operational change cursor.
- `recomputation-planner.ts`: maps changed modules to affected projections.
- `wayfinder-state-service.ts`: derives the current Direction support branch and Helm state.
- `wayfinder-state` Edge Function: composes Position + Bearing + ModuleChange impact from canonical reads.
- Helm now refreshes `wayfinder-state` after confirmed Navigator canonical writes.

## Current recomputation coverage

Recomputed now:

```text
Position
Bearing
Helm
```

Declared invalidation targets but intentionally not yet recomputed:

```text
Requirements
Character
```

Navigator canonical context is invalidated on the next semantic read rather than persisted.

## Direction lineage

Focus actions are not ranked or guessed. Helm walks canonical `SUPPORTS` edges backward from the explicit current Direction.

An unrelated active Action therefore cannot appear as work for the current Direction merely because it is active.

## Partial ModuleChange windows

If more changes occurred than the bounded cursor read returns, Wayfinder invalidates every projection target conservatively. This is safe because state is recomputed from current canonical reads rather than reconstructed by event replay.

## Live evidence

A rollback-backed production test proved:

1. establish an owner-scoped ModuleChange cursor;
2. execute one rollback-only Direction command;
3. exactly one Direction ModuleChange appears after the cursor;
4. result coverage is COMPLETE;
5. Bearing recomputes against current Direction state;
6. transaction rollback leaves no synthetic canonical data.

The real canonical branch was also verified:

```text
Build ModuleChange-driven recomputation
 -> SUPPORTS
Close the living reality to guidance loop
 -> SUPPORTS
Make Wayfinder work as my daily Life OS
```

## Next petal

Finish the deferred recomputation targets:

```text
ModuleChange
 -> domain-owned Requirement observations/specs
 -> coverage-aware Requirement evaluation
 -> reconstructable Character projection
 -> Bearing/guidance
 -> Helm/Navigator
```

No cached/persisted projection should be introduced until evidence shows a real caching or snapshot requirement.
