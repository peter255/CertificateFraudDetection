/**
 * ExecutiveSummaryCard — concise narrative summary only.
 * Scores and recommendations live in Verification Overview / AI Executive Summary.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import type { VerificationResult } from "../../types/verification";
import { DASHBOARD, SectionShell } from "./shared/dashboardShell";

const INVALID = new Set(["", "-", "—", "unknown", "n/a", "na", "pending", "none"]);

function isRealText(value: string | null | undefined): value is string {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v.length > 0 && !INVALID.has(v);
}

/** Resolve AI probability from already-mapped result payloads only. */
export function resolveAiProbability(result: VerificationResult): number | null {
  const pools: Array<Record<string, unknown> | null> = [
    result.technical.layerDetails,
    result.technical.engineResults,
    result.technical.classification,
    result.technical.pdfFraudSubscores,
  ];
  const keys = [
    "ai_probability",
    "ai_prob",
    "ai_generation_probability",
    "generative_ai_probability",
    "generative_probability",
  ];

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  const toScore100 = (value: unknown): number | null => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    if (value <= 1) return Math.round(value * 1000) / 10;
    return Math.round(Math.min(100, value) * 10) / 10;
  };

  const find = (node: unknown, depth = 0): number | null => {
    if (depth > 4 || node == null) return null;
    const rec = asRecord(node);
    if (!rec) return null;
    for (const key of keys) {
      if (key in rec) {
        const score = toScore100(rec[key]);
        if (score != null) return score;
      }
    }
    for (const value of Object.values(rec)) {
      const nested = find(value, depth + 1);
      if (nested != null) return nested;
    }
    return null;
  };

  for (const pool of pools) {
    const score = find(pool);
    if (score != null) return score;
  }
  return null;
}

/** Resolve engine-returned trust score only — never derive from verdict. */
export function resolveEngineTrustScore(result: VerificationResult): number | null {
  const pools: Array<Record<string, unknown> | null> = [
    result.technical.layerDetails,
    result.technical.engineResults,
    result.technical.classification,
  ];
  const keys = ["trust_score", "trustScore", "document_trust_score"];

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  const toScore100 = (value: unknown): number | null => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    if (value <= 1) return Math.round(value * 1000) / 10;
    return Math.round(Math.min(100, value) * 10) / 10;
  };

  const find = (node: unknown, depth = 0): number | null => {
    if (depth > 4 || node == null) return null;
    const rec = asRecord(node);
    if (!rec) return null;
    for (const key of keys) {
      if (key in rec) {
        const score = toScore100(rec[key]);
        if (score != null) return score;
      }
    }
    for (const value of Object.values(rec)) {
      const nested = find(value, depth + 1);
      if (nested != null) return nested;
    }
    return null;
  };

  for (const pool of pools) {
    const score = find(pool);
    if (score != null) return score;
  }
  return null;
}

interface ExecutiveSummaryCardProps {
  result: VerificationResult;
}

export default function ExecutiveSummaryCard({ result }: ExecutiveSummaryCardProps) {
  const summary = (result.aiSummary || result.report.summary || "").trim();
  if (!isRealText(summary)) {
    return null;
  }

  return (
    <SectionShell
      title="Executive Summary"
      icon={<SummarizeOutlinedIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.accent}
      emphasis="primary"
    >
      <Box
        sx={{
          px: { xs: 0.25, sm: 0.5 },
          py: 0.25,
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: "0.9375rem", sm: "1rem" },
            color: DASHBOARD.textSecondary,
            lineHeight: 1.7,
          }}
        >
          {summary}
        </Typography>
      </Box>
    </SectionShell>
  );
}
