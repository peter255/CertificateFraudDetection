import type { RiskLevel, VerdictType } from "../types/verification";

/**
 * Normalized engine classification before application decision rules.
 * Engines may use other labels internally; adapters map into this set.
 */
export type EnginePredictionLabel =
  | "authentic"
  | "suspicious"
  | "fraudulent"
  | "inconclusive";

/**
 * Technical prediction from a verification engine (V1, V2, or future).
 * This is NOT the user-facing result.
 */
export interface EnginePrediction {
  /** Which verification engine produced the prediction. */
  engine: "v1" | "v2" | string;
  /** Normalized engine classification. */
  label: EnginePredictionLabel;
  /**
   * Model confidence in the engine's own prediction (0–100).
   * This is NOT "how authentic the document is."
   */
  modelConfidence: number;
  /** Optional raw engine label for audit / decision notes. */
  rawLabel?: string;
}

/**
 * Application decision presented to the end user.
 */
export interface UserDecision {
  /** One of: Trusted (authentic) | Suspicious | Fraudulent */
  verdict: VerdictType;
  /**
   * Model confidence in the underlying engine prediction (0–100).
   * Display as "Model Confidence".
   */
  modelConfidence: number;
  riskLevel: RiskLevel;
  /** Higher = more risk (0 / 50 / 100). */
  riskScore: number;
  /** Higher = more trust — primary overview gauge (100 / 50 / 0). */
  trustScore: number;
  recommendation: string;
  /** True when the user verdict differs from a direct engine authentic call. */
  remappedFromLowConfidenceAuthentic: boolean;
  /** Short explanation suitable for Key Findings when remapping occurred. */
  decisionNote: string | null;
}
