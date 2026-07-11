/**
 * verificationApi — HTTP client for the active verification engine endpoint.
 *
 * Engine selection: VITE_VERIFICATION_ENGINE=v1|v2 (see config/vendors.ts).
 */

import type {
  VerificationResult,
  VerdictType,
  RiskLevel,
  SignalStatus,
  Signal,
  Finding,
} from "../types/verification";
import {
  ACTIVE_ENGINE_DISPLAY_NAME,
  ACTIVE_VERIFICATION_ENGINE,
  VERIFICATION_ENGINE_PATH,
} from "../config/vendors";

// ── Engine V1 response DTO ───────────────────────────────────────────────────

interface EngineV1Signal {
  id: string;
  category: string;
  description: string;
  status: string;
}

interface EngineV1Finding {
  title: string;
  detail: string;
}

interface EngineV1Report {
  summary: string;
  risk_level: string;
  risk_score: number;
  findings: EngineV1Finding[];
  recommendation: string;
}

interface EngineV1ApiResponse {
  vendor: string;
  certificate_id: string;
  job_id: string;
  overall_status: string;
  confidence_score: number;
  final_result: string;
  raw_score: number;
  document_type: string;
  holder_name: string;
  issuer_name: string;
  signals: EngineV1Signal[];
  report: EngineV1Report;
  ai_summary: string;
  verified_at: string;
  duration_ms: number;
}

// ── Engine V2 response DTO ───────────────────────────────────────────────────

interface EngineV2Signal {
  type?: string | null;
  check?: string | null;
  layer?: string | null;
  stage?: string | null;
  engine?: string | null;
  detector?: string | null;
  severity?: string | null;
  confidence?: number | null;
  description?: string | null;
  engine_label?: string | null;
  detector_label?: string | null;
  evidence_class?: string | null;
  id?: string | null;
  bbox?: number[] | null;
  page?: number | null;
  location?: string | null;
  field?: string | null;
  field_label?: string | null;
  fraud_type?: string | null;
  generator?: string | null;
  issuer_name?: string | null;
  extras?: Record<string, unknown>;
}

interface EngineV2Fraud {
  color?: string | null;
  score?: number | null;
  score_100?: number | null;
  types?: string[];
  verdict?: string | null;
  recommendation?: string | null;
}

interface EngineV2ApiResponse {
  vendor: string;
  job_id: string;
  status: string;
  verdict: string;
  fraud_color?: string | null;
  fraud_score?: number | null;
  risk_level?: string | null;
  fraud_types?: string[];
  recommendation?: string | null;
  is_scan?: boolean | null;
  file_kind?: string | null;
  document_type?: string | null;
  fraud?: EngineV2Fraud | null;
  signals?: EngineV2Signal[];
  field_evidence?: EngineV2Signal[];
  analysis_flow?: Array<Record<string, unknown>>;
  engine_scores?: Record<string, unknown>;
  layer_details?: Record<string, unknown>;
  classification?: Record<string, unknown>;
  engine_results?: Record<string, unknown>;
  raw_result?: Record<string, unknown>;
  verified_at: string;
  duration_ms: number;
}

const V1_STATUS_TO_VERDICT: Record<string, VerdictType> = {
  authentic: "authentic",
  fraudulent: "fraudulent",
  inconclusive: "suspicious",
  pending: "suspicious",
};

const V2_VERDICT_MAP: Record<string, VerdictType> = {
  authentic: "authentic",
  suspicious: "suspicious",
  fraudulent: "fraudulent",
};

const V2_RECOMMENDATION_MAP: Record<string, string> = {
  accept: "approve",
  manual_review: "manual_review",
  reject: "reject",
};

