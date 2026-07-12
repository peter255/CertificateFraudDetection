/**
 * Professional PDF investigation report — Engine V1 / V2.
 * Concise sections; only actual response data; no vendor names.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  RiskLevel,
  Signal,
  VerificationResult,
  VerdictType,
} from "../types/verification";

const COLORS = {
  navy: [15, 41, 66] as [number, number, number],
  navyMid: [22, 58, 95] as [number, number, number],
  accent: [0, 120, 212] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  soft: [248, 250, 252] as [number, number, number],
};

const VERDICT_STYLE: Record<
  VerdictType,
  { label: string; rgb: [number, number, number]; bg: [number, number, number] }
> = {
  authentic: { label: "Trusted", rgb: [16, 124, 16], bg: [240, 253, 244] },
  suspicious: { label: "Suspicious", rgb: [217, 119, 6], bg: [255, 251, 235] },
  fraudulent: { label: "Potentially Fraudulent", rgb: [197, 15, 31], bg: [254, 242, 242] },
};

const RISK_STYLE: Record<RiskLevel, { label: string; rgb: [number, number, number] }> = {
  low: { label: "Low", rgb: [16, 124, 16] },
  medium: { label: "Medium", rgb: [217, 119, 6] },
  high: { label: "High", rgb: [197, 15, 31] },
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  approve: "Approve",
  reject: "Reject — Do Not Accept",
  manual_review: "Escalate for Manual Review",
};

const SIGNAL_STATUS_LABEL: Record<string, string> = {
  pass: "Passed",
  warning: "Warning",
  fail: "Failed",
};

type JsPdfWithTables = jsPDF & {
  lastAutoTable?: { finalY: number };
};

type TableRow = [string, string];

function safeFileStem(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "").trim() || "certificate";
  return stem.replace(/[^\w\-]+/g, "_").slice(0, 80);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function isKnownValue(value: string | null | undefined): value is string {
  if (value == null) return false;
  const v = value.trim();
  if (!v) return false;
  const normalized = v.toLowerCase();
  return (
    normalized !== "unknown" &&
    normalized !== "—" &&
    normalized !== "-" &&
    normalized !== "n/a" &&
    normalized !== "pending" &&
    normalized !== "none"
  );
}

function formatDate(iso?: string | null): string | null {
  if (!iso || !isKnownValue(iso)) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.trim();
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed < pageHeight - 18) return y;
  doc.addPage();
  return 22;
}

function drawFooter(doc: jsPDF, page: number, total: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(16, pageHeight - 12, pageWidth - 16, pageHeight - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("CertVerify · Confidential investigation report", 16, pageHeight - 7);
  doc.text(`Page ${page} of ${total}`, pageWidth - 16, pageHeight - 7, { align: "right" });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text(title.toUpperCase(), 16, y);

  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1.2);
  const titleWidth = doc.getTextWidth(title.toUpperCase());
  doc.line(16, y + 2, 16 + Math.min(titleWidth, 60), y + 2);

  return y + 8;
}

function drawParagraphBox(doc: jsPDF, text: string, y: number, contentWidth: number): number {
  const lines = wrapText(doc, text, contentWidth - 8);
  const height = Math.max(14, lines.length * 4.2 + 8);
  y = ensureSpace(doc, y, height);
  doc.setFillColor(...COLORS.soft);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(16, y, contentWidth, height, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(lines, 20, y + 6);
  return y + height + 8;
}

function drawKeyValueTable(doc: jsPDF, y: number, rows: TableRow[]): number {
  if (rows.length === 0) return y;

  autoTable(doc, {
    startY: y,
    margin: { left: 16, right: 16 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.4,
      textColor: COLORS.text,
      lineColor: COLORS.line,
      lineWidth: 0.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: COLORS.navyMid,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLORS.soft },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", textColor: COLORS.muted },
      1: { cellWidth: "auto" },
    },
    body: rows,
  });

  return ((doc as JsPdfWithTables).lastAutoTable?.finalY || y) + 10;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function conciseSignalDescription(signal: Signal): string {
  const raw = (signal.description || "").trim();
  if (!raw) return "";
  // Keep the leading finding; drop long trailing metadata chains.
  const primary = raw.split(" — ")[0]?.trim() || raw;
  return truncate(primary, 140);
}

function groupSignals(signals: Signal[]): Array<{ category: string; items: Signal[] }> {
  const map = new Map<string, Signal[]>();
  for (const signal of signals) {
    const category = (signal.category || "Forensic Indicator").trim();
    const list = map.get(category) ?? [];
    list.push(signal);
    map.set(category, list);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
}

function buildExecutiveSummary(result: VerificationResult): string | null {
  const summary = (result.aiSummary || result.report.summary || "").trim();
  return isKnownValue(summary) ? summary : null;
}

function buildDocumentRows(result: VerificationResult, fileName: string): TableRow[] {
  const rows: TableRow[] = [];
  if (isKnownValue(fileName)) rows.push(["File Name", fileName]);
  if (isKnownValue(result.certificateId)) rows.push(["Verification ID", result.certificateId]);
  if (isKnownValue(result.documentType)) rows.push(["Document Type", result.documentType]);
  if (isKnownValue(result.fileKind)) rows.push(["File Kind", result.fileKind]);
  if (result.isScan === true) rows.push(["Scan", "Yes"]);
  if (result.isScan === false) rows.push(["Scan", "No"]);
  if (isKnownValue(result.holderName)) rows.push(["Holder", result.holderName]);
  if (isKnownValue(result.issuingAuthority)) {
    rows.push(["Issuing Authority", result.issuingAuthority]);
  }
  if (isKnownValue(result.issueDate)) rows.push(["Issue Date", result.issueDate]);
  return rows;
}

function buildAssessmentRows(result: VerificationResult): TableRow[] {
  const verdict = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE.suspicious;
  const risk = RISK_STYLE[result.report.riskLevel] ?? RISK_STYLE.medium;
  const rows: TableRow[] = [
    ["Overall Assessment", verdict.label],
    ["Risk Level", risk.label],
  ];

  if (Number.isFinite(result.confidence)) {
    rows.push(["Model Confidence", `${result.confidence}%`]);
  }
  if (result.aiProbability != null && Number.isFinite(result.aiProbability)) {
    rows.push(["AI Probability", `${result.aiProbability}%`]);
  }
  if (result.engineTrustScore != null && Number.isFinite(result.engineTrustScore)) {
    rows.push(["Trust Score", `${result.engineTrustScore}/100`]);
  }
  if (result.fraudScore != null && Number.isFinite(result.fraudScore)) {
    rows.push(["Fraud Score", `${result.fraudScore}/100`]);
  }
  if (isKnownValue(result.engineVerdictLabel)) {
    rows.push(["Engine Label", result.engineVerdictLabel]);
  }
  if (isKnownValue(result.analysisStatus)) {
    rows.push(["Analysis Status", result.analysisStatus]);
  }
  rows.push([
    "Score glossary",
    "Model Confidence = certainty in the prediction. Trust Score = engine document trust. AI Probability = likelihood of AI-generated content.",
  ]);
  return rows;
}

function buildAiAnalysisRows(result: VerificationResult): TableRow[] {
  const rows: TableRow[] = [];
  const engine = result.vendorFindings[0];

  if (engine && isKnownValue(engine.vendor)) {
    rows.push(["Engine", engine.vendor]);
  }
  if (engine && isKnownValue(engine.status)) {
    rows.push(["Engine Status", engine.status]);
  }
  if (engine && isKnownValue(engine.processingResult)) {
    rows.push(["Processing Result", engine.processingResult]);
  }
  if (engine?.confidenceScore != null && Number.isFinite(engine.confidenceScore)) {
    rows.push(["Engine Confidence", `${Math.round(engine.confidenceScore * 1000) / 10}%`]);
  }

  // AI-oriented findings only — avoid repeating the full forensic list.
  const aiFindings = (engine?.additionalFindings || []).filter(isKnownValue);
  const aiFromReport = result.report.findings
    .filter((f) => /ai|model|ocr|generation|digital/i.test(f.title))
    .map((f) => f.title)
    .filter(isKnownValue);

  const combined = [...aiFindings, ...aiFromReport].filter(
    (item, index, arr) => arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index
  );

  if (combined.length) {
    rows.push(["AI Findings", combined.slice(0, 6).join("; ")]);
  }

  return rows;
}

function buildTimelineRows(result: VerificationResult): TableRow[] {
  const rows: TableRow[] = [];
  const verified = formatDate(result.verifiedAt);
  if (verified) rows.push(["Verified At", verified]);

  const duration = formatDuration(result.engineDurationMs);
  if (duration) rows.push(["Processing Time", duration]);

  if (isKnownValue(result.analysisStatus)) {
    rows.push(["Pipeline Status", result.analysisStatus]);
  }

  const engineStatus = result.vendorFindings[0]?.status;
  if (isKnownValue(engineStatus) && engineStatus !== result.analysisStatus) {
    rows.push(["Engine Status", engineStatus]);
  }

  return rows;
}

/**
 * Build and download a professional PDF investigation report.
 */
