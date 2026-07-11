/**
 * ExecutiveReport — Section 2: AI Executive Summary
 * Timeline-style findings with prominent recommendation card.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { ExecReport, RiskLevel } from "../../types/verification";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

const RISK_STYLE: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: "Low Risk", color: "#107C10" },
  medium: { label: "Medium Risk", color: "#D97706" },
  high: { label: "High Risk", color: "#C50F1F" },
};

type RecommendationType = "approve" | "reject" | "manual_review";

const RECOMMENDATION_STYLE: Record<
  string,
  { label: string; color: string; bgGradient: string; Icon: typeof CheckCircleIcon }
> = {
  approve: {
    label: "Approve",
    color: "#107C10",
    bgGradient: "linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)",
    Icon: CheckCircleIcon,
  },
  reject: {
    label: "Reject — Do Not Accept",
    color: "#C50F1F",
    bgGradient: "linear-gradient(180deg, #FEF2F2 0%, #FFFFFF 100%)",
    Icon: CancelIcon,
  },
  manual_review: {
    label: "Escalate for Manual Review",
    color: "#D97706",
    bgGradient: "linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)",
    Icon: WarningAmberIcon,
  },
};

const DEFAULT_REC = {
  label: "Review Required",
  color: "#64748B",
  bgGradient: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
  Icon: WarningAmberIcon,
};

interface ExecutiveReportProps {
  report: ExecReport;
  fileName: string;
  aiSummary: string;
  verifiedAt: string;
}

export default function ExecutiveReport({
  report,
  fileName,
  aiSummary,
  verifiedAt,
}: ExecutiveReportProps) {
  const risk = RISK_STYLE[report.riskLevel];
  const rec =
    RECOMMENDATION_STYLE[report.recommendation as RecommendationType] ?? DEFAULT_REC;
  const { Icon: RecIcon } = rec;

  return (
    <SectionShell
      title="AI Executive Summary"
      icon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.accent}
      emphasis="primary"
      badge={
        <SectionBadge color={`${risk.color}18`}>
          <Box component="span" sx={{ color: risk.color }}>
            {risk.label}
          </Box>
        </SectionBadge>
      }
      noPadding
    >
      <Box
        sx={{
          px: 3,
          py: 1.75,
          backgroundColor: "#F1F5F9",
          borderBottom: `1px solid ${DASHBOARD.borderLight}`,
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: DASHBOARD.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            File
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: DASHBOARD.textPrimary, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: DASHBOARD.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Verified
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: verifiedAt ? DASHBOARD.textPrimary : DASHBOARD.textMuted }}>
            {verifiedAt || "—"}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 2,
            p: 3,
            background: rec.bgGradient,
            border: `1px solid ${rec.color}33`,
            borderRadius: "14px",
            mb: 3,
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 5,
              backgroundColor: rec.color,
            },
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              backgroundColor: "#FFFFFF",
              border: `1px solid ${rec.color}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <RecIcon sx={{ fontSize: 24, color: rec.color }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: DASHBOARD.textMuted, mb: 0.5 }}>
              Recommendation
            </Typography>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: rec.color, mb: 0.5 }}>
              {rec.label}
            </Typography>
            {report.recommendation &&
              report.recommendation !== "approve" &&
              report.recommendation !== "reject" &&
              report.recommendation !== "manual_review" && (
                <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.6 }}>
                  {report.recommendation}
                </Typography>
              )}
          </Box>
        </Box>

        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: DASHBOARD.textMuted, mb: 1.5 }}>
          Analysis Summary
        </Typography>
        <Box
          sx={{
            p: 2.5,
            borderRadius: "12px",
            backgroundColor: "#F8FAFC",
            border: `1px solid ${DASHBOARD.borderLight}`,
            mb: report.findings.length > 0 ? 3 : 0,
          }}
        >
          <Typography sx={{ fontSize: "0.9375rem", color: DASHBOARD.textSecondary, lineHeight: 1.8 }}>
            {aiSummary || report.summary || "—"}
          </Typography>
        </Box>

        {report.findings.length > 0 && (
          <>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: DASHBOARD.textMuted, mb: 2 }}>
              Key Findings
            </Typography>
            <Box sx={{ position: "relative", pl: 3 }}>
              <Box
                sx={{
                  position: "absolute",
                  left: 11,
                  top: 12,
                  bottom: 12,
                  width: 2,
                  backgroundColor: DASHBOARD.borderLight,
                }}
              />
              {report.findings.map((finding, index) => (
                <Box
                  key={finding.title}
                  sx={{
                    position: "relative",
                    pl: 3,
                    pb: index < report.findings.length - 1 ? 2.5 : 0,
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      left: -13,
                      top: 4,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      backgroundColor: DASHBOARD.accent,
                      border: "3px solid #FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 0 0 2px ${DASHBOARD.accent}33`,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.5625rem", fontWeight: 800, color: "#FFFFFF" }}>
                      {index + 1}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: "12px",
                      backgroundColor: "#FFFFFF",
                      border: `1px solid ${DASHBOARD.borderLight}`,
                      boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
                    }}
                  >
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: DASHBOARD.textPrimary, mb: 0.75 }}>
                      {finding.title}
                    </Typography>
                    <Typography sx={{ fontSize: "0.8125rem", color: DASHBOARD.textSecondary, lineHeight: 1.65 }}>
                      {finding.detail}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
    </SectionShell>
  );
}
