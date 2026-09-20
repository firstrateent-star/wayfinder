# Wayfinder Journey v0.2

**Status:** v0.1 DEPLOYED / v0.2 IMPLEMENTED ON BRANCH — PRODUCTION GATE PENDING  
**Projection:** `wf_journey_v1(from,to,limit)`  
**Route:** `/journey`

## Product question

Journey answers:

> **How did the Wayfinder record arrive here?**

It is deliberately narrower than:

> What is my complete life story?

Journey is a reconstruction over selected canonical records. It should feel human and chronological without pretending Wayfinder has complete knowledge of lived reality.

## Architectural role

```text
CANONICAL MODULES
Direction · Practice · Practice Output · Evidence
          ↓
   Journey projection
          ↓
  chronological experience
```

Journey does not own canonical facts and does not introduce a `journey_events` table in v0.1.

It is reconstructable and disposable like Helm/Bearing.

## Flower result

The first Flower identified five requirements.

### 1. History must not become a second truth store

Journey reads existing canonical records. It does not persist a parallel timeline merely for presentation.

### 2. Two clocks must remain visible

Wayfinder distinguishes:

- **occurred time** — when a lived activity is recorded as having occurred;
- **recorded time** — when an intention, relationship, evidence connection, or correction entered the Wayfinder record.

Journey may visually sort both on one timeline, but every item carries `time_basis`.

See ADR-029.

### 3. Corrections must not duplicate lived reality

Only a PracticeSession's **current ACTIVE exact version** becomes a `PRACTICE_SESSION` Journey item.

When that record is corrected, the newer session version does not create a second lived activity card. Instead Journey emits a separate `PRACTICE_SESSION_CORRECTED` record-time item.

This gives:

```text
one lived session
+
zero or more record corrections
```

rather than:

```text
version 1 = lived session
version 2 = another lived session   ❌
```

### 4. Evidence must remain historical after correction

An `EVIDENCE_RECORDED` item points to the exact source and target versions that were connected.

Journey computes whether those exact references remain current. It never silently migrates an old EvidenceLink to a corrected PracticeSession.

### 5. Missing Journey items are not missing life

The API returns result coverage separately from epistemic coverage.

An empty Journey scope means:

> No matching Journey items are stored in this selected projection scope.

It does not mean:

> Nothing happened.

## Included item families v0.2

### `PRACTICE_SESSION`

Layer: `REALITY`  
Time basis: `OCCURRED`  
Timeline anchor: `PracticeSession.current_version.occurred_from`

Represents a currently asserted lived PracticeSession.

Returns:

- exact current Session version ref;
- Practice identity and name;
- focus;
- duration;
- occurrence range and timezone;
- recorded time.

### `PRACTICE_OUTPUT_RECORDED`

Layer: `RESULT`  
Time basis: `RECORDED`  
Timeline anchor: first Practice Output version `recorded_at`

Represents the recording of one canonical completed Practice Output.

Journey does **not** substitute the source PracticeSession's occurrence time as an exact Output-completion timestamp. The source session's occurrence remains available inside lineage.

Returns:

- exact first Output ref;
- title / optional evidence URL;
- Practice identity at recording;
- exact source-session ref + source occurrence context;
- current Output state when still resolvable.

### `PRACTICE_OUTPUT_CORRECTED`

Layer: `CORRECTION`  
Time basis: `RECORDED`

Represents one supersession transition between exact Practice Output versions.

It exposes changed fields plus before/after title, URL, Practice, and source-session version.

A correction never becomes another completed-work item.

### `DIRECTION_RECORDED`

Layer: `DIRECTION`  
Time basis: `RECORDED`

Represents the first recorded version of a Value/Direction/Outcome/Commitment/Quest/Plan/Action.

It is an intention/history artifact, not an assertion that the intention happened in lived reality.

### `DIRECTION_RELATION_RECORDED`

Layer: `DIRECTION`  
Time basis: `RECORDED`

Represents a recorded Direction graph relationship such as `SUPPORTS`.

