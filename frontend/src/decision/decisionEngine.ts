/**
 * Decision Engine — converts a verification engine prediction into a
 * consistent user-facing decision.
 *
 * Flow:
 *   Engine Decision  →  Decision Engine  →  User Decision
 *
 * Engines supply a technical prediction + model confidence.
 * This module owns status remapping, risk derivation, and recommendations.
 */

import { DECISION_THRESHOLDS, USER_DECISION_RISK } from "./thresholds";
import type { EnginePrediction, UserDecision } from "./types";
import type { VerdictType } from "../types/verification";

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return DECISION_THRESHOLDS.DEFAULT_MODEL_CONFIDENCE;
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

function buildUserDecision(
  verdict: VerdictType,
  modelConfidence: number,
  extras: Partial<Pick<UserDecision, "remappedFromLowConfidenceAuthentic" | "decisionNote">> = {}
): UserDecision {
  const risk = USER_DECISION_RISK[verdict];
  return {
    verdict,
    modelConfidence: clampConfidence(modelConfidence),
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    trustScore: risk.trustScore,
    recommendation: risk.recommendation,
    remappedFromLowConfidenceAuthentic: extras.remappedFromLowConfidenceAuthentic ?? false,
    decisionNote: extras.decisionNote ?? null,
  };
}

/**
 * Apply business rules to an engine prediction.
 *
 * Rules (thresholds from DECISION_THRESHOLDS / USER_DECISION_RISK):
 * - High-confidence authentic  → Trusted     (trust 100, low risk)
 * - Low-confidence authentic   → Suspicious  (trust 50, medium risk)
 * - Inconclusive / suspicious  → Suspicious  (trust 50, medium risk)
 * - Forgery / fraud / edited   → Fraudulent  (trust 0, high risk)
 */
export function decideUserVerdict(prediction: EnginePrediction): UserDecision {
  const confidence = clampConfidence(prediction.modelConfidence);
  const label = prediction.label;

  if (label === "fraudulent") {
    return buildUserDecision("fraudulent", confidence);
  }

  if (label === "inconclusive" || label === "suspicious") {
    return buildUserDecision("suspicious", confidence);
  }

  if (label === "authentic") {
    if (confidence >= DECISION_THRESHOLDS.AUTHENTIC_MIN_CONFIDENCE) {
      return buildUserDecision("authentic", confidence);
    }

    const raw = prediction.rawLabel?.trim() || "authentic";
    return buildUserDecision("suspicious", confidence, {
      remappedFromLowConfidenceAuthentic: true,
      decisionNote:
        `The verification engine predicted "${raw}" with only ${confidence}% model confidence ` +
        `(below the ${DECISION_THRESHOLDS.AUTHENTIC_MIN_CONFIDENCE}% acceptance threshold). ` +
        `The application therefore classified this document as Suspicious pending manual review.`,
    });
  }

  // Unknown normalized labels default to Suspicious for safety.
  return buildUserDecision("suspicious", confidence);
}
