# Character Initialization Atomic Orchestration — Live Test v0.1

**Status:** PASS  
**Database:** live Supabase project `ngakauhlcmvwnmimtsca`  
**Method:** real authenticated execution with all synthetic canonical data rolled back.

## Subject

```text
public.wf_character_initialize_v0(...)
```

The RPC is a System/application orchestration command. Character remains a projection; the command routes canonical facts to Person and Body while preserving one indivisible player save.

## Failure atomicity test

Input deliberately supplied:

```text
valid Person payload
invalid Body height value (-69 in)
valid Body weight value
```

Expected behavior:

```text
Person child command would be first
Body child rejects
=> entire child subtransaction rolls back
=> outer command returns REJECTED
```

Observed:

```text
outer status: REJECTED
error_code: INVALID_BODY_MEASUREMENT_VALUE
wf_person_current_v0().person: null
wf_body_current_v0().height: null
wf_body_current_v0().weight: null
```

**No partial canonical residue survived.**

## Success test

A second command captured:

```text
Person
  display name
  birth date
  exact local birth time
  birthplace label

Body
  height 69 in
  weight 152 lb
  shared observed time / zone
```

Observed:

```text
outer status: APPLIED
affected refs: 3
  1 Person ref
  2 Body measurement refs
```

The database contained exactly:

```text
1 Person
2 Body measurements
```

inside the test transaction.

## Retry test

Replaying the exact same outer command id/material returned:

```text
status: APPLIED
replayed: true
```

and did not execute duplicate child writes.

## First-run guard test

Submitting the same semantic initialization under a **new** outer command id after successful initialization returned:

```text
REJECTED
CHARACTER_ALREADY_INITIALIZED
```

This prevents the first-run endpoint from silently appending duplicate "initial" Body observations.

## Correlation test

The Person change plus both Body changes were published by their owning modules and received the outer Character-initialization command id as `correlation_id`.

Observed:

```text
correlated ModuleChange rows: 3
```

No separate Character `ModuleChange` was emitted because Character is not canonical truth.

## Deferred integrity

All deferred constraints were forced `IMMEDIATE` before inspection and passed.

## Rollback verification

After rollback:

```text
wf_person.persons     = 0 synthetic rows
wf_body.measurements  = 0 synthetic rows
```

No test character data remains in production.

## Gate

**ATOMIC CHARACTER INITIALIZATION v0.1: PASSED**

This resolves the Character Creation transaction question in favor of atomic orchestration for the current one-screen first-run intent while preserving Person and Body ownership.

Next architecture pressure: deterministic natal calculation requires a resolved birth instant and geographic context. The system must not infer Ascendant/houses from an unresolved place label or missing birth time.
