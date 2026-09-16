# Initial Position + Discovery v0.2

**Status:** LIVE / CI PASSED / PLAYER FEEDBACK ITERATED

This slice converts Helm from a passive saved-record display into the first recursive Position + Discovery loop.

## Player feedback that changed the design

The first live version proved domain-safe persistence, but real use exposed a failure:

> multiple Discovery answers were saved correctly, yet Wayfinder mostly repeated them back and counted them.

That is not enough. A personal intelligence system must transform new information into useful structure and then let that changed understanding affect what happens next.

ADR-040 formalizes the new law:

> **Discovery must transform understanding, not merely persist answers.**

## Current loop

```text
canonical Person + Body + Direction + Schedule
                 ↓
          Initial Position v0.2
                 ↓
      deterministic synthesis
                 ↓
 constraints / overlaps / recorded gaps / focus relationships
                 ↓
               Helm
                 ↓
       opt-in Discovery Session
                 ↓
      highest-value Information Need
                 ↓
       authorized domain command
                 ↓
          recompute Position
                 ↺
```

Initial Position is still a projection. It owns no canonical life truth.

## What v0.2 now does with Schedule information

Instead of returning only a count and one next item, Position now returns all recorded planned allocations in the bounded scope and derives:

```text
ordered planned allocations
hard-planned block count
merged hard-planned occupied duration
overlapping hard commitments
largest recorded gap between hard commitments
```

A recorded gap is explicitly **not** called free time. It only means there is no conflicting HARD allocation in the records currently supplied to Position for that interval.

Example:

```text
Chiro 11:45–12:45
Stage Presence 3:00–6:00

↓

recorded between-commitment gap: 2h 15m
```

That derived gap can become useful once another domain supplies meaning, such as an explicit current Direction.

## Direction joins Position

Initial Position now reads the existing Direction domain through:

```text
wf_direction_current
```

It selects the most recent explicit ACTIVE `direction` node as the current focus. It does not infer a permanent Role, identity, personality, or class.

If Schedule contains useful structure and an explicit current Direction exists, Position may derive a cross-domain insight such as:

```text
recorded schedule gap
+ current Direction
 -> candidate planning window for that Direction
```

This remains a deterministic projection, not a canonical fact that the time is actually free.

## Discovery progression

The Question Planner now has two proving Information Needs:

```text
schedule.next_day.coverage
direction.current_focus
```

Current behavior:

```text
0 recorded planned items
 -> Schedule coverage is P1_HIGH_IMPACT
 -> ask for a real fixed constraint first

1 recorded planned item
 -> repeated Schedule coverage falls to P3_CALIBRATION
 -> missing current Direction is P2_HIGH_LEVERAGE
 -> Discovery changes domains

2+ recorded planned items
 -> repeated Schedule coverage falls to P4_OPTIONAL
 -> do not keep asking the same calendar question by default
```

This is not a hard-coded onboarding checklist. It is the first proof that new information changes the next Information Need.

## Canonical ownership remains intact

```text
Schedule answer
 -> wf_schedule_create_allocation
 -> wf_schedule owns planned time

Current Direction answer
 -> wf_direction_capture_node(kind = direction)
 -> wf_direction owns the explicit Direction

Position
 -> composes them
 -> owns no canonical truth
```

There is still no generic profile/facts table.

## Edge Function

Live JWT-protected function:

```text
initial-position
version: 2
status: ACTIVE
verify_jwt: true
```

Authenticated reads:

```text
wf_person_current_v0
wf_body_current_v0
wf_direction_current
wf_schedule_current_v0
```

The Edge Function performs no canonical writes.

## Frontend

Helm now shows:

- preferred/display name;
- Origin foundation state;
- Body baseline state;
- explicit current Direction when known;
- all recorded planned allocations in the next-local-day scope;
- derived hard-planned duration;
- deterministic Position insight when one is supported;
- Navigator language that explains what changed rather than only reporting a count.

Discovery now changes from Schedule to Direction when the information-value model says Direction is the stronger missing piece.

## Validation

Automated test:

```text
lab/initial-position-discovery-v0.1.test.ts
```

Now proves:

- task-driven Helm remains non-interruptive;
- an empty Schedule prioritizes one real temporal constraint;
- after a Schedule answer, Discovery moves to Direction rather than repeating the form;
- two HARD commitments produce deterministic occupied-duration and between-commitment-gap structure;
- Direction + Schedule can produce a cross-domain `FOCUS_WINDOW` insight;
- overlapping commitments are detected;
- recorded gaps never become claims of actual availability.

Intelligence CI passed. Web CI passed. Vercel deployment reports success.

## Still intentionally missing

- no general LLM extraction from free conversation;
- no persistent question queue;
- no calendar/email connector discovery;
- no automatic proposal to reserve a recorded gap yet;
- no Training/Nutrition/Finance/Gear synthesis yet;
- no claim that deterministic schedule structure alone understands the player's whole day;
- no permanent domain-dashboard Home.

The next slices should preserve the same recursion:

```text
new evidence
 -> owning domain
 -> recompute understanding
 -> derive supported relationships
 -> choose the next useful uncertainty or action
```
