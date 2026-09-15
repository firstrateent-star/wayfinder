# ADR-002: Unknown is not zero

**Status:** Accepted  
**Date:** 2026-09-14  
**Supersedes:** none  
**Superseded by:** none

## Context

Personal data is frequently incomplete. Treating missing records as zero, false, or absent would create misleading conclusions and could distort health, nutrition, money, relationship, productivity, and growth projections.

## Decision

Unknown must remain a first-class state across storage, derivation, reasoning, and UI. Missing evidence must not silently become a numeric zero or boolean false.

## Why

Absence of evidence is not evidence of absence. Preserving uncertainty makes Wayfinder more trustworthy and prevents false precision.

## Consequences

- schemas and APIs need explicit null/unknown semantics
- projections must define behavior under incomplete data
- UI may need to distinguish `0`, `none`, `not recorded`, and `unknown`
- AI reasoning must preserve uncertainty instead of filling gaps

## Validation plan

Architectural tests should verify that incomplete inputs remain unknown through representative derivations.

## Revisit triggers

This principle itself should only be reconsidered if a domain has a formally justified closed-world model where missingness truly implies zero/false. Such behavior must be explicit and domain-local.