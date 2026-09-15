# First Vertical Slice Stress Test — v0.2 Convergence Pass

**Target:** `docs/09-first-vertical-slice.md` v0.2  
**Result:** first-slice stability gate passed for physical schema design

## Pressure matrix

### Action exists; no PracticeSession exists

**Pass.** Direction remains intentional only. Fulfillment read reports no recorded evidence rather than occurrence/completion.

### PracticeSession exists; no Action exists

**Pass.** spontaneous lived activity is canonical and Journey-visible without goal ancestry.

### Session explicitly linked to Action

**Pass.** Practice and Evidence remain separate module writes. Evidence targets exact Action/session versions.

### Combined “log for this Action” gesture

**Pass with economy rule.** Slice 1A does not need a durable workflow engine. The application layer may synchronously issue Practice then Evidence commands and return a structured partial result if the second command fails. On reload, the session is simply visible as unlinked until retried.

### Evidence module down

**Pass.** Practice commit remains successful; no fake rollback or cross-module transaction.

### Session corrected after linkage

**Pass.** historical Evidence remains explainable; current fulfillment/Bearing ignores superseded source version until re-evaluated/relinked.

### Action edited after linkage

**Pass.** evidence remains bound to historical target version and does not silently transfer.

### SQL query returns no sessions

**Pass.** product may say “no sessions logged”; it may not infer “no practice occurred” without source coverage.

### Support and contradiction coexist

**Pass.** Action Fulfillment can report `DISPUTED`; evidence is not forcibly collapsed.

### User wants Action to disappear after evidence appears

**Boundary:** Slice 1A is not a task manager. Fulfillment evidence is a read projection. User may change/withdraw future intent explicitly; the system does not silently mutate DirectionNode because evidence appeared.

### Journey after correction

**Pass.** current user-facing Journey may show current accepted session while an explanation/debug/history view can resolve prior version. Journey need not dump every superseded version by default.

### Hard delete

**Pass.** ordinary semantic removal uses retraction/supersession; privacy deletion is separate.

### Read-model cache deleted

**Pass.** no canonical loss; Slice 1A reads are on-demand anyway.

### AI removed entirely

**Pass.** Slice 1A behavior is unchanged.

### Second user attempts cross-owner reference

**Pass by architecture contract.** resolver/command authorization rejects unauthorized owner scope; later schema must enforce with RLS/backend policy.

## Convergence result

- New ontology primitive required: **0**
- Object-contract structural change required: **0**
- Stateful-module protocol change required: **0**
- Persistent workflow engine required: **0**
- Persistent projection store required: **0**
- AI dependency required: **0**
- Blocking semantic ambiguity for Slice 1A: **0**

One wording clarification is promoted globally: **epistemic Coverage describes source coverage of the phenomenon, not mere database-query completeness.**

The architecture has now earned the right to design the first physical schema. The schema must still be Flowered/stress-tested before it is created in Supabase.

**FIRST VERTICAL SLICE STABILITY GATE: PASSED**