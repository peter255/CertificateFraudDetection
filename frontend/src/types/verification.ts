export type VerificationStep = "idle" | "uploaded" | "analyzing" | "results";

export type VerdictType = "authentic" | "suspicious" | "fraudulent";

export type SignalStatus = "pass" | "warning" | "fail";

export type RiskLevel = "low" | "medium" | "high";

export interface Signal {
  id: string;
  category: string;
  description: string;
  status: SignalStatus;
}

export interface Finding {
  title: string;
  detail: string;
}

export interface ExecReport {
  summary: string;
  riskLevel: RiskLevel;
  riskScore: number;
  /** Higher = more trust (Trusted=100). Used by overview gauges. */
  trustScore: number;
  findings: Finding[];
  recommendation: string;
}

export interface VendorFinding {
  vendor: string;
  status: string;
  confidenceScore: number;
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
  location?: string;
}

export interface VerificationResult {
  certificateId: string;
  verdict: VerdictType;
  /**
   * Model confidence in the engine's prediction (0–100).
   * Display as "Model Confidence" — not document authenticity / trust.
   */
  confidence: number;
  documentType: string;
  issuingAuthority: string;
  holderName: string;
  issueDate: string;
  verifiedAt: string;
  aiSummary: string;
  signals: Signal[];
  report: ExecReport;
  vendorFindings: VendorFinding[];
  tamperRegions: TamperRegion[];
  /** Engine V1 heatmap overlay URL when spatial bboxes are unavailable. */
  heatmapUrl?: string | null;
}

export interface DocumentInfoData {
  fileName: string;
  documentType: string | null;
  fileSize: string;
  pages: string | null;
  uploadTime: string;
  processingTime: string | null;
  vendorName: string | null;
  verifiedAt: string | null;
}
