# Wayfinder — Project State / Chat Recovery

**Repository:** `firstrateent-star/wayfinder`  
**Supabase project:** `ngakauhlcmvwnmimtsca`  
**Current milestone:** Practice Output Lifecycle + Journey v0.2  
**Current phase:** Practice Outputs are now independently readable, lifecycle-aligned, repairable/rebasable, and visible in Journey v0.2 even when they temporarily stop qualifying for a Skill; the remaining gate is real player validation after Vercel browser promotion  
**Current roadmap:** `docs/06-build-roadmap.md` v1.0  
**Mature architecture:** `docs/18-mature-life-rpg-architecture-v0.2.md`  
**Knowledge/Inquiry spine:** `docs/21-knowledge-inquiry-and-acquisition-spine-v0.1.md`  
**Semantic Admission/Training:** `docs/26-semantic-admission-training-v0.1.md`  
**Semantic Episode:** `docs/30-semantic-episode-graph-v0.1.md`  
**Navigator semantic cutover:** `docs/31-navigator-semantic-cutover-v0.2.md`  
**Navigator canonical context:** `docs/32-navigator-canonical-context-v0.1.md`  
**Admission Planner:** `docs/33-admission-planner-v0.1.md`  
**Training Admission Fulfillment:** `docs/34-admission-fulfillment-training-v0.1.md`  
**Schedule + Direction Fulfillment:** `docs/35-schedule-direction-admission-fulfillment-v0.1.md`  
**Nutrition v0.1:** `docs/36-nutrition-v0.1.md`  
**ModuleChange recomputation loop:** `docs/37-modulechange-recomputation-loop-v0.1.md`  
**Requirements + Character recomputation:** `docs/38-requirements-character-recomputation-v0.1.md`  
**Might growth evidence:** `docs/39-might-growth-evidence-v0.1.md`  
**Voyage Progression:** `docs/40-voyage-progression-v0.1.md`  
**Skill Experience + Sharpness:** `docs/41-skill-experience-sharpness-v0.1.md`  
**Practice Skill Association:** `docs/42-practice-skill-association-v0.1.md`  
**Skill Capability:** `docs/43-skill-capability-v0.1.md`  
**Character Skills Surface:** `docs/44-character-skills-surface-v0.1.md`  
**Practice Output + Creative Capability:** `docs/45-practice-output-creative-capability-v0.1.md`  
**Practice Output Lifecycle + Journey:** `docs/46-practice-output-lifecycle-journey-v0.1.md`  
**Latest ADR:** `decisions/ADR-049-practice-output-visibility-is-independent-of-skill-eligibility.md`

## Non-negotiable direction

Wayfinder is being rebuilt from the ground up using the newer Vlourish / Flower architecture. Old Wayfinder code is research evidence only; do not merge/migrate it into this architecture.

Wayfinder is a personal Life OS expressed as a Life RPG. The RPG is a projection over evidence-backed lived reality; it is not the source of truth.

## Core laws

