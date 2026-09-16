# Navigator Conversation Runtime v0.1

**Status:** LIVE proving slice  
**Scope:** Helm conversational orchestration over Training v0.1

## Product law

Navigator is the primary conversational operator of Wayfinder. The player speaks naturally; Navigator tries to understand the intent, reads bounded relevant context, asks for missing information when it materially matters, proposes structured domain writes, and persists only after the admission/authorization boundary is satisfied.

```text
conversation
  -> intent episode
  -> bounded context
  -> semantic candidates
  -> domain admission
  -> clarification / proposal / drop
  -> explicit confirmation
  -> typed domain command
  -> canonical reality
  -> recompute
```

Conversation is not the life model.

## v0.1 proving flow

Training is the first live conversational domain.

Example:

```text
Player: “Hey Nav, I worked out today.”
Navigator: “What did you train?”

Player: “Legs.”
Navigator:
  - reuse last lower-body workout when available
  - tell me the new workout
  - just record leg day
  - skip

Navigator asks when it occurred.
Navigator shows the structured Training proposal.
Player confirms.
Training receives the canonical command.
```

The player may also type details directly. The current recognizer remains deliberately narrow; unsupported detail is not invented.

## Conversation cache vs canonical history

The browser keeps a bounded temporary cache:

- up to 40 chat messages;
- up to 16 rewind snapshots;
- session-scoped storage;
- no server-side transcript persistence in v0.1.

Before confirmation, the player can rewind a turn or clear the temporary conversation.

After a confirmed domain write, chat rewind cannot erase canonical history. Future corrections must go through the owning domain's correction/versioning path.

```text
CHAT REWIND
= temporary working context

CONFIRMED DOMAIN WRITE
= durable canonical history
```

## Skip and partial truth

Navigator must not interrogate the player indefinitely. `Skip` is first-class.

If the owning domain can safely admit partial truth, Wayfinder may preserve the supported portion while leaving missing detail unknown. For example:

```text
“Leg day happened”

known:
- lower-body strength session occurred

unknown:
- exercises
- sets
- reps
- loads
```

Unknown detail is never filled with invented data.

## Suggestions

Suggestions are contextual accelerators, not authoritative choices. v0.1 can surface prior Training context, for example a previous lower-body workout, to reduce repeated manual entry.

The longer-term pattern is:

```text
player utterance
+ bounded domain reads
+ reference knowledge
+ current information needs
  -> useful suggestions
```

## Retention law

The Edge Function returns transient episode state to the client. It does not persist the conversation or candidate graph server-side.

> Understanding precedes persistence.
>
> No owner, no persistence.
>
> Confirmed facts live in domains, not in chat memory.

## Current limitations

v0.1 is not yet a general-purpose LLM Navigator. Training is the first conversationally wired domain, and detailed semantic recognition intentionally understands only a narrow exercise grammar. Inputs outside live domain coverage are dropped rather than placed in a miscellaneous memory bucket.

As Nutrition, Inventory, Finance, World, Direction, and other domains earn implementation, they should register into the same conversational/admission spine rather than adding separate form-first interfaces.

## Next pressure

Use the live Training conversation and observe where natural interaction fails. The next independent domain proof should still be Nutrition so that Navigator has to arbitrate between two genuinely different semantic owners.
