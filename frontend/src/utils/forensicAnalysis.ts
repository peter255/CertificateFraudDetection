/**
 * Transforms engine technical payloads into executive forensic cards.
 * Never invents findings — missing evidence yields "Not provided by the verification engine."
 * Never exposes internal engine / module / vendor field names in card copy.
 */

import type {
  AiDetection,
  EngineTechnicalDetails,
  VerificationResult,
} from "../types/verification";
import { UNSUPPORTED_AI_DETECTION } from "./aiDetection";

export const NOT_PROVIDED = "Not provided by the verification engine.";

export type ForensicStatus = "passed" | "warning" | "failed" | "informed" | "unavailable";

export interface ForensicCard {
  id: string;
  title: string;
  description: string;
  status: ForensicStatus;
  finding: string;
  interpretation: string;
  /** Optional highlighted metric (e.g. AI probability). */
  metric?: { label: string; value: string } | null;
}

export interface TimelineStep {
  id: string;
  label: string;
  complete: boolean;
}

export interface ForensicReport {
  cards: ForensicCard[];
  timeline: TimelineStep[];
  hasDeveloperPayload: boolean;
  developerPayload: Record<string, unknown>;
}

type Domain =
  | "structure"
  | "metadata"
  | "ocr"
  | "font"
  | "hidden"
  | "tamper"
  | "ai";

interface ExtractedFinding {
  status: ForensicStatus;
  finding: string;
  interpretation: string;
  metric?: { label: string; value: string } | null;
}

const CARD_COPY: Record<
  Exclude<Domain, "ai">,
  { title: string; description: string; defaultPassInterpretation: string }
> = {
  structure: {
    title: "Document Structure",
    description:
      "Determines whether the document was originally created digitally or produced from a scanned image.",
    defaultPassInterpretation:
      "This document was generated electronically, allowing advanced forensic analysis.",
  },
  metadata: {
    title: "Metadata Integrity",
    description:
      "Inspects embedded metadata including author, creation software, editing software, timestamps, and modification history.",
    defaultPassInterpretation: "The document metadata appears internally consistent.",
  },
  ocr: {
    title: "OCR Verification",
    description:
      "Compares visible document text with extracted machine-readable text.",
    defaultPassInterpretation:
      "The visible document content matches the internal text layer.",
  },
  font: {
    title: "Font Consistency",
    description:
      "Checks embedded fonts for replacements, missing fonts, or suspicious font manipulation.",
    defaultPassInterpretation: "The document typography appears consistent.",
  },
  hidden: {
    title: "Hidden Objects",
    description:
      "Searches for hidden text, hidden layers, invisible objects, and embedded elements.",
    defaultPassInterpretation: "No concealed document content was found.",
  },
  tamper: {
    title: "Tampering Detection",
    description:
      "Analyzes the document for signs of manipulation, including copy-move, object removal, image splicing, region editing, and content replacement.",
    defaultPassInterpretation:
      "The document does not contain visible signs of digital tampering.",
  },
};

const DOMAIN_KEY_PATTERNS: Record<Exclude<Domain, "ai" | "structure">, RegExp> = {
  metadata: /metadata|meta[_-]?data|exif|xmp|author|creator|producer|modif|creation/,
  ocr: /\bocr\b|text[_-]?consist|text[_-]?layer|machine[_-]?readable|visible[_-]?text/,
  font: /font|typograph|typeface|glyph/,
  hidden: /hidden|invisible|overlay|concealed|embedded[_-]?object|steganograph/,
  tamper:
    /tamper|manipulat|copy[_-]?move|clone|splice|removal|ela|jpeg[_-]?ghost|visual[_-]?fraud|forensic|pixel|region[_-]?edit|content[_-]?replac/,
};

const PASS_TOKENS = [
  "pass",
  "passed",
  "ok",
  "clean",
  "none",
  "no issues",
  "no anomalies",
  "consistent",
  "authentic",
  "trusted",
  "valid",
  "success",
  "completed",
  "clear",
];

