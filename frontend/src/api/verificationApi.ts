/**
 * verificationApi — HTTP client for the active verification engine endpoint.
 *
 * Engine selection: VITE_VERIFICATION_ENGINE=v1|v2 (see config/vendors.ts).
 */

import type {
  VerificationResult,
  SignalStatus,
  Signal,
  Finding,
  TamperRegion,
} from "../types/verification";
import {
  ACTIVE_VERIFICATION_ENGINE,
  VERIFICATION_ENGINE_PATH,
} from "../config/vendors";
import {
  decideUserVerdict,
  DECISION_THRESHOLDS,
  type EnginePredictionLabel,
} from "../decision";

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
  analysis?: {
    heatmap_url?: string | null;
    reasoning?: string;
    key_indicators?: string[];
    visual_patterns?: string[];
    ocr_label?: string | null;
    ocr_score?: number | null;
    ml_label?: string | null;
    ml_score?: number | null;
    metadata_notes?: string[];
    verdict_label?: string;
    analysis_agreement?: string;
    vendor_recommendations?: string[];
    raw_score?: number;
    detection_step?: unknown;
    is_valid?: boolean | null;
    analysis_status?: string;
  };
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
  image_width?: number | null;
  image_height?: number | null;
  bbox_area_ratio?: number | null;
  location?: string | null;
  related_bboxes?: Array<Record<string, unknown>> | null;
  bbox_source?: string | null;
  field?: string | null;
  field_label?: string | null;
  field_fit_score?: number | null;
  field_importance?: number | null;
  field_assignment_source?: string | null;
  field_assignment_confidence?: number | null;
  source?: string | null;
  fraud_type?: string | null;
  score_role?: string | null;
  generator?: string | null;
  issuer_name?: string | null;
  issuer_category?: string | null;
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
  image_width?: number | null;
  image_height?: number | null;
  bbox_source?: string | null;
  has_image?: boolean;
  has_crop_image?: boolean;
  extras?: Record<string, unknown>;
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

function emptyTechnical() {
  return {
    analysisStatus: null as string | null,
    layersApplied: null as string[] | null,
    analysisFlow: null as Array<Record<string, unknown>> | null,
    evidenceGroups: null as Record<string, unknown> | null,
    engineResults: null as Record<string, unknown> | null,
    structuralProfile: null as Record<string, unknown> | null,
    pdfFraudSubscores: null as Record<string, unknown> | null,
    classification: null as Record<string, unknown> | null,
    layerDetails: null as Record<string, unknown> | null,
  };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
  const rec = asRecord(value);
  return Object.keys(rec).length > 0 ? rec : null;
}

function optionalRecordList(value: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const list = value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
  );
  return list.length > 0 ? list : null;
}

function optionalStringList(value: unknown): string[] | null {
  const list = asStringList(value);
  return list.length > 0 ? list : null;
}

const V1_STATUS_TO_PREDICTION: Record<string, EnginePredictionLabel> = {
  authentic: "authentic",
  trusted: "authentic",
  real: "authentic",
  clean: "authentic",
  pass: "authentic",
  fraudulent: "fraudulent",
  forgery: "fraudulent",
  forged: "fraudulent",
  fake: "fraudulent",
  inconclusive: "inconclusive",
  pending: "inconclusive",
};

const V2_VERDICT_TO_PREDICTION: Record<string, EnginePredictionLabel> = {
  authentic: "authentic",
  trusted: "authentic",
  real: "authentic",
  clean: "authentic",
  pass: "authentic",
  low_risk: "authentic",
  suspicious: "suspicious",
  inconclusive: "inconclusive",
  review: "suspicious",
  manual_review: "suspicious",
  fraudulent: "fraudulent",
  forgery: "fraudulent",
  forged: "fraudulent",
  fake: "fraudulent",
  high_risk: "fraudulent",
};

