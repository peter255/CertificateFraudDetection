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

interface EngineV2VisualEvidence {
  title?: string | null;
  type?: string | null;
  field?: string | null;
  field_label?: string | null;
  layer?: string | null;
  location?: string | null;
  severity?: string | null;
  confidence?: number | null;
  description?: string | null;
  page?: number | null;
  bbox?: number[] | null;
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
  executive_summary?: string | null;
  is_scan?: boolean | null;
  file_kind?: string | null;
  document_type?: string | null;
  processing_time?: number | null;
  holder_name?: string | null;
  issuer_name?: string | null;
  issue_date?: string | null;
  fraud?: EngineV2Fraud | null;
  signals?: EngineV2Signal[];
  field_evidence?: EngineV2Signal[];
  visual_evidence?: EngineV2VisualEvidence[];
  analysis_flow?: Array<Record<string, unknown>>;
  layers_applied?: string[];
  engine_scores?: Record<string, unknown>;
  evidence_groups?: Record<string, unknown>;
  layer_details?: Record<string, unknown>;
  classification?: Record<string, unknown>;
  engine_results?: Record<string, unknown>;
  structural_profile?: Record<string, unknown>;
  pdf_fraud_subscores?: Record<string, unknown>;
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
    .replace(/\bT[\w]*Scan\b/gi, "analysis")
    .replace(/\bP[\w]*work(?:\.to)?\b/gi, "analysis")
    .replace(/\bVerification\s+Engine\s*V?\d*\b/gi, "analysis")
    .replace(/\bLLM\s+trust\s+score\b/gi, "Trust score")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScore(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  if (value && typeof value === "object") {
    const rec = asRecord(value);
    if (typeof rec.score === "number") return formatScore(rec.score);
    if (typeof rec.score_100 === "number") return formatScore(rec.score_100);
  }
  return String(value ?? "—");
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
        vendor: "Analysis",
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

  // Surface visual evidence as signals when they add unique findings.
  (data.visual_evidence || []).forEach((item, index) => {
    const key = `visual-${item.type || "item"}-${item.field || ""}-${item.description || item.title || index}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `visual-${index + 1}`,
      category: "Visual / Overlay",
      description: scrubEngineName(
        [
          item.title || item.type || "Visual evidence",
          item.description,
          item.field_label || item.field ? `Field: ${item.field_label || item.field}` : "",
          item.location ? `Location: ${item.location}` : "",
          item.severity ? `Severity: ${item.severity}` : "",
        ]
          .filter(Boolean)
          .join(" — ")
      ),
      status: v2SignalStatus({
        severity: item.severity,
        evidence_class: "review",
      }),
    });
  });

  return out;
}

const FRAUD_TYPE_MEANING: Record<string, string> = {
  invalid_provenance: "Document credentials exist but did not validate cleanly",
  ai_generated_provenance: "Signed credentials indicate the file was AI-generated",
  visual_text_overlap: "Text regions overlap — often a sign of pasted-over text",
  visual_copy_move_region: "Repeated image blocks suggest copy-move editing",
  field_validation: "Layout or fields do not match an authentic template",
  llm_visual_hint: "Visual review flagged unusual layout or field anomalies",
};

function explainFraudType(type: string): string {
  const key = type.trim();
  const meaning = FRAUD_TYPE_MEANING[key] || FRAUD_TYPE_MEANING[key.toLowerCase()];
  const label = humanizeKey(key);
  return meaning ? `${label} — ${meaning}` : label;
}

function mapV2Findings(data: EngineV2ApiResponse): Finding[] {
  const findings: Finding[] = [];
  const layerDetails = asRecord(data.layer_details);
  const llmReport = asRecord(layerDetails.llm_report);
  const llmVisual = asRecord(layerDetails.llm_visual);
  const c2pa = asRecord(asRecord(layerDetails.c2pa).metadata ?? layerDetails.c2pa);
  const fraudTypes = data.fraud_types?.length
    ? data.fraud_types
    : data.fraud?.types || [];

  // 1) Why — one explanation only (not duplicated elsewhere).
  const why =
    (typeof llmReport.detailed_findings === "string" && llmReport.detailed_findings.trim()) ||
    (typeof data.executive_summary === "string" && data.executive_summary.trim()) ||
    (typeof llmReport.executive_summary === "string" && llmReport.executive_summary.trim()) ||
    "";
  if (why) {
    findings.push({
      title: "Why this result",
      detail: scrubEngineName(why),
    });
  }

  // 2) Issues detected — fraud types with plain-English meaning.
  if (fraudTypes.length) {
    findings.push({
      title: "Issues detected",
      detail: fraudTypes.map((t) => `• ${explainFraudType(t)}`).join("\n"),
    });
  }

  // 3) Risk factors — short bullets if present.
  const riskFactors = asStringList(llmReport.risk_factors);
  if (riskFactors.length) {
    findings.push({
      title: "Risk factors",
      detail: riskFactors.map((f) => `• ${f}`).join("\n"),
    });
  }

  if (typeof llmReport.tamper_method === "string" && llmReport.tamper_method.trim()) {
    const method = llmReport.tamper_method.trim();
    if (!["null", "none", "n/a", "na", "unknown", "undefined"].includes(method.toLowerCase())) {
      findings.push({
        title: "Likely tamper method",
        detail: humanizeKey(method),
      });
    }
  }

  // 4) Concrete evidence rows (visual + field), deduped by description.
  const evidenceLines: string[] = [];
  const seenEvidence = new Set<string>();

  const pushEvidence = (line: string) => {
    const key = line.toLowerCase();
    if (!line.trim() || seenEvidence.has(key)) return;
    seenEvidence.add(key);
    evidenceLines.push(`• ${line.trim()}`);
  };

  const visualFindings = Array.isArray(llmVisual.findings) ? llmVisual.findings : [];
  for (const item of visualFindings.slice(0, 8)) {
    const rec = asRecord(item);
    const check = typeof rec.check === "string" ? humanizeKey(rec.check) : "Visual check";
    const field =
      typeof rec.field === "string" && rec.field && rec.field !== "null"
        ? humanizeKey(rec.field)
        : "";
    const body =
      (typeof rec.detail === "string" && rec.detail) ||
      (typeof rec.description === "string" && rec.description) ||
      "";
    const severity = typeof rec.severity === "string" ? rec.severity : "";
    const result = typeof rec.result === "string" ? rec.result : "";
    pushEvidence(
      [
        check,
        field ? `(${field})` : "",
        severity ? `[${severity}]` : "",
        result ? `→ ${result}` : "",
        body ? `: ${body}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  for (const s of (data.field_evidence || []).slice(0, 8)) {
    const field = s.field_label || s.field || "Field";
    const desc = s.description || s.type || "anomaly reported";
    const sev = s.severity ? `[${s.severity}]` : "";
    pushEvidence(`${field} ${sev}: ${desc}`.replace(/\s+/g, " "));
  }

  for (const item of (data.visual_evidence || []).slice(0, 6)) {
    const label = item.title || item.type || "Visual evidence";
    const field = item.field_label || item.field;
    const desc = item.description || item.location || "reported";
    pushEvidence(`${label}${field ? ` (${field})` : ""}: ${desc}`);
  }

  if (evidenceLines.length) {
    findings.push({
      title: "Evidence on the document",
      detail: scrubEngineName(evidenceLines.join("\n")),
    });
  }

  // 5) Provenance — only when it adds a clear AI / credential signal.
  const provenanceBits = [
    c2pa.ai_generated === true ? "Credentials claim this file was AI-generated." : "",
    typeof c2pa.generator === "string" && c2pa.generator
      ? `Generator: ${c2pa.generator}.`
      : "",
    typeof c2pa.issuer_name === "string" && c2pa.issuer_name
      ? `Credential issuer: ${c2pa.issuer_name}.`
      : "",
    c2pa.has_c2pa === true && c2pa.ai_generated !== true
      ? "Content credentials are present on this file."
      : "",
  ].filter(Boolean);
  if (provenanceBits.length) {
    findings.push({
      title: "Digital provenance",
      detail: provenanceBits.join(" "),
    });
  }

  // 6) Score breakdown — only engine scores that help explain severity.
  if (data.engine_scores && Object.keys(data.engine_scores).length) {
    const scores = Object.entries(data.engine_scores)
      .map(([key, value]) => `${humanizeKey(key)}: ${formatScore(value)}`)
      .join(" · ");
    findings.push({
      title: "Score breakdown",
      detail: scores,
    });
  }

  return findings;
}

function clampScore100(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 100) * 10) / 10;
}

/**
 * Normalize engine score fields to 0–100.
 * Accepts either a ratio (0–1) or a percent (0–100).
 */
function toScore100(...candidates: Array<number | null | undefined>): number | null {
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    // 0–1 ratio (engine fraud.score style)
    if (n <= 1) return clampScore100(n * 100);
    return clampScore100(n);
  }
  return null;
}

