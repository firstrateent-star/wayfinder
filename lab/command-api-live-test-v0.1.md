# Slice 1A Command Runtime — Live Database Test v0.1

**Database:** existing `vlourish` Supabase host, isolated `wf_*` namespaces  
**Result:** PASS

The test executed against the real Postgres engine under a simulated `authenticated` JWT context and rolled all test data back.

## Passed behaviors

- authenticated owner bootstrap via `auth.uid()`;
- Direction, Outcome, and Action creation;
- Direction `SUPPORTS` edges;
- unversioned Practice creation without a fabricated version id;
- PracticeSession creation with exact occurrence semantics;
- same Command id + same material replays the existing APPLIED result without duplicating the session;
- same Command id + changed material raises `COMMAND_ID_CONFLICT`;
- fulfillment Evidence creation using exact PracticeSession + Action versions;
- exact semantic Evidence duplicate under a different Command id returns `NOOP` and does not create extra evidence mass;
- PracticeSession correction creates v2, supersedes v1, and advances the stable head;
- Evidence pointing to v1 remains historically present but no longer qualifies as current after session correction;
- stale correction returns `REJECTED / STALE_VERSION`;
- null temporal precision returns `REJECTED / INVALID_TEMPORAL_PRECISION`;
- exact INSTANT interval with mismatched duration returns `REJECTED / DURATION_INTERVAL_MISMATCH`;
- null Command id raises `COMMAND_ID_REQUIRED` before a receipt can be created;
- direct authenticated access to private `wf_practice` tables is denied;
- a second owner cannot resolve the first owner's Direction ids through a user command;
- only APPLIED canonical changes created ModuleChange outbox rows;
- semantic REJECTED and NOOP commands did not create ModuleChange rows.

## Physical state assertions

After the command sequence, before rollback:

- one logical PracticeSession existed despite a true retry;
- exactly two PracticeSession versions existed after correction;
- v1 was `SUPERSEDED` and v2 was current;
- exactly one active exact fulfillment EvidenceLink existed despite a duplicate attempt;
- old Evidence lineage still resolved to v1;
- old Evidence failed the current-source test after v2 became current;
- owner1 had exactly nine ModuleChange rows for the nine applied canonical changes;
- owner1 had three terminal REJECTED receipts for stale correction, invalid precision, and duration mismatch.

## Additional security evidence

An earlier version of the live test attempted to query `wf_practice.sessions` while running as `authenticated` and received `permission denied for schema wf_practice`. The test was then deliberately restructured so private-state assertions run only after restoring the database-owner role.

This is positive evidence that the command boundary is real rather than merely documented.

## Conclusion

The Slice 1A **write path is executable** and currently satisfies the accepted command, versioning, correction, owner-isolation, and evidence-boundary invariants.

Next evidence source: authenticated read surfaces and composed projections. No frontend should depend on private tables directly.
