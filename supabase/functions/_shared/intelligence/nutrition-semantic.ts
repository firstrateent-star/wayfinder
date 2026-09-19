import type {
  AdmissionContract,
  SemanticCandidate
} from "./semantic-admission.ts";

export type NutritionPrecision = "EXACT" | "APPROXIMATE" | "UNKNOWN";

export interface NutritionItemCandidate {
  itemLabel: string;
  quantityValue?: number;
  quantityUnit?: string;
  quantityPrecision?: NutritionPrecision;
}

export interface NutritionTotalsCandidate {
  caloriesKcal?: number;
  caloriesPrecision?: NutritionPrecision;
  proteinG?: number;
  proteinPrecision?: NutritionPrecision;
  carbsG?: number;
  carbsPrecision?: NutritionPrecision;
  fatG?: number;
  fatPrecision?: NutritionPrecision;
}

export interface NutritionIntakeCandidatePayload {
  intakeKind: "MEAL" | "FOOD_INTAKE";
  label?: string;
  localDate?: string;
  occurrencePrecision: "DAY" | "INSTANT" | "APPROXIMATE";
  items: NutritionItemCandidate[];
  nutrition: NutritionTotalsCandidate;
  genericIntake?: boolean;
}

const PRECISIONS = new Set<NutritionPrecision>(["EXACT", "APPROXIMATE", "UNKNOWN"]);

function validFiniteNonnegative(value?: number) {
  return value == null || Number.isFinite(value) && value >= 0;
}

function pairValid(value: number | undefined, precision: NutritionPrecision | undefined) {
  return value == null ? precision == null : precision != null && PRECISIONS.has(precision);
}

function validPayload(payload: NutritionIntakeCandidatePayload) {
  if (!["MEAL", "FOOD_INTAKE"].includes(payload.intakeKind)) return "INVALID_NUTRITION_INTAKE_KIND";
  if (!["DAY", "INSTANT", "APPROXIMATE"].includes(payload.occurrencePrecision)) return "INVALID_NUTRITION_OCCURRENCE_PRECISION";
  if (payload.label != null && (!payload.label.trim() || payload.label.trim().length > 300)) return "INVALID_NUTRITION_LABEL";
  if (!Array.isArray(payload.items) || payload.items.length > 50) return "INVALID_NUTRITION_ITEMS";

  for (const item of payload.items) {
    if (!item.itemLabel?.trim() || item.itemLabel.trim().length > 300) return "INVALID_NUTRITION_ITEM";
    const hasQuantity = item.quantityValue != null;
    if (hasQuantity && (!Number.isFinite(item.quantityValue) || item.quantityValue! <= 0)) return "INVALID_NUTRITION_ITEM_QUANTITY";
    if (hasQuantity !== (item.quantityUnit != null) || hasQuantity !== (item.quantityPrecision != null)) return "INVALID_NUTRITION_ITEM_QUANTITY_PAIR";
    if (item.quantityUnit != null && (!item.quantityUnit.trim() || item.quantityUnit.trim().length > 80)) return "INVALID_NUTRITION_ITEM_UNIT";
    if (item.quantityPrecision != null && !PRECISIONS.has(item.quantityPrecision)) return "INVALID_NUTRITION_ITEM_PRECISION";
  }

  const n = payload.nutrition ?? {};
  if (![n.caloriesKcal, n.proteinG, n.carbsG, n.fatG].every(validFiniteNonnegative)) return "INVALID_NUTRITION_TOTAL";
  if (!pairValid(n.caloriesKcal, n.caloriesPrecision)) return "INVALID_CALORIES_PRECISION_PAIR";
  if (!pairValid(n.proteinG, n.proteinPrecision)) return "INVALID_PROTEIN_PRECISION_PAIR";
  if (!pairValid(n.carbsG, n.carbsPrecision)) return "INVALID_CARBS_PRECISION_PAIR";
  if (!pairValid(n.fatG, n.fatPrecision)) return "INVALID_FAT_PRECISION_PAIR";
  return null;
}

export const nutritionAdmissionContract: AdmissionContract = {
  id: "nutrition.semantic-admission.v0.1",
  owner: "nutrition",
  claimTypes: ["NUTRITION_INTAKE"],
  admit(candidate: SemanticCandidate, context) {
    const payload = candidate.payload as NutritionIntakeCandidatePayload;
    const invalid = validPayload(payload);
    if (invalid) {
      return {
        contractId: this.id,
        candidateId: candidate.candidateId,
        claimType: candidate.claimType,
        owner: this.owner,
        disposition: "REJECT",
        reason: invalid
      };
    }

    const normalized: NutritionIntakeCandidatePayload = {
      intakeKind: payload.intakeKind,
      ...(payload.label ? { label: payload.label.trim().slice(0, 300) } : {}),
      ...(payload.localDate ? { localDate: payload.localDate } : {}),
      occurrencePrecision: payload.localDate ? "DAY" : payload.occurrencePrecision,
      items: payload.items.map((item) => ({
        itemLabel: item.itemLabel.trim().slice(0, 300),
        ...(item.quantityValue != null ? {
          quantityValue: item.quantityValue,
          quantityUnit: item.quantityUnit!.trim().slice(0, 80),
          quantityPrecision: item.quantityPrecision!
        } : {})
      })),
      nutrition: { ...payload.nutrition },
      ...(payload.genericIntake ? { genericIntake: true } : {})
    };

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
    return {
      contractId: this.id,
      candidateId: candidate.candidateId,
      claimType: candidate.claimType,
      owner: this.owner,
      disposition: normalized.genericIntake ? "ACCEPT_PARTIAL" : "ACCEPT",
      normalized,
      command: {
        module: "nutrition",
        commandType: "nutrition.capture_intake",
        args: {
          p_command_id: crypto.randomUUID(),
          p_intake_kind: normalized.intakeKind,
          p_occurrence_precision: occurrencePrecision,
          p_zone_id: context.source.zoneId ?? "UTC",
          p_occurred_at: occurrencePrecision === "DAY" ? null : context.source.occurredAt ?? context.now,
          p_occurred_local_date: occurrencePrecision === "DAY" ? normalized.localDate ?? null : null,
          p_label: normalized.label ?? null,
          p_items: normalized.items.map((item) => ({
            item_label: item.itemLabel,
            quantity_value: item.quantityValue ?? null,
            quantity_unit: item.quantityUnit ?? null,
            quantity_precision: item.quantityPrecision ?? null
          })),
          p_calories_kcal: normalized.nutrition.caloriesKcal ?? null,
          p_calories_precision: normalized.nutrition.caloriesPrecision ?? null,
          p_protein_g: normalized.nutrition.proteinG ?? null,
          p_protein_precision: normalized.nutrition.proteinPrecision ?? null,
          p_carbs_g: normalized.nutrition.carbsG ?? null,
          p_carbs_precision: normalized.nutrition.carbsPrecision ?? null,
          p_fat_g: normalized.nutrition.fatG ?? null,
          p_fat_precision: normalized.nutrition.fatPrecision ?? null,
          p_provenance_source_id: context.source.sourceId
        }
      },
      reason: normalized.genericIntake
        ? "VALID_NUTRITION_INTAKE_WITH_UNKNOWN_ITEM_DETAIL"
        : "NUTRITION_CLAIM_ADMISSIBLE"
    };
  }
};
