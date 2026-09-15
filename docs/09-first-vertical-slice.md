# Wayfinder First Executable Vertical Slice

**Version:** 0.1  
**Status:** CANDIDATE

## Purpose

Build the smallest Wayfinder that is genuinely useful while exercising the architecture's hardest boundaries early.

This slice is **not** a mini version of every future feature. It proves one complete loop:

`INTENT → ACTION → LIVED EVENT → EVIDENCE → UNDERSTANDING → NEXT ORIENTATION`

without collapsing intention into reality or derived state into truth.

## User story

A person wants to grow in a practice such as music production.

They can:

1. create a Direction;
2. create an Outcome beneath/related to that Direction;
3. create an Action intended to support the Outcome;
4. log a real PracticeSession, whether planned or spontaneous;
5. optionally link that real session as evidence bearing on the Action's fulfillment;
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
  "Recorded activity supports your current Direction."
```

The Action existing is not evidence that it happened. The PracticeSession existing is not automatically proof that the Outcome is achieved.

## Stateful modules in Slice 1A

### System Kernel / infrastructure

Needed capabilities:

- owner identity/bootstrap
- auth → owner linkage
- source registration for user entry/system derivation
- command identity/receipt storage
- shared transactional outbox
- stable reference/version conventions

### Direction core module

Canonical records:

- DirectionNode
- DirectionEdge

Minimum node kinds exercised:

- `direction`
- `outcome`
- `action`

Other canonical ontology kinds remain supported conceptually but do not require UI/product implementation in Slice 1A.

Minimum Direction relations exercised:

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
- read recent recorded sessions with coverage metadata

### Evidence core module

Canonical records:

- EvidenceLink

Minimum behavior:

- link a PracticeSession version to an Action version with aspect `fulfillment`;
- preserve exact source/target versions;
- exclude links whose source/target is no longer accepted/current from current Bearing unless explicitly re-evaluated;
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

- active EvidenceLinks for source/target
- resolve EvidenceLink record/version

### Composed reads

#### Journey v0

On-demand chronological composition of:

- PracticeSessions
- relevant Direction changes where useful
- Evidence linkage explanation where useful

Journey is a read projection, not a second history table in Slice 1A.

#### Bearing v0

Bearing v0 is deliberately modest.

It answers:

> Is there recent **recorded evidence** that bears positively on currently held Direction?

It does not claim global life alignment.

Possible result semantics:

- `ALIGNED_EVIDENCE_PRESENT`
- `NO_ALIGNED_EVIDENCE_RECORDED`
- `INSUFFICIENT_COVERAGE`

The second state means no qualifying evidence is recorded in the declared scope. It does **not** mean the person did nothing aligned in lived reality.

#### Helm v0

Shows only:

- one/few currently held Direction nodes;
- current intended Action(s);
- recent recorded Practice sessions;
- Bearing v0 explanation;
- pending/partial shared-module state if Evidence work has not completed.

No Character screen is required yet.

## Workflow: planned practice

```text
1. Create Action in Direction
2. Log PracticeSession in Practice
3. Practice transaction commits
4. Orchestrator attempts Evidence command
5. EvidenceLink commits if valid
6. Helm/Journey recompute on demand
```

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
- current Bearing re-evaluates and ignores stale v1 evidence until the link is explicitly/deterministically re-evaluated;
- the UI may offer to re-link/reconfirm if appropriate.

Safety is preferred over silently carrying evidence across a potentially semantic correction.

## Coverage wording law

A complete query of the Wayfinder Practice database proves only the completeness of the declared stored/source scope.

Therefore:

- allowed: **“No practice sessions are logged for this period.”**
- not allowed from database completeness alone: **“You did not practice this week.”**

The product must preserve the difference between complete storage coverage and complete knowledge of lived reality.

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
6. evidence link uses exact source/target versions;
7. corrected source version invalidates current use of old evidence;
8. a missing record cannot become a zero/absence claim outside bounded Coverage;
9. direct canonical table mutation is not an accepted application write path;
10. Evidence module failure does not roll back a committed PracticeSession;
11. AI availability is irrelevant to all 1A acceptance tests;
12. one owner's reads/writes cannot access another owner's canonical records;
13. deleting any cached Journey/Bearing output does not delete canonical Practice/Direction/Evidence history.

## Exit condition

Wayfinder is “alive” when a real person can create Direction, intend an Action, log lived Practice, connect evidence, see a useful present/history view, and safely correct the record—while all architectural invariants still hold.

At that point, the next evidence source is real implementation and use, not more abstract design.