const WARN_TOKENS = [
  "warn",
  "warning",
  "review",
  "inconclusive",
  "suspicious",
  "uncertain",
  "possible",
  "moderate",
];

const FAIL_TOKENS = [
  "fail",
  "failed",
  "fraud",
  "tamper",
  "anomaly",
  "anomalies",
  "inconsist",
  "mismatch",
  "invalid",
  "reject",
  "critical",
  "high risk",
  "detected",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return (
      v.length === 0 ||
      ["n/a", "na", "none", "null", "undefined", "unknown", "-", "—"].includes(v)
    );
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

function humanizeSafe(raw: string): string {
  return scrubInternalTerms(
    raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Strip developer-only tokens from customer-facing copy. */
function scrubInternalTerms(text: string): string {
  return text
    .replace(/\bsemantic[_\s-]?validation\b/gi, "content validation")
    .replace(/\bclassifier\b/gi, "document assessment")
    .replace(/\bclassification[_\s-]?reason\b/gi, "assessment rationale")
    .replace(/\bdocument[_\s-]?preparation\b/gi, "document preparation")
    .replace(/\bpipeline\b/gi, "analysis process")
    .replace(/\bdecision[_\s-]?stage\b/gi, "assessment stage")
    .replace(/\bengine[_\s-]?results\b/gi, "analysis results")
    .replace(/\banalysis[_\s-]?flow\b/gi, "investigation steps")
    .replace(/\bscan[_\s-]?inference\b/gi, "scan assessment")
    .replace(/\bdeterministic[_\s-]?high[_\s-]?confidence\b/gi, "high confidence")
    .replace(/\bpdf[_\s-]?structure\b/gi, "document structure")
    .replace(/\bborn[_\s-]?digital[_\s-]?pdf\b/gi, "born digital PDF")
    .replace(/\bfield[_\s-]?level[_\s-]?evidence\b/gi, "field evidence")
    .replace(/\bvisual[_\s-]?evidence\b/gi, "visual findings")
    .replace(/\blayer[_\s-]?details\b/gi, "analysis details")
    .replace(/\bc2pa\b/gi, "content credentials")
    .replace(/\bllm[_\s-]?decision[_\s-]?gate\b/gi, "AI assessment gate")
    .replace(/\bllm[_\s-]?report\b/gi, "AI report")
    .replace(/\boverlay[_\s-]?detector\b/gi, "overlay inspection")
    .replace(/\bpaperwork\b/gi, "verification engine")
    .replace(/\btruthscan\b/gi, "verification engine")
    .trim();
}

function normalizeStatusToken(raw: string): ForensicStatus | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (PASS_TOKENS.some((t) => v === t || v.includes(t))) return "passed";
  if (FAIL_TOKENS.some((t) => v === t || v.includes(t))) return "failed";
  if (WARN_TOKENS.some((t) => v === t || v.includes(t))) return "warning";
  return null;
}

function scoreToStatus(score: number): ForensicStatus {
  // Fraud-style subscores: higher = more risk.
  if (score <= 0.15 || (score > 1 && score <= 15)) return "passed";
  if (score <= 0.45 || (score > 1 && score <= 45)) return "warning";
  return "failed";
}

function formatScalar(value: unknown): string | null {
  if (value == null || isBlank(value)) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value <= 1) return `${Math.round(value * 1000) / 10}%`;
    return String(Math.round(value * 10) / 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? humanizeSafe(trimmed) : null;
  }
  return null;
}

interface NodeHit {
  key: string;
  value: unknown;
  path: string;
}

function walkHits(
  node: unknown,
  path: string,
  depth: number,
  out: NodeHit[],
  maxDepth = 5
): void {
  if (depth > maxDepth || node == null) return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkHits(item, `${path}[${i}]`, depth + 1, out, maxDepth));
    return;
  }
  const rec = asRecord(node);
  if (!rec) return;
  for (const [key, value] of Object.entries(rec)) {
    const nextPath = path ? `${path}.${key}` : key;
    out.push({ key, value, path: nextPath });
    if (value && typeof value === "object") {
      walkHits(value, nextPath, depth + 1, out, maxDepth);
    }
  }
}