- reality before interpretation;
- unknown is not zero;
- planned is not happened;
- AI is non-authoritative over canonical reality;
- permanent growth requires evidence;
- derived state is reconstructable;
- important conclusions expose lineage;
- history is preserved while interpretation can evolve;
- occurred, recorded, planned, scheduled, due, and valid time are distinct;
- complex underneath, quiet on the player surface;
- the player should not have to manually model their life;
- RPG mechanics are projections by default;
- Voyage Experience recognizes governed participation; Character growth recognizes demonstrated development;
- one logical governed encounter may award Voyage XP once, independent of internal logging detail;
- Skill Experience accumulates from unique governed encounter + stable Skill identity;
- Skill Experience does not decay; Sharpness may change with time without mutating history;
- Skill Experience and Sharpness do not prove Capability or Mastery;
- Skill Capability is demonstrated ability evidence, not a score; Strength capability preserves exercise-specific load × reps frontiers;
- Practice owns completed creative Outputs; Skills interpret them rather than owning the canonical fact;
- a completed Practice Output may evidence bounded completion Capability but not creative quality, originality, commercial success, Mastery, or Skill Level;
- correcting/reclassifying a source Practice session must never silently move creative Capability between Skills; explicit Output rebase is required;
- canonical Practice Output visibility is independent of current Skill eligibility;
- stale source-version lineage can remain usable when the logical session still belongs to the same Practice; Practice mismatch cannot;
- Journey records Output creation/correction as record-time history and does not invent an exact output completion instant;
- Sharpness may decay while demonstrated Capability remains evidenced;
- Character is composed, not a canonical aggregate;
- equipment modifies effective state, not permanent base mastery;
- Navigator asks questions only when missing information materially matters;
- astrology/tarot are symbolic guidance/reflection, not canonical empirical truth;
- Schedule owns planned temporal allocation, not occurrence;
- Requirement/Standard is distinct from Direction/Goal and Schedule;
- Requirement evaluation is coverage-aware;
- Requirement metrics remain owned by the domain that understands them;
- Owner/auth identity, Person identity, Body observations, and Character projection are distinct;
- Reference Knowledge is separate from Player Reality;
- the language model is a reasoner/interface, not the authoritative encyclopedia;
- available information does not automatically deserve Home visibility;
- information gaps resolve through typed resolvers before asking the player;
- Initial Position is derived rather than a canonical aggregate;
- Discovery questions originate from typed Information Needs;
- Discovery writes only through explicit owning-domain commands;
- a player declining to add information does not establish canonical absence;
- no model-improvised fallback when a resolver cannot establish an answer;
- **input is not player state;**
- **understanding precedes persistence;**
- **no owner, no persistence;**
- **one canonical owner per semantic claim;**
- confidence alone never authorizes persistence;
- conversational disclosure is not automatically canonical write authorization;
- candidates are transient/runtime artifacts by default;
- valid partial reality may be stored only when missing detail remains explicitly unknown;
- persistence without downstream recomputation is incomplete ingestion;
- model meaning, canonical claim type, domain acceptance, write authorization, and command execution are separate decisions;
- explicit source-grounded relations survive unresolved referents without forcing referent resolution;
- an explicit number never earns an unstated unit or measurement type.

## Mature architecture

```text
TIME
 |
 +--> CANONICAL PLAYER PLANE
 |      System / Person / Body / Direction / Practice / Schedule / Training / ...
 |
 +--> KNOWLEDGE PLANE
 |      deterministic / reference / guidance / live external
 |
 +--> ACQUISITION + INQUIRY
 |      SourceEnvelope / semantic candidates / InformationNeed / QuestionPlanner
 |
 +--> INTELLIGENCE + GUIDANCE
 |      Discovery / Position / Requirements / Growth / Planning
 |
 +--> GAME / PROJECTION
 |      Character / Skills / Role / XP / Stats / Stamina / ...
 |
 +--> EXPERIENCE
        Helm / Navigator / Character / Quests / Calendar / Atlas
```

Cross-cutting:

```text
Time
Provenance
Authority
Coverage
Uncertainty
Freshness
Permissions
Lineage
```

Epistemic layers:

```text
1. RECORDED REALITY
2. DETERMINISTIC DERIVATION
3. INTELLIGENT INFERENCE
4. SYMBOLIC INTERPRETATION
```

A lower-authority layer must never masquerade as a higher-authority layer.

## Current private Wayfinder schemas

```text
wf_system
wf_person
wf_direction
wf_practice
wf_evidence
wf_body
wf_schedule
wf_training
wf_nutrition
```

Authenticated clients and Edge Functions use narrow public typed RPCs. Private canonical schemas are not directly exposed to `anon` / `authenticated`.

## Proven foundational substrate

Still valid:

- owner bootstrap and auth scope;
- idempotent command runtime;
- private module boundaries;
- exact-version lineage;
- correction/supersession with stale-write rejection where implemented;
- transactional ModuleChange outbox;
- result coverage vs epistemic coverage;
- occurred vs recorded vs planned time separation;
- public read/projection seam;
- frontend private-table guard;
- deferred version-head integrity;
- modular-monolith physical architecture in one Supabase/Postgres project.

## Person + Temporal Kernel — ✅ LIVE

Person owns only modeled identity and stable/correctable origin facts:

```text
display/preferred name
birth date?
birth local time?
birth-time accuracy? EXACT | APPROXIMATE
birth-place label?
```

Body, Role, Skill, XP, finances, current location and astrology interpretation do not belong in Person.

Temporal helper:

```text
wf_system.local_day_bounds(local_date, zone_id)
```

resolves a local day into the true half-open UTC interval and preserves DST.

## Body v0.1 — ✅ LIVE

Canonical metrics currently:

```text
height
weight
```

They are temporal observations rather than Person profile fields.

## Character Creation — ✅ LIVE

Backend:

```text
wf_character_initialize_v0
```

routes one indivisible user intent across Person + optional Body observations atomically.

Player flow gates authenticated users:

```text
Person missing -> Character Creation
Person exists  -> Helm
```

No Role, Skill, XP, Level, Path or self-rated stats are collected.

