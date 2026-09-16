import type {
  InformationAnswerability,
  InformationNeed,
  InformationSensitivity,
  NeedPriorityClass,
  QuestionMode,
  QuestionOpportunity,
  QuestionSpec,
  QuestionValueSignals
} from "./contracts.ts";

const PRIORITY_WEIGHT: Record<NeedPriorityClass, number> = {
  P0_BLOCKING: 100,
  P1_HIGH_IMACT: 80,
  P2_HIGH_LEVERAGE: 60,
  P3_CALIBRATION: 40,
  P4_OPTIONAL: 10
} as unknown as Record<NeedPriorityClass, number>;

const ANSWERABILITY_WEIGHT: Record<InformationAnswerability, number> = {
  HIGH: 8,
  MEDIUM: 3,
  LOW: -8
};

const SENSITIVITY_PENALTY: Record<InformationSensitivity, number> = {
  LOW: 0,
  MODERATE: 5,
  HIGH: 20
};

function clamp01(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function scoreSignals(signals: QuestionValueSignals | undefined) {
  if (!signals) return 0;

  return (
    clamp01(signals.uncertaintyReduction) * 15 +
    clamp01(signals.currentRelevance) * 20 +
    clamp01(signals.decisionImpact) * 20 +
    clamp01(signals.crossDomainLeverage) * 12 +
    clamp01(signals.futureReuse) * 10 +
    clamp01(signals.freshnessValue) * 8 +
    clamp01(signals.conflictResolutionValue) * 15 +
    clamp01(signals.requirementOrDeadlineImpact) * 15 +
    clamp01(signals.naturalTimingOpportunity) * 10 -
    clamp01(signals.userBurden) * 18 -
    clamp01(signals.interruptionCost) * 18 -
    clamp01(signals.redundancy) * 15 -
    clamp01(signals.recentRepetition) * 20
  );
}

function modeAllows(priority: NeedPriorityClass, mode: QuestionMode, includeOptional: boolean) {
  if (priority === "P0_BLOCKING") return true;

  if (mode === "TASK_DRIVEN") {
    return priority === "P1_HIGH_IMPACT";
  }
  if (mode === "AMBIENT") {
    return priority === "P1_HIGH_IMPACT" || priority === "P2_HIGH_LEVERAGE" || priority === "P3_CALIBRATION";
  }

  if (priority === "P4_OPTIONAL") return includeOptional;
  return true;
}

export interface QuestionPlanningContext {
  mode: QuestionMode;
  now: string;
  budget?: number;
  includeOptional?: boolean;
  allowHighSensitivity?: boolean;
  cooldownQuestionKeys?: ReadonlySet<string>;
  dismissedNeedIds?: ReadonlySet<string>;
}

export class QuestionPlanner {
  private readonly specs = new Map<string, QuestionSpec>();

  registerSpec(spec: QuestionSpec) {
    if (!spec.concept.trim()) throw new Error("QUESTION_SPEC_CONCEPT_REQUIRED");
    if (!spec.questionKey.trim()) throw new Error("QUESTION_SPEC_KEY_REQUIRED");
    if (!spec.questionIntent.trim()) throw new Error("QUESTION_SPEC_INTENT_REQUIRED");
    if (this.specs.has(spec.concept)) {
      throw new Error(`QUESTION_SPEC_ALREADY_REGISTERED:${spec.concept}`);
    }
    this.specs.set(spec.concept, spec);
    return this;
  }

  plan(needs: readonly InformationNeed[], context: QuestionPlanningContext): QuestionOpportunity[] {
    const nowMs = Date.parse(context.now);
    if (!Number.isFinite(nowMs)) throw new Error("QUESTION_PLANNER_INVALID_NOW");

    const includeOptional = context.includeOptional ?? false;
    const budget = Math.max(0, Math.floor(context.budget ?? (context.mode === "DISCOVERY_SESSION" ? 3 : 1)));
    if (budget === 0) return [];

    const opportunities: QuestionOpportunity[] = [];

    for (const need of needs) {
      if (!need.resolutionOptions.includes("PLAYER")) continue;
      if (context.dismissedNeedIds?.has(need.needId)) continue;
      if (need.expiresAt && Date.parse(need.expiresAt) <= nowMs) continue;
      if (!modeAllows(need.priorityClass, context.mode, includeOptional)) continue;

      const sensitivity = need.sensitivity ?? "LOW";
      if (sensitivity === "HIGH" && !context.allowHighSensitivity) continue;

      const spec = this.specs.get(need.concept);
      if (!spec) continue;
      if (context.cooldownQuestionKeys?.has(spec.questionKey)) continue;

      const whyThisMatters =
        typeof spec.whyThisMatters === "function"
          ? spec.whyThisMatters(need)
          : spec.whyThisMatters;

      const planningScore =
        PRIORITY_WEIGHT[need.priorityClass] +
        ANSWERABILITY_WEIGHT[need.answerability ?? "MEDIUM"] -
        SENSITIVITY_PENALTY[sensitivity] +
        scoreSignals(need.questionSignals);

      opportunities.push({
        opportunityId: `${need.needId}:${spec.questionKey}`,
        questionKey: spec.questionKey,
        informationNeed: need,
        mode: context.mode,
        questionIntent: spec.questionIntent,
        expectedAnswerShape: spec.expectedAnswerShape,
        whyThisMatters,
        mayPersistAnswer: spec.mayPersistAnswer,
        requiresExplicitAuthorizationForWrite: spec.requiresExplicitAuthorizationForWrite,
        planningScore
      });
    }

    return opportunities
      .sort((a, b) => {
        const scoreDelta = b.planningScore - a.planningScore;
        if (scoreDelta !== 0) return scoreDelta;
        return a.opportunityId.localeCompare(b.opportunityId);
      })
      .slice(0, budget);
  }
}
