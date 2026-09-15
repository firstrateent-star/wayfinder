# Command API Stress Test — v0.1

**Target:** `docs/12-command-api.md` v0.1  
**Result:** architecture holds; four implementation clarifications accepted before SQL

## 1. Unversioned Practice in receipts/outbox

Implementation exposed that Practice is intentionally unversioned while CommandReceipt/ModuleChange had been described as version-ref-only.

**Resolved by ADR-025:** operational affected refs use `RecordRef` as the minimum; versioned records include exact `version`. Evidence/provenance lineage remains version-required.

No new ontology primitive or table is needed.

## 2. Canonical request hash must be server-owned

Letting the client submit its own hash would let serializer differences or a malicious client alter retry semantics.

**Rule:** each typed RPC normalizes its parameters, builds versioned `jsonb` material inside Postgres, and hashes `jsonb::text` with SHA-256 server-side. The contract/version key is part of the material.

A future non-Postgres transport may define another canonical serialization version, but one command endpoint has one deterministic material-hash rule.

## 3. Command claim concurrency

Two transactions call the same Command id simultaneously.

**Rule:** `INSERT ... ON CONFLICT DO NOTHING` on `command_receipts.command_id` is the serialization point. The losing transaction waits for the winner and then reads the terminal receipt. Different material/owner/module/type under the same id is rejected as conflict.

Persistent `PROCESSING` is not expected because claim + terminalization occur in the same transaction; rollback removes the claim.

## 4. Semantic rejection vs structural database error

Expected domain errors such as invalid input, not-found/currentness, or stale version should become terminal `REJECTED` receipts.

Unexpected constraint/trigger failures should abort the whole transaction, including the PROCESSING receipt and any outbox row. They are implementation/invariant failures, not user-semantic rejections.

This preserves atomicity and prevents a receipt from claiming a write outcome the database did not accept.

## 5. Duplicate Direction edge race

Two distinct command ids create the same active structural edge concurrently.

**Change:** add a partial unique active edge index on `(owner, from, to, relation)`. The command should pre-check for friendly `NOOP`/rejection semantics, but the unique index is the final race-safe boundary.

Slice 1A exposes only SUPPORTS.

## 6. Duplicate Evidence mass

Two distinct command ids create the exact same source-version → target-version/aspect/relation link.

**Change:** add a partial unique active Evidence index over the complete semantic identity (including normalized target aspect). This prevents exact duplicates from manufacturing evidence mass.

Different evidence sources remain distinct, and contradictory Evidence remains representable.

## 7. Cross-owner probing

A caller supplies another owner's node/session id.

**Rule:** all lookup validation is `WHERE owner_id = authenticated_owner`. Product errors say `NOT_FOUND`/`INVALID_REF` rather than revealing that another owner's protected record exists.

## 8. Bootstrap race

Two first-login calls race to initialize the same auth user.

**Pass:** unique `auth_user_id` + INSERT ON CONFLICT DO NOTHING + reselect returns one owner. Bootstrap is the accepted pre-Command exception.

## 9. SECURITY DEFINER boundary

Public RPCs need private-schema access while authenticated roles have none.

**Rule:**

- SECURITY DEFINER;
- fixed `search_path = pg_catalog`;
- all non-pg_catalog objects fully qualified;
- `auth.uid()` determines caller identity;
- execute granted only to `authenticated` for user RPCs;
- helper/private functions not granted to client roles.

No RPC trusts a supplied owner id.

## 10. Correction + immediate one-ACTIVE uniqueness

Reconfirmed executable replacement ordering discovered during SQL migration testing. The command pre-generates replacement id, terminalizes v1 with deferred forward FK, then inserts v2 ACTIVE and advances the head.

**Pass.** No weakening of database uniqueness is needed.

## Result

No new table family/module/root primitive required.

Authorized next:

1. add race-safe semantic uniqueness indexes for active Direction edges and exact Evidence links;
2. add private command-runtime helpers;
3. add authenticated owner bootstrap and Slice 1A typed mutation RPCs;
4. add minimal read RPCs;
5. test all through real Postgres with simulated authenticated JWT context before a frontend exists.