## Knowledge + Inquiry Acquisition Spine — ✅ EXECUTABLE

Shared runtime in:

```text
supabase/functions/_shared/intelligence/
```

Resolution order:

```text
canonical state
 -> deterministic derivation
 -> trusted reference knowledge
 -> live external context when materially needed
 -> player question when appropriate
 -> preserve unknown
```

Question priority classes:

```text
P0_BLOCKING
P1_HIGH_IMPACT
P2_HIGH_LEVERAGE
P3_CALIBRATION
P4_OPTIONAL
```

There is no LLM-guess fallback.

## Birth Context — ✅ LIVE

JWT Edge Function:

```text
birth-context
```

```text
Person birth facts
 -> place resolution
 -> ambiguity/question when needed
 -> timezone resolution
 -> historical local instant resolution
 -> natal readiness
```

## Deterministic Natal Geometry — ✅ LIVE

JWT Edge Function:

```text
natal-geometry
```

Pinned calculator:

```text
Astronomy Engine 2.1.19
```

Outputs Sun through Pluto geometry, Ascendant/MC/Descendant/IC, Equal + Whole Sign houses, and pairwise aspect geometry. Symbolic meaning remains separate.

## Schedule v0.1 — ✅ LIVE

Private module:

```text
wf_schedule
├── allocations
└── allocation_versions
```

Kinds:

```text
HARD
SOFT
WINDOWED
FLOATING
```

Schedule owns planned temporal allocation only. A passed interval never proves activity occurred.

## Requirement contract v0.1 — ✅ EXECUTABLE

There is intentionally no universal `wf_requirements` canonical table.

Shared evaluator supports:

```text
AT_LEAST
AT_MOST
BETWEEN
EXACT
```

Coverage:

```text
COMPLETE
PARTIAL
UNKNOWN
```

Evaluation:

```text
SATISFIED
IN_PROGRESS
CLOSED_BELOW_TARGET
BREACHED
UNKNOWN
```

Domain owners supply the metric observations and coverage semantics.

## Initial Position / Helm — ✅ LIVE SEED

Helm remains a relevance projection, not a dashboard.

Initial Position composes grounded Person/Body/Schedule context and Question Planner. Real use showed that merely saving answers was insufficient; this directly led to Semantic Admission.

Home law:

```text
AVAILABLE INFORMATION != INFORMATION THAT DESERVES ATTENTION
```

## Semantic Admission v0.1 — ✅ LIVE / CI PASSED

Reference: `docs/26-semantic-admission-training-v0.1.md`, ADR-040.

Runtime:

```text
supabase/functions/_shared/intelligence/semantic-admission.ts
```

Core types:

```text
SourceEnvelope
SemanticCandidate
CandidateGraph
AdmissionContract
AdmissionDecision
AdmissionRegistry
```

Admission outcomes:

```text
ACCEPT
ACCEPT_PARTIAL
NEEDS_CLARIFICATION
NEEDS_AUTHORIZATION
SESSION_ONLY
REFLECTION
REJECT
```

Routing law:

```text
raw input
 -> recognition
 -> transient candidate graph
 -> knowledge/context resolution
 -> exactly one owning AdmissionContract
 -> admission decision
 -> explicit authorization where required
 -> typed owning-domain command
 -> canonical state
 -> recomputation
```

No generic facts/memory/notes table exists for unclaimed information.

Live JWT Edge Function:

```text
semantic-admission
version 1
status ACTIVE
verify_jwt true
```

The Edge Function currently registers only the Training semantic contract. It explicitly reports that raw input is not persisted by the Semantic Admission layer.

## Training v0.1 — ✅ LIVE / DATABASE GATE PASSED

Private module:

```text
wf_training
├── sessions
├── session_versions
└── exercise_sets
```

Public typed RPCs:

```text
wf_training_capture_strength_session
wf_training_recent_v0
```

Current minimal factual semantics:

```text
STRENGTH session
INSTANT | DAY | APPROXIMATE occurrence
exercise reference key + label
reps optional
load optional LB/KG
RPE optional
```

`wf_training_recent_v0` returns stored-record query coverage separately from lived-reality epistemic coverage, which remains UNKNOWN by default.

Direct authenticated table access to `wf_training` has been live-tested denied.

### Semantic proving recognizer

Runtime:

```text
supabase/functions/_shared/intelligence/training-semantic.ts
```

This is deliberately a narrow deterministic recognizer, not the final general NLP system.

Current reference concept:

```text
barbell_bench_press
aliases: bench / bench press / barbell bench press / benched
```

