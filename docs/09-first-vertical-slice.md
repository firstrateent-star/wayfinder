# Wayfinder First Executable Vertical Slice

**Version:** 0.2  
**Status:** CANDIDATE-STABLE

## Purpose

Build the smallest Wayfinder that is genuinely useful while exercising the architecture's hardest boundaries early.

This slice is **not** a mini version of every future feature. It proves one complete loop:

`INTENT → ACTION → LIVED EVENT → EVIDENCE → UNDERSTANDING → NEXT ORIENTATION`

without collapsing intention into reality or derived state into truth.

## User story

A person wants to grow in a practice such as music production.

They can:

1. create a Direction;
2. create an Outcome related to that Direction;
3. create an Action intended to support the Outcome;
4. log a real PracticeSession, whether planned or spontaneous;
5. explicitly link that real session as evidence bearing on the Action's fulfillment when desired;
6. see the session in Journey;
7. see a minimal Helm view of current Direction, intended Action, recent recorded Practice, and evidence-backed Bearing;
8. correct a PracticeSession without erasing the old explanation trail.

No AI is required for this slice.

## Example

```text
Direction
  Become a stronger music producer
      ↑ SUPPORTS
Outcome
  Finish one complete track
      ↑ SUPPORTS
Action
  Practice synthesis for 30 minutes

Reality
  PracticeSession: 42 minutes of synthesis

Evidence
  Session v1 SUPPORTS Action v1 / aspect: fulfillment

Derived read
  "Recorded evidence supports fulfillment of this Action."
```

The Action existing is not evidence that it happened. The PracticeSession existing is not automatically proof that the Outcome is achieved.

## Stateful modules in Slice 1A

### System Kernel / infrastructure

Needed capabilities:

- owner identity/bootstrap
- auth → owner linkage
- stable built-in source ids for user-entry/system-derived records
- command identity/receipt storage
- shared transactional outbox
- stable reference/version conventions

A persisted source-registry table is not required yet because Slice 1A has no configurable external sources.

### Direction core module

Canonical records:

- DirectionNode
- DirectionEdge

Minimum node kinds exercised:

- `direction`
- `outcome`
- `action`

Other ontology kinds remain valid but do not require product implementation in Slice 1A.

Minimum Direction relation exercised:

- `SUPPORTS`

### Practice life-domain module

Canonical records:

- Practice entity
- PracticeSession

Minimum behavior:

- create Practice
- log session
- log spontaneous session with no Action
- correct session through versioned supersession
- resolve current and historical versions
- read recent recorded sessions

### Evidence core module

Canonical records:

- EvidenceLink

Minimum behavior:

- explicitly link a PracticeSession version to an Action version with aspect `fulfillment`;
- preserve exact source/target versions;
- retain historical links when source/target is superseded;
- exclude stale links from current fulfillment/Bearing reads unless explicitly re-evaluated;
- preserve old link history for explanation.

## Slice 1B — authored Reflection

After 1A works, add a small Meaning/Reflection core module:

- attach a Reflection to a PracticeSession or Direction record;
- preserve authored-at vs recorded-at;
- show Reflection in Journey;
- never convert Reflection into Observation automatically.

This is intentionally a follow-on mini-slice rather than a blocker for initial functionality.

## Commands required in 1A

### Direction

- `direction.create_node`
- `direction.create_edge`
- `direction.update_node`
- `direction.set_intent_state`

### Practice

- `practice.create`
- `practice.log_session`
- `practice.correct_session`

### Evidence

- `evidence.create_link`
- `evidence.retract_link`

Every command uses:

- stable Command id as retry identity;
- owner scope;
- requester/authorization context;
- version preconditions when updating existing canonical state;
- module validation;
- atomic command receipt + outbox ModuleChange.

## Minimum read surfaces

### Direction reads

- active Direction/Outcome/Action graph for one owner
- resolve Direction record/version

### Practice reads

- recent recorded sessions by Practice/time range
- resolve Practice/Session record/version

### Evidence reads

- active/historical EvidenceLinks for source/target
- resolve EvidenceLink record/version

### Composed reads

#### Journey v0

On-demand chronological composition of user-meaningful canonical records such as:

- PracticeSessions
- authored Direction records/changes where useful
- relevant Evidence linkage explanation where useful

Journey does **not** display raw ModuleChanges, outbox rows, or command receipts. Infrastructure audit data is separate from lived/history experience.

Journey is a read projection, not a second history table in Slice 1A.

#### Action Fulfillment v0

A small read projection evaluates current evidence around an Action without mutating DirectionNode.

Initial states:

- `EVIDENCE_PRESENT`
- `NO_EVIDENCE_RECORDED`
- `STALE_EVIDENCE_ONLY`
- `DISPUTED`

This projection does not claim metaphysical completion. It reports the current evidence state.

#### Bearing v0

Bearing v0 is deliberately modest.

It answers:

> Is there recent **recorded evidence** that bears positively on currently held Direction?

It does not claim global life alignment.

