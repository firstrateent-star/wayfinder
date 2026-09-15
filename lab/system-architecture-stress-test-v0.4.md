# System Architecture Stress Test — v0.4 Convergence Pass

**Target:** `docs/02-system-architecture.md` v0.4  
**Result:** system architecture stability gate passed for first-schema design

## Pressure matrix

### Core module and life-domain module use the same execution machinery

Direction creates a DirectionNode; Practice creates a PracticeSession.

**Pass.** Both use Command → owning Stateful Module → canonical transaction → receipt + outbox ModuleChange, while preserving different business semantics.

### Shared infrastructure participates in a module transaction

Practice writes its own canonical tables while command receipt and outbox are written atomically.

**Pass.** System Kernel infrastructure is explicitly allowed inside the same transaction without granting Practice authority over another module's canonical facts.

### Frontend attempts direct table mutation

**Pass by boundary.** Canonical writes are command-only. Supabase RPC/server function is acceptable if it enforces the protocol; raw direct insert/update is not an application mutation path.

### User expects immediate confirmation after logging Practice

**Pass.** The canonical module write is synchronously confirmable. Cross-module Evidence or cached projections may follow asynchronously and surface pending/freshness state if needed.

### Projection worker is offline

**Pass.** Source truth remains usable; cheap projections may compute on demand.

### AI provider is offline

**Pass.** Canonical modules, Direction, history, deterministic reads, and command execution remain functional.

### Evidence module is offline

**Pass.** Practice truth remains canonical. Evidence linkage is delayed rather than fabricated.

### Future module extraction

Practice later needs to become a separate service.

**Pass at boundary level.** Stable commands, references, reads, ownership, and ModuleChanges already exist. Extraction would change physical transport/transaction implementation, not ontology.

### Root owner bootstrap

**Pass.** Stable id is generated first; root owner entity may self-own and link to auth identity.

### Same database encourages hidden joins

**Pass by rule.** private-table coupling is explicitly prohibited across modules; stable exported reads/views/RPCs are allowed.

### Background infrastructure is overbuilt before use

**Pass.** architecture explicitly prefers on-demand deterministic projections first and adds cached/async machinery only when earned.

### Orchestrator accumulates business truth

**Pass by boundary.** orchestration may track workflow execution but does not duplicate module canonical state.

## Convergence result

- New root ontology primitives required: **0**
- New object-contract family required: **0**
- New stateful-module concept required: **0** after Domain → Stateful Module generalization
- Blocking consistency ambiguity: **0**
- Blocking transaction ambiguity: **0**
- Blocking frontend-authority ambiguity: **0**
- Blocking first-deployment topology ambiguity: **0**

The next recursive target is no longer the abstract architecture. It is the **first executable vertical-slice specification**: the minimum records, commands, reads, and invariants needed to make Wayfinder genuinely usable while exercising the architecture.

**SYSTEM ARCHITECTURE STABILITY GATE: PASSED**