function mapEngineV2Response(data: EngineV2ApiResponse): VerificationResult {
  const verdictKey = (data.verdict || data.fraud?.verdict || "").toLowerCase();
  const verdict = V2_VERDICT_MAP[verdictKey] ?? "suspicious";

  // Prefer explicit 0–100 fields first; fall back to 0–1 ratio.
  const fraudScore = toScore100(
    data.fraud_score,
    data.fraud?.score_100,
    data.fraud?.score
  );

  const layerDetails = asRecord(data.layer_details);
  const llmReport = asRecord(layerDetails.llm_report);
  const trustScore = toScore100(
    typeof llmReport.trust_score === "number" ? llmReport.trust_score : null
  );

  // Prefer trust score when provided (already 0–100)
  const confidence =
    trustScore != null
      ? trustScore
      : fraudScore != null
        ? clampScore100(100 - fraudScore)
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

  const signals = mapV2Signals(data);
  const findings = mapV2Findings(data);

  const execSummary =
    (typeof data.executive_summary === "string" && data.executive_summary.trim()) ||
    (typeof llmReport.executive_summary === "string" && llmReport.executive_summary.trim()) ||
    "";

  // Keep the top summary short — Key Findings carry the detail.
  const summary = scrubEngineName(
    execSummary ||
      `This document was classified as ${data.verdict || "Unknown"}` +
        (fraudScore != null ? ` (fraud score ${fraudScore}/100).` : ".")
  );

  const classification = asRecord(data.classification);
  const documentType =
    data.document_type ||
    (typeof classification.document_type === "string" ? classification.document_type : null) ||
    (typeof classification.detected_document_type === "string"
      ? classification.detected_document_type
      : null) ||
    "Unknown";

  const holderName =
    (typeof data.holder_name === "string" && data.holder_name.trim()) || "Unknown";
  const issuingAuthority =
    (typeof data.issuer_name === "string" && data.issuer_name.trim()) || "Unknown";
  const issueDate =
    (typeof data.issue_date === "string" && data.issue_date.trim()) || "—";

  const riskScore =
    fraudScore != null
      ? Math.round(fraudScore)
      : riskLevel === "high"
        ? 85
        : riskLevel === "medium"
          ? 50
          : 15;

  return {
    certificateId: data.job_id || "",
    verdict,
    confidence,
    documentType: String(documentType).replace(/_/g, " "),
    issuingAuthority,
    holderName,
    issueDate,
    verifiedAt: data.verified_at || "",
    aiSummary: summary,
    signals,
    report: {
      summary,
      riskLevel,
      riskScore,
      findings,
      recommendation,
    },
    vendorFindings: [
      {
        vendor: "Analysis",
        status: (data.verdict || verdict).toLowerCase(),
        confidenceScore: confidence / 100,
      },
    ],
  };
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