Possible result semantics:

- `ALIGNED_EVIDENCE_PRESENT`
- `NO_ALIGNED_EVIDENCE_RECORDED`
- `INSUFFICIENT_SOURCE_COVERAGE`

The second state means no qualifying evidence is recorded in the declared record scope. It does **not** mean the person did nothing aligned in lived reality.

#### Helm v0

Shows only:

- one/few currently held Direction nodes;
- intended Action(s) and their evidence state;
- recent recorded Practice sessions;
- Bearing v0 explanation;
- pending/partial shared-module state if Evidence work has not completed.

No Character screen is required yet.

## Workflow: planned practice

A combined user gesture may mean “log this session for this Action,” but the orchestration must preserve two explicit command meanings.

```text
1. User explicitly intends PracticeSession + Action link
2. Practice command logs session
3. Practice transaction commits
4. Orchestrator issues Evidence command
5. EvidenceLink commits if valid
6. Helm/Journey recompute on demand
```

UI context alone must not silently manufacture EvidenceLink semantics.

If step 4/5 fails, the PracticeSession remains valid and visible. The UI may show evidence linkage as pending/unlinked rather than pretending the whole workflow failed or succeeded atomically.

## Workflow: spontaneous practice

```text
1. Log PracticeSession with no Direction relationship
2. Session commits
3. Journey shows session
4. Bearing does not count it as aligned evidence unless a later explicit/authorized EvidenceLink is created
```

Spontaneous life remains valid even when it was not planned.

## Correction behavior

When PracticeSession v1 is corrected to v2:

- v1 remains historically version-resolvable or explicitly tombstoned under policy;
- v2 becomes current;
- Practice publishes ModuleChange;
- EvidenceLinks pointing at v1 remain historical but are not silently treated as links to v2;
- Action Fulfillment/Bearing ignores stale v1 linkage as current evidence;
- re-linking v2 is explicit or deterministically re-evaluated under a future transparent rule.

Safety is preferred over silently carrying Evidence across a potentially semantic correction.

The same rule applies when the Evidence target version changes: evidence does not silently migrate across Direction revisions.

## Coverage wording law

Coverage is epistemic/source coverage of the target phenomenon—not merely “the SQL query returned all rows.”

Manual Wayfinder logging usually does **not** establish complete coverage of everything that happened in lived reality.

Therefore:

- allowed: **“No PracticeSessions are logged for this period.”**
- allowed: **“No aligned evidence is recorded in the selected scope.”**
- not allowed from database completeness alone: **“You did not practice this week.”**
- not allowed from missing evidence alone: **“You were not aligned this week.”**

Operational query success belongs to readiness/error handling. Epistemic Coverage answers a different question: how completely do the declared sources cover the phenomenon being inferred?

## Delete/correction law

Ordinary user correction/removal does not hard-delete referenced canonical records silently.

Use supersession/retraction for normal semantic correction. Privacy deletion is a separate policy path that may intentionally resolve historical refs to explicit redaction/deletion tombstones.

## Projection economy

Slice 1A does not create persistent Journey, Bearing, or Action Fulfillment tables.

They are computed on demand from authorized module reads.

Persistent/cached projection infrastructure is added only when measured latency or scale justifies it.

## What Slice 1A deliberately does not build

- Navigator/AI write path
- Character/XP/levels
- astrology/archetypes
- universal Skills
- Calendar/scheduling engine
- notifications
- finance/health/connectors
- complex workflow engine
- persistent projection warehouse
- event-sourced architecture
- microservices
- full multi-user sharing

## Acceptance invariants

Slice 1A is not complete unless tests prove at least:

1. retrying the same log-session Command does not create a duplicate session;
2. conflicting reuse of one Command id is rejected;
3. stale correction precondition is rejected;
4. Action existence does not create occurrence evidence;
5. PracticeSession can exist without Direction;
6. EvidenceLink creation is explicit in command semantics, not inferred solely from UI context;
7. evidence link uses exact source/target versions;
8. corrected/superseded source version invalidates current use of old Evidence;
9. Action Fulfillment is a projection, not a canonical Direction mutation;
10. missing records do not become lived-reality absence claims;
11. a successful database query is not mislabeled as complete lived-reality Coverage;
12. direct canonical table mutation is not an accepted application write path;
13. Evidence module failure does not roll back a committed PracticeSession;
14. AI availability is irrelevant to all 1A acceptance tests;
15. one owner's reads/writes cannot access another owner's canonical records;
16. deleting any Journey/Bearing/Fulfillment read cache does not delete canonical Practice/Direction/Evidence history;
17. Journey does not expose infrastructure audit records as lived history;
18. ordinary correction does not silently hard-delete lineage-bearing records.

## Exit condition

Wayfinder is “alive” when a real person can create Direction, intend an Action, log lived Practice, explicitly connect Evidence, see a useful present/history view, and safely correct the record—while all architectural invariants still hold.

At that point, the next evidence source is real implementation and use, not more abstract design.