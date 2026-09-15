# ADR-006: AI is non-authoritative over canonical reality

**Status:** Accepted  
**Date:** 2026-09-14  
**Supersedes:** none  
**Superseded by:** none

## Context

Wayfinder will use AI deeply for reasoning, context assembly, interpretation, proposal generation, and conversation. Allowing model output to write canonical facts directly would couple truth to probabilistic generation and make lineage/authority difficult to guarantee.

## Decision

AI may read, interpret, hypothesize, explain, and propose. Canonical state changes must pass through an authorized command path and owning-domain validation.

## Why

Reasoning quality and write authority are different concerns. Separating them lets Wayfinder replace models without changing historical truth or domain rules.

## Consequences

- proposals are structurally distinct from facts and commands
- important writes require user authorization or an explicitly granted automation permission
- even pre-authorized automation uses domain commands
- AI model replacement does not migrate factual state

## Validation plan

Architecture tests must prove that no model-facing path can directly insert or mutate canonical domain records outside authorized command handlers.

## Revisit triggers

Automation permissions may expand, but the command/domain validation boundary should remain.