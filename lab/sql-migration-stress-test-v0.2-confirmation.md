# Executable SQL Migration Stress Test — v0.2 Confirmation

**Targets:**

- `20260915053000_create_wayfinder_slice1_core.sql`
- `20260915053100_harden_wayfinder_version_heads.sql`

**Result:** DEPLOYMENT GATE PASSED for the empty Slice 1A persistence layer.

## Re-run summary

The migration set was re-checked after the first SQL pressure pass against:

- trigger INSERT/UPDATE/DELETE semantics;
- circular stable/version creation;
- correction ordering under the one-ACTIVE partial unique index;
- forward-only supersession lineage;
- latest/head version identity;
- terminal lifecycle monotonicity;
- cross-owner FK integrity;
- half-open/non-empty temporal ranges;
- generic Evidence reference boundaries;
- command receipt/outbox coupling;
- private-schema privilege isolation;
- minimum-table economy.

## Version-head hardening

The companion hardening migration makes the deferred transaction-end invariant explicit:

1. every DirectionNode and PracticeSession stable identity must end the transaction with a resolvable current/latest version;
2. that version must be the greatest stored `version_no` for the logical record;
3. the current/latest version may be ACTIVE or RETRACTED but never SUPERSEDED;
4. at most one ACTIVE version may exist;
5. SUPERSEDED lineage must point to a strictly higher version number, preventing self/backward supersession cycles.

## Correction ordering

Because the one-ACTIVE constraint is immediate, correction commands pre-generate the replacement version id and execute in this order:

```text
lock stable row
pre-generate v2 id
mark v1 SUPERSEDED -> v2 id
insert v2 ACTIVE
move stable current_version_id -> v2
commit / deferred invariant check
```

The same-record supersession FK is deferred, so the temporary forward reference is valid inside the transaction and must resolve by commit.

## No new architecture required

The second pass did **not** require:

- a new ontology primitive;
- a new Stateful Module;
- a universal record registry;
- event sourcing;
- a projection table;
- a workflow/saga table;
- a service split;
- any table beyond the accepted ten-table Slice 1A shape.

## Deployment authorization

The SQL migration set is authorized to be applied to the existing `vlourish` Supabase project inside the isolated `wf_*` namespaces.

After deployment, the next evidence must come from the real Postgres engine:

1. inspect created objects and privileges;
2. run transactional invariant tests that roll back;
3. run security/performance advisors;
4. record any database-engine findings;
5. only then build public command/read RPC surfaces.