Proven behavior:

```text
"I benched 185 lbs for 8 reps for 3 sets today"
 -> ACCEPT when RECORD + explicit authorization
 -> 3 canonical Barbell Bench Press sets

"I benched 185 for 8 three times today"
 -> NEEDS_CLARIFICATION
 -> training.exercise_set.structure
 -> no write

"I crushed legs today"
 -> ACCEPT_PARTIAL
 -> generic lower-body strength session
 -> no invented exercises/reps/load

clear training disclosure in ordinary conversation
 -> NEEDS_AUTHORIZATION
 -> no write

irrelevant/unowned input
 -> no claim
 -> no persistence
```

### Live database proof

A production transaction captured a synthetic 3-set 185 LB × 8 bench session via the authenticated public RPC and read the structured session back through `wf_training_recent_v0`.

The transaction was rolled back. A follow-up query confirmed zero synthetic rows remained.

### CI

```text
lab/semantic-admission-training-v0.1.test.ts
```

Wayfinder Intelligence CI passed with Semantic Admission Edge type-check and all Training semantic tests.

### Performance hardening

The first advisor pass found four unindexed composite Training foreign keys. They were covered by:

```text
20260916043500_index_wayfinder_training_foreign_keys.sql
```

A second advisor pass no longer reports Training `unindexed_foreign_keys`.

## Current Security Advisor context

Authenticated execution warnings for Wayfinder public `SECURITY DEFINER` RPCs, including the new Training RPCs, are intentional because these functions are the owner-scoped API boundary:

```text
authenticated client / Edge Function
 -> public typed SECURITY DEFINER RPC
 -> private canonical schema
```

Direct private-schema access is denied.

Existing `vl_*` RLS-without-policy findings are separate from Wayfinder.

`Leaked Password Protection Disabled` remains a production-hardening item.

## Current production frontier — Four-domain Navigator → downstream recomputation

The generalized Navigator nervous system is now live in production:

```text
natural language
 -> Live Semantic Reasoner
 -> bounded Semantic Episode
 -> canonical context
 -> Candidate Life Graph
 -> Wayfinder Capacity
 -> Admission Planner
 -> owning-domain Fulfillment adapter
 -> owning AdmissionContract
 -> short-lived server-staged proposal
 -> explicit player confirmation
 -> AdmissionContract rerun with authorization
 -> typed owning-domain command
 -> canonical reality
 -> ModuleChange outbox
```

Production `navigator-chat` is **v24 ACTIVE** with `verify_jwt=true`.

Canonical write-capable Navigator owners:

```text
STRENGTH_TRAINING   -> Training  -> TRAINING_STRENGTH_SESSION
DIRECTION_INTENT    -> Direction -> DIRECTION_NODE
SCHEDULE_ALLOCATION -> Schedule  -> SCHEDULE_ALLOCATION
MEAL / FOOD_INTAKE  -> Nutrition -> NUTRITION_INTAKE
MUSIC_PRODUCTION /
DRAWING              -> Practice  -> PRACTICE_SESSION
```

Important negative boundaries remain explicit:

```text
FOOD_ACQUISITION != FOOD_INTAKE
planned != occurred
understood != admitted
admitted != authorized
unknown nutrition != zero
unknown nutrition != model-estimated nutrition
```

The four-domain stack has passed exact-main Intelligence CI and the complete real-model semantic gate, including adversarial and multi-turn Episode suites. Direction, Schedule, and Nutrition command retry/idempotency have also been live-proven through rollback transactions.

### Current downstream loop

The first recomputation slice is now implemented:

```text
canonical command
 -> ModuleChange outbox
 -> owner-scoped change cursor
 -> recomputation impact planner
 -> canonical reads
 -> Position + Bearing
 -> Helm State
 -> frontend refresh
```

`wayfinder-state` is a reconstructable projection read. ModuleChange is invalidation only and never becomes canonical life truth.

The current explicit Direction branch proving the loop is:

```text
Build ModuleChange-driven recomputation
 -> SUPPORTS
Close the living reality to guidance loop
 -> SUPPORTS
Make Wayfinder work as my daily Life OS
```

Helm walks those canonical SUPPORTS edges backward from the current Direction, so unrelated active Actions do not become inferred priorities.

### Current Requirements + Character layer

Requirements and Character now close through the first governed longitudinal growth proof:

```text
player-authored domain Standard
 + domain-owned canonical observations
 -> shared coverage-aware Requirement evaluator
 -> Requirement projection / quiet guidance candidate

Training canonical evidence
 -> Might EXPOSURE
 -> loaded-repetition CAPABILITY
 -> same-exercise longitudinal frontier comparison
 -> repeatable governed GROWTH evidence
```

