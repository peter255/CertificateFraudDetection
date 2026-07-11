/**
 * Professional PDF verification report — works for both V1 and V2 results.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RiskLevel, VerificationResult, VerdictType } from "../types/verification";

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
  authentic: { label: "TRUSTED", rgb: [16, 124, 16], bg: [240, 253, 244] },
  suspicious: { label: "SUSPICIOUS", rgb: [217, 119, 6], bg: [255, 251, 235] },
  fraudulent: { label: "POTENTIALLY FRAUDULENT", rgb: [197, 15, 31], bg: [254, 242, 242] },
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

type JsPdfWithTables = jsPDF & {
  lastAutoTable?: { finalY: number };
};

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
  return normalized !== "unknown" && normalized !== "—" && normalized !== "-" && normalized !== "n/a";
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "—", maxWidth) as string[];
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

function drawMetricCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueRgb: [number, number, number]
): void {
  doc.setFillColor(...COLORS.soft);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(label.toUpperCase(), x + 4, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(value.length > 22 ? 8.5 : 11);
  doc.setTextColor(...valueRgb);
  const lines = wrapText(doc, value, w - 8);
  doc.text(lines.slice(0, 2), x + 4, y + 14);
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
  const risk = RISK_STYLE[result.report.riskLevel] ?? RISK_STYLE.medium;
  const recommendation =
    RECOMMENDATION_LABEL[result.report.recommendation] ||
    result.report.recommendation ||
    "Review Required";
  const generatedAt = new Date().toLocaleString();
  const displayName = truncate(fileName, 42);

  const heatmapDataUrl = result.heatmapUrl ? await fetchImageAsDataUrl(result.heatmapUrl) : null;

  // ── Header band ───────────────────────────────────────────────────────────
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
  doc.text("Certificate Fraud Investigation Report", 16, 23);

  doc.setFontSize(8);
  doc.text(`Generated ${generatedAt}`, pageWidth - 16, 16, { align: "right" });
  doc.text(displayName, pageWidth - 16, 23, { align: "right" });

  let y = 46;

  // ── Verdict banner ────────────────────────────────────────────────────────
  doc.setFillColor(...verdict.bg);
  doc.setDrawColor(...verdict.rgb);
  doc.setLineWidth(0.6);
  doc.roundedRect(16, y, contentWidth, 18, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...verdict.rgb);
  doc.text(verdict.label, 22, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Risk ${risk.label}  ·  Model Confidence ${result.confidence}%  ·  Trust ${result.report.trustScore}/100`,
    22,
    y + 14
  );
  y += 26;

  // ── KPI row ───────────────────────────────────────────────────────────────
  const cardW = (contentWidth - 6) / 3;
  drawMetricCard(doc, 16, y, cardW, 22, "Model Confidence", `${result.confidence}%`, COLORS.accent);
  drawMetricCard(
    doc,
    16 + cardW + 3,
    y,
    cardW,
    22,
    "Trust Score",
    `${result.report.trustScore}/100`,
    risk.rgb
  );
  drawMetricCard(
    doc,
    16 + (cardW + 3) * 2,
    y,
    cardW,
    22,
    "Recommendation",
    recommendation,
    verdict.rgb
  );
  y += 30;

  // ── Document overview ─────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Document Overview", y);

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
      0: { cellWidth: 48, fontStyle: "bold", textColor: COLORS.muted },
      1: { cellWidth: "auto" },
    },
    body: [
      ["File", fileName],
      ["Certificate / Job ID", result.certificateId || "—"],
      ...(isKnownValue(result.documentType) ? [["Document Type", result.documentType]] : []),
      ...(isKnownValue(result.holderName) ? [["Holder", result.holderName]] : []),
      ...(isKnownValue(result.issuingAuthority)
        ? [["Issuing Authority", result.issuingAuthority]]
        : []),
      ...(isKnownValue(result.issueDate) ? [["Issue Date", result.issueDate]] : []),
      ["Verified At", formatDate(result.verifiedAt)],
      ["Verdict", verdict.label],
      ["Risk Level", risk.label],
    ],
  });
  y = (doc.lastAutoTable?.finalY || y) + 10;

  // ── Executive summary ─────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Executive Summary", y);
  const summary =
    result.aiSummary || result.report.summary || "No executive summary was provided.";
  const summaryLines = wrapText(doc, summary, contentWidth - 8);
  const summaryHeight = Math.max(16, summaryLines.length * 4.2 + 8);
  y = ensureSpace(doc, y, summaryHeight);

  doc.setFillColor(...COLORS.soft);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(16, y, contentWidth, summaryHeight, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(summaryLines, 20, y + 6);
  y += summaryHeight + 10;

  // ── Key findings ──────────────────────────────────────────────────────────
  if (result.report.findings.length > 0) {
    y = drawSectionTitle(doc, "Key Findings", y);

    for (const [index, finding] of result.report.findings.entries()) {
      const detailLines = wrapText(doc, finding.detail.replace(/\n+/g, " "), contentWidth - 10);
      const blockH = 8 + detailLines.length * 4;
      y = ensureSpace(doc, y, blockH + 4);

      doc.setFillColor(...COLORS.white);
      doc.setDrawColor(...COLORS.line);
      doc.roundedRect(16, y, contentWidth, blockH, 2, 2, "FD");

      doc.setFillColor(...COLORS.accent);
      doc.roundedRect(16, y, 5.5, 5.5, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.white);
      doc.text(String(index + 1), 18.75, y + 3.8, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.navy);
      doc.text(truncate(finding.title, 70), 24, y + 4.2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(...COLORS.muted);
      doc.text(detailLines, 24, y + 9);

      y += blockH + 3;
    }
    y += 4;
  }

  // ── Tamper regions / spatial evidence ─────────────────────────────────────
  if (result.tamperRegions?.length) {
    y = drawSectionTitle(doc, "Marked Tamper Regions", y);
    autoTable(doc, {
      startY: y,
      margin: { left: 16, right: 16 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.2,
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
        1: { cellWidth: 36 },
        2: { cellWidth: 22 },
        3: { cellWidth: 16 },
        4: { cellWidth: "auto" },
      },
      head: [["#", "Region", "Severity", "Page", "Description"]],
      body: result.tamperRegions.map((region, i) => [
        String(i + 1),
        region.label,
        region.severity,
        String(region.page),
        region.description,
      ]),
    });
    y = (doc.lastAutoTable?.finalY || y) + 10;
  }

  if (heatmapDataUrl) {
    y = drawSectionTitle(doc, "Forensic Heatmap", y);
    const imgW = contentWidth;
    const imgH = 90;
    y = ensureSpace(doc, y, imgH + 8);
    try {
      doc.addImage(heatmapDataUrl, imageFormatFromDataUrl(heatmapDataUrl), 16, y, imgW, imgH);
      y += imgH + 8;
    } catch {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      doc.text("Heatmap image could not be embedded in this report.", 16, y);
      y += 10;
    }
  } else if (result.heatmapUrl) {
    y = drawSectionTitle(doc, "Spatial Evidence", y);
    y = ensureSpace(doc, y, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      "A forensic heatmap was generated for this document. Open the investigation UI to view it.",
      16,
      y
    );
    y += 10;
  }

  // ── Forensic signals ──────────────────────────────────────────────────────
  if (result.signals.length > 0) {
    y = drawSectionTitle(doc, "Forensic Signals", y);
    autoTable(doc, {
      startY: y,
      margin: { left: 16, right: 16 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.2,
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
        1: { cellWidth: 36 },
        2: { cellWidth: "auto" },
      },
      head: [["Status", "Category", "Description"]],
      body: result.signals.map((signal) => [
        signal.status.toUpperCase(),
        signal.category,
        signal.description,
      ]),
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 0) return;
        const raw = String(data.cell.raw || "").toLowerCase();
        if (raw === "fail") data.cell.styles.textColor = [197, 15, 31];
        else if (raw === "warning") data.cell.styles.textColor = [217, 119, 6];
        else if (raw === "pass") data.cell.styles.textColor = [16, 124, 16];
      },
    });
    y = (doc.lastAutoTable?.finalY || y) + 10;
  }

  // ── Closing note ──────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 24);
  doc.setFillColor(...COLORS.soft);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(16, y, contentWidth, 18, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.navy);
  doc.text("Disclaimer", 20, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    wrapText(
      doc,
      "This report summarizes automated forensic analysis for investigation support. Final acceptance decisions should combine these findings with organizational policy and human review.",
      contentWidth - 8
    ),
    20,
    y + 11
  );

  // Footers on all pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  doc.save(`verification-report_${safeFileStem(fileName)}_${stamp}.pdf`);
}
