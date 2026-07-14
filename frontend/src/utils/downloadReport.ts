/**
 * PDF investigation report — mirrors the ResultsDashboard layout and wording
 * so the exported file is as clear as the on-screen analysis.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  TamperRegion,
  VerificationResult,
  VerdictType,
} from "../types/verification";
import {
  ORGANIZATION_NAME,
  PRODUCT_NAME,
  REPORT_TITLE,
  BRAND_LOGO_PDF_PATH,
} from "../branding/constants";
import {
  categoryRiskLabel,
  categorySummaryForReport,
  clampSummary,
  computeAnalysisDisplayScores,
  confOf,
  overallRiskLabel,
  signalDescription,
  signalTitle,
  verdictFallback,
} from "./findingsDisplay";

const COLORS = {
  navy: [15, 41, 66] as [number, number, number],
  navyMid: [22, 58, 95] as [number, number, number],
  accent: [0, 120, 212] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  soft: [248, 250, 252] as [number, number, number],
  danger: [197, 15, 31] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  success: [16, 124, 16] as [number, number, number],
};

const VERDICT_STYLE: Record<
  VerdictType,
  { label: string; rgb: [number, number, number]; bg: [number, number, number] }
> = {
  authentic: { label: "Trusted", rgb: COLORS.success, bg: [240, 253, 244] },
  suspicious: { label: "Suspicious", rgb: COLORS.warning, bg: [255, 251, 235] },
  fraudulent: {
    label: "Potentially Fraudulent",
    rgb: COLORS.danger,
    bg: [254, 242, 242],
  },
};

const SIGNAL_STATUS_LABEL: Record<string, string> = {
  pass: "Passed",
  warning: "Warning",
  fail: "Failed",
};

const SEVERITY_LABEL: Record<TamperRegion["severity"], string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
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

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed < pageHeight - 18) return y;
  doc.addPage();
  return 22;
}

function riskTone(label: string): [number, number, number] {
  const key = label.toUpperCase();
  if (key.includes("HIGH") || key.includes("CRITICAL")) return COLORS.danger;
  if (key.includes("MEDIUM") || key.includes("ELEVATED")) return COLORS.warning;
  return COLORS.success;
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
  doc.text(`${PRODUCT_NAME} · Confidential · ${ORGANIZATION_NAME}`, 16, pageHeight - 7);
  doc.text(`Page ${page} of ${total}`, pageWidth - 16, pageHeight - 7, {
    align: "right",
  });
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

function drawParagraphBox(
  doc: jsPDF,
  text: string,
  y: number,
  contentWidth: number
): number {
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
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const raw = String(data.cell.raw || "");
      // Color the metric value when it embeds a risk chip like "50 / 100  ·  ELEVATED"
      if (/\bCRITICAL\b|\bHIGH RISK\b/i.test(raw)) {
        data.cell.styles.textColor = COLORS.danger;
        data.cell.styles.fontStyle = "bold";
      } else if (/\bELEVATED\b|\bMEDIUM\b/i.test(raw)) {
        data.cell.styles.textColor = COLORS.warning;
        data.cell.styles.fontStyle = "bold";
      } else if (/\bLOW RISK\b|\bLOW\b/i.test(raw) && /·/.test(raw)) {
        data.cell.styles.textColor = COLORS.success;
        data.cell.styles.fontStyle = "bold";
      }
    },
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
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg"))
    return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function drawCategoryBlock(
  doc: jsPDF,
  y: number,
  contentWidth: number,
  title: string,
  riskLabel: string,
  score: number,
  summary: string,
  signals: VerificationResult["signals"],
  prefix: string
): number {
  y = ensureSpace(doc, y, 22);

  // Title row with same risk chip wording as the website
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text(title.toUpperCase(), 16, y);

  const chip = `${riskLabel}  ·  ${score}/100`;
  doc.setFontSize(9);
  doc.setTextColor(...riskTone(riskLabel));
  doc.text(chip, 16 + contentWidth, y, { align: "right" });
  y += 5;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.3);
  doc.line(16, y, 16 + contentWidth, y);
  y += 6;

  const hasSummary = Boolean(summary.trim());
  if (hasSummary) {
    y = drawParagraphBox(doc, summary.trim(), y, contentWidth);
    return y;
  }

  const items =
    signals.length > 0
      ? signals
      : [
          {
            id: `${prefix}-ok`,
            category: title,
            description: "No anomalies detected in this layer.",
            status: "pass" as const,
          },
        ];

  const body = items.slice(0, 16).map((signal, index) => {
    const status = SIGNAL_STATUS_LABEL[signal.status] || signal.status;
    const code = `${prefix}-${String(index + 1).padStart(2, "0")}`;
    const titleText = truncate(signalTitle(signal), 40);
    const detail = truncate(signalDescription(signal) || titleText, 160);
    const confidence = `${confOf(signal)}%`;
    return [status, code, titleText, detail, confidence];
  });

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
      0: { cellWidth: 20, fontStyle: "bold" },
      1: { cellWidth: 18 },
      2: { cellWidth: 36 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 18 },
    },
    head: [["Status", "Ref", "Finding", "Detail", "Conf."]],
    body,
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const raw = String(data.cell.raw || "").toLowerCase();
      if (raw === "failed") data.cell.styles.textColor = COLORS.danger;
      else if (raw === "warning") data.cell.styles.textColor = COLORS.warning;
      else if (raw === "passed") data.cell.styles.textColor = COLORS.success;
    },
  });

  return ((doc as JsPdfWithTables).lastAutoTable?.finalY || y) + 10;
}

/**
 * Build and download a PDF that mirrors the analysis results screen.
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
  const generatedAt = new Date().toLocaleString();
  const displayName = truncate(fileName, 42);

  const scores = computeAnalysisDisplayScores(result);
  const criticalLabel = overallRiskLabel(
    result.report.riskLevel,
    scores.riskScore
  );
  const textRisk = categoryRiskLabel(scores.buckets.text);
  const imageRisk = categoryRiskLabel(scores.buckets.image);
  const pdfRisk = categoryRiskLabel(scores.buckets.pdf);

  const consolidated =
    clampSummary((result.aiSummary || "").trim()) ||
    verdictFallback(result.verdict);

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 48, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 48, pageWidth, 1.5, "F");

  const logoDataUrl = await fetchImageAsDataUrl(BRAND_LOGO_PDF_PATH);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 16, 12, 42, 11);
    } catch {
      /* ignore unsupported formats */
    }
  } else {
    doc.setDrawColor(186, 198, 214);
    doc.setLineWidth(0.4);
    doc.roundedRect(16, 10, 14, 14, 1, 1, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(186, 198, 214);
    doc.text(ORGANIZATION_NAME, 23, 18, { align: "center" });
  }

  const textLeft = logoDataUrl ? 64 : 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(REPORT_TITLE, textLeft, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(186, 198, 214);
  doc.text(PRODUCT_NAME, textLeft, 23);
  doc.text(`Organization: ${ORGANIZATION_NAME}`, textLeft, 29);

  doc.setFontSize(8);
  doc.setTextColor(186, 198, 214);
  doc.text(`Generated ${generatedAt}`, pageWidth - 16, 16, { align: "right" });
  doc.text(displayName, pageWidth - 16, 23, { align: "right" });
  if (result.certificateId?.trim()) {
    doc.text(
      `Verification ID: ${result.certificateId.trim().slice(0, 12).toUpperCase()}`,
      pageWidth - 16,
      30,
      { align: "right" }
    );
  }

  let y = 58;

  // Verdict strip — same decision label as the UI
  doc.setFillColor(...verdict.bg);
  doc.setDrawColor(...verdict.rgb);
  doc.setLineWidth(0.6);
  doc.roundedRect(16, y, contentWidth, 12, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...verdict.rgb);
  doc.text(verdict.label.toUpperCase(), 22, y + 8);
  y += 20;

  // Analysis Scores — same metrics and labels as ResultsDashboard
  y = drawSectionTitle(doc, "Analysis Scores", y);
  const scoreRows: TableRow[] = [
    [
      "Risk Score",
      `${Math.round(scores.riskScore)} / 100  ·  ${criticalLabel}`,
    ],
    [
      "Fraud Probability",
      `${Math.round(scores.fraudProbability)}%`,
    ],
    [
      "AI Probability",
      scores.aiProbability != null ? `${scores.aiProbability}%` : "—",
    ],
    [
      "Text Logic",
      `${scores.textScore} / 100  ·  ${textRisk.label}`,
    ],
    [
      "Image Forensics",
      `${scores.imageScore} / 100  ·  ${imageRisk.label}`,
    ],
    [
      "File Structure",
      `${scores.pdfScore} / 100  ·  ${pdfRisk.label}`,
    ],
  ];
  y = drawKeyValueTable(doc, y, scoreRows);

  // Consolidated Verdict — same narrative as the website
  y = drawSectionTitle(doc, "Consolidated Verdict", y);
  y = drawParagraphBox(doc, consolidated, y, contentWidth);

  // Detailed Findings — navigable visual evidence only (same list as the UI panel)
  y = drawSectionTitle(doc, "Detailed Findings", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    "Localized visual evidence only — each item has a page and bounding box on the document.",
    16,
    y
  );
  y += 6;

  const regions = (result.tamperRegions || []).filter(
    (r) =>
      Array.isArray(r.bbox) &&
      r.bbox.length === 4 &&
      Number.isFinite(r.page) &&
      r.page >= 1 &&
      r.imageWidth > 0 &&
      r.imageHeight > 0
  );

  if (regions.length === 0) {
    y = drawParagraphBox(
      doc,
      "No localized visual evidence was returned for this document.",
      y,
      contentWidth
    );
  } else {
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
        1: { cellWidth: 42 },
        2: { cellWidth: 24 },
        3: { cellWidth: 14 },
        4: { cellWidth: "auto" },
      },
      head: [["#", "Finding", "Severity", "Page", "Description"]],
      body: regions.slice(0, 24).map((region, i) => [
        String(i + 1),
        truncate(region.label, 42),
        SEVERITY_LABEL[region.severity],
        String(region.page),
        truncate(region.description, 140),
      ]),
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 2) return;
        const raw = String(data.cell.raw || "").toUpperCase();
        data.cell.styles.fontStyle = "bold";
        if (raw === "CRITICAL" || raw === "HIGH") {
          data.cell.styles.textColor = COLORS.danger;
        } else if (raw === "MEDIUM") {
          data.cell.styles.textColor = COLORS.warning;
        } else {
          data.cell.styles.textColor = COLORS.success;
        }
      },
    });
    y = (doc.lastAutoTable?.finalY || y) + 10;
  }

  // Category analysis — same three blocks as the website
  y = drawSectionTitle(doc, "Category Analysis", y);

  y = drawCategoryBlock(
    doc,
    y,
    contentWidth,
    "Text Manipulation",
    textRisk.label,
    textRisk.score,
    categorySummaryForReport(result, "text", scores.buckets.text),
    scores.buckets.text,
    "TXT"
  );

  y = drawCategoryBlock(
    doc,
    y,
    contentWidth,
    "Image Manipulation",
    imageRisk.label,
    imageRisk.score,
    categorySummaryForReport(result, "image", scores.buckets.image),
    scores.buckets.image,
    "IMG"
  );

  y = drawCategoryBlock(
    doc,
    y,
    contentWidth,
    "File Structure",
    pdfRisk.label,
    pdfRisk.score,
    categorySummaryForReport(result, "pdf", scores.buckets.pdf),
    scores.buckets.pdf,
    "FILE"
  );

  // Closing note
  y = ensureSpace(doc, y, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    wrapText(
      doc,
      "This report mirrors the on-screen analysis results. Scores, risk labels, detailed findings, and category summaries use the same data shown in the Fraud Detection System.",
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
  doc.save(`fraud-detection-report_${safeFileStem(fileName)}_${stamp}.pdf`);
}