function collectPools(technical: EngineTechnicalDetails | null | undefined): unknown[] {
  if (!technical) return [];
  return [
    technical.structuralProfile,
    technical.pdfFraudSubscores,
    technical.evidenceGroups,
    technical.engineResults,
    technical.classification,
    technical.layerDetails,
  ].filter((v) => v != null);
}

function matchesDomain(key: string, domain: Exclude<Domain, "ai" | "structure">): boolean {
  return DOMAIN_KEY_PATTERNS[domain].test(key.toLowerCase().replace(/\s+/g, "_"));
}

function extractFromNode(value: unknown, keyHint: string): ExtractedFinding | null {
  if (isBlank(value)) return null;

  if (typeof value === "boolean") {
    const key = keyHint.toLowerCase();
    const negativePolarity =
      /anomal|tamper|inconsist|mismatch|fraud|suspicious|fail|warn|hidden|manipulat|detect/.test(
        key
      );
    const positivePolarity = /consistent|valid|clean|pass|ok|trusted|authentic|intact/.test(key);

    if (negativePolarity) {
      return value
        ? {
            status: "failed",
            finding: `${humanizeSafe(keyHint)} indicated.`,
            interpretation:
              "The verification engine reported a positive risk indicator that warrants review.",
          }
        : {
            status: "passed",
            finding: `No ${humanizeSafe(keyHint).toLowerCase()} reported.`,
            interpretation: "The verification engine did not report concerns for this check.",
          };
    }

    if (positivePolarity) {
      return value
        ? {
            status: "passed",
            finding: `${humanizeSafe(keyHint)} confirmed.`,
            interpretation: "The verification engine reported a clean result for this check.",
          }
        : {
            status: "warning",
            finding: `${humanizeSafe(keyHint)} was not confirmed.`,
            interpretation: "The verification engine recommended additional review for this check.",
          };
    }

    return {
      status: "informed",
      finding: `${humanizeSafe(keyHint)}: ${value ? "Yes" : "No"}`,
      interpretation: "This finding was returned by the verification engine.",
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const status = scoreToStatus(value);
    const display =
      value >= 0 && value <= 1
        ? `${Math.round(value * 1000) / 10}%`
        : String(Math.round(value * 10) / 10);
    if (status === "passed") {
      return {
        status,
        finding: "No significant anomalies detected.",
        interpretation: "The verification engine scored this check within a low-risk range.",
        metric: { label: "Engine indicator", value: display },
      };
    }
    if (status === "warning") {
      return {
        status,
        finding: "Potential inconsistencies were reported.",
        interpretation:
          "The verification engine scored this check in a range that warrants manual review.",
        metric: { label: "Engine indicator", value: display },
      };
    }
    return {
      status,
      finding: "Suspicious indicators were reported.",
      interpretation:
        "The verification engine scored this check in a range associated with elevated risk.",
      metric: { label: "Engine indicator", value: display },
    };
  }

  if (typeof value === "string") {
    const status = normalizeStatusToken(value) ?? "informed";
    const finding = humanizeSafe(value);
    if (status === "passed") {
      return {
        status,
        finding,
        interpretation: "The verification engine reported a clean result for this check.",
      };
    }
    if (status === "failed") {
      return {
        status,
        finding,
        interpretation: "The verification engine reported findings that require investigation.",
      };
    }
    if (status === "warning") {
      return {
        status,
        finding,
        interpretation: "The verification engine recommended additional review for this check.",
      };
    }
    return {
      status: "informed",
      finding,
      interpretation: "This finding was returned by the verification engine.",
    };
  }

  if (Array.isArray(value)) {
    const strings = value
      .map((item) => formatScalar(item))
      .filter((item): item is string => Boolean(item));
    if (strings.length === 0) return null;
    const joined = strings.slice(0, 4).join("; ");
    const blob = strings.join(" ").toLowerCase();
    const status =
      normalizeStatusToken(blob) ??
      (FAIL_TOKENS.some((t) => blob.includes(t))
        ? "failed"
        : WARN_TOKENS.some((t) => blob.includes(t))
          ? "warning"
          : "informed");
    return {
      status,
      finding: joined,
      interpretation:
        status === "passed"
          ? "The verification engine did not report concerning notes for this check."
          : "Review the engine notes carefully as part of the investigation.",
    };
  }

  const rec = asRecord(value);
  if (!rec) return null;

  const statusRaw =
    formatScalar(rec.status) ||
    formatScalar(rec.result) ||
    formatScalar(rec.label) ||
    formatScalar(rec.verdict) ||
    formatScalar(rec.outcome);
  const scoreRaw =
    typeof rec.score === "number"
      ? rec.score
      : typeof rec.value === "number"
        ? rec.value
        : typeof rec.risk === "number"
          ? rec.risk
          : null;
  const detail =
    formatScalar(rec.summary) ||
    formatScalar(rec.message) ||
    formatScalar(rec.description) ||
    formatScalar(rec.detail) ||
    formatScalar(rec.finding) ||
    statusRaw;

  let status: ForensicStatus = "informed";
  if (statusRaw) {
    status = normalizeStatusToken(statusRaw) ?? status;
  } else if (scoreRaw != null) {
    status = scoreToStatus(scoreRaw);
  }

  if (!detail && scoreRaw == null) return null;

  return {
    status,
    finding: detail || "Result recorded by the verification engine.",
    interpretation:
      status === "passed"
        ? "The verification engine reported a clean result for this check."
        : status === "failed"
          ? "The verification engine reported findings that require investigation."
          : status === "warning"
            ? "The verification engine recommended additional review for this check."
            : "This finding was returned by the verification engine.",
    metric:
      scoreRaw != null
        ? {
            label: "Engine indicator",
            value:
              scoreRaw >= 0 && scoreRaw <= 1
                ? `${Math.round(scoreRaw * 1000) / 10}%`
                : String(Math.round(scoreRaw * 10) / 10),
          }
        : null,
  };
}

function findDomainFinding(
  pools: unknown[],
  domain: Exclude<Domain, "ai" | "structure">
): ExtractedFinding | null {
  const hits: NodeHit[] = [];
  for (const pool of pools) walkHits(pool, "", 0, hits);

  const matched = hits.filter((hit) => matchesDomain(hit.key, domain));
  if (matched.length === 0) return null;

  // Prefer direct status/score-like values over deep nested bags.
  const ranked = [...matched].sort((a, b) => {
    const rank = (v: unknown) => {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return 0;
      if (Array.isArray(v)) return 1;
      return 2;
    };
    return rank(a.value) - rank(b.value);
  });

  for (const hit of ranked) {
    const extracted = extractFromNode(hit.value, hit.key);
    if (extracted) return extracted;
  }
  return null;
}

function extractStructure(
  result: VerificationResult,
  pools: unknown[]
): ExtractedFinding | null {
  if (typeof result.isScan === "boolean") {
    if (result.isScan) {
      return {
        status: "informed",
        finding: "Scanned document",
        interpretation:
          "This document appears to originate from a scanned image, which can limit some digital forensic checks.",
      };
    }
    return {
      status: "passed",
      finding: "Born digital document",
      interpretation:
        "This document was generated electronically, allowing advanced forensic analysis.",
    };
  }

  const hits: NodeHit[] = [];
  for (const pool of pools) walkHits(pool, "", 0, hits);

  const structureHit = hits.find((hit) =>
    /born[_-]?digital|is[_-]?scan|pdf[_-]?structure|document[_-]?structure|document[_-]?origin|scan[_-]?type/.test(
      hit.key.toLowerCase()
    )
  );

  if (structureHit) {
    if (typeof structureHit.value === "boolean") {
      if (/scan/.test(structureHit.key.toLowerCase())) {
        return structureHit.value
          ? {
              status: "informed",
              finding: "Scanned document",
              interpretation:
                "This document appears to originate from a scanned image, which can limit some digital forensic checks.",
            }
          : {
              status: "passed",
              finding: "Born digital document",
              interpretation:
                "This document was generated electronically, allowing advanced forensic analysis.",
            };
      }
      if (/born/.test(structureHit.key.toLowerCase())) {
        return structureHit.value
          ? {
              status: "passed",
              finding: "Born digital document",
              interpretation:
                "This document was generated electronically, allowing advanced forensic analysis.",
            }
          : {
              status: "informed",
              finding: "Not born digital",
              interpretation:
                "The verification engine indicated this file was not produced as a native digital document.",
            };
      }
    }
    const extracted = extractFromNode(structureHit.value, structureHit.key);
    if (extracted) return extracted;
  }

  if (result.fileKind) {
    const kind = humanizeSafe(result.fileKind);
    return {
      status: "informed",
      finding: kind,
      interpretation: "The verification engine reported the document file classification above.",
    };
  }

  return null;
}

function extractOcrFromV1(engineResults: Record<string, unknown> | null): ExtractedFinding | null {
  if (!engineResults) return null;
  const label = formatScalar(engineResults.ocr_label);
  const score =
    typeof engineResults.ocr_score === "number" && Number.isFinite(engineResults.ocr_score)
      ? engineResults.ocr_score
      : null;
  if (!label && score == null) return null;

  const status =
    (label && normalizeStatusToken(label)) ||
    (score != null ? scoreToStatus(score) : null) ||
    "informed";

  return {
    status,
    finding: label || "OCR assessment completed.",
    interpretation:
      status === "passed"
        ? "The visible document content matches the internal text layer."
        : status === "failed"
          ? "OCR findings suggest inconsistencies between visible and machine-readable text."
          : "Review the OCR assessment as part of the investigation.",
    metric:
      score != null
        ? {
            label: "OCR indicator",
            value:
              score >= 0 && score <= 1
                ? `${Math.round(score * 1000) / 10}%`
                : String(Math.round(score * 10) / 10),
          }
        : null,
  };
}

function extractMetadataFromV1(
  engineResults: Record<string, unknown> | null
): ExtractedFinding | null {
  if (!engineResults) return null;
  const notes = engineResults.metadata_notes;
  if (!Array.isArray(notes) || notes.length === 0) return null;
  const strings = notes.map((n) => formatScalar(n)).filter((n): n is string => Boolean(n));
  if (strings.length === 0) return null;
  const blob = strings.join(" ").toLowerCase();
  const status =
    normalizeStatusToken(blob) ??
    (FAIL_TOKENS.some((t) => blob.includes(t))
      ? "failed"
      : WARN_TOKENS.some((t) => blob.includes(t))
        ? "warning"
        : "informed");
  return {
    status,
    finding: strings.slice(0, 3).join("; "),
    interpretation:
      status === "failed" || status === "warning"
        ? "Metadata notes from the verification engine indicate possible integrity concerns."
        : status === "passed"
          ? "The document metadata appears internally consistent."
          : "These metadata notes were returned by the verification engine.",
  };
}

function extractAi(aiDetection: AiDetection | null | undefined): ExtractedFinding {
  const detection = aiDetection ?? UNSUPPORTED_AI_DETECTION;
  if (!detection.supported) {
    return {
      status: "unavailable",
      finding: NOT_PROVIDED,
      interpretation:
        "This metric estimates AI involvement only. It does not determine whether the document is authentic.",
      metric: null,
    };
  }

  const probability =
    detection.probability != null && Number.isFinite(detection.probability)
      ? detection.probability
      : null;

  let status: ForensicStatus = "informed";
  if (detection.label === "Likely Human Generated") status = "passed";
  if (detection.label === "Likely AI Generated") status = "warning";

  return {
    status,
    finding: detection.label === "Unknown" ? "AI assessment completed." : detection.label,
    interpretation:
      detection.source === "azure_openai"
        ? "This percentage was estimated by Azure OpenAI when the verification engine did not return a numeric AI probability. It estimates AI involvement only and does not determine authenticity."
        : "This metric estimates AI involvement only. It does not determine whether the document is authentic.",
    metric:
      probability != null
        ? {
            label:
              detection.source === "azure_openai"
                ? "AI Generated Probability (Azure OpenAI)"
                : "AI Generated Probability",
            value: `${Math.round(probability * 10) / 10}%`,
          }
        : { label: "AI Generated Probability", value: NOT_PROVIDED },
  };
}

function unavailableCard(
  id: string,
  title: string,
  description: string
): ForensicCard {
  return {
    id,
    title,
    description,
    status: "unavailable",
    finding: NOT_PROVIDED,
    interpretation:
      "No finding was returned for this inspection area. Absence of data is not evidence of authenticity or fraud.",
    metric: null,
  };
}

function toCard(
  id: Domain,
  title: string,
  description: string,
  extracted: ExtractedFinding | null,
  defaultPassInterpretation: string
): ForensicCard {
  if (!extracted) {
    return unavailableCard(id, title, description);
  }
  return {
    id,
    title,
    description,
    status: extracted.status,
    finding: extracted.finding,
    interpretation:
      extracted.status === "passed" && !extracted.interpretation
        ? defaultPassInterpretation
        : extracted.interpretation,
    metric: extracted.metric ?? null,
  };
}

/** Map internal stage/layer tokens to customer-safe timeline labels. */
function mapTimelineLabel(raw: string): string | null {
  const k = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (!k.trim()) return null;

  if (/upload|ingest|receiv|submit/.test(k)) return "File Uploaded";
  if (/classif|document_type|doc_type|prepare|preparation/.test(k)) return "Document Classified";
  if (/metadata|exif|xmp|provenance/.test(k)) return "Metadata Inspection";
  if (/\bocr\b|text_layer|text_consist/.test(k)) return "OCR Verification";
  if (/\bai\b|llm|generat|c2pa|synthetic/.test(k)) return "AI Inspection";
  if (/tamper|visual|forensic|pixel|manipulat|copy_move|splice|overlay/.test(k)) {
    return "Tampering Detection";
  }
  if (/font|typograph/.test(k)) return "Font Consistency Check";
  if (/hidden|invisible|embed/.test(k)) return "Hidden Content Inspection";
  if (/final|decision|verdict|assess|complet|aggregat|report/.test(k)) {
    return "Final Assessment";
  }

  // Unknown internal tokens are intentionally omitted — never expose them.
  return null;
}

function extractTimelineLabelFromStep(step: Record<string, unknown>): string | null {
  const candidates = [
    step.label,
    step.name,
    step.title,
    step.stage,
    step.layer,
    step.check,
    step.module,
    step.step,
    step.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const mapped = mapTimelineLabel(candidate);
      if (mapped) return mapped;
    }
  }
  return null;
}