function scrubEngineName(text: string): string {
  return text
    .replace(/\bT[\w]*Scan\b/gi, "engine")
    .replace(/\bP[\w]*work(?:\.to)?\b/gi, "engine")
    .replace(/\bTruth\s*Scan\b/gi, "engine")
    .replace(/\bPaper\s*work(?:\.to)?\b/gi, "engine")
    .replace(/\bLLM\s+trust\s+score\b/gi, "Model confidence")
    .replace(/\bTrust\s+Score\b/gi, "Model Confidence")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanizeEngineValue(value: string | null | undefined): string | null {
  const cleaned = optionalString(value);
  if (!cleaned) return null;
  return scrubEngineName(cleaned.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
}

function collectAdditionalFindings(
  findings: Finding[],
  signals: Signal[]
): string[] | null {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    const title = scrubEngineName(finding.title || "").trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    // Skip decision-engine notes already shown in executive summary.
    if (key === "why this result") continue;
    seen.add(key);
    items.push(title);
    if (items.length >= 6) break;
  }

  if (items.length < 6) {
    for (const signal of signals) {
      const category = scrubEngineName(signal.category || "").trim();
      if (!category) continue;
      const key = category.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(category);
      if (items.length >= 6) break;
    }
  }

  return items.length > 0 ? items : null;
}

function clampScore100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}

function applyUserDecision(
  base: VerificationResult,
  prediction: {
    label: EnginePredictionLabel;
    modelConfidence: number;
    rawLabel?: string;
    engine: "v1" | "v2";
  }
): VerificationResult {
  const decision = decideUserVerdict({
    engine: prediction.engine,
    label: prediction.label,
    modelConfidence: prediction.modelConfidence,
    rawLabel: prediction.rawLabel,
  });

  const findings = [...base.report.findings];
  if (decision.decisionNote) {
    findings.unshift({
      title: "Why this result",
      detail: decision.decisionNote,
    });
  }

  return {
    ...base,
    verdict: decision.verdict,
    /** Model confidence in the engine prediction (0–100). Not document trust. */
    confidence: decision.modelConfidence,
    aiSummary: decision.decisionNote
      ? scrubEngineName(decision.decisionNote)
      : base.aiSummary,
    report: {
      ...base.report,
      summary: decision.decisionNote
        ? scrubEngineName(decision.decisionNote)
        : base.report.summary,
      findings,
      riskLevel: decision.riskLevel,
      riskScore: decision.riskScore,
      trustScore: decision.trustScore,
      recommendation: decision.recommendation,
    },
    vendorFindings: base.vendorFindings.map((vf) => ({
      ...vf,
      confidenceScore:
        typeof decision.modelConfidence === "number"
          ? decision.modelConfidence / 100
          : vf.confidenceScore,
    })),
  };
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
  const analysis = data.analysis || {};
  const summary = scrubEngineName(
    (typeof analysis.reasoning === "string" && analysis.reasoning.trim()) ||
      data.ai_summary ||
      data.report?.summary ||
      ""
  );

  // Prefer curated backend findings; fall back to remapping older shapes.
  const findings = (data.report?.findings || []).map((f) => ({
    title: f.title,
    detail: scrubEngineName(f.detail),
  }));

  const modelConfidence = clampScore100(
    typeof data.confidence_score === "number" ? data.confidence_score * 100 : DECISION_THRESHOLDS.DEFAULT_MODEL_CONFIDENCE
  );

  const engineLabel =
    V1_STATUS_TO_PREDICTION[(data.overall_status || "").toLowerCase().trim()] ?? "inconclusive";

  const analysisStatus = optionalString(analysis.analysis_status);
  const engineVerdictLabel =
    optionalString(analysis.verdict_label) ||
    optionalString(data.final_result) ||
    optionalString(data.overall_status);

  const base: VerificationResult = {
    certificateId: data.certificate_id || "",
    verdict: "suspicious",
    confidence: modelConfidence,
    documentType: optionalString(data.document_type),
    issuingAuthority: optionalString(data.issuer_name),
    holderName: optionalString(data.holder_name),
    issueDate: null,
    verifiedAt: data.verified_at || "",
    aiSummary: summary,
    signals: data.signals
      .filter((s) => {
        const description = (s.description || "").trim().toLowerCase();
        const category = (s.category || "").trim().toLowerCase();
        if (!description && !category) return false;
        if (["pending", "not provided", "not available", "n/a"].includes(description)) return false;
        if (category === "pending") return false;
        return Boolean((s.description || "").trim());
      })
      .map((s) => ({
      id: s.id,
      category: s.category,
      description: scrubEngineName(s.description),
      status: s.status as SignalStatus,
    })),
    report: {
      summary: scrubEngineName(data.report.summary),
      // Placeholder — Decision Engine overwrites risk + recommendation.
      riskLevel: "medium",
      riskScore: 50,
      trustScore: 50,
      findings,
      recommendation: "manual_review",
    },
    vendorFindings: [
      {
        vendor: "Engine V1",
        status: humanizeEngineValue(data.overall_status) || humanizeEngineValue(analysisStatus),
        confidenceScore: Number.isFinite(modelConfidence) ? modelConfidence / 100 : null,
        processingResult: humanizeEngineValue(data.final_result) || humanizeEngineValue(analysis.verdict_label),
        additionalFindings: collectAdditionalFindings(findings, data.signals.map((s) => ({
          id: s.id,
          category: s.category,
          description: scrubEngineName(s.description),
          status: s.status as SignalStatus,
        }))),
      },
    ],
    tamperRegions: [],
    heatmapUrl:
      typeof analysis.heatmap_url === "string" && analysis.heatmap_url.trim()
        ? analysis.heatmap_url.trim()
        : null,
    engineDurationMs:
      typeof data.duration_ms === "number" && Number.isFinite(data.duration_ms)
        ? data.duration_ms
        : null,
    engineVerdictLabel,
    analysisStatus,
    fraudScore: null,
    fraudColor: null,
    isScan: null,
    fileKind: null,
    technical: {
      ...emptyTechnical(),
      analysisStatus,
    },
  };

  return applyUserDecision(base, {
    engine: "v1",
    label: engineLabel,
    modelConfidence,
    rawLabel: data.final_result || data.overall_status,
  });
}

