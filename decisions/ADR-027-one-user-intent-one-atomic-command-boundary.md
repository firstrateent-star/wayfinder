# ADR-027 — One indivisible user intent uses one atomic command boundary

**Status:** ACCEPTED  
**Date:** 2026-09-15

## Context

The first real browser use of Slice 1A exposed a structural mismatch between the user's perceived action and the application's transaction boundary.

The original Practice capture UI treated “record this practice session” as two independently committed commands:

```text
create Practice
  ↓ commit
log PracticeSession
  ↓ commit
```

When the second write failed, the first write remained canonical even though the person had experienced the interaction as one failed save. The database was internally valid, but the resulting partial state did not faithfully represent the user's indivisible intent.

The same risk existed for creating an Action and then separately creating its optional SUPPORTS edge.

## Decision

When a user-facing operation is experienced as one indivisible intent, and a strict subset of its required canonical writes would misrepresent that intent, the application boundary must expose one authoritative command whose required writes share one database transaction.

Formally, for a command transaction `T` with required canonical writes `W = {w1 ... wn}`:

```text
commit(T) => all(W)
not all(W) => rollback(T)
```

A successful strict subset of `W` is not an accepted terminal state for that user intent.

This decision does **not** mean every multi-step workflow becomes one giant transaction. Separate human decisions, long-running processes, cross-service workflows, and independently meaningful state transitions may remain separate commands. Atomicity follows the semantic boundary of the intent, not screen layout or implementation convenience.

## Slice 1A application

Practice capture uses:

```text
wf_practice_capture_session(...)
```

which validates the whole request, resolves or creates the Practice, creates Session + SessionVersion, advances the version head, writes receipt/outbox state, and commits together.

Direction capture uses:

```text
wf_direction_capture_node(...)
```

which creates the Direction node and optional Action SUPPORTS edge in one command transaction.

Lower-level commands remain valid module primitives but the live browser must not compose them into a partially committing representation of one indivisible save.

## Idempotency

The atomic command still obeys the existing command identity contract:

```text
same command id + same normalized material
→ replay same terminal receipt

same command id + changed material
→ COMMAND_ID_CONFLICT
```

The client may retain a command id across retry while material input is unchanged. Material input changes require a new command id.

## Consequences

### Positive

- UI failure cannot leave a semantic half-save for these capture operations.
- Retry behavior is simpler because one command receipt describes the whole user intent.
- Validation happens before creating dependent canonical state.
- The browser remains an intent collector instead of becoming a workflow coordinator.
- Outbox/result lineage can explain the entire atomic mutation.

### Costs

- Compound command RPCs may duplicate some validation/write orchestration that exists in lower-level commands.
- Command boundaries must be designed intentionally rather than mechanically mirroring tables.
- Long-running or external workflows still need different coordination semantics; this ADR does not authorize broad database transactions across arbitrary processes.

## Rejected alternatives

### Let the frontend compensate after partial failure

Rejected because compensation makes the browser a workflow authority and may itself fail.

### Delete the first write if the second write fails

Rejected as a client-side repair strategy because it can erase legitimate concurrent/historical state and still requires privileged orchestration outside the owning module.

### Accept partial state as harmless

Rejected because the partial Practice rows observed in the first live browser session were concrete evidence that storage validity alone is weaker than semantic fidelity to user intent.

## Evidence

See:

- `lab/live-slice-flower-v0.1.md`
- `supabase/migrations/20260915074000_harden_live_capture_workflows.sql`
- first live browser Practice/Action capture failure trail documented in `PROJECT_STATE.md`
