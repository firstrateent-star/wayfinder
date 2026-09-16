# Wayfinder Character Creation → Schedule → Requirements v0.1

**Status:** BUILDING

This slice returns Wayfinder to the player/life side after proving the Knowledge/Question and deterministic natal foundations.

The sequence is deliberate:

```text
Character Creation
  -> establishes the modeled Person + initial Body observations
  -> Schedule
      -> owns planned allocation of time, never occurrence
      -> Requirement contract
          -> evaluates domain-owned recurring standards against bounded time
          -> Navigator later uses both to orient the player
```

## Laws preserved

- Character remains a projection; no canonical Character table.
- Character Creation is one player intent routed atomically to Person + Body.
- Planned time is not lived occurrence.
- Schedule may reference another module's object but does not own that object.
- Requirements are a shared contract, not a universal facts table.
- A domain owns the meaning of its requirement metric.
- Requirement evaluation is coverage-aware; missing observations are never silently treated as zero.
- Home/Helm remains relevance-driven rather than becoming a dashboard.

## v0.1 targets

1. Player-facing Character Creation over the existing `wf_character_initialize_v0` orchestration.
2. `wf_schedule` as a bounded canonical module for planned allocations.
3. A reusable Requirement contract/evaluator in the intelligence runtime, with no `wf_requirements` table.
4. Tests proving temporal semantics and unknown/partial coverage behavior.