Character is now `character_v0.2`. Might GROWTH can become `EVIDENCED` only under `might_growth_v0.1`: the bounded Training read must be COMPLETE, the canonical exercise must match, at least two strictly-earlier baseline sessions must exist, a later load/repetition Pareto-frontier expansion must occur, and a second strictly-later session must independently expand the same frozen historical frontier. A single PR, cross-exercise evidence, load/repetition tradeoffs, partial query coverage, Requirement satisfaction, or activity count cannot establish growth.

No Standard means no Requirement. Missing evidence stays unknown rather than zero. Requirement satisfaction does not mutate Character.

Projection invalidation remains registered by actual providers:

```text
Training  -> Requirements + Character + Progression + Skills
Nutrition -> Requirements
```

### Current Voyage Progression layer

The first governed game-progression slice is live:

```text
current canonical Training STRENGTH session
 -> stable logical encounter identity
 -> Voyage encounter
 -> 1 Voyage XP
```

Voyage Progression is reconstructable under `voyage_progression_v0.1`. One logical session counts once regardless of set count, command retry, or current session-version correction. Stored-record count coverage is explicit and lived-reality coverage remains UNKNOWN.

Voyage XP does not mutate Might or any other Character facet. Requirement satisfaction does not earn XP. No permanent XP award ledger, Level, Rank, Pillar XP, or Attribute XP exists yet.

### Current Skill Experience + Sharpness layer

The first governed Skill projection is now live:

```text
current canonical Training STRENGTH session
 -> physical.strength_training
 -> one Skill Experience encounter
 -> personal cadence
 -> reconstructable Sharpness
```

`skills_v0.1` keeps four axes separate:

```text
Experience  = governed practice history
Sharpness   = current recency relative to personal cadence
Capability  = UNKNOWN in v0.1
Mastery     = NOT_EVALUATED in v0.1
```

Cadence-aware Sharpness requires at least four qualifying encounters and at least three positive inter-session intervals. The median positive interval becomes the personal cadence baseline. Current gap / typical interval maps deterministically to `SHARP`, `WARM`, `COOL`, or `DORMANT`. With insufficient history, Wayfinder exposes recency but leaves cadence-aware Sharpness `UNESTABLISHED`.

No decay job writes anything. Time passing can change Sharpness while Experience remains unchanged.

### Current Skill Capability layer

Wayfinder now has two governed Capability evidence models:

```text
Strength Training
  current canonical loaded-repetition history
   -> exercise-specific load × reps Pareto frontier
   -> bounded Strength Capability

Music Production / Drawing
  player-confirmed canonical Practice Output
   -> COMPLETED_PRACTICE_OUTPUT
   -> bounded creative completion Capability
```

`skills_v0.4` keeps:

```text
Experience   governed practice history
Sharpness    recency relative to personal cadence
Capability   domain-specific demonstrated ability evidence
Mastery      NOT_EVALUATED
```

Current production has no qualifying loaded-repetition demonstrations and no confirmed creative Outputs. Therefore Strength Training, Music Production, and Drawing each honestly resolve to Capability `INSUFFICIENT_EVIDENCE` under their respective complete modeled reads. None of those states means zero human ability.

Practice Output is canonical and versioned. Skill Capability remains reconstructable. A source-session Practice reclassification invalidates the Output's Skill contribution until the player explicitly rebases/corrects the Output, preventing silent movement between creative Skill identities.

### Current Practice Output lifecycle + Journey layer

The canonical creative-result loop is now closed through visibility and history:

```text
PracticeSession
 -> explicit completed Practice Output
 -> Skill Capability eligibility
 -> canonical Output catalog
 -> correction/rebase when lineage changes
 -> Journey record + correction history
```

Authenticated production reads:

```text
wf_practice_outputs_v0
wf_journey_v1   -> journey_v0.2
```

Output alignment is explicit:

```text
CURRENT
SOURCE_VERSION_ADVANCED
PRACTICE_MISMATCH
SOURCE_SESSION_UNRESOLVED
SOURCE_SESSION_NOT_ACTIVE
SOURCE_PRACTICE_NOT_ACTIVE
RECORDED_PRACTICE_NOT_ACTIVE
SOURCE_OCCURRENCE_AFTER_AS_OF
OUTPUT_RETRACTED
```

A same-Practice source-session correction may advance exact lineage without destroying Capability eligibility. A Practice mismatch remains canonical and visible but is excluded from Skill Capability until an explicit Output correction/rebase.

