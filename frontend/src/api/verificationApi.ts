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
  AiDetection,
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
import {
  buildAiDetection,
  extractAiFieldsFromPools,
  parseAiClassificationLabel,
} from "../utils/aiDetection";
import {
  interpretBBox,
  type InterpretedBBox,
} from "../utils/localization";
import {
  extractAzureAnalyzeResult,
  remapTamperRegionsToAzureLayout,
} from "../utils/azureLayout";
import {
  humanizeLabel,
  isPlausibleHighlightBox,
  isUsefulHighlightBox,
  normalizeFindingSeverity,
  sanitizeFindingText,
  spatialFindingKey,
  uniqueFindingId,
  bboxIoU,
  bboxMostlyContained,
} from "../utils/findingLabels";

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
  /** Backend-resolved AI probability (0–100), from vendor fields or Azure OpenAI. */
  ai_probability?: number | null;
  ai_probability_source?: "vendor" | "azure_openai" | string | null;
  /** Azure OpenAI plain-English summary of Text Manipulation findings. */
  text_manipulation_summary?: string | null;
  /** Azure OpenAI plain-English summary of Image Manipulation findings. */
  image_manipulation_summary?: string | null;
  pdf_structure_summary?: string | null;
  pdf_structure_findings?: Array<Record<string, unknown>>;
  /** Azure OpenAI dashboard scores (preferred by the results UI). */
  display_risk_score?: number | null;
  fraud_probability?: number | null;
  text_logic_score?: number | null;
  image_forensics_score?: number | null;
  file_structure_score?: number | null;
  vendor_flags?: string[];
  metadata_flags?: string[];
  certificate_flags?: string[];
  file_information?: Record<string, unknown>;
  recommendations?: string[];
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
    /** Vendor warnings (watermark, blur, screen_recapture, …). */
    warnings?: Array<Record<string, unknown>> | null;
    /** Full vendor `/query` JSON preserved by the backend mapper. */
    raw_query_response?: Record<string, unknown> | null;
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
  status?: string | null;
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
  /** Backend-resolved AI probability (0–100), from vendor fields or Azure OpenAI. */
  ai_probability?: number | null;
  ai_probability_source?: "vendor" | "azure_openai" | string | null;
  text_manipulation_summary?: string | null;
  image_manipulation_summary?: string | null;
  pdf_structure_summary?: string | null;
  pdf_structure_findings?: Array<Record<string, unknown>>;
  /** Azure OpenAI dashboard scores (preferred by the results UI). */
  display_risk_score?: number | null;
  fraud_probability?: number | null;
  text_logic_score?: number | null;
  image_forensics_score?: number | null;
  file_structure_score?: number | null;
  vendor_flags?: string[];
  metadata_flags?: string[];
  certificate_flags?: string[];
  file_information?: Record<string, unknown>;
  recommendations?: string[];
}

function mapReportEnrichmentFields(data: {
  vendor_flags?: string[];
  metadata_flags?: string[];
  certificate_flags?: string[];
  file_information?: Record<string, unknown>;
  recommendations?: string[];
}): Pick<
  VerificationResult,
  "vendorFlags" | "metadataFlags" | "certificateFlags" | "fileInformation" | "recommendations"
> {
  const fileInfoRaw = asRecord(data.file_information);
  const numPagesRaw = fileInfoRaw?.num_pages ?? fileInfoRaw?.numPages;
  const numPages =
    typeof numPagesRaw === "number" && Number.isFinite(numPagesRaw) && numPagesRaw > 0
      ? Math.round(numPagesRaw)
      : 1;
  const fileType = optionalString(fileInfoRaw?.file_type ?? fileInfoRaw?.fileType);
  const fileSize = optionalString(fileInfoRaw?.file_size ?? fileInfoRaw?.fileSize);

  return {
    vendorFlags: asStringList(data.vendor_flags),
    metadataFlags: asStringList(data.metadata_flags),
    certificateFlags: asStringList(data.certificate_flags),
    fileInformation:
      fileType || fileSize
        ? {
            fileType: fileType || "—",
            fileSize: fileSize || "—",
            numPages,
          }
        : null,
    recommendations: asStringList(data.recommendations),
  };
}

