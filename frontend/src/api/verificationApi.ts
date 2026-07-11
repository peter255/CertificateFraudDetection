/**
 * verificationApi — dedicated HTTP client for the certificate verification endpoint.
 *
 * Responsibilities:
 *   1. Own all backend DTO types (ApiResponse and its nested shapes).
 *   2. Map the backend DTO to the frontend VerificationResult — the page and
 *      result components never see raw backend field names.
 *   3. Execute the multipart POST and surface typed results or thrown errors.
 *
 * Nothing in this file is exported except verifyDocument.
 * Pages call verifyDocument(file) and receive a VerificationResult.
 */

import type {
  VerificationResult,
  VerdictType,
  RiskLevel,
  SignalStatus,
} from "../types/verification";

// ── Backend DTOs ─────────────────────────────────────────────────────────────
// These types mirror the VerifyCertificateResponse pydantic model exactly.
// They must never be imported or used outside this module.

interface ApiVendorFinding {
  vendor: string;
  status: string;
  confidence_score: number;
}

interface ApiSignal {
  id: string;
  category: string;
  description: string;
  status: string; // "pass" | "warning" | "fail"
}

interface ApiFinding {
  title: string;
  detail: string;
}

interface ApiReport {
  summary: string;
  risk_level: string; // "low" | "medium" | "high"
  risk_score: number; // 0–100
  findings: ApiFinding[];
  recommendation: string;
}

interface ApiResponse {
  certificate_id: string;
  overall_status: string; // "authentic" | "fraudulent" | "inconclusive" | "pending"
  confidence_score: number; // 0.0–1.0
  document_type: string;
  holder_name: string;
  issuer_name: string;
  vendor_findings: ApiVendorFinding[];
  signals: ApiSignal[];
  report: ApiReport;
  ai_summary: string;
  verified_at: string;
}

// ── Mapper ───────────────────────────────────────────────────────────────────

const OVERALL_STATUS_TO_VERDICT: Record<string, VerdictType> = {
  authentic: "authentic",
  fraudulent: "fraudulent",
  inconclusive: "suspicious",
  pending: "suspicious",
};

function mapApiResponse(data: ApiResponse): VerificationResult {
  return {
    certificateId: data.certificate_id || "",
    verdict: OVERALL_STATUS_TO_VERDICT[data.overall_status] ?? "suspicious",
    confidence: Math.round(data.confidence_score * 1000) / 10,
    documentType: data.document_type || "Unknown",
    issuingAuthority: data.issuer_name || "Unknown",
    holderName: data.holder_name || "Unknown",
    issueDate: "—",
    verifiedAt: data.verified_at || "",
    aiSummary: data.ai_summary || "",
    signals: data.signals.map((s) => ({
      id: s.id,
      category: s.category,
      description: s.description,
      status: s.status as SignalStatus,
    })),
    report: {
      summary: data.report.summary,
      riskLevel: data.report.risk_level as RiskLevel,
      riskScore: data.report.risk_score,
      findings: data.report.findings,
      recommendation: data.report.recommendation,
    },
    vendorFindings: data.vendor_findings.map((vf) => ({
      vendor: vf.vendor,
      status: vf.status,
      confidenceScore: vf.confidence_score,
    })),
  };
}

// ── API client ───────────────────────────────────────────────────────────────

const BASE_URL = "/api/v1";

/**
 * Upload a certificate file for verification.
 *
 * @param file  The document selected by the user.
 * @returns     A fully-mapped VerificationResult ready for the UI.
 * @throws      An Error whose message is safe to surface to the user.
 */
export async function verifyDocument(file: File): Promise<VerificationResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("holder_name", "Unknown");
  body.append("issuer_name", "Unknown");
  body.append("document_type", "academic_certificate");

  const response = await fetch(`${BASE_URL}/certificates/verify`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      (payload as { message?: string; detail?: string }).message ??
      (payload as { message?: string; detail?: string }).detail ??
      `Server error ${response.status}`;
    throw new Error(message);
  }

  const data: ApiResponse = await response.json();
  return mapApiResponse(data);
}