Journey v0.2 adds:

```text
PRACTICE_OUTPUT_RECORDED   -> RESULT / RECORDED
PRACTICE_OUTPUT_CORRECTED  -> CORRECTION / RECORDED
```

Wayfinder does not fabricate a separate output completion timestamp.

Current live account state:

```text
canonical Practice Outputs  0
Output result coverage       COMPLETE
lived-output coverage        UNKNOWN
Journey matching items       10
Journey result coverage      COMPLETE
```

### Strongest next build

The next earned frontier is **real-player validation of the creative evidence loop**, not another abstract progression layer:

1. promote the merged Character + Journey frontend when Vercel's daily quota resets;
2. record one real Music Production or Drawing Output through the player-facing command;
3. verify the loop end-to-end:
   ```text
   Practice -> Output -> Capability -> Output catalog -> Journey
   ```
4. exercise one real correction/rebase and confirm history stays legible;
5. use observed friction to refine copy/interaction before adding stronger creative evidence classes;
6. only after real evidence warrants it, Flower whether reviewed deliverables, client acceptance, publication, or repeatable objective constraints deserve separate Capability evidence classes;
7. keep Mastery, Skill Level, Role/Class, rankings, challenge multipliers, and model-dependent semantic Output capture deferred.

**Law:** logging earns nothing; governed participation earns Experience; Sharpness describes recency, not ability; evidence reveals Capability; canonical evidence remains visible even when projection eligibility changes; longitudinal evidence establishes Growth; game progression never impersonates canonical life truth.

## Deferred until earned

Do not prematurely build:

- generic `misc_facts`, notes, memory or other junk-drawer canonical tables;
- universal persistent candidate backlog;
- raw chat/voice transcript as the life model;
- persistence based only on model confidence;
- autonomous AI canonical writes;
- permanent XP ledger;
- giant stat table;
- persisted Role/Class;
- universal skill taxonomy;
- universal life-event/facts table;
- universal Knowledge database;
- vector database merely because Knowledge exists;
- astrology/tarot interpretations as empirical facts;
- calendar entries as occurrence evidence;
- incomplete nutrition logs as zero intake;
- broad input-heavy player dashboards;
- domain widgets on Home merely because a domain exists;
- speculative empty schemas.

## Recovery instruction

Before editing, fetch latest `main` and current target files. Do not rely on this file's commit SHA as if no later commit can exist.

### Production closure — 2026-09-19

PR #13 merged to `main` at code checkpoint `9b253851`.

Merged-main gates are green:

```text
Wayfinder Intelligence CI      PASS
Wayfinder Web CI               PASS
live semantic primary          PASS
live semantic adversarial      PASS
live Semantic Episode          PASS
```

Production Supabase is aligned to that merged runtime:

```text
navigator-chat     ACTIVE v23
wayfinder-state    ACTIVE v3
Training Standards            0
Nutrition Standards           0
```

The governed Training/Nutrition Standard commands and Requirement-input reads are present in production. No default Standard was installed for the player.

The Vercel web source is merged and Web CI is green, but the production web deployment is externally blocked by the Vercel free-tier daily deployment quota (`api-deployments-free-per-day`). That quota condition is not treated as a Wayfinder architecture or test failure.

The four-domain governed Navigator remains the canonical write spine. `wayfinder-state.v0.2` reconstructs Position + Requirements + qualitative Character + Bearing + Helm.

### Might growth production closure — 2026-09-19

PR #14 merged to `main` at code checkpoint `591c1bff`.

Merged-main gates are green:

```text
Wayfinder Intelligence CI      PASS
Might growth pressure suite    PASS
Wayfinder Web CI               PASS
```

Production Supabase now runs:

```text
navigator-chat     ACTIVE v23   (unchanged by this slice)
wayfinder-state    ACTIVE v4
Character          character_v0.2
Growth rule        might_growth_v0.1
```

The changed production `wayfinder-state` runtime files were verified byte-for-byte against merge `591c1bff`. No database migration, XP ledger, numeric Character stat, or new canonical write path was added.

The Vercel frontend source is merged and Web CI is green, but production frontend deployment remains blocked by the Vercel free-tier daily deployment quota. The backend response remains structurally compatible; the source contract now recognizes `character_v0.2`.

The immediate architectural target is now **governed RPG progression semantics after verified growth**. Growth is evidence; it does not automatically become XP.


### Voyage progression production closure — 2026-09-19

PR #15 merged to `main` at code checkpoint `e65eca9e22e3829033489c721b01ed9a8c22a0a4`.

