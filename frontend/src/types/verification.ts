export type VerificationStep = "idle" | "uploaded" | "analyzing" | "results";

export type VerdictType = "authentic" | "suspicious" | "fraudulent";

export type SignalStatus = "pass" | "warning" | "fail";

export type RiskLevel = "low" | "medium" | "high";

export interface Signal {
  id: string;
  category: string;
  description: string;
  status: SignalStatus;
  /** Optional engine-native fields (null/omitted when unavailable). */
  check?: string | null;
  layer?: string | null;
  stage?: string | null;
  engine?: string | null;
  detector?: string | null;
  severity?: string | null;
  confidence?: number | null;
  evidenceClass?: string | null;
  field?: string | null;
  fieldLabel?: string | null;
  fraudType?: string | null;
  generator?: string | null;
  issuerName?: string | null;
  issuerCategory?: string | null;
  source?: string | null;
  scoreRole?: string | null;
  bboxSource?: string | null;
  bboxAreaRatio?: number | null;
  relatedBboxes?: Array<Record<string, unknown>> | null;
  fieldFitScore?: number | null;
  fieldImportance?: number | null;
  fieldAssignmentSource?: string | null;
  fieldAssignmentConfidence?: number | null;
  extras?: Record<string, unknown> | null;
}

export interface Finding {
  title: string;
  detail: string;
}

export interface ExecReport {
  /** Unused for display — narrative lives in VerificationResult.aiSummary only. */
  summary: string;
  riskLevel: RiskLevel;
  riskScore: number;
  /** Decision-derived trust (100/50/0). Risk badge uses riskLevel; Overview Trust gauge uses engineTrustScore. */
  trustScore: number;
  findings: Finding[];
  recommendation: string;
}

export interface VendorFinding {
  /** Public label only — "Engine V1" or "Engine V2". Never a vendor name. */
  vendor: string;
  /** Engine status when provided. */
  status: string | null;
  /** Model confidence as 0–1 ratio when provided. */
  confidenceScore: number | null;
  /** Engine processing / classification result when provided. */
  processingResult: string | null;
  /** Extra short findings returned by this engine. */
  additionalFindings: string[] | null;
}

/** Spatial tamper / anomaly region on the source document. */
export interface TamperRegion {
  id: string;
  label: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  /** [x, y, width, height] in source image pixels (origin top-left). */
  bbox: [number, number, number, number];
  page: number;
  imageWidth: number;
  imageHeight: number;
  location?: string | null;
  layer?: string | null;
  confidence?: number | null;
  bboxSource?: string | null;
  hasImage?: boolean | null;
  hasCropImage?: boolean | null;
  extras?: Record<string, unknown> | null;
}

/** Engine-native technical payloads not folded into signals/findings. */
export interface EngineTechnicalDetails {
  analysisStatus: string | null;
  layersApplied: string[] | null;
  analysisFlow: Array<Record<string, unknown>> | null;
  evidenceGroups: Record<string, unknown> | null;
  engineResults: Record<string, unknown> | null;
  structuralProfile: Record<string, unknown> | null;
  pdfFraudSubscores: Record<string, unknown> | null;
  classification: Record<string, unknown> | null;
  layerDetails: Record<string, unknown> | null;
}

export interface VerificationResult {
  certificateId: string;
  verdict: VerdictType;
  /**
   * Model confidence in the engine's prediction (0–100).
   * Display as "Model Confidence" — not document authenticity / trust.
   */
  confidence: number;
  /**
   * Likelihood of AI-generated or AI-altered content (0–100).
   * Null when the engine does not return a usable score.
   */
  aiProbability: number | null;
  /**
   * Engine-assessed document trustworthiness (0–100).
   * Distinct from Model Confidence and from decision-derived report.trustScore.
   * Null when the engine does not return a trust score.
   */
  engineTrustScore: number | null;
  documentType: string | null;
  issuingAuthority: string | null;
  holderName: string | null;
  issueDate: string | null;
  verifiedAt: string;
  aiSummary: string;
  signals: Signal[];
  report: ExecReport;
  vendorFindings: VendorFinding[];
  tamperRegions: TamperRegion[];
  /** Engine V1 heatmap overlay URL when spatial bboxes are unavailable. */
  heatmapUrl?: string | null;
  /** Engine-reported wall time in ms; null when the engine does not provide one. */
  engineDurationMs: number | null;
  /** Raw engine verdict / final_result label before Decision Engine mapping. */
  engineVerdictLabel: string | null;
  /** V1 analysis pipeline status; null for engines that omit it. */
  analysisStatus: string | null;
  /** V2 fraud intensity 0–100; null when unavailable. */
  fraudScore: number | null;
  /** V2 fraud color token; null when unavailable. */
  fraudColor: string | null;
  isScan: boolean | null;
  fileKind: string | null;
  technical: EngineTechnicalDetails;
}

export interface DocumentInfoData {
  fileName: string | null;
  fileSize: string | null;
  fileType: string | null;
  mimeType: string | null;
  width: string | null;
  height: string | null;
  resolution: string | null;
  dpi: string | null;
  colorSpace: string | null;
  pages: string | null;
  fileHash: string | null;
  createdDate: string | null;
  modifiedDate: string | null;
  verifiedAt: string | null;
  documentType: string | null;
  holderName: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  fileKind: string | null;
  isScan: boolean | null;
  processingTime: string | null;
  uploadTime: string | null;
  /** Additional scalar metadata returned by the engine. */
  extras: Array<{ label: string; value: string }>;
}