function normalizeSeverity(raw: string | null | undefined): TamperRegion["severity"] {
  const s = (raw || "").toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "low") return "low";
  return "medium";
}

function asBBox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const nums = value.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (nums[2] <= 0 || nums[3] <= 0) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

function mapTamperRegions(data: EngineV2ApiResponse): TamperRegion[] {
  const out: TamperRegion[] = [];
  const seen = new Set<string>();

  const push = (input: {
    id?: string | null;
    label: string;
    description: string;
    severity?: string | null;
    bbox?: number[] | null;
    page?: number | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
    location?: string | null;
    layer?: string | null;
    confidence?: number | null;
    bboxSource?: string | null;
    hasImage?: boolean | null;
    hasCropImage?: boolean | null;
    extras?: Record<string, unknown> | null;
  }) => {
    const bbox = asBBox(input.bbox);
    if (!bbox) return;
    const imageWidth = Number(input.imageWidth);
    const imageHeight = Number(input.imageHeight);
    if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
      return;
    }

    const key = `${input.page || 1}-${bbox.join(",")}-${input.label}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      id: String(input.id || key),
      label: input.label,
      description: scrubEngineName(input.description || input.label),
      severity: normalizeSeverity(input.severity),
      bbox,
      page: input.page && input.page > 0 ? input.page : 1,
      imageWidth,
      imageHeight,
      location: optionalString(input.location),
      layer: optionalString(input.layer),
      confidence:
        typeof input.confidence === "number" && Number.isFinite(input.confidence)
          ? input.confidence
          : null,
      bboxSource: optionalString(input.bboxSource),
      hasImage: typeof input.hasImage === "boolean" ? input.hasImage : null,
      hasCropImage: typeof input.hasCropImage === "boolean" ? input.hasCropImage : null,
      extras: optionalRecord(input.extras),
    });
  };

  for (const signal of [...(data.signals || []), ...(data.field_evidence || [])]) {
    push({
      id: signal.id,
      label:
        signal.field_label ||
        signal.field ||
        signal.type ||
        signal.check ||
        "Anomaly",
      description: signal.description || signal.type || "Tamper indicator",
      severity: signal.severity,
      bbox: signal.bbox,
      page: signal.page,
      imageWidth: signal.image_width,
      imageHeight: signal.image_height,
      location: signal.location,
      layer: signal.layer,
      confidence: signal.confidence,
      bboxSource: signal.bbox_source,
      hasImage: null,
      hasCropImage: null,
      extras: signal.extras ?? null,
    });
  }

  for (const item of data.visual_evidence || []) {
    push({
      id: item.type,
      label: item.title || item.field_label || item.field || item.type || "Visual evidence",
      description: item.description || item.location || item.title || "Visual evidence",
      severity: item.severity,
      bbox: item.bbox,
      page: item.page,
      imageWidth: item.image_width,
      imageHeight: item.image_height,
      location: item.location,
      layer: item.layer,
      confidence: item.confidence,
      bboxSource: item.bbox_source,
      hasImage: typeof item.has_image === "boolean" ? item.has_image : null,
      hasCropImage: typeof item.has_crop_image === "boolean" ? item.has_crop_image : null,
      extras: item.extras ?? null,
    });
  }

  // Prefer higher severity first for legend ordering.
  const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

  // Fill missing canvas size from sibling regions on the same page when possible.
  const dimsByPage = new Map<number, { w: number; h: number }>();
  for (const region of out) {
    dimsByPage.set(region.page, { w: region.imageWidth, h: region.imageHeight });
  }

  // Re-scan sources that lacked dims using page fallbacks — rebuild lightly.
  const withFallback: TamperRegion[] = [...out];
  const tryFallback = (input: {
    id?: string | null;
    label: string;
    description: string;
    severity?: string | null;
    bbox?: number[] | null;
    page?: number | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
    location?: string | null;
    layer?: string | null;
    confidence?: number | null;
    bboxSource?: string | null;
    hasImage?: boolean | null;
    hasCropImage?: boolean | null;
    extras?: Record<string, unknown> | null;
  }) => {
    const bbox = asBBox(input.bbox);
    if (!bbox) return;
    const page = input.page && input.page > 0 ? input.page : 1;
    let imageWidth = Number(input.imageWidth);
    let imageHeight = Number(input.imageHeight);
    if (!Number.isFinite(imageWidth) || imageWidth <= 0 || !Number.isFinite(imageHeight) || imageHeight <= 0) {
      const fallback = dimsByPage.get(page);
      if (!fallback) return;
      imageWidth = fallback.w;
      imageHeight = fallback.h;
    }
    const key = `${page}-${bbox.join(",")}-${input.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    withFallback.push({
      id: String(input.id || key),
      label: input.label,
      description: scrubEngineName(input.description || input.label),
      severity: normalizeSeverity(input.severity),
      bbox,
      page,
      imageWidth,
      imageHeight,
      location: optionalString(input.location),
      layer: optionalString(input.layer),
      confidence:
        typeof input.confidence === "number" && Number.isFinite(input.confidence)
          ? input.confidence
          : null,
      bboxSource: optionalString(input.bboxSource),
      hasImage: typeof input.hasImage === "boolean" ? input.hasImage : null,
      hasCropImage: typeof input.hasCropImage === "boolean" ? input.hasCropImage : null,
      extras: optionalRecord(input.extras),
    });
  };

  for (const item of data.visual_evidence || []) {
    tryFallback({
      id: item.type,
      label: item.title || item.field_label || item.field || item.type || "Visual evidence",
      description: item.description || item.location || item.title || "Visual evidence",
      severity: item.severity,
      bbox: item.bbox,
      page: item.page,
      imageWidth: item.image_width,
      imageHeight: item.image_height,
      location: item.location,
      layer: item.layer,
      confidence: item.confidence,
      bboxSource: item.bbox_source,
      hasImage: typeof item.has_image === "boolean" ? item.has_image : null,
      hasCropImage: typeof item.has_crop_image === "boolean" ? item.has_crop_image : null,
      extras: item.extras ?? null,
    });
  }

  withFallback.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return withFallback;
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
  const type = (signal.type || signal.check || signal.fraud_type || "").toLowerCase();
  const field = (signal.field_label || signal.field || "").toLowerCase();
  const desc = (signal.description || "").toLowerCase();
  const blob = `${layer} ${engine} ${detector} ${type} ${field} ${desc}`;

  if (
    blob.includes("ai_generated") ||
    blob.includes("ai-generated") ||
    blob.includes("generative") ||
    type.includes("ai_gen") ||
    detector.includes("ai_gen")
  ) {
    return "AI Generation";
  }
  if (
    blob.includes("digitally edited") ||
    blob.includes("digital_edit") ||
    blob.includes("photoshop") ||
    type.includes("edit")
  ) {
    return "Digital Editing";
  }
  if (
    blob.includes("copy_move") ||
    blob.includes("clone") ||
    blob.includes("duplicat")
  ) {
    return "Clone Detection";
  }
  if (
    blob.includes("compression") ||
    blob.includes("jpeg_ghost") ||
    blob.includes("ela") ||
    blob.includes("artifact")
  ) {
    return "Compression Artifacts";
  }
  if (blob.includes("signature") || blob.includes("c2pa") || blob.includes("provenance")) {
    return blob.includes("signature") && !blob.includes("c2pa")
      ? "Signature Analysis"
      : "Provenance / C2PA";
  }
  if (blob.includes("font")) return "Font Consistency";
  if (blob.includes("layout") || blob.includes("template") || blob.includes("alignment")) {
    return "Layout Consistency";
  }
  if (blob.includes("ocr") || blob.includes("text_consist")) return "OCR Consistency";
  if (
    blob.includes("overlay") ||
    blob.includes("overlap") ||
    blob.includes("visual") ||
    blob.includes("manipulat")
  ) {
    return "Visual Manipulation";
  }
  if (blob.includes("exif") || blob.includes("metadata")) return "Metadata Integrity";
  if (engine.includes("forensic")) return "Forensic Analysis";
  if (engine.includes("perceptual")) return "Perceptual Analysis";
  if (engine.includes("semantic")) return "Semantic Analysis";
  if (layer.includes("llm") || engine.includes("ai_review") || detector.includes("visual_review")) {
    return "AI Review";
  }
  if (signal.field_label || signal.field) return "Field Evidence";

  const label =
    optionalString(signal.engine_label) ||
    optionalString(signal.detector_label) ||
    optionalString(signal.layer) ||
    optionalString(signal.engine) ||
    optionalString(signal.type) ||
    optionalString(signal.check);

  return label ? humanizeKey(label) : "Forensic Indicator";
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
  if (signal.issuer_category) meta.push(`Issuer category: ${signal.issuer_category}`);
  if (signal.stage) meta.push(`Stage: ${signal.stage}`);
  if (signal.source) meta.push(`Source: ${signal.source}`);
  if (signal.score_role) meta.push(`Score role: ${signal.score_role}`);
  if (signal.bbox_source) meta.push(`BBox source: ${signal.bbox_source}`);
  if (signal.bbox_area_ratio != null) {
    meta.push(`BBox area ratio: ${signal.bbox_area_ratio}`);
  }
  if (signal.field_fit_score != null) meta.push(`Field fit: ${signal.field_fit_score}`);
  if (signal.field_importance != null) {
    meta.push(`Field importance: ${signal.field_importance}`);
  }
  if (signal.field_assignment_source) {
    meta.push(`Field assignment: ${signal.field_assignment_source}`);
  }
  if (signal.field_assignment_confidence != null) {
    meta.push(
      `Assignment confidence: ${Math.round(signal.field_assignment_confidence * 1000) / 10}%`
    );
  }
  if (signal.related_bboxes?.length) {
    meta.push(`Related bboxes: ${signal.related_bboxes.length}`);
  }
  if (signal.extras && Object.keys(signal.extras).length) {
    meta.push(
      Object.entries(signal.extras)
        .map(([k, v]) => `${humanizeKey(k)}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
        .join(" · ")
    );
  }

  if (meta.length) parts.push(meta.join(" · "));
  return scrubEngineName(parts.filter(Boolean).join(" — "));
}

function mapV2SignalFields(signal: EngineV2Signal): Omit<Signal, "id" | "category" | "description" | "status"> {
  return {
    check: optionalString(signal.check),
    layer: optionalString(signal.layer),
    stage: optionalString(signal.stage),
    engine: optionalString(signal.engine_label) || optionalString(signal.engine),
    detector: optionalString(signal.detector_label) || optionalString(signal.detector),
    severity: optionalString(signal.severity),
    confidence:
      typeof signal.confidence === "number" && Number.isFinite(signal.confidence)
        ? signal.confidence
        : null,
    evidenceClass: optionalString(signal.evidence_class),
    field: optionalString(signal.field),
    fieldLabel: optionalString(signal.field_label),
    fraudType: optionalString(signal.fraud_type),
    generator: optionalString(signal.generator),
    issuerName: optionalString(signal.issuer_name),
    issuerCategory: optionalString(signal.issuer_category),
    source: optionalString(signal.source),
    scoreRole: optionalString(signal.score_role),
    bboxSource: optionalString(signal.bbox_source),
    bboxAreaRatio:
      typeof signal.bbox_area_ratio === "number" && Number.isFinite(signal.bbox_area_ratio)
        ? signal.bbox_area_ratio
        : null,
    relatedBboxes: optionalRecordList(signal.related_bboxes),
    fieldFitScore:
      typeof signal.field_fit_score === "number" && Number.isFinite(signal.field_fit_score)
        ? signal.field_fit_score
        : null,
    fieldImportance:
      typeof signal.field_importance === "number" && Number.isFinite(signal.field_importance)
        ? signal.field_importance
        : null,
    fieldAssignmentSource: optionalString(signal.field_assignment_source),
    fieldAssignmentConfidence:
      typeof signal.field_assignment_confidence === "number" &&
      Number.isFinite(signal.field_assignment_confidence)
        ? signal.field_assignment_confidence
        : null,
    extras: optionalRecord(signal.extras),
  };
}

function mapV2Signals(data: EngineV2ApiResponse): Signal[] {
  const combined = [...(data.signals || []), ...(data.field_evidence || [])];
  const seen = new Set<string>();
  const out: Signal[] = [];

  combined.forEach((signal, index) => {
    const key = signal.id || `${signal.type || "signal"}-${index}-${signal.description || ""}`;
    if (seen.has(key)) return;
    seen.add(key);

    const description = v2SignalDescription(signal);
    if (!description.trim()) return;

    out.push({
      id: String(signal.id || index + 1),
      category: v2SignalCategory(signal),
      description,
      status: v2SignalStatus(signal),
      ...mapV2SignalFields(signal),
    });
  });

  // Surface visual evidence as signals when they add unique findings.
  (data.visual_evidence || []).forEach((item, index) => {
    const key = `visual-${item.type || "item"}-${item.field || ""}-${item.description || item.title || index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const description = scrubEngineName(
      [
        item.title || item.type || "",
        item.description,
        item.field_label || item.field ? `Field: ${item.field_label || item.field}` : "",
        item.location ? `Location: ${item.location}` : "",
        item.severity ? `Severity: ${item.severity}` : "",
      ]
        .filter(Boolean)
        .join(" — ")
    );
    if (!description.trim()) return;
    out.push({
      id: `visual-${index + 1}`,
      category: "Visual Manipulation",
      description,
      status: v2SignalStatus({
        severity: item.severity,
        evidence_class: "review",
      }),
      layer: optionalString(item.layer),
      severity: optionalString(item.severity),
      confidence:
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? item.confidence
          : null,
      field: optionalString(item.field),
      fieldLabel: optionalString(item.field_label),
      bboxSource: optionalString(item.bbox_source),
      extras: optionalRecord(item.extras),
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

  if (data.pdf_fraud_subscores && Object.keys(data.pdf_fraud_subscores).length) {
    const scores = Object.entries(data.pdf_fraud_subscores)
      .map(([key, value]) => `${humanizeKey(key)}: ${formatScore(value)}`)
      .join(" · ");
    findings.push({
      title: "PDF fraud subscores",
      detail: scores,
    });
  }

  return findings;
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

function resolveV2ModelConfidence(
  label: EnginePredictionLabel,
  trustScore: number | null,
  fraudScore: number | null
): number {
  // Prefer an explicit positive trust/confidence from the engine.
  if (trustScore != null && trustScore > 0) {
    return trustScore;
  }

  if (label === "fraudulent") {
    // Fraud intensity as confidence in the fraud call — never treat 0 as "sure".
    if (fraudScore != null && fraudScore > 0) return fraudScore;
    return DECISION_THRESHOLDS.DEFAULT_MODEL_CONFIDENCE;
  }

  if (label === "authentic") {
    // Low fraud ⇒ high confidence in authenticity.
    if (fraudScore != null) return clampScore100(100 - fraudScore);
    return DECISION_THRESHOLDS.DEFAULT_MODEL_CONFIDENCE;
  }

  // suspicious / inconclusive — fraud intensity only when > 0; never map 0 → 0%.
  if (fraudScore != null && fraudScore > 0) return fraudScore;
  return DECISION_THRESHOLDS.DEFAULT_MODEL_CONFIDENCE;
}

function mapEngineV2Response(data: EngineV2ApiResponse): VerificationResult {
  const verdictKey = (data.verdict || data.fraud?.verdict || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  const engineLabel = V2_VERDICT_TO_PREDICTION[verdictKey] ?? "inconclusive";

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

  const modelConfidence = resolveV2ModelConfidence(engineLabel, trustScore, fraudScore);

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
    optionalString(data.document_type) ||
    optionalString(classification.document_type) ||
    optionalString(classification.detected_document_type);

  const holderName = optionalString(data.holder_name);
  const issuingAuthority = optionalString(data.issuer_name);
  const issueDate = optionalString(data.issue_date);

  // Prefer processing_time when it looks like seconds; otherwise duration_ms.
  let resolvedDurationMs: number | null = null;
  if (typeof data.processing_time === "number" && Number.isFinite(data.processing_time)) {
    resolvedDurationMs =
      data.processing_time > 0 && data.processing_time < 1000
        ? Math.round(data.processing_time * 1000)
        : Math.round(data.processing_time);
  } else if (typeof data.duration_ms === "number" && Number.isFinite(data.duration_ms)) {
    resolvedDurationMs = data.duration_ms;
  }

  const technical = {
    analysisStatus: null as string | null,
    layersApplied: optionalStringList(data.layers_applied),
    analysisFlow: optionalRecordList(data.analysis_flow),
    evidenceGroups: optionalRecord(data.evidence_groups),
    engineResults: optionalRecord(data.engine_results),
    structuralProfile: optionalRecord(data.structural_profile),
    pdfFraudSubscores: optionalRecord(data.pdf_fraud_subscores),
    classification: optionalRecord(data.classification),
    layerDetails: optionalRecord(data.layer_details),
  };

  const base: VerificationResult = {
    certificateId: data.job_id || "",
    verdict: "suspicious",
    confidence: modelConfidence,
    documentType: documentType ? String(documentType).replace(/_/g, " ") : null,
    issuingAuthority,
    holderName,
    issueDate,
    verifiedAt: data.verified_at || "",
    aiSummary: summary,
    signals,
    report: {
      summary,
      // Placeholder — Decision Engine overwrites risk + recommendation.
      riskLevel: "medium",
      riskScore: 50,
      trustScore: 50,
      findings,
      recommendation: "manual_review",
    },
    vendorFindings: [
      {
        vendor: "Engine V2",
        status: humanizeEngineValue(data.status) || humanizeEngineValue(data.risk_level),
        confidenceScore: Number.isFinite(modelConfidence) ? modelConfidence / 100 : null,
        processingResult:
          humanizeEngineValue(data.verdict) || humanizeEngineValue(data.fraud?.verdict),
        additionalFindings: collectAdditionalFindings(findings, signals),
      },
    ],
    tamperRegions: mapTamperRegions(data),
    heatmapUrl: null,
    engineDurationMs: resolvedDurationMs,
    engineVerdictLabel:
      optionalString(data.verdict) || optionalString(data.fraud?.verdict) || null,
    analysisStatus: null,
    fraudScore,
    fraudColor: optionalString(data.fraud_color) || optionalString(data.fraud?.color),
    isScan: typeof data.is_scan === "boolean" ? data.is_scan : null,
    fileKind: optionalString(data.file_kind),
    technical,
  };

  return applyUserDecision(base, {
    engine: "v2",
    label: engineLabel,
    modelConfidence,
    rawLabel: data.verdict || data.fraud?.verdict || engineLabel,
  });
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