export async function downloadVerificationReport(
  result: VerificationResult,
  fileName = "certificate"
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  }) as JsPdfWithTables;

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 32;
  const verdict = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE.suspicious;
  const recommendation =
    RECOMMENDATION_LABEL[result.report.recommendation] ||
    (isKnownValue(result.report.recommendation) ? result.report.recommendation : null);
  const generatedAt = new Date().toLocaleString();
  const displayName = truncate(fileName, 42);

  const heatmapUrl =
    typeof result.heatmapUrl === "string" && result.heatmapUrl.trim()
      ? result.heatmapUrl.trim()
      : null;
  const heatmapDataUrl = heatmapUrl ? await fetchImageAsDataUrl(heatmapUrl) : null;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 36, pageWidth, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text("CertVerify", 16, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(186, 198, 214);
  doc.text("Investigation Report", 16, 23);

  doc.setFontSize(8);
  doc.text(`Generated ${generatedAt}`, pageWidth - 16, 16, { align: "right" });
  doc.text(displayName, pageWidth - 16, 23, { align: "right" });

  let y = 46;

  // Compact verdict strip (not repeated later as a full overview table).
  doc.setFillColor(...verdict.bg);
  doc.setDrawColor(...verdict.rgb);
  doc.setLineWidth(0.6);
  doc.roundedRect(16, y, contentWidth, 12, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...verdict.rgb);
  doc.text(verdict.label.toUpperCase(), 22, y + 8);
  y += 20;

  // 1) Executive Summary
  const executiveSummary = buildExecutiveSummary(result);
  if (executiveSummary) {
    y = drawSectionTitle(doc, "Executive Summary", y);
    y = drawParagraphBox(doc, executiveSummary, y, contentWidth);
  }

  // 2) Overall Assessment
  const assessmentRows = buildAssessmentRows(result);
  if (assessmentRows.length) {
    y = drawSectionTitle(doc, "Overall Assessment", y);
    y = drawKeyValueTable(doc, y, assessmentRows);
  }

  // 3) Document Information
  const documentRows = buildDocumentRows(result, fileName);
  if (documentRows.length) {
    y = drawSectionTitle(doc, "Document Information", y);
    y = drawKeyValueTable(doc, y, documentRows);
  }

  // 4) AI Analysis
  const aiRows = buildAiAnalysisRows(result);
  if (aiRows.length) {
    y = drawSectionTitle(doc, "AI Analysis", y);
    y = drawKeyValueTable(doc, y, aiRows);
  }

  // 5) Forensic Findings (signals only — not the executive finding cards)
  const realSignals = result.signals.filter(
    (s) => isKnownValue(s.description) || isKnownValue(s.category)
  );
  if (realSignals.length) {
    y = drawSectionTitle(doc, "Forensic Findings", y);
    const groups = groupSignals(realSignals);
    const body: string[][] = [];

    for (const group of groups) {
      for (const signal of group.items.slice(0, 8)) {
        const description = conciseSignalDescription(signal);
        if (!description && !isKnownValue(signal.category)) continue;
        body.push([
          SIGNAL_STATUS_LABEL[signal.status] || signal.status,
          group.category,
          description || group.category,
        ]);
      }
    }

    if (body.length) {
      // Cap total rows for concision.
      const capped = body.slice(0, 24);
      autoTable(doc, {
        startY: y,
        margin: { left: 16, right: 16 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.1,
          textColor: COLORS.text,
          lineColor: COLORS.line,
          lineWidth: 0.2,
          valign: "top",
        },
        headStyles: {
          fillColor: COLORS.navyMid,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: COLORS.soft },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: "bold" },
          1: { cellWidth: 40 },
          2: { cellWidth: "auto" },
        },
        head: [["Status", "Category", "Finding"]],
        body: capped,
        didParseCell: (data) => {
          if (data.section !== "body" || data.column.index !== 0) return;
          const raw = String(data.cell.raw || "").toLowerCase();
          if (raw === "failed") data.cell.styles.textColor = [197, 15, 31];
          else if (raw === "warning") data.cell.styles.textColor = [217, 119, 6];
          else if (raw === "passed") data.cell.styles.textColor = [16, 124, 16];
        },
      });
      y = (doc.lastAutoTable?.finalY || y) + 10;
    }
  }

  // 6) Evidence (spatial only)
  const regions = (result.tamperRegions || []).filter(
    (r) => Array.isArray(r.bbox) && r.bbox.length === 4 && r.imageWidth > 0 && r.imageHeight > 0
  );
  if (regions.length || heatmapDataUrl) {
    y = drawSectionTitle(doc, "Evidence", y);

    if (regions.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: 16, right: 16 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.1,
          textColor: COLORS.text,
          lineColor: COLORS.line,
          lineWidth: 0.2,
          valign: "top",
        },
        headStyles: {
          fillColor: COLORS.navyMid,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: COLORS.soft },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 38 },
          2: { cellWidth: 22 },
          3: { cellWidth: 14 },
          4: { cellWidth: "auto" },
        },
        head: [["#", "Region", "Severity", "Page", "Description"]],
        body: regions.slice(0, 16).map((region, i) => [
          String(i + 1),
          region.label,
          region.severity,
          String(region.page),
          truncate(region.description, 120),
        ]),
      });
      y = (doc.lastAutoTable?.finalY || y) + 8;
    }

    if (heatmapDataUrl) {
      const imgW = contentWidth;
      const imgH = 72;
      y = ensureSpace(doc, y, imgH + 6);
      try {
        doc.addImage(heatmapDataUrl, imageFormatFromDataUrl(heatmapDataUrl), 16, y, imgW, imgH);
        y += imgH + 8;
      } catch {
        // Skip unreadable heatmap — never invent evidence.
      }
    }
  }

  // 7) Recommendation
  if (recommendation) {
    y = drawSectionTitle(doc, "Recommendation", y);
    y = ensureSpace(doc, y, 18);
    doc.setFillColor(...verdict.bg);
    doc.setDrawColor(...verdict.rgb);
    doc.roundedRect(16, y, contentWidth, 14, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...verdict.rgb);
    doc.text(recommendation, 22, y + 9);
    y += 22;
  }

  // 8) Verification Timeline
  const timelineRows = buildTimelineRows(result);
  if (timelineRows.length) {
    y = drawSectionTitle(doc, "Verification Timeline", y);
    y = drawKeyValueTable(doc, y, timelineRows);
  }

  // Closing note
  y = ensureSpace(doc, y, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    wrapText(
      doc,
      "This report summarizes automated forensic analysis for investigation support. Final acceptance decisions should combine these findings with organizational policy and human review.",
      contentWidth
    ),
    16,
    y
  );

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  doc.save(`investigation-report_${safeFileStem(fileName)}_${stamp}.pdf`);
}