Exact-head and merged-main gates are green:

```text
Wayfinder Intelligence CI      PASS
Voyage progression suite       PASS
Requirements + Character       PASS
Might growth pressure suite    PASS
Wayfinder Web CI               PASS
```

Production Supabase now runs:

```text
navigator-chat     ACTIVE v23   (unchanged by this slice)
wayfinder-state    ACTIVE v5
State contract     wayfinder-state.v0.3
Progression rule   voyage_progression_v0.1
First provider     training.strength-session-encounter.v0.1
```

Production migration `add_wayfinder_voyage_progression_input_v0` is applied. The authenticated read boundary exists, authenticated may execute it, and anon/public may not. The four changed `wayfinder-state` runtime files were verified byte-for-byte against merge `e65eca9`.

No permanent XP ledger, Level/Rank, Attribute XP, or new canonical life-truth store was added. Voyage XP is a reconstructable game projection over current governed canonical encounters. Character remains independently evidence-governed.

The Vercel source contract is merged and Web CI is green. Production frontend promotion remains externally blocked by the free-tier daily deployment quota; this does not block the production Supabase progression backend.


### Skill Experience + Sharpness production closure — 2026-09-19

PR #16 merged to `main` at code checkpoint `5428b7ec0f2feb8a8303b398843d535b5744fc36`.

Exact-head and merged-main gates are green:

```text
Wayfinder Intelligence CI            PASS
Skill Experience + Sharpness suite   PASS
Recomputation suite                  PASS
Requirements + Character             PASS
Might growth suite                   PASS
Voyage progression suite             PASS
Wayfinder Web CI                     PASS
```

Production Supabase now runs:

```text
navigator-chat     ACTIVE v23   (unchanged by this slice)
wayfinder-state    ACTIVE v6
State contract     wayfinder-state.v0.4
Skills projection  skills_v0.1
First Skill        physical.strength_training
Skill provider     training.strength-skill-provider.v0.1
```

Production migration `add_strength_skill_experience_input_v0` is applied. The authenticated Skill-input RPC exists; authenticated may execute it, while anon/public may not. The deployed state composer, recomputation planner, provider registry, and Skill projection were verified byte-for-byte against merge `5428b7ec`.

No Skill table, Skill Level, Skill XP point ledger, persisted Sharpness, decay job, Capability score, Mastery score, Role/Class, or AI-controlled progression was added. Sharpness is reconstructed from current time plus the median positive interval of current canonical Strength Training encounters.

The backend state now exposes Skills. The player UI source contract accepts `wayfinder-state.v0.4`, but this slice does not yet add a dedicated visible Skill screen/card.


### Governed Practice Skill Association production closure — 2026-09-19

PR #17 merged at `e0865409`; migration syntax fix PR #18 merged at corrected main `c61f081c`.

Production now runs:

```text
navigator-chat       ACTIVE v24
wayfinder-state      ACTIVE v7
state contract       wayfinder-state.v0.5
skills projection    skills_v0.2
Practice association practice.name-skill-provider.v0.1
```

Live governed Skills now include:

```text
physical.strength_training
creative.music_production
creative.drawing
```

Canonical Practice identities remain untouched. Exact normalized aliases only affect the reconstructable Skill projection. Existing production history currently supplies one Music Production encounter and one Drawing encounter, both below the cadence-establishment threshold.

Navigator can recognize governed Music Production / Drawing occurrences, stage a Practice proposal, require explicit confirmation, and execute the existing `wf_practice_capture_session` command. Planned activity, other-person activity, vague timing, unregistered Practice names, and semantic Skill proposals cannot directly mint Skill Experience.

Merged-main Intelligence and Web CI are green. The real-model Semantic Live Eval could not execute because the configured OpenAI API account returned HTTP 429 no-credits errors for all scenarios; do not treat that workflow as a model-quality pass.

**Next earned frontier:** first governed Skill Capability projection, beginning with Strength Training because loaded-repetition capability evidence already exists.


### Skill Capability production closure — 2026-09-19

PR #19 merged at `5afdb0539d0067c6a35ab35787dbc37b5014515f`.

```text
Wayfinder Intelligence CI    PASS
Skill Capability suite       PASS
Wayfinder Web CI             PASS
wayfinder-state              ACTIVE v8
state contract               wayfinder-state.v0.6
skills projection            skills_v0.3
```

Production migration `add_strength_skill_capability_input_v0` is live and owner-scoped. Authenticated execute is allowed; anon/public execute is denied.

