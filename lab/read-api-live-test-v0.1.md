# Slice 1A Read Runtime — Live Database Test v0.1

**Database:** existing `vlourish` Supabase host, isolated `wf_*` namespaces  
**Result:** PASS WITH ONE SEMANTIC REFINEMENT

The live test executed against the real Postgres engine using two simulated authenticated users and rolled all fixture data back.

## Passed attacks

### Half-open temporal boundaries

For read scope `[10:00, 11:00)`:

- point at exactly `10:00` was included;
- point at exactly `11:00` was excluded;
- range ending exactly at `10:00` was excluded;
- range starting exactly at `11:00` was excluded;
- interval crossing the left boundary was included.

This confirms the executable read path matches the accepted `[start,end)` contract.

### Owner isolation

A second owner received:

- an empty Direction graph rather than owner 1 records;
- zero PracticeSession records for the tested window;
- `TARGET_NOT_FOUND` when attempting to read owner 1's Action evidence by exact IDs.

No cross-owner read leak was observed.

### Stale Evidence

A fulfillment EvidenceLink was initially `source_current=true`, `target_current=true`, and `currently_usable=true`.

After correcting the source PracticeSession from v1 to v2, the historical EvidenceLink remained returned for the exact Action target but became:

- `source_current=false`;
- `currently_usable=false`.

Evidence did not silently migrate to the corrected source version.

### Empty result semantics

A window with no stored PracticeSession records returned an empty array and zero matching records while still explicitly refusing to claim complete lived-reality coverage.

### Result-limit behavior

Three matching current PracticeSessions queried with `limit=2` returned two rows while reporting three matches and a truncation reason.

## Flower finding

The executable behavior was correct, but the response vocabulary still conflated two different questions:

1. **Did the API return all matching database rows?**
2. **Does Wayfinder completely know the lived phenomenon?**

The existing field `storage_coverage.completeness=PARTIAL` on result truncation made a result-window property look like epistemic/lived-reality coverage.

That violates the spirit of the bounded Coverage contract even though `lived_reality_complete=false` prevented the worst interpretation.

## Required refinement

Split the concepts explicitly:

- `result_coverage` — COMPLETE/PARTIAL relative to matching stored rows and result limit;
- `epistemic_coverage` — current source coverage of the underlying lived phenomenon, initially `UNKNOWN` for manually stored Practice/Evidence records unless a future source can prove completeness.

For Direction, a narrower `record_coverage` may truthfully be COMPLETE for the current Wayfinder-stored graph without claiming that every intention in a person's life has been captured.

## Gate status

Read mechanics passed. The **Read Gate remains pending** until this vocabulary refinement is deployed and the same adversarial cases are rerun.
