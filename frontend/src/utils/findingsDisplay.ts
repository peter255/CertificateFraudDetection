/**
 * Shared display helpers for ResultsDashboard and the exported PDF report
 * so both surfaces show the same scores, buckets, and summaries.
 */

import type { Signal, VerificationResult } from "../types/verification";

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

export function clampSummary(text: string, maxSentences = 3, maxChars = 420): string {
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
 * Category risk from engine signal statuses/severities — not a fixed badge.
 * Empty bucket → low score (no evidence of risk in that layer).
 */
export function categoryRisk(signals: Signal[]): { score: number } {
  if (!signals.length) {
    return { score: 8 };
  }

  let failWeight = 0;
  let warnWeight = 0;
  for (const s of signals) {
    const sev = (s.severity || "").toLowerCase();
    if (s.status === "fail" || sev === "critical" || sev === "high") {
      failWeight += sev === "critical" ? 2 : 1.4;
    } else if (
      s.status === "warning" ||
      sev === "medium" ||
      sev === "warning"
    ) {
      warnWeight += 1;
    }
  }

  const totalWeight = Math.max(signals.length, failWeight + warnWeight);
  const ratio = (failWeight * 2 + warnWeight) / (totalWeight * 2);
  const score = Math.round(Math.min(100, ratio * 100));

  if (failWeight > 0 || score >= 55) {
    return { score: Math.max(score, 62) };
  }
  if (warnWeight > 0 || score >= 25) {
    return { score: Math.max(score, 35) };
  }
  return { score: Math.min(score, 18) };
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
  return (
    signal.fieldLabel ||
    signal.check ||
    signal.category ||
    signal.detector ||
    "Finding"
  ).trim();
}

export function signalDescription(signal: Signal): string {
  return (signal.description || signal.check || signal.fieldLabel || "").trim();
}

export function verdictFallback(verdict: VerificationResult["verdict"]): string {
  if (verdict === "fraudulent") {
    return "Strong manipulation signals appear across layers. The document looks altered.";
  }
  if (verdict === "suspicious") {
    return "Mixed forensic signals leave authenticity uncertain. Key flags need closer attention.";
  }
  return "Cross-layer checks support authenticity. No material fraud flags stood out.";
}

/** Scores as shown on the results dashboard after analysis. */
export function computeAnalysisDisplayScores(result: VerificationResult) {
  const riskScore = result.report.riskScore ?? 0;
  const fraudProbability =
    result.fraudScore != null && Number.isFinite(result.fraudScore)
      ? Math.round(result.fraudScore)
      : result.verdict === "fraudulent"
        ? Math.max(riskScore, result.confidence ?? 0)
        : result.verdict === "suspicious"
          ? Math.round((riskScore + (result.confidence ?? 50)) / 2)
          : Math.min(riskScore, 18);

  const aiProbability =
    result.aiProbability != null && Number.isFinite(result.aiProbability)
      ? Math.round(result.aiProbability * 10) / 10
      : result.aiDetection?.probability != null &&
          Number.isFinite(result.aiDetection.probability)
        ? Math.round(result.aiDetection.probability * 10) / 10
        : null;

  const buckets = bucketSignals(result.signals);
  return {
    riskScore,
    fraudProbability,
    aiProbability,
    textScore: categoryRisk(buckets.text).score,
    imageScore: categoryRisk(buckets.image).score,
    pdfScore: categoryRisk(buckets.pdf).score,
    buckets,
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

  const title =
    bucket === "text"
      ? "Text manipulation"
      : bucket === "image"
        ? "Image manipulation"
        : "File structure";

  return clampSummary(
    (fromApi || "").trim() || buildLocalCategorySummary(title, signals) || ""
  );
}