Before merge, a rollback-backed production-schema proof inserted synthetic Bench 185×8, Bench 205×5, Bench 185×5, and Squat 225×5 evidence. The capability RPC preserved 185×8 and 205×5 as nondominated bench frontier points, removed 185×5, kept squat independent, and then rolled back the function and all synthetic rows.

The actual production read currently contains zero qualifying loaded-repetition demonstrations with COMPLETE modeled-result coverage and UNKNOWN total-human-capability coverage. No zero-ability claim is made.

The deployed `wayfinder-state` entrypoint, Skill projection, and projection-provider registry match merge `5afdb053` byte-for-byte.

No Skill Level, e1RM, overall-strength score, Mastery score, Role/Class, creative-skill capability inference, or permanent capability ledger was added.


### Character Skills Surface merge closure — 2026-09-19

PR #20 merged at `c0cb63bfcc8e3d0dc13b92adbf9beea869d1f129`.

```text
Wayfinder Web CI      PASS
Character route       /character
backend contract      wayfinder-state.v0.6
backend production    wayfinder-state ACTIVE v8
```

The surface reads the existing evidence-backed Skill projection and keeps Experience, Sharpness, and Capability visually distinct. It does not introduce Skill Level, Mastery, ratings, or synthetic progress bars. Strength exercise frontiers are only shown when evidence exists; unknown and insufficient-evidence states remain explicit.

The Vercel deployment is externally blocked by the free-tier daily deployment quota (`api-deployments-free-per-day`). Source/build is green; production browser promotion is pending quota availability.


### Practice Output + Creative Capability production closure — 2026-09-19

PR #21 merged at `5076ca9f19b2e9c3b888d4714695a82d17e4a25b`.

```text
Wayfinder Intelligence CI                  PASS
Practice Output creative Capability suite  PASS
Wayfinder Web CI                           PASS
navigator-chat                             ACTIVE v24
wayfinder-state                            ACTIVE v9
state contract                             wayfinder-state.v0.7
skills projection                          skills_v0.4
```

Production migration `add_practice_output_capability_v0` is applied as version `20260920011830`.

New canonical Practice substrate:

```text
wf_practice.outputs
wf_practice.output_versions
wf_practice_capture_output
wf_practice_correct_output
wf_practice_output_skill_capability_input_v0
```

The live current-account creative reads are COMPLETE over stored qualifying Outputs and currently report zero Music Production and zero Drawing completed Outputs, with total human-capability coverage UNKNOWN. Accordingly both creative Skills now have a governed provider but begin at `INSUFFICIENT_EVIDENCE`, never zero ability.

A rollback-backed production-schema proof verified command retry/idempotency, correction, stale-write rejection, source-session reclassification invalidation, explicit Output rebase, Skill movement only after explicit rebase, and full rollback cleanup.

Production execute permissions are authenticated-only; anon/public are denied. The three changed `wayfinder-state` runtime files match merge `5076ca9f` byte-for-byte.

The Character source contains explicit completed-Output capture and completed-output evidence rendering. Web CI is green, but Vercel browser production promotion remains externally blocked by the daily free-tier deployment quota.


### Practice Output lifecycle + Journey production closure — 2026-09-19

PR #22 merged at `8787189145b8d05ed572bd7024408417a9fdd9c0`.

```text
Wayfinder Web CI             PASS
Wayfinder Intelligence CI    PASS
rollback lifecycle proof     PASS
canonical Output read        LIVE
Journey v0.2                 LIVE
```

Production migration `add_practice_output_read_and_journey_v0_2` is applied as version `20260920013829`.

The new authenticated-only reads are:

```text
wf_practice_outputs_v0
wf_journey_v1
```

Anon/public execution is denied for both.

The rollback-backed production-schema proof verified:

- CURRENT Output eligibility;
- same-Practice `SOURCE_VERSION_ADVANCED` remains eligible;
- Practice reclassification becomes `PRACTICE_MISMATCH` and needs explicit review;
- mismatch does not silently move Skill Capability;
- explicit Output rebase restores CURRENT under the new Practice;
- Journey includes one original Output record plus later Output correction history;
- result-limit accounting remains correct;
- all synthetic proof data rolls back.

The real current account has zero canonical Practice Outputs with COMPLETE stored-result coverage and UNKNOWN lived-output coverage. Journey v0.2 currently returns 10 matching recorded timeline items with COMPLETE result coverage.

The Character Output manager and Journey v0.2 UI source are merged and Web CI is green. Vercel production browser promotion remains externally blocked by the free-tier daily deployment quota.
