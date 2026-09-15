# Physical Schema Stress Test — v0.5 Confirmation

**Target:** `docs/10-physical-schema.md` v0.5 plus ADR-022/023/024  
**Result:** PHYSICAL SCHEMA GATE PASSED FOR SLICE 1A SQL DESIGN

## Center

Does the first-slice topology still hold after applying the v0.4 clarifications and changing physical hosting from a dedicated Supabase project to isolated schemas inside the existing `vlourish` Supabase project?

## Re-test results

1. **Non-empty known ranges** — PASS. Bounded occurrence ranges require `end > start`; instant occurrence does not fake a zero-width range.
2. **Receipt claim state** — PASS. `PROCESSING` is internal transaction machinery; public receipts remain terminal `APPLIED | REJECTED | NOOP`.
3. **Practice lifecycle** — PASS. Unversioned Practice metadata permits monotonic `ACTIVE → RETRACTED` only in Slice 1A.
4. **Owner bootstrap concurrency** — PASS. Idempotent bootstrap keyed by unique `auth_user_id` remains the one justified pre-owner exception to normal Command handling.
5. **Outbox command integrity** — PASS. Nullable FK to command receipt is useful when command-backed; system-internal changes may remain null if introduced later.
6. **Current-pointer/supersession integrity** — PASS. Deferrable same-record/owner checks preserve atomic correction ordering.
7. **Evidence currentness race** — PASS. Exact historical refs plus current read re-resolution avoid distributed locking.
8. **Direction-edge semantics** — PASS. Structural graph edges bind logical nodes; fulfillment evidence remains exact-version addressed.
9. **Owner/auth deletion boundary** — PASS. Restrictive deletion is correct until an explicit privacy purge workflow exists.
10. **Deterministic command hashing** — PASS. Canonicalized material request content prevents JSON serialization order from changing retry identity.
11. **Half-open temporal semantics** — PASS. `[start, end)` remains consistent across day/range normalization and adjacent queries.
12. **Shared Vlourish physical host** — PASS. Dedicated `wf_*` schemas preserve canonical ownership and migration boundaries; no Wayfinder canonical table depends on `vl_*` tables.
13. **Minimum-table economy** — PASS. Intended Slice 1A remains ten tables; no speculative table family is justified.
14. **Frontend security boundary** — PASS. Empty namespaces begin with all privileges revoked from `public`, `anon`, and `authenticated`; later access is granted only through explicit command/read surfaces.

## Confirmation result

No new ontology primitive, object contract, stateful-module rule, table family, or distributed component is required.

### Gate status

- Ontology gate: PASSED
- Object contracts gate: PASSED
- Stateful Module Protocol gate: PASSED
- System architecture gate: PASSED
- First vertical slice gate: PASSED
- Physical schema design gate: **PASSED**
- Empty namespace bootstrap: **AUTHORIZED AND DEPLOYED**
- Slice 1A table migration: **NOT YET DEPLOYED**

The next validation target is executable SQL for the ten-table first-slice migration. SQL must be reviewed adversarially before application.