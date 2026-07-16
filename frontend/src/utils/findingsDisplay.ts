/**
 * Shared display helpers for ResultsDashboard and the exported PDF report
 * so both surfaces show the same scores, buckets, and summaries.
 */

import type {
  RiskLevel,
  Signal,
  SignalStatus,
  TamperRegion,
  VerificationResult,
} from "../types/verification";
import { humanizeLabel, sanitizeFindingText } from "./findingLabels";

export type FindingBucket = "text" | "image" | "pdf";

export function bucketForSignal(signal: Signal): FindingBucket {
  const layer = (signal.layer || "").toLowerCase();
  // Prefer explicit engine layer over free-text keyword matching.
  if (
    /pdf|structure|metadata|provenance|c2pa|xmp/.test(layer) ||
    signal.evidenceClass === "pdf_structure"
  ) {
    return "pdf";
  }
  if (/visual|image|overlay|pixel|heatmap|perceptual|forensic|copy.?move/.test(layer)) {
    return "image";
  }
  if (/ocr|text|font|field|typography|llm.?text/.test(layer)) {
    return "text";
  }

  const hay = [
    signal.category,
    signal.layer,
    signal.check,
    signal.detector,
    signal.description,
    signal.evidenceClass,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\bpdf\b|xmp|incremental|embedded.?font|pdf.?structure|provenance|c2pa|\bmetadata\b/.test(
      hay
    )
  ) {
    return "pdf";
  }
  if (
    /\bimage\b|visual|copy.?move|splic|resampl|seal|pixel|heatmap|perceptual/.test(
      hay
    )
  ) {
    // Field/OCR/text cues stay in text even with a weak visual label.
    if (
      /\b(?:ocr|font|text|typography|glyph|field.?valid|holder|issuer|name.?field|date.?field)\b/.test(
        hay
      )
    ) {
      return "text";
    }
    return "image";
  }
  return "text";
}

export function bucketSignals(signals: Signal[]): {
  text: Signal[];
  image: Signal[];
  pdf: Signal[];
} {
  const text: Signal[] = [];
  const image: Signal[] = [];
  const pdf: Signal[] = [];
  for (const s of signals) {
    const b = bucketForSignal(s);
    if (b === "text") text.push(s);
    else if (b === "image") image.push(s);
    else pdf.push(s);
  }
  return { text, image, pdf };
}

export function clampSummary(text: string, maxSentences = 2, maxChars = 280): string {
  let cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length > maxSentences) {
    cleaned = sentences.slice(0, maxSentences).join(" ");
    if (!/[.!?]$/.test(cleaned)) cleaned += ".";
  }

  if (cleaned.length > maxChars) {
    let cut = cleaned.slice(0, maxChars - 1);
    const seps = [". ", "! ", "? ", "; ", ", ", " "];
    for (const sep of seps) {
      const idx = cut.lastIndexOf(sep);
      if (idx >= Math.floor(maxChars * 0.55)) {
        cut = cut.slice(0, idx + (sep.trim() ? 1 : 0));
        break;
      }
    }
    cleaned = cut.replace(/[ ,;]+$/g, "");
    if (!/[.!?]$/.test(cleaned)) cleaned += ".";
  }

  return cleaned;
}

export function buildLocalCategorySummary(
  title: string,
  signals: Signal[]
): string | null {
  const bits = signals
    .map((s) => (s.description || s.check || s.fieldLabel || "").trim())
    .filter(Boolean)
    .map((bit) =>
      bit.length > 90 ? `${bit.slice(0, 89).replace(/[ ,;]+$/g, "")}…` : bit
    )
    .slice(0, 2);
  if (!bits.length) return null;
  if (bits.length === 1) return clampSummary(bits[0]);
  return clampSummary(
    `${title} shows ${signals.length} key issues. ${bits[0]}. ${bits[1]}.`
  );
}

/**
 * Pure evidence-based category score (0–100).
 * No fixed baseline — 0 when there is no suspicious forensic evidence.
 * Scores rise only from actual fail/warning evidence, not from running analysis.
 */
export function categoryRisk(signals: Signal[]): { score: number } {
  if (!signals.length) {
    return { score: 0 };
  }

  let failWeight = 0;
  let warnWeight = 0;
  for (const s of signals) {
    const sev = (s.severity || "").toLowerCase();
    // Informational notes never contribute.
    if (sev === "info") continue;

    // Elevated severity always counts, even if status was mapped to pass.
    if (s.status === "fail" || sev === "critical" || sev === "high") {
      failWeight += sev === "critical" ? 2 : 1.4;
      continue;
    }
    if (s.status === "warning" || sev === "medium" || sev === "warning") {
      warnWeight += 1;
      continue;
    }
    // severity low / status pass → no contribution
  }

  if (failWeight === 0 && warnWeight === 0) {
    return { score: 0 };
  }

  // Evidence-only points — no artificial floor. Caps at 100.
  const points = failWeight * 38 + warnWeight * 20;
  return { score: Math.min(100, Math.round(points)) };
}

