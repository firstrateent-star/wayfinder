# Person + Temporal Kernel + Body — Live Database Test v0.1

**Database:** existing `vlourish` Supabase host, isolated private `wf_*` namespaces  
**Result:** PASS  
**Method:** real Postgres execution under simulated `authenticated` JWT context; all synthetic Person/Body data rolled back.

## Person v0.1 passed behaviors

- authenticated Person create returned `APPLIED`;
- one stable Person + exact version v1 were created;
- same Command id + same material replayed the prior `APPLIED` result with `replayed=true`;
- same semantic Person create under a new Command id returned `NOOP` rather than creating another Person;
- profile correction created v2, superseded v1, and advanced the stable head;
- stale correction using v1 returned `REJECTED / STALE_VERSION`;
- future birth date returned `REJECTED / BIRTH_DATE_IN_FUTURE`;
- `wf_person_current_v0()` resolved the current exact version;
- deferred head-integrity constraints were forced `IMMEDIATE` and passed;
- direct `authenticated` access to `wf_person.persons` was denied.

## Temporal Kernel passed behaviors

`wf_system.local_day_bounds(date, 'America/New_York')` returned real local-day bounds:

```text
2026-03-08 -> 23 hours  [DST spring transition]
2026-09-15 -> 24 hours
2026-11-01 -> 25 hours  [DST fall transition]
```

This confirms future daily Requirements can use local-calendar intervals rather than assuming every day contains 24 elapsed hours.

## Body v0.1 passed behaviors

- height `69 inches` was accepted and canonicalized to reported unit token `in`;
- weight `152 lbs` was accepted and canonicalized to reported unit token `lb`;
- deterministic read normalization returned height `175.26 cm`;
- deterministic read normalization returned corrected weight in kilograms;
- same Command id + same measurement material replayed the prior `APPLIED` result;
- invalid metric/unit combination (`height` + `lb`) returned `REJECTED / INVALID_BODY_MEASUREMENT_UNIT`;
- correcting the weight created v2, superseded v1, and advanced the stable head;
- stale correction using weight v1 returned `REJECTED / STALE_VERSION`;
- `wf_body_current_v0()` selected the latest active height and weight observations;
- deferred head-integrity constraints were forced `IMMEDIATE` and passed;
- direct `authenticated` access to `wf_body.measurements` was denied.

## Current-read epistemic behavior

`wf_body_current_v0()` deliberately reports the latest recorded observation rather than claiming complete physical truth.

The live read explicitly preserved:

```text
reported quantity     -> canonical sourced value/unit
deterministic quantity -> normalized value/unit
observed_at            -> when the measurement applies
recorded_at            -> when Wayfinder recorded it
```

and explicitly did not assert health status, fitness, BMI/body composition, stamina/recovery, or absence of unrecorded measurements.

## Rollback verification

After the rollback:

```text
wf_person.persons              = 0 test rows
wf_person.person_versions      = 0 test rows
wf_body.measurements           = 0 test rows
wf_body.measurement_versions   = 0 test rows
```

No synthetic Character/Person/Body data from the test remains in the live database.

## Security advisory context

Supabase's generic table metadata surfaces an RLS-disabled advisory for private `wf_person` / `wf_body` tables. This was not auto-remediated.

Wayfinder currently uses a deliberately different primary boundary:

```text
schema/table privileges denied to client roles
+
public owner-scoped SECURITY DEFINER RPCs
```

The live test proved direct authenticated table access is denied. RLS remains a possible future defense-in-depth decision rather than a reason to weaken or replace the current private-schema boundary.

## Gate

**PERSON + TEMPORAL + BODY v0.1 LIVE GATE: PASSED**

Next design pressure: one player-facing Character Creation action may conceptually capture Person + Body information together. Before exposing it, Flower whether the initial creation workflow requires one atomic orchestration boundary across the two canonical modules or may truthfully expose partial completion/retry semantics.