export function buildInvestigationTimeline(
  technical: EngineTechnicalDetails | null | undefined,
  hasResult: boolean
): TimelineStep[] {
  const labels: string[] = [];
  const push = (label: string | null) => {
    if (!label) return;
    if (labels.includes(label)) return;
    labels.push(label);
  };

  if (hasResult) push("File Uploaded");

  if (technical?.layersApplied?.length) {
    for (const layer of technical.layersApplied) {
      push(mapTimelineLabel(layer));
    }
  }

  if (technical?.analysisFlow?.length) {
    for (const step of technical.analysisFlow) {
      const rec = asRecord(step);
      if (!rec) continue;
      push(extractTimelineLabelFromStep(rec));
    }
  }

  if (hasResult) push("Final Assessment");

  // Only stages evidenced by the engine (plus upload / final when a result exists).
  // Never invent intermediate inspections that were not reported.
  return labels.map((label, index) => ({
    id: `step-${index}`,
    label,
    complete: true,
  }));
}

function buildDeveloperPayload(
  technical: EngineTechnicalDetails | null | undefined
): Record<string, unknown> {
  if (!technical) return {};
  const payload: Record<string, unknown> = {};
  if (technical.analysisStatus) payload.analysis_status = technical.analysisStatus;
  if (technical.layersApplied?.length) payload.layers_applied = technical.layersApplied;
  if (technical.analysisFlow?.length) payload.analysis_flow = technical.analysisFlow;
  if (technical.evidenceGroups) payload.evidence_groups = technical.evidenceGroups;
  if (technical.engineResults) payload.engine_results = technical.engineResults;
  if (technical.structuralProfile) payload.structural_profile = technical.structuralProfile;
  if (technical.pdfFraudSubscores) payload.pdf_fraud_subscores = technical.pdfFraudSubscores;
  if (technical.classification) payload.classification = technical.classification;
  if (technical.layerDetails) payload.layer_details = technical.layerDetails;
  return payload;
}

