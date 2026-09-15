# Command API Stress Test — v0.2

**Target:** typed mutation SQL candidate  
**Result:** architecture holds; two validation hardenings surfaced before public use

## 1. Nullable precision can bypass boolean validation

SQL three-valued logic means `NULL NOT IN (...)` is not `TRUE`; without an explicit null branch, a null `from_precision` could fall through validation and fail later as an unexpected database NOT NULL error.

**Change:** typed Practice RPCs must explicitly reject `from_precision IS NULL` before membership tests.

This keeps malformed user input in semantic `REJECTED` territory rather than turning it into an invariant/transaction failure.

## 2. Exact interval + explicit duration consistency

The physical schema intentionally allows a duration shorter than a coarse uncertainty window (for example, “30 minutes sometime Saturday”). But when both occurrence boundaries are explicitly `INSTANT` precision and a duration is supplied, the bounds represent the exact event interval.

**Change:** log/correction RPCs validate that explicit duration matches the exact interval to whole-second precision when both boundaries are `INSTANT`.

Coarse precision windows do not receive this equality rule.

## 3. Command id null

A Command cannot exist without retry identity. A null command id cannot be persisted as a terminal rejection because the receipt primary key itself is absent.

**Rule:** public mutation RPCs reject/raise `COMMAND_ID_REQUIRED` before claim. This is a malformed transport envelope, not a domain-semantic rejected Command.

## 4. Runtime helper owner scope

The first helper draft returned a receipt by Command id only. Although private, this unnecessarily weakened the boundary.

**Change already incorporated:** `command_response` now requires owner id + command id.

## 5. Remaining scenarios

Re-run found no new issue in:

- same-id retry serialization;
- different-content id conflict;
- duplicate edge/evidence race protection;
- cross-owner lookup scoping;
- bootstrap exception;
- correction ordering;
- deferred invariant rollback;
- SECURITY DEFINER isolation.

## Result

No new primitive, table, or Stateful Module is required. Apply the typed command RPC migration together with a small validation-hardening migration, then test under simulated authenticated JWT context before adding read RPCs.
