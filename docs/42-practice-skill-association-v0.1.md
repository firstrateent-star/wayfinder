# Wayfinder Governed Practice Skill Association v0.1

**Status:** IMPLEMENTED ON BRANCH — CI / LIVE GATES PENDING  
**Skills projection:** `skills_v0.2`  
**Practice association provider:** `practice.name-skill-provider.v0.1`

## Purpose

Extend Skill Experience beyond Training while preserving the architecture's authority boundary.

Canonical Practice answers:

> What activity did the player record?

Skill Association answers:

> Which stable game/knowledge Skill concept does that governed encounter exercise?

Those identities are related but not interchangeable.

## First governed concepts

```text
physical.strength_training   <- Training provider
creative.music_production    <- Practice alias provider
creative.drawing             <- Practice alias provider
```

The Practice alias registry currently accepts:

```text
"music production" -> creative.music_production
"drawing"          -> creative.drawing
```

Normalization is case-insensitive with outer/duplicate whitespace removed.

Production history already contains multiple canonical Practice rows whose names normalize to `music production`. This slice deliberately preserves those records while allowing their sessions to converge at the Skill projection.

## Association authority

`skill-association.ts` distinguishes:

```text
DETERMINISTIC_DOMAIN
  domain semantics themselves establish the association
  example: Training STRENGTH -> Strength Training

GOVERNED_PRACTICE_ALIAS
  an accepted exact normalized Practice label establishes the association

SEMANTIC_PROPOSAL
  AI/inference suggests a Skill relationship
  contributesExperience = false
```

The model can propose meaning but cannot award progression.

## Generic Practice Skill read

Migration:

```text
supabase/migrations/20260920013000_add_practice_skill_input_v0.sql
```

Authenticated RPC:

```text
wf_practice_skill_input_v0(
  normalized_practice_names[],
  as_of,
  recent_limit
)
```

The Skill runtime supplies its governed aliases. Postgres owns only exact canonical selection/counting:

- current ACTIVE PracticeSessions;
- current ACTIVE Practice records;
- exact normalized alias match;
- encounter count;
- first/last occurrence;
- positive cadence samples;
- median cadence interval;
- recent exact PracticeSession + Practice lineage.

The database does not own the Skill taxonomy.

## Generalized Skills projection

`skill-projection.ts` advances to:

```text
skills_v0.2
```

It accepts provider-owned encounter streams rather than a hard-coded Training input.

```text
SkillExperienceProviderInput
├── stable skill key
├── display label
├── provider id
├── association authority
├── source namespace/type
├── encounter identity prefix
└── exact canonical aggregate/read
```

The same Experience and Sharpness machinery now works for Training and Practice-derived Skills.

## Anti-double-count rule

```text
skill_experience_key
=
encounter_key
+
skill_key
```

Examples:

```text
practice:session:A:skill:creative.music_production
practice:session:B:skill:creative.music_production
```

If A and B came from two different canonical Practice rows named `Music Production`, they remain two distinct lived sessions and two Experience encounters.

If session A is corrected from v1 to v2:

```text
same encounter
same skill_experience_key
new exact lineage version
no second Experience contribution
```

## Semantic Practice capture

Wayfinder's general semantic system now recognizes:

```text
CREATIVE_PRACTICE
MUSIC_PRODUCTION
DRAWING
```

Only Music Production and Drawing currently have Practice persistence capacity.

Eligibility:

```text
subject = SELF
node = EVENT
reality = OCCURRED
concept = MUSIC_PRODUCTION | DRAWING
```

Anything else remains session-only.

### Time law

Semantic Practice v0.1 requires a concrete interval:

```text
from + to
precision = EXACT | APPROXIMATE
```

If the player says only “I drew today,” Wayfinder must ask when the session occurred rather than converting the message time into event time.

### Write path

```text
language
 -> semantic candidate
 -> Practice planning policy
 -> Practice fulfillment
 -> server-staged proposal
 -> explicit confirmation
 -> Practice admission contract rerun
 -> wf_practice_capture_session
 -> canonical PracticeSession
```

No new canonical write mechanism is introduced.

## Projection consequences

Practice ModuleChange now invalidates:

```text
Bearing
Skills
Helm
Navigator Context
```

It does **not** currently invalidate:

```text
Voyage Progression
Character
Requirements
```

because generic Practice has no governed provider for those claims yet.

## Tests

```text
lab/skill-association-practice-v0.1.test.ts
lab/practice-semantic-v0.1.test.ts
```

Pressure cases include:

- case/whitespace Practice aliases converge to one Skill;
- distinct canonical Practice identities remain distinct lineage;
- alias collision fails closed;
- unregistered activities are not guessed into Skills;
- semantic Skill proposals contribute no Experience;
- PracticeSession correction preserves Skill Experience identity;
- Training + multiple Practice Skills compose through one engine;
- planned Practice does not become occurred Practice;
- other-person Practice does not become player reality;
- vague timing requires clarification;
- canonical write requires staged explicit confirmation;
- authorized semantic capture reuses the existing Practice command.

## Deferred next frontier

Once live:

1. run real-model semantic tests for natural Music Production / Drawing phrasing;
2. add one governed semantic-to-Skill association proposal review path for unregistered skills;
3. decide when repeated unresolved associations justify creating a new stable Skill concept;
4. add a first domain-backed Skill Capability provider;
5. only after Capability breadth exists, Flower Mastery and Skill Level.
