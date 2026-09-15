# Wayfinder Database Bootstrap

**Version:** 0.1  
**Status:** DEPLOYED — NAMESPACE ONLY

## Physical host

Wayfinder is hosted inside the existing Supabase project named `vlourish`.

This is shared infrastructure only. Wayfinder remains a separate top-level system through dedicated Postgres schemas and independent canonical ownership.

## Deployed schemas

The namespace bootstrap migration created:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

All privileges on these schemas were revoked from:

- `public`
- `anon`
- `authenticated`

No Wayfinder canonical tables have been created yet.

## Migration

Deployed Supabase migration:

`20260915044820_bootstrap_wayfinder_namespaces`

Repository source:

`supabase/migrations/20260915044820_bootstrap_wayfinder_namespaces.sql`

## Boundary with Vlourish

The existing `vl_core`, `vl_method`, `vl_gov`, and `vl_ops` schemas are not Wayfinder canonical persistence.

Wayfinder must not silently depend on those tables for its own truth model. Future cross-system integration requires an explicit contract/ADR.

## Advisor check

Security and performance advisors were run immediately after bootstrap.

No findings concern the empty `wf_*` schemas. Current advisor notices relate to existing `vl_*` tables/configuration and are therefore outside the Wayfinder namespace bootstrap.

## Next gate

The next step is **not frontend work**.

It is to produce executable SQL for the ten-table Slice 1A model defined by `docs/10-physical-schema.md`, then recursively review that SQL before applying it.

Required review areas:

- owner and composite foreign keys;
- deferrable current-version invariants;
- immutable payload/lifecycle triggers;
- monotonic lifecycle transitions;
- command receipt concurrency and deterministic request hashing;
- auth/RPC/security-definer boundaries;
- cross-owner isolation;
- Evidence exact-version resolver behavior;
- restore/migration behavior;
- `[start, end)` temporal validation.

Only after that SQL gate passes should the first canonical Wayfinder tables be created.