The relationship is canonical between logical Direction identities. v0.1 uses first-version titles for historical display so a future current-title change does not silently rewrite the old timeline label.

### `EVIDENCE_RECORDED`

Layer: `EVIDENCE`  
Time basis: `RECORDED`

Represents an exact EvidenceLink between PracticeSession version and Action version.

Returns currentness of the exact source and target refs so the UI can distinguish current vs historical lineage.

### `PRACTICE_SESSION_CORRECTED`

Layer: `CORRECTION`  
Time basis: `RECORDED`

Represents one supersession transition between exact PracticeSession versions.

Returns:

- previous exact ref;
- newer exact ref;
- fields that changed;
- before/after Practice, focus, duration, and occurrence values.

## Explicit exclusions

Journey v0.1 does not yet claim to include:

- complete lived events;
- reflections or meaning;
- causal explanations;
- all lifecycle transitions;
- external calendar/message/location history;
- a growth score;
- Character/XP;
- an AI-authored narrative;
- every infrastructure change in `module_change_outbox`.

`ModuleChange` remains infrastructure and is not promoted into lived history simply because it has a timestamp.

## Response contract

Simplified:

```text
JourneyRead
├── scope
├── items[]
│   ├── item_key
│   ├── kind
│   ├── layer
│   ├── timeline_at
│   ├── time_basis
│   └── payload + lineage
├── returned_count
├── matching_item_count
├── result_coverage
├── epistemic_coverage
└── does_not_assert[]
```

Scope is half-open `[from,to)` over each item's own `timeline_at`.

## UI v0.1

Route:

```text
/journey
```

The first Journey screen provides:

- 7 / 30 / 90 day scopes;
- grouped calendar-day timeline;
- Reality / Result / Direction / Evidence / Correction visual distinctions;
- explicit `Occurred` vs `Recorded` labels;
- current vs historical exact Evidence lineage;
- correction context;
- result vs lived-reality coverage language;
- navigation back to Helm.

The layer counts at the top are counts of **returned Journey items**, not scores or measurements of the person's life.

## Security

`wf_journey_v0` follows the established Wayfinder public read boundary:

- authenticated only;
- `SECURITY DEFINER` intentionally;
- owner derived from `auth.uid()`;
- fixed `search_path=pg_catalog`;
- private `wf_*` schemas remain inaccessible to browser users;
- no frontend direct canonical-table access.

## Stress evidence

The original rollback stress pass proved:

```text
corrected PracticeSession
→ exactly one lived PRACTICE_SESSION item
→ one PRACTICE_SESSION_CORRECTED item
→ pre-correction EVIDENCE_RECORDED survives
→ Evidence source is_current=false
→ changed_fields identifies the corrected field
```

See `lab/journey-v0-flower-and-stress-test.md`.

## Gate

Backend/projection gate: **PASS for v0.1**.

Frontend build/deploy gate must pass CI/Vercel.

Human browser gate remains:

1. open Journey from Helm;
2. confirm current real records are legible;
3. attach Evidence in Helm and observe it appear in Journey;
4. correct the source PracticeSession and observe both correction + historical lineage;
5. Flower the lived experience before adding narrative intelligence or Character dependence.


## v0.2 Practice Output extension

Journey v0.2 composes the deployed v0.1 Journey substrate with canonical Practice Output creation/correction.

The production-schema rollback proof for v0.2 established:

```text
one logical completed Output
-> one PRACTICE_OUTPUT_RECORDED item

Output correction
-> one PRACTICE_OUTPUT_CORRECTED item
-> no duplicate completed work

source-session same-Practice correction
-> source version becomes historical
-> Output remains usable

source-session Practice reclassification
-> Output becomes PRACTICE_MISMATCH
-> no automatic Skill movement

explicit Output rebase
-> current alignment restored
-> another correction record preserved
```

Output creation and correction are placed by `RECORDED` time because Practice Output v0.1 has no independent exact completion timestamp.

See ADR-049 and `docs/46-practice-output-lifecycle-journey-v0.1.md`.