function scrubEngineName(text: string): string {
  return text
    .replace(/\bT[\w]*Scan\b/gi, "Verification Engine V1")
    .replace(/\bP[\w]*work(?:\.to)?\b/gi, "Verification Engine V2");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function mapEngineV1Response(data: EngineV1ApiResponse): VerificationResult {
  const summary = scrubEngineName(data.ai_summary || data.report?.summary || "");

  return {
    certificateId: data.certificate_id || "",
    verdict: V1_STATUS_TO_VERDICT[data.overall_status] ?? "suspicious",
    confidence: Math.round(data.confidence_score * 1000) / 10,
    documentType: data.document_type || "Unknown",
    issuingAuthority: data.issuer_name || "Unknown",
    holderName: data.holder_name || "Unknown",
    issueDate: "—",
    verifiedAt: data.verified_at || "",
    aiSummary: summary,
    signals: data.signals.map((s) => ({
      id: s.id,
      category: s.category,
      description: scrubEngineName(s.description),
      status: s.status as SignalStatus,
    })),
    report: {
      summary: scrubEngineName(data.report.summary),
      riskLevel: data.report.risk_level as RiskLevel,
      riskScore: data.report.risk_score,
      findings: data.report.findings.map((f) => ({
        title: f.title,
        detail: scrubEngineName(f.detail),
      })),
      recommendation: data.report.recommendation,
    },
    vendorFindings: [
      {
        vendor: ACTIVE_ENGINE_DISPLAY_NAME,
        status: data.overall_status,
        confidenceScore: data.confidence_score,
      },
    ],
  };
}

function v2SignalStatus(signal: EngineV2Signal): SignalStatus {
  const evidence = (signal.evidence_class || "").toLowerCase();
  const severity = (signal.severity || "").toLowerCase();

  if (evidence === "hard" || evidence === "strong" || severity === "critical" || severity === "high") {
    return "fail";
  }
  if (evidence === "review" || severity === "medium") {
    return "warning";
  }
  if (evidence === "context" || severity === "low") {
    return "warning";
  }
  return "pass";
}

function v2SignalCategory(signal: EngineV2Signal): string {
  const layer = (signal.layer || "").toLowerCase();
  const engine = (signal.engine || "").toLowerCase();
  const detector = (signal.detector || "").toLowerCase();

  if (layer.includes("c2pa") || detector.includes("c2pa") || signal.type?.includes("provenance")) {
    return "Provenance / C2PA";
  }
  if (layer.includes("overlay") || signal.type?.includes("overlap") || signal.type?.includes("copy_move")) {
    return "Visual / Overlay";
  }
  if (layer.includes("llm") || engine.includes("ai_review") || detector.includes("visual_review")) {
    return "AI Review";
  }
  if (layer.includes("exif") || detector.includes("metadata") || layer.includes("metadata")) {
    return "Metadata";
  }
  if (engine.includes("forensic")) return "Forensic";
  if (engine.includes("perceptual")) return "Perceptual";
  if (engine.includes("semantic")) return "Semantic";
  if (signal.field_label || signal.field) return "Field Evidence";

  return (
    signal.engine_label ||
    signal.detector_label ||
    signal.layer ||
    signal.engine ||
    "Engine Signal"
  );
}

function v2SignalDescription(signal: EngineV2Signal): string {
  const parts: string[] = [];

  if (signal.description) parts.push(signal.description);

  const meta: string[] = [];
  if (signal.field_label || signal.field) {
    meta.push(`Field: ${signal.field_label || signal.field}`);
  }
  if (signal.location) meta.push(`Location: ${signal.location}`);
  if (signal.page != null) meta.push(`Page ${signal.page}`);
  if (signal.bbox?.length === 4) {
    meta.push(`BBox [${signal.bbox.join(", ")}]`);
  }
  if (signal.severity) meta.push(`Severity: ${signal.severity}`);
  if (signal.evidence_class) meta.push(`Evidence: ${signal.evidence_class}`);
  if (signal.confidence != null) {
    meta.push(`Confidence: ${Math.round(signal.confidence * 1000) / 10}%`);
  }
  if (signal.fraud_type) meta.push(`Fraud type: ${signal.fraud_type}`);
  if (signal.generator) meta.push(`Generator: ${signal.generator}`);
  if (signal.issuer_name) meta.push(`Issuer: ${signal.issuer_name}`);

  if (meta.length) parts.push(meta.join(" · "));
  return scrubEngineName(parts.filter(Boolean).join(" — ") || "Signal reported by engine.");
}

function mapV2Signals(data: EngineV2ApiResponse): Signal[] {
  const combined = [...(data.signals || []), ...(data.field_evidence || [])];
  const seen = new Set<string>();
  const out: Signal[] = [];

  combined.forEach((signal, index) => {
    const key = signal.id || `${signal.type || "signal"}-${index}-${signal.description || ""}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      id: String(signal.id || index + 1),
      category: v2SignalCategory(signal),
      description: v2SignalDescription(signal),
      status: v2SignalStatus(signal),
    });
  });

  return out;
}

function mapV2Findings(data: EngineV2ApiResponse): Finding[] {
  const findings: Finding[] = [];
  const layerDetails = asRecord(data.layer_details);
  const llmReport = asRecord(layerDetails.llm_report);
  const llmVisual = asRecord(layerDetails.llm_visual);
  const c2pa = asRecord(asRecord(layerDetails.c2pa).metadata ?? layerDetails.c2pa);
  const classification = asRecord(data.classification);
  const fraudTypes = data.fraud_types?.length
    ? data.fraud_types
    : data.fraud?.types || [];

  if (data.verdict || data.recommendation || data.fraud_score != null) {
    const bits = [
      `Verdict: ${data.verdict || "Unknown"}.`,
      data.fraud_score != null ? `Fraud score: ${data.fraud_score}/100.` : "",
      data.fraud_color ? `Traffic light: ${data.fraud_color}.` : "",
      data.recommendation ? `Recommendation: ${data.recommendation}.` : "",
      data.risk_level ? `Risk level: ${data.risk_level}.` : "",
    ].filter(Boolean);
    findings.push({ title: "Decision Summary", detail: bits.join(" ") });
  }

  if (fraudTypes.length) {
    findings.push({
      title: "Fraud Types",
      detail: fraudTypes.map((t) => `• ${t}`).join(" "),
    });
  }

  if (typeof llmReport.executive_summary === "string" && llmReport.executive_summary.trim()) {
    findings.push({
      title: "Executive Summary",
      detail: scrubEngineName(llmReport.executive_summary),
    });
  }
  if (typeof llmReport.detailed_findings === "string" && llmReport.detailed_findings.trim()) {
    findings.push({
      title: "Decision Rationale",
      detail: scrubEngineName(llmReport.detailed_findings),
    });
  }
  const riskFactors = asStringList(llmReport.risk_factors);
  if (riskFactors.length) {
    findings.push({
      title: "Risk Factors",
      detail: riskFactors.map((f) => `• ${f}`).join(" "),
    });
  }
  if (typeof llmReport.tamper_method === "string" && llmReport.tamper_method.trim()) {
    findings.push({
      title: "Tamper Method",
      detail: llmReport.tamper_method,
    });
  }

  if (typeof llmVisual.summary === "string" && llmVisual.summary.trim()) {
    findings.push({
      title: "Visual Assessment",
      detail: scrubEngineName(llmVisual.summary),
    });
  }

  if (Object.keys(c2pa).length) {
    const c2paBits = [
      c2pa.has_c2pa != null ? `C2PA present: ${String(c2pa.has_c2pa)}.` : "",
      c2pa.ai_generated != null ? `AI generated claim: ${String(c2pa.ai_generated)}.` : "",
      typeof c2pa.generator === "string" ? `Generator: ${c2pa.generator}.` : "",
      typeof c2pa.validation_state === "string" ? `Validation: ${c2pa.validation_state}.` : "",
      typeof c2pa.issuer_name === "string" ? `Issuer: ${c2pa.issuer_name}.` : "",
    ].filter(Boolean);
    if (c2paBits.length) {
      findings.push({ title: "Provenance (C2PA)", detail: c2paBits.join(" ") });
    }
  }

  if (data.analysis_flow?.length) {
    const flow = data.analysis_flow
      .map((step) => {
        const label = String(step.label || step.stage || "step");
        const status = step.status ? ` → ${String(step.status)}` : "";
        const reason = step.reason ? ` (${String(step.reason)})` : "";
        return `${label}${status}${reason}`;
      })
      .join(" · ");
    findings.push({ title: "Analysis Pipeline", detail: flow });
  }

  if (data.engine_scores && Object.keys(data.engine_scores).length) {
    const scores = Object.entries(data.engine_scores)
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
      .join(" · ");
    findings.push({ title: "Engine Scores", detail: scores });
  }

  if (Object.keys(classification).length) {
    const classBits = Object.entries(classification)
      .slice(0, 8)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
    if (classBits) {
      findings.push({ title: "Document Classification", detail: classBits });
    }
  }

  if (data.is_scan != null || data.file_kind) {
    findings.push({
      title: "Document Form",
      detail: [
        data.file_kind ? `Kind: ${data.file_kind}.` : "",
        data.is_scan != null ? `Scanned image: ${data.is_scan ? "yes" : "no"}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  const fieldEvidence = data.field_evidence || [];
  if (fieldEvidence.length) {
    const detail = fieldEvidence
      .slice(0, 8)
      .map((s) => {
        const field = s.field_label || s.field || "field";
        const desc = s.description || s.type || "evidence";
        return `• ${field}: ${desc}`;
      })
      .join(" ");
    findings.push({ title: "Field Evidence", detail });
  }

  return findings;
}

function mapEngineV2Response(data: EngineV2ApiResponse): VerificationResult {
  const verdictKey = (data.verdict || data.fraud?.verdict || "").toLowerCase();
  const verdict = V2_VERDICT_MAP[verdictKey] ?? "suspicious";

  const fraudScore =
    data.fraud_score ??
    data.fraud?.score_100 ??
    (data.fraud?.score != null ? data.fraud.score * 100 : null);

  // Authenticity confidence = inverse of fraud severity when available.
  const confidence =
    fraudScore != null
      ? Math.round(Math.min(Math.max(100 - fraudScore, 0), 100) * 10) / 10
      : 50;

  const riskLevel = ((data.risk_level || "").toLowerCase() ||
    (fraudScore != null && fraudScore >= 70
      ? "high"
      : fraudScore != null && fraudScore >= 35
        ? "medium"
        : "low")) as RiskLevel;

  const recommendationRaw = (
    data.recommendation ||
    data.fraud?.recommendation ||
    ""
  ).toLowerCase();
  const recommendation =
    V2_RECOMMENDATION_MAP[recommendationRaw] || recommendationRaw || "manual_review";

  const layerDetails = asRecord(data.layer_details);
  const llmReport = asRecord(layerDetails.llm_report);
  const signals = mapV2Signals(data);
  const findings = mapV2Findings(data);

  const summaryParts = [
    typeof llmReport.executive_summary === "string" ? llmReport.executive_summary : "",
    `Verification Engine V2 classified this document as ${data.verdict || "Unknown"}` +
      (fraudScore != null ? ` (fraud score ${fraudScore}/100).` : "."),
    data.recommendation ? `Recommendation: ${data.recommendation}.` : "",
    fraudTypesSummary(data),
  ].filter(Boolean);

  const summary = scrubEngineName(summaryParts.join(" "));

  const classification = asRecord(data.classification);
  const documentType =
    data.document_type ||
    (typeof classification.document_type === "string" ? classification.document_type : null) ||
    (typeof classification.detected_document_type === "string"
      ? classification.detected_document_type
      : null) ||
    "Unknown";

  return {
    certificateId: data.job_id || "",
    verdict,
    confidence,
    documentType: String(documentType).replace(/_/g, " "),
    issuingAuthority: "Unknown",
    holderName: "Unknown",
    issueDate: "—",
    verifiedAt: data.verified_at || "",
    aiSummary: summary,
    signals,
    report: {
      summary,
      riskLevel,
      riskScore: fraudScore != null ? Math.round(fraudScore) : riskLevel === "high" ? 85 : riskLevel === "medium" ? 50 : 15,
      findings,
      recommendation,
    },
    vendorFindings: [
      {
        vendor: ACTIVE_ENGINE_DISPLAY_NAME,
        status: (data.verdict || verdict).toLowerCase(),
        confidenceScore: confidence / 100,
      },
    ],
  };
}

function fraudTypesSummary(data: EngineV2ApiResponse): string {
  const types = data.fraud_types?.length ? data.fraud_types : data.fraud?.types || [];
  if (!types.length) return "";
  return `Active fraud types: ${types.join(", ")}.`;
}

const BASE_URL = "/api/v1";

/**
 * Upload a certificate file for verification via the configured engine.
 */
export async function verifyDocument(file: File): Promise<VerificationResult> {
  const body = new FormData();
  body.append("file", file);

  if (ACTIVE_VERIFICATION_ENGINE === "v1") {
    body.append("holder_name", "Unknown");
    body.append("issuer_name", "Unknown");
    body.append("document_type", "academic_certificate");
  } else {
    body.append("document_type", "auto");
    body.append("ocr_mode", "auto");
  }

  const response = await fetch(`${BASE_URL}${VERIFICATION_ENGINE_PATH}`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const raw =
      (payload as { message?: string; detail?: string }).message ??
      (payload as { message?: string; detail?: string }).detail ??
      `Server error ${response.status}`;
    throw new Error(scrubEngineName(String(raw)));
  }

  const data = await response.json();

  if (ACTIVE_VERIFICATION_ENGINE === "v1") {
    return mapEngineV1Response(data as EngineV1ApiResponse);
  }

  return mapEngineV2Response(data as EngineV2ApiResponse);
}
