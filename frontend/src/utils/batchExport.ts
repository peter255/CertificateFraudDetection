/**
 * Batch export helpers — CSV and JSON summaries from finished jobs.
 */

import type { VerificationResult } from "../types/verification";

export interface BatchExportRow {
  fileName: string;
  status: string;
  certificateId: string;
  verdict: string;
  riskLevel: string;
  modelConfidence: number | null;
  aiProbability: number | null;
  engineTrustScore: number | null;
  fraudScore: number | null;
  recommendation: string;
  durationMs: number | null;
  error: string;
}

const CSV_HEADERS: Array<keyof BatchExportRow> = [
  "fileName",
  "status",
  "certificateId",
  "verdict",
  "riskLevel",
  "modelConfidence",
  "aiProbability",
  "engineTrustScore",
  "fraudScore",
  "recommendation",
  "durationMs",
  "error",
];

export function resultToExportRow(
  fileName: string,
  status: string,
  result: VerificationResult | null,
  error: string | null,
  durationMs: number | null
): BatchExportRow {
  return {
    fileName,
    status,
    certificateId: result?.certificateId ?? "",
    verdict: result?.verdict ?? "",
    riskLevel: result?.report.riskLevel ?? "",
    modelConfidence: result?.confidence ?? null,
    aiProbability: result?.aiProbability ?? null,
    engineTrustScore: result?.engineTrustScore ?? null,
    fraudScore: result?.fraudScore ?? null,
    recommendation: result?.report.recommendation ?? "",
    durationMs,
    error: error ?? "",
  };
}

function cellValue(value: string | number | null | undefined): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (value == null) return "";
  return String(value);
}

/** Quote only when needed so Excel keeps one value per column. */
function csvEscape(value: string | number | null | undefined): string {
  const raw = cellValue(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function downloadBatchCsv(rows: BatchExportRow[], stem = "batch-results"): void {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) => CSV_HEADERS.map((key) => csvEscape(row[key])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `${stem}_${timestamp()}.csv`);
}

export function downloadBatchJson(rows: BatchExportRow[], stem = "batch-results"): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, `${stem}_${timestamp()}.json`);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
