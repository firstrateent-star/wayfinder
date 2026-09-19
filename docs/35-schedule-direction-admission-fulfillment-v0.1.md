# Schedule + Direction Admission Fulfillment v0.1

**Status:** IMPLEMENTED ON WORK BRANCH / GATED BEFORE MERGE
**Date:** 2026-09-19

The generalized Navigator write spine now has three owning domains:

```text
STRENGTH_TRAINING   -> Training  -> TRAINING_STRENGTH_SESSION
DIRECTION_INTENT    -> Direction -> DIRECTION_NODE
SCHEDULE_ALLOCATION -> Schedule  -> SCHEDULE_ALLOCATION
```

Direction is reserved for durable player goals/aims/quests. Schedule is reserved for explicit planned temporal allocation.

Schedule planning requires `realityMode=PLANNED`; occurred activity can never become a schedule allocation. Exact intervals default to SOFT unless the player explicitly establishes HARD. Day-only timing clarifies instead of inventing a clock time.

Both domains use the same expiring server-staged confirmation envelope and their existing typed command RPCs/outbox signals.