function optionalScore100(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Map Azure OpenAI dashboard scores from verify API responses. */
function mapAzureDisplayScores(data: {
  display_risk_score?: number | null;
  fraud_probability?: number | null;
  text_logic_score?: number | null;
  image_forensics_score?: number | null;
  file_structure_score?: number | null;
}): VerificationResult["displayScores"] {
  const riskScore = optionalScore100(data.display_risk_score);
  const fraudProbability = optionalScore100(data.fraud_probability);
  const textLogicScore = optionalScore100(data.text_logic_score);
  const imageForensicsScore = optionalScore100(data.image_forensics_score);
  const fileStructureScore = optionalScore100(data.file_structure_score);
  if (
    riskScore == null &&
    fraudProbability == null &&
    textLogicScore == null &&
    imageForensicsScore == null &&
    fileStructureScore == null
  ) {
    return null;
  }
  return {
    riskScore,
    fraudProbability,
    textLogicScore,
    imageForensicsScore,
    fileStructureScore,
  };
}

function mapPdfStructureFindingsToSignals(
  findings: Array<Record<string, unknown>> | undefined | null,
  existing: Signal[] = []
): Signal[] {
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const existingDescriptions = new Set(
    existing
      .map((s) => (s.description || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const existingIds = new Set(existing.map((s) => s.id));
  const existingChecks = new Set(
    existing
      .map((s) => (s.check || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const out: Signal[] = [];
  findings.forEach((item, index) => {
    const description = optionalString(item.description);
    const title = optionalString(item.title);
    const ruleId = optionalString(item.rule_id) || `pdf-structure-${index + 1}`;
    if (!description) return;

    const normalized = description.toLowerCase();
    const prefixed = `pdf structure / metadata: ${normalized}`;
    if (existingDescriptions.has(normalized) || existingDescriptions.has(prefixed)) return;
    if (existingChecks.has(ruleId.toLowerCase())) return;

    const id = `pdf-structure-${ruleId}-${index + 1}`;
    if (existingIds.has(id)) return;

    // Prefer severity for informational findings — never inflate risk from status alone.
    const statusRaw = optionalString(item.status)?.toLowerCase();
    const severity = optionalString(item.severity)?.toLowerCase();
    let status: SignalStatus;
    if (severity === "info" || severity === "low") {
      status = "pass";
    } else if (statusRaw === "pass" || statusRaw === "fail" || statusRaw === "warning") {
      status = statusRaw;
    } else if (severity === "critical" || severity === "high") {
      status = "fail";
    } else if (severity === "warning" || severity === "medium") {
      status = "warning";
    } else {
      status = "pass";
    }

    out.push({
      id,
      category: "PDF Structure",
      description: scrubEngineName(description),
      status,
      check: ruleId,
      layer: "pdf_structure",
      detector: "pdf_structure",
      severity: optionalString(item.severity),
      confidence:
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? item.confidence
          : null,
      fieldLabel: title,
      evidenceClass: "pdf_structure",
      extras: {
        rule_id: ruleId,
        title,
        evidence: item.evidence ?? null,
        recommendation: item.recommendation ?? null,
      },
    });
    existingDescriptions.add(normalized);
  });

  return out;
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
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanizeEngineValue(value: string | null | undefined): string | null {
  const cleaned = optionalString(value);
  if (!cleaned) return null;
  return scrubEngineName(cleaned.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
}

function normalizeNarrative(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function findingsWithoutNarrativeDuplicates(
  findings: Finding[],
  aiSummary: string
): Finding[] {
  const summaryKey = normalizeNarrative(aiSummary);
  return findings.filter((f) => {
    const title = (f.title || "").trim().toLowerCase();
    const detail = normalizeNarrative(f.detail || "");
    if (!title && !detail) return false;
    // Executive Summary owns the narrative — do not repeat it under findings.
    if (summaryKey && detail && detail === summaryKey) return false;
    return true;
  });
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

  // Drop findings that restate the executive summary narrative.
  let findings = findingsWithoutNarrativeDuplicates(
    base.report.findings,
    base.aiSummary
  );

  if (decision.decisionNote) {
    // Decision note is the only "Why this result" — replace any prior copy.
    findings = findings.filter(
      (f) => (f.title || "").trim().toLowerCase() !== "why this result"
    );
    findings.unshift({
      title: "Why this result",
      detail: decision.decisionNote,
    });
  }

  // aiSummary is the single narrative source; report.summary stays empty for display.
  // Model confidence lives only on result.confidence (Overview) — not vendorFindings.
  return {
    ...base,
    verdict: decision.verdict,
    confidence: decision.modelConfidence,
    report: {
      ...base.report,
      summary: "",
      findings,
      riskLevel: decision.riskLevel,
      riskScore: decision.riskScore,
      trustScore: decision.trustScore,
      recommendation: decision.recommendation,
    },
    vendorFindings: base.vendorFindings.map((vf) => ({
      ...vf,
      confidenceScore: null,
      additionalFindings: null,
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
  return humanizeLabel(key) || key;
}

function mapEngineV1Response(data: EngineV1ApiResponse): VerificationResult {
  const analysis = data.analysis || {};
  // Prefer backend Azure OpenAI / flags summary — never recommendation-style narratives.
  const rawSummary =
    data.ai_summary ||
    (typeof analysis.reasoning === "string" && analysis.reasoning.trim()) ||
    data.report?.summary ||
    "";
  const flags = [
    ...(analysis.key_indicators || []),
    ...(analysis.visual_patterns || []),
    ...(analysis.metadata_notes || []),
  ].filter((f): f is string => typeof f === "string" && f.trim().length > 0);
  const summary = scrubEngineName(
    rawSummary && !isRecommendationNarrative(rawSummary)
      ? rawSummary
      : buildFlagsExecutiveSummary(
          analysis.verdict_label || data.overall_status || data.final_result,
          flags,
          null
        )
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

  const aiDetection = resolveV1AiDetection(data, analysis);
  const aiProbability = aiDetection.probability;

  // V1 has no native fraud_score / trust_score — derive from prediction intensity.
  // fraudulent → fraud ≈ confidence in that call; authentic → trust ≈ confidence.
  const rawScore100 = toScore100(
    typeof analysis.raw_score === "number" ? analysis.raw_score : null,
    typeof data.raw_score === "number" ? data.raw_score : null,
    modelConfidence
  );
  const engineRiskScore =
    typeof data.report?.risk_score === "number" && Number.isFinite(data.report.risk_score)
      ? data.report.risk_score
      : null;

  let fraudScore: number | null = null;
  let engineTrustScore: number | null = null;
  if (engineLabel === "fraudulent") {
    fraudScore = rawScore100;
    engineTrustScore = rawScore100 != null ? clampScore100(100 - rawScore100) : null;
  } else if (engineLabel === "authentic") {
    engineTrustScore = rawScore100;
    fraudScore = rawScore100 != null ? clampScore100(100 - rawScore100) : null;
  } else {
    fraudScore = toScore100(engineRiskScore) ?? 50;
    engineTrustScore = clampScore100(100 - fraudScore);
  }

  const engineResults: Record<string, unknown> = {
    ml_score: analysis.ml_score ?? null,
    ml_label: analysis.ml_label ?? null,
    ocr_score: analysis.ocr_score ?? null,
    ocr_label: analysis.ocr_label ?? null,
    metadata_notes: analysis.metadata_notes ?? [],
    key_indicators: analysis.key_indicators ?? [],
    visual_patterns: analysis.visual_patterns ?? [],
    reasoning: analysis.reasoning ?? null,
    heatmap_url: analysis.heatmap_url ?? null,
    analysis_agreement: analysis.analysis_agreement ?? null,
    vendor_recommendations: analysis.vendor_recommendations ?? [],
    verdict_label: analysis.verdict_label ?? null,
    // Vendor Core AI score (`/query.result`) — also exposed as aiDetection.probability.
    raw_score: analysis.raw_score ?? data.raw_score ?? null,
    core_ai_score: analysis.raw_score ?? data.raw_score ?? null,
    detection_step: analysis.detection_step ?? null,
    is_valid: analysis.is_valid ?? null,
    analysis_status: analysisStatus,
    warnings: analysis.warnings ?? null,
    raw_query_response: analysis.raw_query_response ?? null,
    fraud_score: fraudScore,
    trust_score: engineTrustScore,
  };

  const base: VerificationResult = {
    certificateId: data.certificate_id || "",
    verdict: "suspicious",
    confidence: modelConfidence,
    aiProbability,
    aiDetection,
    engineTrustScore,
    documentType: optionalString(data.document_type),
    issuingAuthority: optionalString(data.issuer_name),
    holderName: optionalString(data.holder_name),
    issueDate: null,
    verifiedAt: data.verified_at || "",
    aiSummary: summary,
    textManipulationSummary:
      typeof data.text_manipulation_summary === "string" && data.text_manipulation_summary.trim()
        ? scrubEngineName(data.text_manipulation_summary.trim())
        : null,
    imageManipulationSummary:
      typeof data.image_manipulation_summary === "string" && data.image_manipulation_summary.trim()
        ? scrubEngineName(data.image_manipulation_summary.trim())
        : null,
    pdfStructureSummary:
      typeof data.pdf_structure_summary === "string" && data.pdf_structure_summary.trim()
        ? scrubEngineName(data.pdf_structure_summary.trim())
        : null,
    displayScores: mapAzureDisplayScores(data),
    signals: (() => {
      const mapped = data.signals
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
        }));
      return [...mapped, ...mapPdfStructureFindingsToSignals(data.pdf_structure_findings, mapped)];
    })(),
    report: {
      // Narrative lives only in aiSummary — Executive Summary card.
      summary: "",
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
        // Model confidence → Verification Overview only.
        confidenceScore: null,
        processingResult: humanizeEngineValue(data.final_result) || humanizeEngineValue(analysis.verdict_label),
        additionalFindings: null,
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
    fraudScore,
    fraudColor: null,
    isScan: null,
    fileKind: null,
    technical: {
      ...emptyTechnical(),
      analysisStatus,
      engineResults,
    },
    ...mapReportEnrichmentFields(data),
  };

  return applyUserDecision(base, {
    engine: "v1",
    label: engineLabel,
    modelConfidence,
    rawLabel: data.final_result || data.overall_status,
  });
}

function normalizeSeverity(
  raw: string | null | undefined,
  status?: string | null
): TamperRegion["severity"] {
  return normalizeFindingSeverity(raw, status);
}

/**
 * Gate used by signal filters — true when a 4-tuple looks spatial.
 * Full format resolution happens in resolveBBox() with image dimensions.
 */
function asBBox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const nums = value.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [a, b, c, d] = nums;
  // Accept either xywh (positive size) or xyxy (c>a, d>b).
  if (c > 0 && d > 0 && a >= 0 && b >= 0) return [a, b, c, d];
  if (c > a && d > b && a >= 0 && b >= 0) return [a, b, c - a, d - b];
  return null;
}

function resolveBBox(
  value: unknown,
  imageWidth: number,
  imageHeight: number,
  areaRatio?: number | null
): InterpretedBBox | null {
  return interpretBBox(value, imageWidth, imageHeight, areaRatio);
}

function toConfidenceRatio(value: unknown): number | null {
  const score = toScore100(typeof value === "number" ? value : null);
  if (score == null) return null;
  return score / 100;
}

type TamperRegionInput = {
  id?: string | null;
  label: string;
  description: string;
  severity?: string | null;
  status?: string | null;
  bbox?: number[] | null;
  page?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  location?: string | null;
  layer?: string | null;
  confidence?: number | null;
  bboxSource?: string | null;
  bboxAreaRatio?: number | null;
  hasImage?: boolean | null;
  hasCropImage?: boolean | null;
  extras?: Record<string, unknown> | null;
};

/**
 * Pull spatial candidates from nested engine sections that are allowed to
 * create visual findings. Items without a real bbox are skipped — never invented.
 */
function harvestNestedSpatialCandidates(
  data: EngineV2ApiResponse
): TamperRegionInput[] {
  const out: TamperRegionInput[] = [];

  const pushRecord = (
    raw: Record<string, unknown>,
    fallbackId: string,
    fallbackLabel: string
  ) => {
    const bboxRaw = raw.bbox ?? raw.bounding_box ?? raw.box;
    if (!asBBox(bboxRaw)) return;

    const label =
      humanizeLabel(
        (typeof raw.title === "string" && raw.title) ||
          (typeof raw.field_label === "string" && raw.field_label) ||
          (typeof raw.field === "string" && raw.field) ||
          (typeof raw.type === "string" && raw.type) ||
          (typeof raw.check === "string" && raw.check) ||
          fallbackLabel
      ) || fallbackLabel;
    const description =
      sanitizeFindingText(
        (typeof raw.description === "string" && raw.description) ||
          (typeof raw.detail === "string" && raw.detail) ||
          label
      ) || label;

    out.push({
      id: (typeof raw.id === "string" && raw.id) || fallbackId,
      label,
      description,
      severity: typeof raw.severity === "string" ? raw.severity : null,
      status: typeof raw.status === "string" ? raw.status : null,
      bbox: Array.isArray(bboxRaw) ? (bboxRaw as number[]) : null,
      page: typeof raw.page === "number" ? raw.page : null,
      imageWidth:
        typeof raw.image_width === "number"
          ? raw.image_width
          : typeof raw.imageWidth === "number"
            ? raw.imageWidth
            : null,
      imageHeight:
        typeof raw.image_height === "number"
          ? raw.image_height
          : typeof raw.imageHeight === "number"
            ? raw.imageHeight
            : null,
      location: typeof raw.location === "string" ? raw.location : null,
      layer: typeof raw.layer === "string" ? raw.layer : null,
      confidence: typeof raw.confidence === "number" ? raw.confidence : null,
      bboxSource:
        typeof raw.bbox_source === "string"
          ? raw.bbox_source
          : typeof raw.bboxSource === "string"
            ? raw.bboxSource
            : null,
      bboxAreaRatio:
        typeof raw.bbox_area_ratio === "number"
          ? raw.bbox_area_ratio
          : typeof raw.bboxAreaRatio === "number"
            ? raw.bboxAreaRatio
            : null,
      hasImage: null,
      hasCropImage: null,
      extras: raw,
    });
  };

  const pushList = (
    list: unknown,
    idPrefix: string,
    fallbackLabel: string
  ) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      pushRecord(
        item as Record<string, unknown>,
        `${idPrefix}-${index}`,
        fallbackLabel
      );
    });
  };

  // Top-level scored_signals (when present and not already folded into signals)
  pushList(
    (data as EngineV2ApiResponse & { scored_signals?: unknown }).scored_signals,
    "scored",
    "Scored signal"
  );

  const layer = asRecord(data.layer_details);
  const overlay = asRecord(layer.overlay_detector);
  pushList(overlay.signals, "overlay", "Overlay signal");
  pushList(overlay.scored_signals, "overlay-scored", "Overlay signal");

  const llmVisual = asRecord(layer.llm_visual);
  pushList(llmVisual.findings, "llm-visual", "Visual finding");

  // Also check raw_result nesting when the vendor kept the original tree
  const raw = asRecord(data.raw_result);
  const rawLayer = asRecord(raw.layer_details);
  if (Object.keys(rawLayer).length) {
    const rawOverlay = asRecord(rawLayer.overlay_detector);
    pushList(rawOverlay.signals, "raw-overlay", "Overlay signal");
    pushList(rawOverlay.scored_signals, "raw-overlay-scored", "Overlay signal");
    const rawLlm = asRecord(rawLayer.llm_visual);
    pushList(rawLlm.findings, "raw-llm-visual", "Visual finding");
  }
  pushList(raw.scored_signals, "raw-scored", "Scored signal");

  return out;
}

function mapTamperRegions(data: EngineV2ApiResponse): TamperRegion[] {
  const candidates: TamperRegionInput[] = [];

  for (const signal of [...(data.signals || []), ...(data.field_evidence || [])]) {
    const label = humanizeLabel(
      signal.field_label ||
        signal.field ||
        signal.type ||
        signal.check ||
        "Anomaly"
    ) || "Anomaly";
    const description =
      sanitizeFindingText(signal.description || signal.type || label) || label;
    const parent = {
      id: signal.id,
      label,
      description,
      severity: signal.severity,
      status: signal.status,
      page: signal.page,
      imageWidth: signal.image_width,
      imageHeight: signal.image_height,
      location: signal.location,
      layer: signal.layer,
      confidence: signal.confidence,
      bboxSource: signal.bbox_source,
    };

    candidates.push({
      ...parent,
      bbox: signal.bbox,
      bboxAreaRatio:
        typeof signal.bbox_area_ratio === "number" ? signal.bbox_area_ratio : null,
      hasImage: null,
      hasCropImage: null,
      extras: signal.extras ?? null,
    });

    // Do not expand related_bboxes into separate findings — they overlap the
    // parent region and make the list / highlight selection confusing.
  }

  for (const item of data.visual_evidence || []) {
    const label =
      humanizeLabel(
        item.title || item.field_label || item.field || item.type || "Visual evidence"
      ) || "Visual evidence";
    candidates.push({
      id: item.type,
      label,
      description:
        sanitizeFindingText(item.description || item.title || label) || label,
      severity: item.severity,
      status: null,
      bbox: item.bbox,
      page: item.page,
      imageWidth: item.image_width,
      imageHeight: item.image_height,
      location: item.location,
      layer: item.layer,
      confidence: item.confidence,
      bboxSource: item.bbox_source,
      bboxAreaRatio: null,
      hasImage: typeof item.has_image === "boolean" ? item.has_image : null,
      hasCropImage: typeof item.has_crop_image === "boolean" ? item.has_crop_image : null,
      extras: item.extras ?? null,
    });
  }

  // Allowed nested sources — only items that already carry a bbox.
  candidates.push(...harvestNestedSpatialCandidates(data));

  const dimsByPage = new Map<number, { w: number; h: number }>();
  for (const input of candidates) {
    const page = input.page && input.page > 0 ? input.page : 1;
    const w = Number(input.imageWidth);
    const h = Number(input.imageHeight);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      dimsByPage.set(page, { w, h });
    }
  }

  const out: TamperRegion[] = [];
  const seen = new Map<string, number>(); // spatial key → index in out
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

  for (const input of candidates) {
    // Require an explicit engine bbox — never invent coordinates.
    if (!asBBox(input.bbox)) continue;

    // Page defaults to 1 only when the engine omitted it (single-page convention).
    // Reject non-positive / non-finite values — never invent a page for multi-page docs.
    const page =
      input.page == null
        ? 1
        : Number.isFinite(input.page) && input.page >= 1
          ? input.page
          : null;
    if (page == null) continue;

    let imageWidth = Number(input.imageWidth);
    let imageHeight = Number(input.imageHeight);
    if (!Number.isFinite(imageWidth) || imageWidth <= 0 || !Number.isFinite(imageHeight) || imageHeight <= 0) {
      const fallback = dimsByPage.get(page);
      if (!fallback) continue;
      imageWidth = fallback.w;
      imageHeight = fallback.h;
    }

    const interpreted = resolveBBox(
      input.bbox,
      imageWidth,
      imageHeight,
      input.bboxAreaRatio
    );
    if (!interpreted) continue;
    const { xywh: bbox, raw, format, ambiguous } = interpreted;

    const label = humanizeLabel(input.label) || "Marked region";
    const description =
      sanitizeFindingText(input.description || label) || label;
    const severity = normalizeSeverity(input.severity, input.status);

    const key = spatialFindingKey(page, bbox);
    const existingIdx = seen.get(key);
    if (existingIdx != null) {
      const existing = out[existingIdx];
      // Keep the stronger severity / richer description; drop the duplicate.
      if (severityRank[severity] < severityRank[existing.severity]) {
        existing.severity = severity;
      }
      if (
        description.length > existing.description.length &&
        description !== label
      ) {
        existing.description = description;
      }
      if (label.length > existing.label.length) {
        existing.label = label;
      }
      continue;
    }

    if (!isPlausibleHighlightBox(bbox, imageWidth, imageHeight)) continue;

    // Merge into a nearby / overlapping finding instead of listing both.
    let merged = false;
    for (let i = 0; i < out.length; i++) {
      const other = out[i];
      if (other.page !== page) continue;
      const iou = bboxIoU(bbox, other.bbox);
      const contained = bboxMostlyContained(bbox, other.bbox);
      if (iou < 0.4 && !contained) continue;

      if (severityRank[severity] < severityRank[other.severity]) {
        other.severity = severity;
      }
      if (description.length > other.description.length && description !== label) {
        other.description = description;
      }
      // Prefer the tighter (smaller) box when one mostly contains the other.
      const areaNew = bbox[2] * bbox[3];
      const areaOld = other.bbox[2] * other.bbox[3];
      if (contained && areaNew < areaOld) {
        other.bbox = bbox;
        other.rawBBox = raw;
        other.bboxFormat = format;
        other.bboxAmbiguous = ambiguous;
        other.id = uniqueFindingId(page, bbox);
      }
      if (label.length > other.label.length) {
        other.label = label;
      }
      merged = true;
      break;
    }
    if (merged) continue;

    seen.set(key, out.length);

    out.push({
      // Always unique — never reuse engine type / signal ids (they collide).
      id: uniqueFindingId(page, bbox),
      label,
      description,
      severity,
      bbox,
      rawBBox: raw,
      bboxFormat: format,
      bboxAmbiguous: ambiguous,
      page,
      imageWidth,
      imageHeight,
      location: optionalString(input.location),
      layer: optionalString(input.layer),
      confidence: toConfidenceRatio(input.confidence),
      bboxSource: optionalString(input.bboxSource),
      hasImage: typeof input.hasImage === "boolean" ? input.hasImage : null,
      hasCropImage: typeof input.hasCropImage === "boolean" ? input.hasCropImage : null,
      extras: null,
    });
  }

  out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return out;
}

function v2SignalStatus(signal: EngineV2Signal): SignalStatus {
  const severity = (signal.severity || "").toLowerCase();
  // Informational / low findings never elevate category risk.
  if (severity === "info" || severity === "low") {
    return "pass";
  }

  // Prefer explicit engine status when present (e.g. PDF structure findings).
  const explicit = (signal as EngineV2Signal & { status?: string | null }).status;
  if (typeof explicit === "string") {
    const s = explicit.trim().toLowerCase();
    if (s === "pass" || s === "fail" || s === "warning") return s;
  }
  const extrasStatus =
    signal.extras && typeof signal.extras === "object"
      ? (signal.extras as Record<string, unknown>).status
      : null;
  if (typeof extrasStatus === "string") {
    const s = extrasStatus.trim().toLowerCase();
    if (s === "pass" || s === "fail" || s === "warning") return s;
  }

  const evidence = (signal.evidence_class || "").toLowerCase();

  if (
    evidence === "hard" ||
    evidence === "strong" ||
    severity === "critical" ||
    severity === "high"
  ) {
    return "fail";
  }
  if (
    evidence === "review" ||
    severity === "medium" ||
    severity === "warning"
  ) {
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
      : "Provenance";
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
  if (engine.includes("semantic")) return "Content Analysis";
  if (layer.includes("llm") || engine.includes("ai_review") || detector.includes("visual_review")) {
    return "AI Review";
  }
  if (signal.field_label || signal.field) return "Field Evidence";

  const label =
    optionalString(signal.engine_label) ||
    optionalString(signal.detector_label) ||
    optionalString(signal.type) ||
    optionalString(signal.check);

  return label ? humanizeKey(label) : "Forensic Indicator";
}

const INTERNAL_LOCATION_HINT = /\bbbox\b|\[|\{|xywh|xyxy/i;

function v2SignalDescription(signal: EngineV2Signal): string {
  const parts: string[] = [];

  const primary = sanitizeFindingText(signal.description);
  if (primary) parts.push(primary);

  const meta: string[] = [];
  const fieldName = humanizeLabel(signal.field_label || signal.field);
  if (fieldName) meta.push(`Field: ${fieldName}`);
  if (signal.location && !INTERNAL_LOCATION_HINT.test(signal.location)) {
    meta.push(`Location: ${sanitizeFindingText(signal.location)}`);
  }
  if (signal.page != null) meta.push(`Page ${signal.page}`);
  if (signal.fraud_type) meta.push(`Fraud type: ${humanizeLabel(signal.fraud_type)}`);
  if (signal.generator) meta.push(`Generator: ${signal.generator}`);
  if (signal.issuer_name) meta.push(`Issuer: ${signal.issuer_name}`);

  if (meta.length) parts.push(meta.filter(Boolean).join(" · "));
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
    fieldLabel: humanizeLabel(signal.field_label || signal.field) || null,
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
    // Never dump raw extras JSON into the customer UI.
    extras: null,
  };
}

function mapV2Signals(data: EngineV2ApiResponse): Signal[] {
  const combined = [...(data.signals || []), ...(data.field_evidence || [])];
  const seen = new Set<string>();
  const out: Signal[] = [];

  combined.forEach((signal, index) => {
    // Keep spatial signals for category risk scoring (Text / Image / File).
    // The Detailed Findings visual panel still draws from tamperRegions only.
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

  // Visual evidence contributes to Image Manipulation risk even when it has a bbox.
  (data.visual_evidence || []).forEach((item, index) => {
    const key = `visual-${item.type || "item"}-${item.field || ""}-${item.description || item.title || index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const description = scrubEngineName(
      [
        humanizeLabel(item.title || item.type || "") || "",
        sanitizeFindingText(item.description),
        item.field_label || item.field
          ? `Field: ${humanizeLabel(item.field_label || item.field)}`
          : "",
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
      }),
      layer: optionalString(item.layer) || "visual",
      severity: optionalString(item.severity),
      confidence:
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? item.confidence
          : null,
      field: optionalString(item.field),
      fieldLabel: humanizeLabel(item.field_label || item.field) || null,
      bboxSource: optionalString(item.bbox_source),
      extras: null,
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

/** Vendor executive_summary often restates recommendations — never show those as the verdict narrative. */
function isRecommendationNarrative(text: string): boolean {
  const lowered = text.toLowerCase();
  return (
    /\bmanual review\b/.test(lowered) ||
    /\brecommend(?:ed|ation|s)?\b/.test(lowered) ||
    /\b(?:approve|reject)\b/.test(lowered) ||
    /\breview is required\b/.test(lowered) ||
    /\breview-level\b/.test(lowered) ||
    /\bautomatic reject\b/.test(lowered) ||
    /\bnext steps?\b/.test(lowered) ||
    /\bsuggested action\b/.test(lowered)
  );
}

function collectV2Flags(data: EngineV2ApiResponse): string[] {
  const layerDetails = asRecord(data.layer_details);
  const llmReport = asRecord(layerDetails.llm_report);
  const flags: string[] = [];
  const push = (value: string | null | undefined) => {
    const trimmed = (value || "").trim();
    if (!trimmed || isRecommendationNarrative(trimmed)) return;
    if (!flags.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      flags.push(trimmed);
    }
  };

  const fraudTypes = data.fraud_types?.length ? data.fraud_types : data.fraud?.types || [];
  for (const type of fraudTypes) {
    push(type);
  }

  for (const factor of asStringList(llmReport.risk_factors)) {
    push(factor);
  }

  for (const signal of data.signals || []) {
    push(
      optionalString(signal.description) ||
        optionalString(signal.fraud_type) ||
        optionalString(signal.check) ||
        optionalString(signal.detector_label)
    );
  }

  return flags;
}

function buildFlagsExecutiveSummary(
  verdict: string | null | undefined,
  flags: string[],
  fraudScore: number | null
): string {
  const verdictLabel = (verdict || "unknown").replace(/_/g, " ");
  const scoreBit =
    fraudScore != null && Number.isFinite(fraudScore) ? ` Fraud score ${fraudScore}/100.` : "";
  if (flags.length > 0) {
    return scrubEngineName(
      `Verification classified this document as ${verdictLabel}.${scoreBit} Detected flags: ${flags.join("; ")}.`
    );
  }
  return scrubEngineName(
    `Verification classified this document as ${verdictLabel}.${scoreBit} No discrete fraud flags were reported.`
  );
}

function mapV2Findings(data: EngineV2ApiResponse): Finding[] {
  const findings: Finding[] = [];
  const layerDetails = asRecord(data.layer_details);
  const llmReport = asRecord(layerDetails.llm_report);
  const c2pa = asRecord(asRecord(layerDetails.c2pa).metadata ?? layerDetails.c2pa);
  const fraudTypes = data.fraud_types?.length
    ? data.fraud_types
    : data.fraud?.types || [];

  // "Why this result" = decision-engine notes only (applyUserDecision).
  // Executive narrative → Executive Summary (aiSummary). Do not inject it here.
  // detailed_findings is a distinct explanation when present and not equal to exec summary.
  const execSummary =
    (typeof data.executive_summary === "string" && data.executive_summary.trim()) ||
    (typeof llmReport.executive_summary === "string" && llmReport.executive_summary.trim()) ||
    "";
  const detailed =
    typeof llmReport.detailed_findings === "string" && llmReport.detailed_findings.trim()
      ? llmReport.detailed_findings.trim()
      : "";
  if (
    detailed &&
    normalizeNarrative(detailed) !== normalizeNarrative(execSummary)
  ) {
    findings.push({
      title: "Why this result",
      detail: scrubEngineName(detailed),
    });
  }

  // Issues detected — fraud types with plain-English meaning.
  if (fraudTypes.length) {
    findings.push({
      title: "Issues detected",
      detail: fraudTypes.map((t) => `• ${explainFraudType(t)}`).join("\n"),
    });
  }

  // Risk factors — short bullets if present.
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

  // Evidence → Forensic Indicators + Document Tamper Map (not Key Findings).
  // Score breakdown / PDF fraud subscores → Technical Analysis / Overview gauges.

  // Provenance — surface explicit C2PA AI / credential signals.
  const provenanceBits = [
    c2pa.ai_generated === true ? "Credentials claim this file was AI-generated." : "",
    c2pa.ai_generated === false && c2pa.has_c2pa === true
      ? "Content credentials are present and do not indicate AI-generated content."
      : "",
    Array.isArray(c2pa.ai_indicators) && c2pa.ai_indicators.length
      ? `AI indicators: ${c2pa.ai_indicators.map(String).join(", ")}.`
      : "",
    typeof c2pa.generator === "string" && c2pa.generator
      ? `Generator: ${c2pa.generator}.`
      : "",
    typeof c2pa.issuer_name === "string" && c2pa.issuer_name
      ? `Credential issuer: ${c2pa.issuer_name}.`
      : "",
    c2pa.has_c2pa === true && c2pa.ai_generated == null
      ? "Content credentials are present on this file."
      : "",
  ].filter(Boolean);
  if (provenanceBits.length) {
    findings.push({
      title: "Digital provenance",
      detail: provenanceBits.join(" "),
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

const ENGINE_TRUST_KEYS = ["trust_score", "trustScore", "document_trust_score"];

/**
 * Engine V1 AI detection — explicit vendor AI fields only.
 *
 * Sources (TruthScan / AI Image Detection API):
 * - `result` / `raw_score` — vendor **"Core AI score"** (0–100 AI detection score).
 *   Documented at detect-image.truthscan.com (`GET /help?format=json`: "Core AI score only")
 *   and in the official AI Image Detection API docs. This is the product's AI score,
 *   not a trust/risk/verdict-derived value.
 * - Named AI probability / boolean keys nested under `analysis` / `raw_query_response`
 * - `final_result` / `verdict_label` / `ml_label` / `ocr_label` when they are explicit
 *   AI classification strings ("AI Generated", "Real", …)
 *
 * Never invents values from trust, risk, or overall authenticity status.
 * Note: V1 `confidence_score` is the same underlying Core AI score scaled to 0–1 for
 * the Decision Engine's model-confidence input — AI Probability reads the raw score.
 */
function resolveV1AiDetection(
  data: EngineV1ApiResponse,
  analysis: NonNullable<EngineV1ApiResponse["analysis"]>
): AiDetection {
  const analysisBag = asRecord(analysis);
  const rawQuery = asRecord(analysis.raw_query_response);
  const extracted = extractAiFieldsFromPools([analysisBag, rawQuery]);

  // Backend-resolved probability (vendor fields or Azure OpenAI fallback).
  let probability = toScore100(
    typeof data.ai_probability === "number" ? data.ai_probability : null
  );
  let source: "vendor" | "azure_openai" | null =
    data.ai_probability_source === "azure_openai"
      ? "azure_openai"
      : data.ai_probability_source === "vendor"
        ? "vendor"
        : null;

  // Vendor Core AI score (`result` → backend `raw_score`). Prefer an explicitly
  // named AI-probability key when present; otherwise use the Core AI score.
  if (probability == null) {
    probability = extracted.probability;
    if (probability != null) source = "vendor";
  }
  if (probability == null) {
    probability = toScore100(
      typeof analysis.raw_score === "number" ? analysis.raw_score : null,
      typeof data.raw_score === "number" ? data.raw_score : null
    );
    if (probability != null) source = "vendor";
  }

  let isAiGenerated = extracted.isAiGenerated;

  if (isAiGenerated == null) {
    isAiGenerated =
      parseAiClassificationLabel(data.final_result) ??
      parseAiClassificationLabel(analysis.verdict_label) ??
      parseAiClassificationLabel(analysis.ml_label) ??
      parseAiClassificationLabel(analysis.ocr_label) ??
      null;
  }

  return buildAiDetection({
    probability,
    isAiGenerated,
    source,
  });
}

/**
 * Engine V2 AI detection — nested named AI fields + explicit provenance flags.
 *
 * Sources (confirmed via live Paperwork status payload + opaque passthrough):
 * - Named AI probability / boolean keys in layer_details, engine_results,
 *   classification, pdf_fraud_subscores, llm_report, engine_scores, raw_result
 * - `layer_details.c2pa.metadata.ai_generated` boolean (always present on live API)
 * - `layer_details.png_ai_metadata` / nested AI-named keys when present
 * - fraud type `ai_generated_provenance` as an explicit AI Yes signal
 *
 * Live audit found **no** numeric `ai_probability` / `ai_score` field — only the
 * C2PA boolean (and optional `ai_indicators` list). Never uses model confidence,
 * trust_score, fraud_score, risk, verdict, or `engine_scores.ai_review`.
 */
function resolveV2AiDetection(data: EngineV2ApiResponse): AiDetection {
  const layerDetails = asRecord(data.layer_details);
  const llmReport = asRecord(layerDetails.llm_report);
  const classification = asRecord(data.classification);
  const engineResults = asRecord(data.engine_results);
  const pdfFraudSubscores = asRecord(data.pdf_fraud_subscores);
  const engineScores = asRecord(data.engine_scores);
  const rawResult = asRecord(data.raw_result);
  const c2pa = asRecord(asRecord(layerDetails.c2pa).metadata ?? layerDetails.c2pa);
  const pngAi = asRecord(
    asRecord(layerDetails.png_ai_metadata).metadata ?? layerDetails.png_ai_metadata
  );

  const extracted = extractAiFieldsFromPools([
    layerDetails,
    engineResults,
    classification,
    pdfFraudSubscores,
    llmReport,
    c2pa,
    pngAi,
    engineScores,
    rawResult,
  ]);

  let probability = toScore100(
    typeof data.ai_probability === "number" ? data.ai_probability : null
  );
  let source: "vendor" | "azure_openai" | null =
    data.ai_probability_source === "azure_openai"
      ? "azure_openai"
      : data.ai_probability_source === "vendor"
        ? "vendor"
        : null;

  if (probability == null) {
    probability = extracted.probability;
    if (probability != null) source = "vendor";
  }

  let isAiGenerated = extracted.isAiGenerated;

  if (isAiGenerated == null && typeof c2pa.ai_generated === "boolean") {
    isAiGenerated = c2pa.ai_generated;
  }

  // Non-empty C2PA AI indicators are an explicit provenance AI signal.
  if (isAiGenerated == null && Array.isArray(c2pa.ai_indicators) && c2pa.ai_indicators.length > 0) {
    isAiGenerated = true;
  }

  if (isAiGenerated == null) {
    const fraudTypes = [
      ...(data.fraud_types || []),
      ...((data.fraud?.types as string[] | undefined) || []),
    ].map((t) => String(t).toLowerCase().trim());
    if (fraudTypes.includes("ai_generated_provenance")) {
      isAiGenerated = true;
    }
  }

  return buildAiDetection({
    probability,
    isAiGenerated,
    source,
  });
}

function findNestedScore(
  pools: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
  depthLimit = 4
): number | null {
  const keySet = new Set(keys.map((k) => k.toLowerCase()));

  const walk = (node: unknown, depth: number): number | null => {
    if (depth > depthLimit || node == null) return null;
    const rec = asRecord(node);
    if (!Object.keys(rec).length) return null;

    for (const [key, value] of Object.entries(rec)) {
      if (keySet.has(key.toLowerCase())) {
        const score = toScore100(typeof value === "number" ? value : null);
        if (score != null) return score;
      }
    }
    for (const value of Object.values(rec)) {
      if (value && typeof value === "object") {
        const nested = walk(value, depth + 1);
        if (nested != null) return nested;
      }
    }
    return null;
  };

  for (const pool of pools) {
    if (!pool) continue;
    const score = walk(pool, 0);
    if (score != null) return score;
  }
  return null;
}

/**
 * Model confidence from prediction strength only — never engine trust_score.
 */
function resolveV2ModelConfidence(
  label: EnginePredictionLabel,
  fraudScore: number | null,
  explicitConfidence: number | null
): number {
  if (explicitConfidence != null && explicitConfidence > 0) {
    return explicitConfidence;
  }

  if (label === "fraudulent") {
    if (fraudScore != null && fraudScore > 0) return fraudScore;
    return DECISION_THRESHOLDS.DEFAULT_MODEL_CONFIDENCE;
  }

  if (label === "authentic") {
    if (fraudScore != null) return clampScore100(100 - fraudScore);
    return DECISION_THRESHOLDS.DEFAULT_MODEL_CONFIDENCE;
  }

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
  const classification = asRecord(data.classification);
  const engineResults = asRecord(data.engine_results);

  const engineTrustScore = findNestedScore(
    [layerDetails, engineResults, classification, llmReport],
    ENGINE_TRUST_KEYS
  );

  // Explicit prediction confidence only — never llm_report.trust_score.
  const explicitConfidence = toScore100(
    typeof llmReport.model_confidence === "number" ? llmReport.model_confidence : null,
    typeof llmReport.confidence === "number" ? llmReport.confidence : null,
    typeof classification.confidence === "number" ? classification.confidence : null,
    typeof classification.model_confidence === "number" ? classification.model_confidence : null
  );

  const modelConfidence = resolveV2ModelConfidence(engineLabel, fraudScore, explicitConfidence);

  const aiDetection = resolveV2AiDetection(data);
  const aiProbability = aiDetection.probability;

  const signals = mapV2Signals(data);
  const findings = mapV2Findings(data);

  const execSummaryRaw =
    (typeof data.executive_summary === "string" && data.executive_summary.trim()) ||
    (typeof llmReport.executive_summary === "string" && llmReport.executive_summary.trim()) ||
    "";
  // Never display recommendation-style vendor narratives in CONSOLIDATED VERDICT.
  const execSummary = isRecommendationNarrative(execSummaryRaw) ? "" : execSummaryRaw;
  const flags = collectV2Flags(data);

  // Prefer Azure/backend flags summary; otherwise build from detected flags.
  const summary = scrubEngineName(
    execSummary ||
      buildFlagsExecutiveSummary(data.verdict || data.fraud?.verdict, flags, fraudScore)
  );

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
    aiProbability,
    aiDetection,
    engineTrustScore,
    documentType: documentType ? String(documentType).replace(/_/g, " ") : null,
    issuingAuthority,
    holderName,
    issueDate,
    verifiedAt: data.verified_at || "",
    aiSummary: summary,
    textManipulationSummary:
      typeof data.text_manipulation_summary === "string" && data.text_manipulation_summary.trim()
        ? scrubEngineName(data.text_manipulation_summary.trim())
        : null,
    imageManipulationSummary:
      typeof data.image_manipulation_summary === "string" && data.image_manipulation_summary.trim()
        ? scrubEngineName(data.image_manipulation_summary.trim())
        : null,
    pdfStructureSummary:
      typeof data.pdf_structure_summary === "string" && data.pdf_structure_summary.trim()
        ? scrubEngineName(data.pdf_structure_summary.trim())
        : null,
    displayScores: mapAzureDisplayScores(data),
    signals: [...signals, ...mapPdfStructureFindingsToSignals(data.pdf_structure_findings, signals)],
    report: {
      // Narrative lives only in aiSummary — Executive Summary card.
      summary: "",
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
        // Model confidence → Verification Overview only.
        confidenceScore: null,
        processingResult:
          humanizeEngineValue(data.verdict) || humanizeEngineValue(data.fraud?.verdict),
        additionalFindings: null,
      },
    ],
    tamperRegions: remapTamperRegionsToAzureLayout(
      mapTamperRegions(data),
      extractAzureAnalyzeResult(
        data.structural_profile,
        technical.structuralProfile,
        data.raw_result,
        data.engine_results,
        data.layer_details
      )
    ).filter((region) => {
      if (region.scope === "document") return true;
      if (region.canHighlight) {
        return isUsefulHighlightBox(region.bbox, region.imageWidth, region.imageHeight);
      }
      // Element without a confident Azure polygon — keep the card, draw nothing.
      return Boolean(region.label?.trim() || region.description?.trim());
    }),
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
    ...mapReportEnrichmentFields(data),
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
