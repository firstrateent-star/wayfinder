# ADR-039 — Initial Position is derived; Discovery writes through owning-domain commands

**Status:** ACCEPTED

## Context

Character Creation now establishes a canonical Person plus optional initial Body observations. Wayfinder also has a canonical Schedule module and an executable Question Planner.

After Character Creation, the old Helm placeholder no longer reflected the system's actual knowledge. However, replacing it with a multi-domain dashboard would violate the player-experience law that Home surfaces only information that matters now.

Wayfinder also needs a way to learn more about the player without turning onboarding into a questionnaire or allowing AI conversation to bypass canonical ownership.

## Decision

### 1. Initial Position is a reconstructable projection

Initial Position composes bounded reads from canonical domains and may use the Question Planner. It is not stored as canonical player truth merely for frontend convenience.

Current v0 inputs are:

- Person;
- Body baseline presence;
- a bounded Schedule read.

Future Position may add Direction, Requirements, Training, Nutrition, Inventory, World and other proven domains without changing this ownership rule.

### 2. Record completeness is not life completeness

An empty Schedule result does not establish free time. A complete database result only means all matching records in the bounded query were returned.

Initial Position therefore preserves Schedule epistemic coverage as unknown unless stronger bounded real-world coverage exists.

### 3. Discovery starts from structured Information Needs

Navigator questions originate from a typed Information Need with:

- purpose;
- consumers;
- priority;
- resolver options;
- answerability/sensitivity;
- a legitimate destination or derived/session use.

The model may later improve natural wording, but it does not invent the semantic reason for asking.

### 4. Discovery is opt-in and budgeted

The first schedule-coverage need is P2 when no planned allocation is known and P3 when some planned time is already known.

Ordinary task-driven Helm does not proactively spend a question on this P2 need. The player starts a Discovery Session, which currently exposes one question at a time.

### 5. Persisted answers use the owning module's command boundary

A player who explicitly supplies a fixed commitment may authorize a `wf_schedule_create_allocation` command.

There is no generic `profile_data`, `discovery_answers`, or universal facts store used as a shortcut.

### 6. Negative conversational response does not automatically establish absence

Choosing “Nothing I need to add” in v0 is not canonical proof that the day contains no other commitments.

The response remains session-local and uncertainty remains preserved until Wayfinder has a properly bounded absence/coverage contract that earns persistence.

### 7. Planned does not become occurred

A fixed commitment captured through Discovery is a HARD Schedule allocation. It never becomes evidence of lived occurrence merely because time passes.

## Consequences

Positive:

- Helm can become personally useful without becoming a dashboard.
- Navigator has a governed path to learn about the player.
- answers retain correct domain ownership;
- uncertainty and incomplete coverage remain explicit;
- later conversational AI can plug into the same semantic contracts.

Costs:

- the first Discovery Session is intentionally narrow and structured;
- declining to add a commitment is not remembered across sessions yet;
- richer Position depends on additional grounded domains and requirements.

## Rejected alternatives

### Persist a generic player profile / discovered-facts document
Rejected because it creates unclear ownership and turns AI extraction into a competing truth store.

### Treat empty Schedule as free time
Rejected because database completeness does not establish lived-reality completeness.

### Ask a large onboarding questionnaire
Rejected because questions should be prioritized by information value and timing, not by blank fields.

### Let Navigator write directly to canonical tables
Rejected because canonical mutations must continue through authorized owning-module commands.

### Persist every “no” answer as absence evidence
Rejected until the system can define the bounded scope and completeness needed for that absence claim.
