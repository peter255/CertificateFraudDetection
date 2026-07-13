/**
 * ExecutiveReport — recommendation + short summary + clear Key Findings.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import type { ExecReport, Finding } from "../../types/verification";
import { DASHBOARD, SectionShell } from "./shared/dashboardShell";
import { ORGANIZATION_NAME, PRODUCT_NAME, REPORT_TITLE } from "../../branding/constants";

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

type Tone = "info" | "warn" | "danger" | "ok";

const TONE: Record<Tone, { color: string; bg: string }> = {
  info: { color: DASHBOARD.accent, bg: "#EFF6FF" },
  warn: { color: "#D97706", bg: "#FFFBEB" },
  danger: { color: "#C50F1F", bg: "#FEF2F2" },
  ok: { color: "#107C10", bg: "#F0FDF4" },
};

function findingTone(title: string): Tone {
  const t = title.toLowerCase();
  if (t.includes("evidence") || t.includes("issue") || t.includes("tamper")) return "danger";
  if (t.includes("risk") || t.includes("why")) return "warn";
  if (t.includes("provenance")) return "warn";
  if (t.includes("score")) return "info";
  return "info";
}

function findingIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("why")) return HelpOutlineOutlinedIcon;
  if (t.includes("issue") || t.includes("tamper") || t.includes("risk")) return ReportProblemOutlinedIcon;
  if (t.includes("evidence")) return FactCheckOutlinedIcon;
  if (t.includes("provenance")) return VerifiedUserOutlinedIcon;
  if (t.includes("score")) return SpeedOutlinedIcon;
  return FactCheckOutlinedIcon;
}

function severityFromText(text: string): Tone {
  const t = text.toLowerCase();
  if (/\bcritical\b|\bhigh\b|\bfail\b|\bfraud/.test(t)) return "danger";
  if (/\bmedium\b|\bsuspicious\b|\breview\b|\bwarning\b/.test(t)) return "warn";
  if (/\blow\b|\bpass\b|\bcomplete\b|\baccept\b/.test(t)) return "ok";
  return "info";
}

function splitLines(detail: string): string[] {
  if (detail.includes("\n")) {
    return detail
      .split("\n")
      .map((l) => l.replace(/^•\s*/, "").trim())
      .filter(Boolean);
  }
  if (detail.includes("•")) {
    return detail
      .split("•")
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return [];
}

function ScoreBars({ detail }: { detail: string }) {
  const parts = detail.split(" · ").map((p) => p.trim()).filter(Boolean);
  const rows = parts
    .map((part) => {
      // "Forensic: 39.8" or "Trust: 50/100" — never concatenate digits
      const m = part.match(/^(.+?):\s*([\d.]+)/);
      if (!m) return null;
      const value = Number(m[2]);
      if (!Number.isFinite(value)) return null;
      return { label: m[1].trim(), value };
    })
    .filter((x): x is { label: string; value: number } => x != null);

  if (!rows.length) {
    return (
      <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.65 }}>
        {detail}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      {rows.map((row) => {
        const pct = Math.min(Math.max(row.value, 0), 100);
        const color = pct >= 70 ? "#C50F1F" : pct >= 35 ? "#D97706" : "#107C10";
        return (
          <Box key={row.label}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: DASHBOARD.textPrimary }}>
                {row.label}
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color }}>
                {Number.isInteger(row.value) ? row.value : row.value.toFixed(1)}
                <Box component="span" sx={{ fontWeight: 600, color: DASHBOARD.textMuted }}>
                  /100
                </Box>
              </Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 999, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
              <Box
                sx={{
                  width: `${pct}%`,
                  height: "100%",
                  backgroundColor: color,
                  borderRadius: 999,
                }}
              />
            </Box>
          </Box>
        );
      })}
      <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted }}>
        Higher contribution = stronger signal toward fraud risk.
      </Typography>
    </Box>
  );
}

