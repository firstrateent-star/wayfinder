# Initial Position + Discovery v0.1

**Status:** LIVE / CI PASSED

This slice converts Helm from a generic development placeholder into the first real player-specific Position surface.

## Flower result

After Character Creation, Wayfinder already knows enough to stop speaking generically, but not enough to pretend it understands the player's life. The correct seam is therefore:

```text
canonical Person + Body + Schedule
            ↓
     Initial Position
            ↓
        quiet Helm
            ↓
 opt-in Discovery Session
            ↓
 structured Information Need
            ↓
 explicit player answer
            ↓
 authorized domain command
            ↓
 refreshed Position
```

Initial Position is a projection. It owns no canonical life truth.

## Laws

1. **Known records are not complete life coverage.**
   - An empty Schedule read does not mean the day is free.
   - One known commitment does not prove no other commitments exist.

2. **Discovery is not onboarding paperwork.**
   - Normal Helm does not proactively ask the P2 discovery question.
   - The player explicitly starts Discovery.
   - v0 asks one question at a time.

3. **Every persisted answer has a legitimate owner.**
   - The first question resolves `schedule.next_day.coverage`.
   - A confirmed fixed commitment writes through `wf_schedule_create_allocation`.
   - There is no generic profile/facts table.

4. **Player refusal/no-add is not false evidence of absence.**
   - “Nothing I need to add” creates no canonical assertion that the day is empty.
   - v0 intentionally does not persist this ephemeral response.

5. **Planned still does not mean happened.**
   - Discovery may create a HARD Schedule allocation.
   - That allocation is planning state only and never occurrence evidence.

6. **Home remains relevance-driven.**
   - Initial Position surfaces only the current character foundation, bounded planned-time knowledge, and one Navigator entry point.
   - It does not render permanent domain widgets.

## Runtime

Shared intelligence:

```text
supabase/functions/_shared/intelligence/initial-position-service.ts
```

The service composes:

```text
Person snapshot
Body baseline presence
bounded Schedule snapshot
Question Planner
```

into:

```text
initial_position_v0.1
├── person display name
├── foundation
│   ├── origin established?
│   ├── birth time known?
│   ├── birthplace known?
│   └── body baseline state
├── schedule
│   ├── bounded scope
│   ├── recorded allocation count
│   ├── next recorded allocation
│   ├── result coverage
│   └── epistemic coverage = UNKNOWN
├── question opportunities
└── explicit non-claims
```

Explicit non-claims include:

```text
unscheduled time is free
planned activity occurred
all commitments are known
missing Body observations are zero/absent in reality
```

## Information Need

First concept:

```text
schedule.next_day.coverage
```

Priority:

```text
no recorded allocations -> P2_HIGH_LEVERAGE
some recorded allocations -> P3_CALIBRATION
```

Canonical destination:

```text
module: schedule
command: CREATE_ALLOCATION
```

The question requires explicit authorization before canonical write.

Normal `TASK_DRIVEN` Position gives the question planner a zero proactive-question budget for this need. `DISCOVERY_SESSION` gives a one-question budget.

## Edge Function

Live JWT-protected function:

```text
initial-position
version: 1
status: ACTIVE
verify_jwt: true
```

It uses authenticated public read boundaries:

```text
wf_person_current_v0
wf_body_current_v0
wf_schedule_current_v0
```

and then passes their bounded outputs into the projection service.

The Edge Function performs no canonical writes.

## Frontend

Helm now:

- greets the player by preferred/display name;
- states that the starting character has been established;
- shows Origin foundation state;
- shows Body baseline state without exposing a tracker dashboard;
- shows the next local day's known planned-time state;
- explicitly says an empty schedule does not mean free time;
- presents Navigator as the path into Discovery.

Discovery v0 flow:

```text
Anything fixed next local day?
  ├── no
  │    -> preserve uncertainty, no write
  └── yes
       -> short label
       -> start/end time
       -> explicit save
       -> HARD Schedule allocation
       -> refresh Initial Position
```

The flow is structured in v0. General natural-language extraction remains a later Discovery capability so provenance and authorization do not get blurred prematurely.

## Validation

Automated test:

```text
lab/initial-position-discovery-v0.1.test.ts
```

Proves:

- task-driven Helm remains non-interruptive;
- Discovery Session surfaces exactly one high-leverage schedule question;
- empty Schedule remains epistemically unknown;
- known planned time does not establish complete coverage;
- writes require explicit authorization.

Intelligence CI passed.

Web CI initially caught unsupported button variants in the frontend; the implementation was corrected to the existing component contract and Web CI then passed.

Vercel deployment for the corrected build reports success.

## What this does not yet do

- no LLM chat/extraction;
- no persistent question queue;
- no durable “player said no other commitments” absence record;
- no calendar connector;
- no automatic discovery from emails/calendar/messages;
- no full Position ranking across Direction/Requirements/Training/Nutrition;
- no permanent Schedule widget on Home.

Those should be earned by later slices rather than guessed into v0.
