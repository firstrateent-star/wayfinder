# System Architecture Stress Test — v0.3

**Target:** `docs/02-system-architecture.md` v0.3  
**Result:** one important abstraction mismatch discovered; contracts must reopen once before schema design

## 1. Direction emits a `DomainChange`

Direction is now correctly modeled as a core stateful module rather than a life domain, but the shared change envelope is still named `DomainChange` and Command still routes through `domain`.

**Failure:** infrastructure vocabulary assumes every canonical owner is a life domain.

**Change:** generalize the operational abstraction from **Domain** to **Stateful Module**:

- `Command.domain` → `Command.module`
- `DomainChange` → `ModuleChange`
- `DomainReadResult` → `ModuleReadResult`
- `DomainModule` registration → `StatefulModule`

Life Domain remains an ontological/business boundary and becomes one `StatefulModule.kind = "life"`. Direction/Evidence/Meaning can be `kind = "core"`.

This is a contract refactor, not a new ontology primitive.

## 2. Canonical transaction writes a module table plus command receipt plus outbox

Strictly interpreting “no cross-module writes” could make the owning module unable to write shared command/outbox infrastructure atomically.

**Clarification:** System Kernel infrastructure provides transaction-scoped primitives for command receipt/idempotency and ModuleChange outbox. A module may use those primitives inside its transaction. This is infrastructure participation, not hidden ownership of another life module's facts.

## 3. First owner record needs an ownerRef

The first Wayfinder person/workspace record appears circular because every canonical record has an owner scope.

**Pass:** generate the stable owner/entity id first and allow the root owner entity to self-own. Authentication identity links to that owner entity. No special metaphysical “ownerless” state is needed.

## 4. Core module outage

Evidence is down while Practice is healthy.

**Pass:** core modules follow the same fault-isolation/readiness rules as life modules. Practice truth remains canonical; evidence work can be pending.

## 5. Orchestrator becomes a god object

As more workflows are added, the application layer could accumulate business truth.

**Boundary:** orchestration may coordinate commands and workflow state, but domain/core semantics remain inside owning modules. Durable orchestration state records workflow execution, not a second copy of life truth.

## 6. Direct Supabase RPC

A frontend calls a database RPC that performs command validation/transaction/outbox atomically.

**Pass:** “no direct table mutation” does not require a separate network service. An RPC/server function can be the command boundary if it enforces the same protocol.

## 7. Cheap projection before background infrastructure exists

Recent Practice activity is computed on read from public Practice reads.

**Pass:** background projection workers are not required for the first useful app. On-demand reads preserve early implementation economy.

## 8. AI unavailable for a week

Canonical modules and deterministic projections continue working.

**Pass.** Intelligence remains optional to truth capture.

## Reflection

The architecture is converging, but the operational word `Domain` is now too narrow for the shared module machinery. Fix that vocabulary before freezing database names or TypeScript interfaces.

After the rename/generalization, re-run one convergence pass.