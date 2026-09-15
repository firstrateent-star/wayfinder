# ADR-016 — Stateful Module Is the Operational Boundary

**Status:** Accepted

## Context

Wayfinder originally used `Domain` as both a life-modeling concept and the generic owner of commands, reads, versions, and change notifications. Recursive architecture testing exposed core canonical capabilities such as Direction and Evidence that need the same operational laws but are not life domains.

## Decision

Use **Stateful Module** as the shared operational abstraction.

Initial module kinds:

- `core` — Direction, Evidence, Meaning/Reflection, and similar shared canonical capabilities;
- `life` — Practice, Training, Finance, Relationships, Creative, Home, Inner Life, and other factual life domains.

Life Domain remains a meaningful semantic/architectural category; it is simply not the universal execution type.

## Consequences

Shared operational contracts use `module`, `ModuleChange`, and `StatefulModule` terminology.

All stateful modules follow the same ownership, command, version, provenance, correction, readiness, and change-publication laws while retaining asymmetric business semantics.