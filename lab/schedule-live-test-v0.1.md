# Schedule v0.1 live database test

**Status:** PASSED

## Purpose

Prove the first canonical Schedule slice against the deployed Supabase database without leaving synthetic player data behind.

## Test method

The test ran inside one database transaction using an existing authenticated Wayfinder owner scope, invoked only public Schedule RPCs, inspected the read projection, checked private-schema access, and rolled the transaction back.

No synthetic Schedule allocation remains after the test.

## Results

```text
Create SOFT allocation       -> APPLIED
Revise/reschedule allocation -> APPLIED
Bounded current read         -> 1 current allocation
Direct authenticated USAGE   -> false
Transaction                  -> ROLLBACK
```

The revised allocation superseded the original version rather than mutating its semantic payload in place.

## Semantics proved

- Schedule can create one fixed SOFT planned interval.
- Schedule can version/reschedule it using an expected current version.
- The read projection resolves only the current head.
- Schedule remains private behind authenticated public RPCs.
- The test does not assert that the scheduled activity actually happened.

## Advisor follow-up

After deployment, missing covering indexes reported for Wayfinder Person/Body/Schedule foreign keys were added in migration:

`20260916030500_index_wayfinder_person_body_schedule_foreign_keys.sql`

A subsequent performance advisor run no longer reported `unindexed_foreign_keys` for these schemas. Newly created indexes may naturally appear as unused until production traffic exercises them.

Security advisor notes remain consistent with the intended architecture: authenticated `SECURITY DEFINER` RPCs are an intentional narrow API boundary, while private Wayfinder schemas deny direct client access. Leaked-password protection remains a separate production-hardening item.
