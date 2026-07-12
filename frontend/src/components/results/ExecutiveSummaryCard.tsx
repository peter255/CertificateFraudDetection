/**
 * ExecutiveSummaryCard — concise narrative summary only.
 * Scores and recommendations live in Verification Overview / Recommendation & Findings.
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
