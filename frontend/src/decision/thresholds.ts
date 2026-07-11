/**
 * Centralized Decision Engine thresholds and derived risk constants.
 * Adjust values here only — do not scatter magic numbers in mappers or UI.
 */

/** Model confidence is always expressed on a 0–100 scale. */
export const DECISION_THRESHOLDS = {
  /**
   * Minimum model confidence required to accept an engine "authentic"
   * prediction as a user-facing Authentic status.
   * Below this, Authentic engine predictions become Suspicious.
   */
  AUTHENTIC_MIN_CONFIDENCE: 40,

  /**
   * Default model confidence when an engine omits a usable score.
   * Neutral mid-band avoids over-claiming certainty.
   */
  DEFAULT_MODEL_CONFIDENCE: 50,
} as const;

/**
 * Risk / trust are derived only from the final user-facing decision — never
 * from the raw engine label alone.
 *
 * - riskScore: higher = more risk (reports / badges)
 * - trustScore: higher = more trust (primary overview gauges — full green ring)
 */
export const USER_DECISION_RISK = {
  authentic: {
    riskLevel: "low" as const,
    riskScore: 0,
    trustScore: 100,
    recommendation: "approve",
  },
  suspicious: {
    riskLevel: "medium" as const,
    riskScore: 50,
    trustScore: 50,
    recommendation: "manual_review",
  },
  fraudulent: {
    riskLevel: "high" as const,
    riskScore: 100,
    trustScore: 0,
    recommendation: "reject",
  },
} as const;
