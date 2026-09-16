# Intelligence Acquisition Framework v0.1 — Smoke Test

**Status:** PASS  
**Validated:** 2026-09-15 local / 2026-09-16 UTC

## Scope

The first executable Knowledge + Inquiry framework was type-checked under strict TypeScript settings and executed as a pure runtime smoke test.

Source under test:

```text
supabase/functions/_shared/intelligence/
├── contracts.ts
├── knowledge-registry.ts
├── knowledge-router.ts
├── acquisition-router.ts
├── question-planner.ts
└── index.ts
```

Executable fixture:

```text
lab/intelligence-acquisition-framework-smoke-v0.1.ts
```

## Test cases

### 1. Provider readiness + fallback

A high-priority `geo.resolve_place` provider reported `UNAVAILABLE`.

Expected:

- the unavailable provider is not called;
- the attempt is retained in routing lineage;
- the lower-priority reference provider may resolve the capability.

Result: PASS.

```text
knowledge_fallback = RESOLVED
attempts = 2
```

### 2. Ambiguity is preserved

A place provider returned two candidates.

Expected:

- `AMBIGUOUS` remains a first-class result;
- candidates are retained;
- the router does not guess one candidate.

Result: PASS.

```text
ambiguity_preserved = AMBIGUOUS
candidate_count = 2
```

### 3. Acquisition resolver order

A canonical resolver knew only that a free-text birthplace label existed and returned `UNKNOWN` for resolved geographic identity.

A reference provider then resolved the place.

Expected path:

```text
CANONICAL
  -> insufficient
REFERENCE_DATA
  -> RESOLVED
```

Result: PASS.

```text
acquisition_stage = REFERENCE_DATA
```

### 4. Player as later resolver

A `training.access` need allowed canonical state and player input, but no canonical resolver could answer it.

Expected:

- no fabricated answer;
- router returns `NEEDS_PLAYER` only after earlier permitted resolution paths fail.

Result: PASS.

```text
player_fallback = NEEDS_PLAYER
```

### 5. Ambient question budget + priority

Two needs competed:

```text
P2 training access
P4 favorite movie
```

Ambient budget was `1`.

Expected:

- only one proactive question opportunity;
- the high-leverage training question wins;
- optional curiosity does not interrupt normal mode.

Result: PASS.

```text
ambient_question = training.access.v1
```

### 6. Opt-in Discovery Session

The same two needs were evaluated in `DISCOVERY_SESSION` with optional questions explicitly allowed and budget `2`.

Expected:

- both may be returned;
- P2 remains ordered ahead of P4.

Result: PASS.

```text
discovery_question_count = 2
```

## Runtime output

```json
{
  "knowledge_fallback": "RESOLVED",
  "ambiguity_preserved": "AMBIGUOUS",
  "acquisition_stage": "REFERENCE_DATA",
  "player_fallback": "NEEDS_PLAYER",
  "ambient_question": "training.access.v1",
  "discovery_question_count": 2
}
```

## What this proves

The framework now has executable seams for:

```text
KnowledgeQuery
KnowledgeResolution
provider registration/readiness/failover
InformationNeed
canonical -> knowledge -> player routing
QuestionSpec
QuestionOpportunity
P0-P4 prioritization
question budgets
cooldowns/dismissal inputs
sensitivity gating
preserved ambiguity
preserved unknown
```

The framework intentionally persists none of these transient runtime objects yet.

## What this does not prove

- a real geographic provider;
- historical timezone resolution;
- natal readiness;
- durable question queue/cooldown persistence;
- LLM question phrasing;
- answer-to-domain mutation flow;
- live external provider authorization/rate limits;
- guidance-knowledge retrieval.

Those remain future vertical-slice work.

## Next pressure test

Build the first real capability family:

```text
geo.resolve_place
geo.resolve_timezone
astro.natal_readiness
```

Use birthplace ambiguity to prove a real Knowledge result can create an Information Need and then a prioritized player Question Opportunity without turning unresolved data into fabricated truth.