export function buildForensicReport(result: VerificationResult): ForensicReport {
  const technical = result.technical;
  const pools = collectPools(technical);
  const engineResults = asRecord(technical?.engineResults);

  const structure = extractStructure(result, pools);
  const metadata =
    findDomainFinding(pools, "metadata") || extractMetadataFromV1(engineResults);
  const ocr = findDomainFinding(pools, "ocr") || extractOcrFromV1(engineResults);
  const font = findDomainFinding(pools, "font");
  const hidden = findDomainFinding(pools, "hidden");
  const tamper = findDomainFinding(pools, "tamper");
  const ai = extractAi(result.aiDetection);

  const cards: ForensicCard[] = [
    toCard(
      "structure",
      CARD_COPY.structure.title,
      CARD_COPY.structure.description,
      structure,
      CARD_COPY.structure.defaultPassInterpretation
    ),
    toCard(
      "metadata",
      CARD_COPY.metadata.title,
      CARD_COPY.metadata.description,
      metadata,
      CARD_COPY.metadata.defaultPassInterpretation
    ),
    toCard(
      "ocr",
      CARD_COPY.ocr.title,
      CARD_COPY.ocr.description,
      ocr,
      CARD_COPY.ocr.defaultPassInterpretation
    ),
    toCard(
      "font",
      CARD_COPY.font.title,
      CARD_COPY.font.description,
      font,
      CARD_COPY.font.defaultPassInterpretation
    ),
    toCard(
      "hidden",
      CARD_COPY.hidden.title,
      CARD_COPY.hidden.description,
      hidden,
      CARD_COPY.hidden.defaultPassInterpretation
    ),
    toCard(
      "tamper",
      CARD_COPY.tamper.title,
      CARD_COPY.tamper.description,
      tamper,
      CARD_COPY.tamper.defaultPassInterpretation
    ),
    {
      id: "ai",
      title: "AI Generated Content",
      description:
        "Estimated probability that Artificial Intelligence tools were involved in generating or modifying the document.",
      status: ai.status,
      finding: ai.finding,
      interpretation: ai.interpretation,
      metric: ai.metric ?? null,
    },
  ];

  const developerPayload = buildDeveloperPayload(technical);

  return {
    cards,
    timeline: buildInvestigationTimeline(technical, true),
    hasDeveloperPayload: Object.keys(developerPayload).length > 0,
    developerPayload,
  };
}

export function forensicStatusStyle(status: ForensicStatus): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "passed":
      return { label: "Passed", color: "#107C10", bg: "#ECFDF5" };
    case "warning":
      return { label: "Review", color: "#D97706", bg: "#FFFBEB" };
    case "failed":
      return { label: "Failed", color: "#C50F1F", bg: "#FEF2F2" };
    case "informed":
      return { label: "Reported", color: "#0078D4", bg: "#EFF6FF" };
    case "unavailable":
    default:
      return { label: "Not provided", color: "#64748B", bg: "#F8FAFC" };
  }
}
