# Wayfinder Domain Protocol

**Version:** 0.1  
**Status:** CANDIDATE

A Wayfinder domain is an independently understandable area of lived reality with its own facts, rules, commands, and reads.

## A domain owns

- its persistence schema
- validation rules
- canonical factual records
- command handlers
- domain events
- domain-specific measurements
- domain-specific derived signals where appropriate
- read models or read adapters

## A domain exposes

At minimum:

1. **identity** — stable domain name and version
2. **commands** — allowed requests for canonical change
3. **validation** — rules that decide whether commands are acceptable
4. **references** — stable EntityRefs for records that other systems may point to
5. **reads** — bounded query surfaces
6. **events** — accepted factual changes worth publishing
7. **health/readiness** — whether required dependencies are available

Optional extensions:

- observations
- metrics
- signals
- evidence suggestions
- progression/growth derivations
- Journey projections
- Today/Helm contributions
- criteria/evaluation contracts

## A domain must not

- write another domain's factual tables
- award global Character state directly
- treat missing data as zero
- convert scheduled intent into completed reality
- let AI bypass command validation
- require unrelated domains to be healthy before its own facts are usable
- manufacture symmetry merely to resemble another domain

## Registration model

The core should discover domains through registration rather than hard-coded branching.

Conceptually:

```ts
interface DomainModule {
  id: string;
  version: string;
  lifecycle: "experimental" | "active" | "disabled";
  commands: unknown[];
  reads: unknown[];
  readiness(): DomainReadiness;
}
```

The concrete contract will expand only after the first vertical slice proves what is truly shared.

## Fault isolation

Failure in one domain must not erase or invalidate truth in another.

If Finance is unavailable, Practice history should still load. If an interpretation service fails, factual domain records remain intact.

## Cross-domain relationships

Cross-domain composition occurs through:

- `EntityRef`
- evidence links
- domain events
- explicit query contracts
- authorized commands

Never through hidden foreign writes.

## Domain admission test

Before creating a new domain, answer:

1. Does this area have distinct factual semantics?
2. Does it require its own validation or persistence rules?
3. Would forcing it into an existing domain weaken truth or clarity?
4. Can it expose a bounded contract to the rest of Wayfinder?

If not, it may be a feature or projection rather than a domain.

## Pilot domain

The first proving domain is **Practice** because it is small enough to implement early but rich enough to test:

- real events
- time
- measurements
- direction links
- evidence
- reflection
- growth
- Journey
- Helm
- Navigator reasoning

Practice is not privileged in the architecture. It is the first stress test of the protocol.