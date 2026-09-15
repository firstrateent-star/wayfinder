# ADR-023 — First Physical Schema Is a Four-Module Modular Monolith

**Status:** Accepted  
**Date:** 2026-09-15

## Context

Wayfinder needs to become executable early without flattening all life into universal tables or prematurely splitting into distributed services. The first vertical slice must prove Direction, real Practice, Evidence, command idempotency, correction lineage, and read projections.

## Decision

The first Supabase/Postgres implementation uses one project/database with four private module schemas:

- `wf_system`
- `wf_direction`
- `wf_practice`
- `wf_evidence`

The initial topology is approximately ten tables and intentionally excludes universal facts/entities, projection warehouses, Character/XP, skills, calendar, AI conversation, agent, workflow/saga, and connector infrastructure.

Canonical application mutation occurs only through command/RPC/server boundaries. Direct frontend canonical-table mutation is not an accepted write path.

Version only records whose historical payload materially affects lineage in Slice 1A. DirectionNode and PracticeSession are versioned; DirectionEdge and EvidenceLink have immutable semantic payload plus controlled retraction; Practice is initially an unversioned display entity.

## Consequences

- architecture stays modular while deployment stays operationally simple;
- the first useful product can ship without speculative infrastructure;
- later modules can join through the Stateful Module Protocol;
- real Postgres behavior becomes the next source of architectural evidence;
- migration SQL must still pass a separate recursive review before application.

## Evidence

The topology survived repeated schema passes through `lab/physical-schema-stress-test-v0.5-confirmation.md` without requiring a new table family, module, or ontology primitive.
