# ADR-019 — Canonical Mutation Is Command-Only

**Status:** Accepted

## Context

Direct UI/database writes could bypass authorization, domain/module validation, idempotency, version preconditions, command receipts, correction rules, and transactional change publication.

Wayfinder needs one behavior regardless of whether change is requested by UI, API, automation, import, or future AI proposal.

## Decision

Application-level canonical mutation occurs through an authorized `Command` handled by the owning Stateful Module.

A Supabase/Postgres RPC, server function, or backend endpoint is a valid command boundary if it enforces the full protocol.

Raw direct insert/update/delete of canonical module tables is not an accepted application mutation path.

`Command.id` is the retry/idempotency identity. A true retry reuses the same id; materially different content under the same id is rejected.

## Consequences

Write semantics are centralized and testable.

Frontend convenience does not supersede canonical rules.

Semantic duplicate prevention across different commands remains module-specific.