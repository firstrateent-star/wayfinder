import type {
  AdmissionContext,
  AdmissionContract,
  AdmissionDecision,
  CandidateGraph,
  SemanticCandidate,
  SourceEnvelope
} from "./semantic-admission.ts";
import { resolveTrainingExercise } from "./training-exercises.ts";

export interface TrainingSetCandidate {
  exerciseText: string;
  exerciseKey?: string;
  exerciseLabel?: string;
  reps?: number;
  loadValue?: number;
  loadUnit?: "LB" | "KG";
  rpe?: number;
}

export interface TrainingSessionCandidatePayload {
  sessionKind: "STRENGTH";
  label?: string;
  localDate?: string;
  occurrencePrecision: "DAY" | "INSTANT" | "APPROXIMATE";
  sets: TrainingSetCandidate[];
  genericStrengthSession?: boolean;
}

function localDateInZone(instant: string, zoneId: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function wordNumber(value?: string) {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
  };
  if (words[lower] !== undefined) return words[lower];
  const parsed = Number(lower);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Bounded proving recognizer, not a general language model.
 * It intentionally understands only a narrow training grammar so the admission
 * architecture can be proven without letting a model improvise canonical facts.
 */
export function recognizeTraining(source: SourceEnvelope): CandidateGraph {
  const text = source.content.trim();
  const lower = text.toLowerCase();
  const candidates: SemanticCandidate<TrainingSessionCandidatePayload>[] = [];

  const exactSets = lower.match(
    /\b(benched|bench(?: press)?|barbell bench press)\s+(\d+(?:\.\d+)?)\s*(lb|lbs|pounds|kg|kgs|kilograms)?\s*(?:for|x)\s*(\d+)\s*(?:reps?)?\s*(?:for\s*)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+sets?\b/
  );

  if (exactSets) {
    const count = wordNumber(exactSets[5]) ?? 1;
    const load = Number(exactSets[2]);
    const reps = Number(exactSets[4]);
    const rawUnit = exactSets[3]?.toLowerCase();
    const unit: "LB" | "KG" = rawUnit?.startsWith("k") ? "KG" : "LB";
    const sets: TrainingSetCandidate[] = Array.from({ length: count }, () => ({
      exerciseText: exactSets[1],
      reps,
      loadValue: load,
      loadUnit: unit
    }));
    candidates.push({
      candidateId: crypto.randomUUID(),
      claimType: "TRAINING_STRENGTH_SESSION",
      proposedOwner: "training",
      sourceId: source.sourceId,
      extractionConfidence: 0.99,
      payload: {
        sessionKind: "STRENGTH",
        label: "Strength training",
        localDate: lower.includes("today") ? localDateInZone(source.receivedAt, source.zoneId ?? "UTC") : undefined,
        occurrencePrecision: lower.includes("today") ? "DAY" : source.occurredAt ? "INSTANT" : "APPROXIMATE",
        sets
      }
    });
  } else {
    const ambiguousSets = lower.match(
      /\b(benched|bench(?: press)?|barbell bench press)\s+(\d+(?:\.\d+)?)\s*(lb|lbs|pounds|kg|kgs|kilograms)?\s*(?:for|x)\s*(\d+)\s*(?:reps?)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+times\b/
    );

    if (ambiguousSets) {
      const load = Number(ambiguousSets[2]);
      const reps = Number(ambiguousSets[4]);
      const rawUnit = ambiguousSets[3]?.toLowerCase();
      candidates.push({
        candidateId: crypto.randomUUID(),
        claimType: "TRAINING_STRENGTH_SESSION",
        proposedOwner: "training",
        sourceId: source.sourceId,
        extractionConfidence: 0.96,
        ambiguities: [
          {
            code: "SET_STRUCTURE_AMBIGUOUS",
            description: `“${ambiguousSets[5]} times” could mean repeated sets in one session or repeated performances across sessions.`,
            blocking: true
          }
        ],
        payload: {
          sessionKind: "STRENGTH",
          label: "Strength training",
          localDate: lower.includes("today") ? localDateInZone(source.receivedAt, source.zoneId ?? "UTC") : undefined,
          occurrencePrecision: lower.includes("today") ? "DAY" : source.occurredAt ? "INSTANT" : "APPROXIMATE",
          sets: [
            {
              exerciseText: ambiguousSets[1],
              reps,
              loadValue: load,
              loadUnit: rawUnit?.startsWith("k") ? "KG" : "LB"
            }
          ]
        }
      });
    }
  }

  if (candidates.length === 0 && /\b(crushed|trained|worked)\s+(legs|leg day)\b/.test(lower)) {
    candidates.push({
      candidateId: crypto.randomUUID(),
      claimType: "TRAINING_STRENGTH_SESSION",
      proposedOwner: "training",
      sourceId: source.sourceId,
      extractionConfidence: 0.82,
      payload: {
        sessionKind: "STRENGTH",
        label: "Lower-body strength training",
        localDate: lower.includes("today") ? localDateInZone(source.receivedAt, source.zoneId ?? "UTC") : undefined,
        occurrencePrecision: lower.includes("today") ? "DAY" : source.occurredAt ? "INSTANT" : "APPROXIMATE",
        sets: [],
        genericStrengthSession: true
      }
    });
  }

  return {
    sourceId: source.sourceId,
    candidates,
    relations: []
  };
}

function normalizePayload(payload: TrainingSessionCandidatePayload) {
  return {
    ...payload,
    sets: payload.sets.map((set) => {
      const resolved = resolveTrainingExercise(set.exerciseText);
      return {
        ...set,
        exerciseKey: resolved?.key,
        exerciseLabel: resolved?.label
      };
    })
  };
}

export const trainingAdmissionContract: AdmissionContract = {
  id: "training.semantic-admission.v0.1",
  owner: "training",
  claimTypes: ["TRAINING_STRENGTH_SESSION"],
  admit(candidate: SemanticCandidate, context: AdmissionContext): AdmissionDecision {
    const payload = candidate.payload as TrainingSessionCandidatePayload;
    const blocking = candidate.ambiguities?.find((item) => item.blocking);
    if (blocking) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        informationNeed: {
          concept: "training.exercise_set.structure",
          purpose: "Resolve whether repeated performance refers to sets in one workout or separate occurrences.",
          priorityClass: "P1_HIGH_IMPACT",
          questionIntent: "Clarify whether the repeated reps/load were multiple sets in the same workout.",
          whyThisMatters: "Training can only store a structured set history if the set/session boundary is known."
        },
        reason: blocking.code
      };
    }

    const normalized = normalizePayload(payload);
    if (normalized.sets.some((set) => !set.exerciseKey || !set.exerciseLabel)) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_CLARIFICATION",
        informationNeed: {
          concept: "training.exercise.identity",
          purpose: "Resolve the exercise to a known Training reference concept before persistence.",
          priorityClass: "P1_HIGH_IMPACT",
          questionIntent: "Clarify which exercise variant the player performed.",
          whyThisMatters: "An unresolved exercise name should not become a fabricated canonical exercise."
        },
        reason: "UNRESOLVED_EXERCISE"
      };
    }

    if (!context.source.authorizesCanonicalWrite || context.source.interactionIntent !== "RECORD") {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "NEEDS_AUTHORIZATION",
        normalized,
        reason: "PLAYER_HAS_NOT_AUTHORIZED_CANONICAL_WRITE"
      };
    }

    const occurrencePrecision = normalized.localDate ? "DAY" : normalized.occurrencePrecision;
    const command = {
      module: "training",
      commandType: "training.capture_strength_session",
      args: {
        p_command_id: crypto.randomUUID(),
        p_occurrence_precision: occurrencePrecision,
        p_zone_id: context.source.zoneId ?? "UTC",
        p_occurred_at: occurrencePrecision === "DAY" ? null : context.source.occurredAt ?? context.now,
        p_occurred_local_date: occurrencePrecision === "DAY" ? normalized.localDate : null,
        p_label: normalized.label ?? null,
        p_sets: normalized.sets.map((set) => ({
          exercise_key: set.exerciseKey,
          exercise_label: set.exerciseLabel,
          reps: set.reps ?? null,
          load_value: set.loadValue ?? null,
          load_unit: set.loadUnit ?? null,
          rpe: set.rpe ?? null
        })),
        p_provenance_source_id: context.source.sourceId
      }
    };

    return {
      contractId: this.id,
      candidateId: candidate.candidateId,
      claimType: candidate.claimType,
      owner: this.owner,
      disposition: normalized.genericStrengthSession ? "ACCEPT_PARTIAL" : "ACCEPT",
      normalized,
      command,
      reason: normalized.genericStrengthSession ? "VALID_GENERIC_STRENGTH_SESSION_WITH_UNKNOWN_EXERCISE_DETAIL" : "TRAINING_CLAIM_ADMISSIBLE"
    };
  }
};