function IssueList({ lines }: { lines: string[] }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      {lines.map((line) => {
        const [title, ...rest] = line.split(" — ");
        const meaning = rest.join(" — ");
        const tone = severityFromText(line);
        const style = TONE[tone];
        return (
          <Box
            key={line}
            sx={{
              display: "flex",
              gap: 1.5,
              p: 1.5,
              borderRadius: "12px",
              backgroundColor: style.bg,
              border: `1px solid ${style.color}22`,
              borderLeft: `4px solid ${style.color}`,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: DASHBOARD.textPrimary }}>
                {title}
              </Typography>
              {meaning && (
                <Typography sx={{ fontSize: "0.8125rem", color: DASHBOARD.textSecondary, mt: 0.35, lineHeight: 1.55 }}>
                  {meaning}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function EvidenceList({ lines }: { lines: string[] }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      {lines.map((line) => {
        const tone = severityFromText(line);
        const style = TONE[tone];
        // Prefer "Title: body" when present
        const idx = line.indexOf(": ");
        const title = idx > 0 ? line.slice(0, idx) : line;
        const body = idx > 0 ? line.slice(idx + 2) : "";
        return (
          <Box
            key={line}
            sx={{
              p: 1.75,
              borderRadius: "12px",
              backgroundColor: "#FFFFFF",
              border: `1px solid ${DASHBOARD.borderLight}`,
              borderLeft: `4px solid ${style.color}`,
            }}
          >
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: DASHBOARD.textPrimary, mb: body ? 0.5 : 0 }}>
              {title}
            </Typography>
            {body && (
              <Typography sx={{ fontSize: "0.8125rem", color: DASHBOARD.textSecondary, lineHeight: 1.6 }}>
                {body}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function FindingBody({ finding }: { finding: Finding }) {
  const title = finding.title.toLowerCase();
  const lines = splitLines(finding.detail);

  if (title.includes("score")) {
    return <ScoreBars detail={finding.detail} />;
  }

  if (title.includes("issue") || title.includes("risk factor")) {
    return <IssueList lines={lines.length ? lines : [finding.detail]} />;
  }

  if (title.includes("evidence")) {
    return <EvidenceList lines={lines.length ? lines : [finding.detail]} />;
  }

  if (lines.length >= 2) {
    return <IssueList lines={lines} />;
  }

  return (
    <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.7 }}>
      {finding.detail}
    </Typography>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const tone = findingTone(finding.title);
  const style = TONE[tone];
  const Icon = findingIcon(finding.title);

  return (
    <Box
      sx={{
        borderRadius: "16px",
        border: `1px solid ${DASHBOARD.borderLight}`,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.25,
          py: 1.75,
          backgroundColor: style.bg,
          borderBottom: `1px solid ${DASHBOARD.borderLight}`,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            backgroundColor: "#FFFFFF",
            border: `1px solid ${style.color}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 18, color: style.color }} />
        </Box>
        <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: DASHBOARD.textPrimary }}>
          {finding.title}
        </Typography>
      </Box>
      <Box sx={{ px: 2.25, py: 2 }}>
        <FindingBody finding={finding} />
      </Box>
    </Box>
  );
}

interface ExecutiveReportProps {
  report: ExecReport;
}

export default function ExecutiveReport({ report }: ExecutiveReportProps) {
  const rec =
    RECOMMENDATION_STYLE[report.recommendation as RecommendationType] ?? DEFAULT_REC;
  const { Icon: RecIcon } = rec;
  const findings = report.findings.filter((f) => {
    const title = (f.title || "").trim().toLowerCase();
    const detail = (f.detail || "").trim();
    if (!title && !detail) return false;
    // Owned by Forensic Indicators / Tamper Map / Technical Analysis / Overview.
    if (
      title.includes("evidence on the document") ||
      title.includes("score breakdown") ||
      title.includes("pdf fraud subscore")
    ) {
      return false;
    }
    return true;
  });

  if (!report.recommendation && findings.length === 0) {
    return null;
  }

  return (
    <SectionShell
      title="Recommendation & Findings"
      icon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.accent}
      emphasis="primary"
      noPadding
    >
      <Box sx={{ px: { xs: 2, sm: 2.75 }, pt: { xs: 2, sm: 2.25 }, pb: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            pb: 1.75,
            mb: 0.5,
            borderBottom: `1px solid ${DASHBOARD.borderLight}`,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: "0.5625rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: DASHBOARD.textMuted,
                mb: 0.35,
              }}
            >
              {REPORT_TITLE}
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: DASHBOARD.textPrimary }}>
              Prepared by {PRODUCT_NAME}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: DASHBOARD.navy,
              flexShrink: 0,
            }}
          >
            {ORGANIZATION_NAME}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ px: { xs: 2, sm: 2.75 }, py: { xs: 2.25, sm: 2.75 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.75,
            p: { xs: 2, sm: 2.5 },
            background: rec.bgGradient,
            border: `1px solid ${rec.color}33`,
            borderRadius: "12px",
            mb: findings.length > 0 ? 2.5 : 0,
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor: rec.color,
            },
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              border: `1px solid ${rec.color}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <RecIcon sx={{ fontSize: 22, color: rec.color }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: "0.625rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: DASHBOARD.textMuted,
                mb: 0.35,
              }}
            >
              Recommendation
            </Typography>
            <Typography sx={{ fontSize: { xs: "1rem", sm: "1.125rem" }, fontWeight: 700, color: rec.color }}>
              {rec.label}
            </Typography>
          </Box>
        </Box>

        {findings.length > 0 && (
          <>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: DASHBOARD.textMuted,
                mb: 1.5,
              }}
            >
              Key Findings
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {findings.map((finding, index) => (
                <FindingCard key={`${finding.title}-${index}`} finding={finding} />
              ))}
            </Box>
          </>
        )}
      </Box>
    </SectionShell>
  );
}