function severityToStatus(
  severity: TamperRegion["severity"] | string | null | undefined
): SignalStatus {
  const sev = (severity || "").toLowerCase();
  if (sev === "critical" || sev === "high") return "fail";
  if (sev === "medium" || sev === "warning") return "warning";
  return "pass";
}

/** Convert localized visual regions into signals so Text/Image scores reflect analysis. */
export function signalsFromTamperRegions(regions: TamperRegion[] | undefined | null): Signal[] {
  if (!regions?.length) return [];
  return regions.map((region) => ({
    id: `region-${region.id}`,
    category: region.label || "Visual evidence",
    description: region.description || region.label || "Localized finding",
    status: severityToStatus(region.severity),
    layer: region.layer || "visual",
    severity: region.severity,
    confidence: region.confidence ?? null,
    fieldLabel: region.label,
  }));
}

/**
 * Rule IDs / cues that are informational OCR / metadata / tooling notes —
 * never fraud indicators by themselves (browser/Skia producers included as known).
 */
const PDF_INFO_ONLY_RULES = new Set([
  "ocr_missing_important_fields",
  "pdf_missing_creation_date",
  "pdf_missing_producer",
  "pdf_missing_creator",
  "pdf_unknown_producer",
  "pdf_empty_metadata",
]);

function isPdfInformationalSignal(signal: Signal): boolean {
  const sev = (signal.severity || "").toLowerCase();
  if (sev === "info" || sev === "low") return true;
  if (signal.status === "pass") return true;

  const rule = (signal.check || signal.id || "").toLowerCase();
  for (const id of PDF_INFO_ONLY_RULES) {
    if (rule.includes(id)) return true;
  }

  const hay = [signal.description, signal.fieldLabel, signal.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    /ocr (missing|field extraction)|missing (creation date|producer|creator)|sparse or empty optional|empty pdf metadata|unknown pdf producer|unrecognized pdf producer|metadata limitation|extraction (failure|gaps)|not (a fraud indicator|evidence of manipulation)|document characteristic/.test(
      hay
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Neutral File Structure summary when CLEAN / no forensic indicators.
 * Distinguishes informational document characteristics from manipulation evidence.
 */
export function fileStructureDisplaySummary(
  signals: Signal[],
  fromApi: string | null | undefined,
  opts?: {
    verdict?: VerificationResult["verdict"];
    riskScore?: number;
    fraudScore?: number | null;
  }
): string {
  const forensic = signals.filter((s) => !isPdfInformationalSignal(s));
  const infoOnly = signals.filter((s) => isPdfInformationalSignal(s));
  const cleanOverall =
    opts?.verdict === "authentic" &&
    (opts.riskScore ?? 0) <= 10 &&
    (opts.fraudScore == null || opts.fraudScore <= 10);

  // Language depends on whether forensic evidence exists — not on the display score.
  if (cleanOverall && forensic.length === 0) {
    if (infoOnly.length > 0) {
      const titles = infoOnly
        .map((s) => signalTitle(s))
        .filter(Boolean)
        .slice(0, 3);
      const listed = titles.length ? ` Observed characteristics: ${titles.join("; ")}.` : "";
      return clampSummary(
        "File-structure review found no suspicious forensic indicators of manipulation." +
          listed
      );
    }
    return clampSummary(
      "File-structure review found no suspicious forensic indicators. " +
        "No metadata or structure inconsistencies were identified."
    );
  }

  if (forensic.length === 0) {
    return clampSummary(
      (fromApi || "").trim() ||
        "File-structure review found no suspicious forensic indicators. " +
          "Observed notes reflect routine document characteristics only."
    );
  }

  return clampSummary(
    (fromApi || "").trim() ||
      buildLocalCategorySummary("File structure", forensic) ||
      ""
  );
}

/**
 * File Structure score: evidence-based only (baseline 0).
 * Elevate when multiple independent forensic indicators support suspicion.
 * Align with overall CLEAN verdicts — no invented minimum score.
 */
export function pdfStructureCategoryRisk(
  signals: Signal[],
  opts?: {
    verdict?: VerificationResult["verdict"];
    riskScore?: number;
    fraudScore?: number | null;
  }
): { score: number } {
  const forensic = signals.filter((s) => !isPdfInformationalSignal(s));
  if (!forensic.length) {
    return { score: 0 };
  }

  let fails = 0;
  let warns = 0;
  for (const s of forensic) {
    const sev = (s.severity || "").toLowerCase();
    if (s.status === "fail" || sev === "critical" || sev === "high") {
      fails += 1;
    } else if (s.status === "warning" || sev === "medium" || sev === "warning") {
      warns += 1;
    }
  }

  const independent = fails + warns;
  if (independent === 0) {
    return { score: 0 };
  }

  const base = categoryRisk(forensic).score;

  // A single supportive warning is weak evidence — keep proportional, no floor.
  if (independent === 1 && fails === 0) {
    return { score: Math.min(base, 28) };
  }
  if (independent === 1 && fails > 0) {
    return { score: Math.min(base, 48) };
  }

  const verdict = opts?.verdict;
  const riskScore = opts?.riskScore ?? 0;
  const fraudScore =
    opts?.fraudScore != null && Number.isFinite(opts.fraudScore)
      ? opts.fraudScore
      : null;
  const cleanOverall =
    verdict === "authentic" &&
    riskScore <= 10 &&
    (fraudScore == null || fraudScore <= 10);

  if (cleanOverall) {
    // CLEAN overall → File Structure stays 0 unless multiple strong fails exist.
    if (fails < 2) {
      return { score: 0 };
    }
    return { score: Math.min(base, 40) };
  }

  return { score: base };
}

/** Same overall risk chip as ResultsDashboard (CRITICAL / ELEVATED / LOW). */
export function overallRiskLabel(_level: RiskLevel, score: number): string {
  // Follow the displayed numeric score — avoid CRITICAL with a mid score.
  if (score >= 75) return "CRITICAL";
  if (score >= 40) return "ELEVATED";
  return "LOW";
}

/** Risk chip from an Azure/local numeric category score. */
export function riskUiFromScore(score: number): {
  label: string;
  score: number;
} {
  if (score <= 0) return { label: "LOW RISK", score: 0 };
  if (score >= 55) return { label: "HIGH RISK", score };
  if (score >= 25) return { label: "MEDIUM", score };
  return { label: "LOW RISK", score };
}

/** Same category chip as ResultsDashboard (HIGH RISK / MEDIUM / LOW RISK). */
export function categoryRiskLabel(signals: Signal[]): {
  label: string;
  score: number;
} {
  const { score } = categoryRisk(signals);
  if (score <= 0) {
    return { label: "LOW RISK", score: 0 };
  }
  const fails = signals.filter((s) => {
    if (isPdfInformationalSignal(s)) return false;
    const sev = (s.severity || "").toLowerCase();
    return s.status === "fail" || sev === "critical" || sev === "high";
  }).length;
  const warns = signals.filter((s) => {
    if (isPdfInformationalSignal(s)) return false;
    const sev = (s.severity || "").toLowerCase();
    if (s.status === "fail" || sev === "critical" || sev === "high") return false;
    return s.status === "warning" || sev === "medium" || sev === "warning";
  }).length;
  if (fails > 0 || score >= 55) {
    return { label: "HIGH RISK", score };
  }
  if (warns > 0 || score >= 25) {
    return { label: "MEDIUM", score };
  }
  return { label: "LOW RISK", score };
}

/** File Structure chip — uses multi-indicator scoring. */
export function pdfStructureRiskLabel(
  signals: Signal[],
  opts?: {
    verdict?: VerificationResult["verdict"];
    riskScore?: number;
    fraudScore?: number | null;
  }
): { label: string; score: number } {
  const { score } = pdfStructureCategoryRisk(signals, opts);
  if (score <= 0) return { label: "LOW RISK", score: 0 };
  if (score >= 55) return { label: "HIGH RISK", score };
  if (score >= 25) return { label: "MEDIUM", score };
  return { label: "LOW RISK", score };
}

export function confOf(signal: Signal): number {
  if (signal.confidence != null && Number.isFinite(signal.confidence)) {
    const c = signal.confidence;
    return c <= 1 ? Math.round(c * 100) : Math.round(c);
  }
  if (signal.status === "fail") return 92;
  if (signal.status === "warning") return 71;
  return 88;
}

export function signalTitle(signal: Signal): string {
  const raw = (
    signal.fieldLabel ||
    signal.check ||
    signal.category ||
    signal.detector ||
    "Finding"
  ).trim();
  return humanizeLabel(raw) || raw;
}

export function signalDescription(signal: Signal): string {
  return sanitizeFindingText(signal.description || signal.check || signal.fieldLabel || "") || "";
}

export function verdictFallback(verdict: VerificationResult["verdict"]): string {
  if (verdict === "fraudulent") {
    return "Strong manipulation signals appear across layers.";
  }
  if (verdict === "suspicious") {
    return "Mixed forensic signals leave authenticity uncertain.";
  }
  return "Cross-layer checks support authenticity with no clear manipulation indicators.";
}

/**
 * Fraud Probability fallback when Azure does not return display scores.
 * Keeps coherence with the Decision Engine risk band.
 */
function deriveFraudProbability(
  result: VerificationResult,
  bandRiskScore: number
): number {
  const vendor =
    result.fraudScore != null && Number.isFinite(result.fraudScore)
      ? Math.min(100, Math.max(0, result.fraudScore))
      : null;
  const confidence =
    result.confidence != null && Number.isFinite(result.confidence)
      ? result.confidence
      : 50;

  if (result.verdict === "fraudulent") {
    return Math.round(Math.max(bandRiskScore, vendor ?? confidence));
  }

  if (result.verdict === "suspicious") {
    const intensity = vendor ?? confidence;
    return Math.round((bandRiskScore + intensity) / 2);
  }

  if (vendor != null) {
    return Math.round(Math.min(vendor, 18));
  }
  return Math.round(Math.min(bandRiskScore, 18));
}

/**
 * Scores as shown on the results dashboard.
 * Prefer Azure OpenAI display scores when the backend provides them;
 * otherwise fall back to local evidence formulas.
 */
export function computeAnalysisDisplayScores(result: VerificationResult) {
  const azure = result.displayScores ?? null;
  const bandRiskScore = result.report.riskScore ?? 0;

  const fraudProbability =
    azure?.fraudProbability != null && Number.isFinite(azure.fraudProbability)
      ? Math.round(azure.fraudProbability)
      : deriveFraudProbability(result, bandRiskScore);

  const aiProbability =
    result.aiProbability != null && Number.isFinite(result.aiProbability)
      ? Math.round(result.aiProbability * 10) / 10
      : result.aiDetection?.probability != null &&
          Number.isFinite(result.aiDetection.probability)
        ? Math.round(result.aiDetection.probability * 10) / 10
        : null;

  const regionSignals = signalsFromTamperRegions(result.tamperRegions);
  // Buckets still drive FindingCategory signal lists (manipulation UI).
  const buckets = bucketSignals([...result.signals, ...regionSignals]);

  const localText = categoryRisk(buckets.text).score;
  const localImage = categoryRisk(buckets.image).score;
  const localPdf = pdfStructureCategoryRisk(buckets.pdf, {
    verdict: result.verdict,
    riskScore: bandRiskScore,
    fraudScore:
      result.fraudScore != null && Number.isFinite(result.fraudScore)
        ? result.fraudScore
        : fraudProbability,
  }).score;

  const textScore =
    azure?.textLogicScore != null && Number.isFinite(azure.textLogicScore)
      ? Math.round(azure.textLogicScore)
      : localText;
  const imageScore =
    azure?.imageForensicsScore != null && Number.isFinite(azure.imageForensicsScore)
      ? Math.round(azure.imageForensicsScore)
      : localImage;
  const pdfScore =
    azure?.fileStructureScore != null && Number.isFinite(azure.fileStructureScore)
      ? Math.round(azure.fileStructureScore)
      : localPdf;

  const riskScore =
    azure?.riskScore != null && Number.isFinite(azure.riskScore)
      ? Math.round(azure.riskScore)
      : bandRiskScore;

  return {
    riskScore,
    fraudProbability,
    aiProbability,
    textScore,
    imageScore,
    pdfScore,
    buckets,
    fromAzure: Boolean(azure),
  };
}

export function categorySummaryForReport(
  result: VerificationResult,
  bucket: FindingBucket,
  signals: Signal[]
): string {
  const fromApi =
    bucket === "text"
      ? result.textManipulationSummary
      : bucket === "image"
        ? result.imageManipulationSummary
        : result.pdfStructureSummary;

  if (bucket === "pdf") {
    const scores = computeAnalysisDisplayScores(result);
    return fileStructureDisplaySummary(signals, fromApi, {
      verdict: result.verdict,
      riskScore: scores.riskScore,
      fraudScore: scores.fraudProbability,
    });
  }

  const title =
    bucket === "text"
      ? "Text manipulation"
      : "Image manipulation";

  return clampSummary(
    (fromApi || "").trim() || buildLocalCategorySummary(title, signals) || ""
  );
}
