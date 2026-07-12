/**
 * Engine Analysis — active verification engine results.
 * Displays only Engine V1 / Engine V2 — never vendor or implementation names.
 * Model Confidence lives in Verification Overview (not repeated here).
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import type { VendorFinding } from "../../types/verification";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

interface StatusStyle {
  label: string;
  color: string;
  bgColor: string;
  Icon: typeof CheckCircleIcon;
}

const INVALID = new Set(["", "-", "—", "unknown", "n/a", "na", "pending", "none"]);

function isRealText(value: string | null | undefined): value is string {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v.length > 0 && !INVALID.has(v);
}

function resolveStatusStyle(status: string | null): StatusStyle {
  const normalized = (status || "").toLowerCase();

  if (
    normalized.includes("authentic") ||
    normalized.includes("trusted") ||
    normalized.includes("pass") ||
    normalized.includes("completed") ||
    normalized.includes("clean") ||
    normalized.includes("real")
  ) {
    return {
      label: status || "Completed",
      color: "#107C10",
      bgColor: "#ECFDF5",
      Icon: CheckCircleIcon,
    };
  }
  if (
    normalized.includes("fraud") ||
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("forg")
  ) {
    return {
      label: status || "Failed",
      color: "#C50F1F",
      bgColor: "#FEF2F2",
      Icon: CancelIcon,
    };
  }
  if (
    normalized.includes("inconclusive") ||
    normalized.includes("suspicious") ||
    normalized.includes("warning") ||
    normalized.includes("review")
  ) {
    return {
      label: status || "Review",
      color: "#D97706",
      bgColor: "#FFFBEB",
      Icon: WarningAmberIcon,
    };
  }

  return {
    label: status || "",
    color: "#64748B",
    bgColor: "#F8FAFC",
    Icon: HelpOutlineOutlinedIcon,
  };
}

function engineDisplayName(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === "v1" || key.includes("engine v1") || key === "analysis v1") return "Engine V1";
  if (key === "v2" || key.includes("engine v2") || key === "analysis v2") return "Engine V2";
  if (key === "engine v1") return "Engine V1";
  if (key === "engine v2") return "Engine V2";
  if (key === "analysis" || key === "vendor") return "Engine V1";
  return raw.startsWith("Engine V") ? raw : "Engine V1";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.25,
        borderRadius: "10px",
        backgroundColor: "#FFFFFF",
        border: `1px solid ${DASHBOARD.borderLight}`,
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.5625rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: DASHBOARD.textMuted,
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: DASHBOARD.textPrimary,
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function EngineCard({ finding }: { finding: VendorFinding }) {
  const engineName = engineDisplayName(finding.vendor);
  const hasStatus = isRealText(finding.status);
  const hasResult = isRealText(finding.processingResult);

  const style = resolveStatusStyle(finding.status);
  const { Icon } = style;

  if (!hasStatus && !hasResult) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: 2.5,
        borderRadius: "14px",
        backgroundColor: "#F8FAFC",
        border: `1px solid ${DASHBOARD.borderLight}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: DASHBOARD.textPrimary, mb: 0.25 }}>
            {engineName}
          </Typography>
          {hasStatus && (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.625,
                mt: 1,
                borderRadius: "8px",
                backgroundColor: style.bgColor,
                border: `1px solid ${style.color}33`,
              }}
            >
              <Icon sx={{ fontSize: 14, color: style.color }} />
              <Typography
                sx={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: style.color,
                }}
              >
                {style.label}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {hasResult && (
        <DetailRow label="Processing Result" value={finding.processingResult!} />
      )}
    </Box>
  );
}

interface VendorAnalysisProps {
  vendorFindings: VendorFinding[];
}

export default function VendorAnalysis({ vendorFindings }: VendorAnalysisProps) {
  const cards = vendorFindings
    .map((finding) => ({ finding, key: engineDisplayName(finding.vendor) }))
    .filter(({ finding }) => {
      const hasStatus = isRealText(finding.status);
      const hasResult = isRealText(finding.processingResult);
      return hasStatus || hasResult;
    });

  if (cards.length === 0) {
    return null;
  }

  return (
    <SectionShell
      title="Engine Analysis"
      icon={<HubOutlinedIcon sx={{ fontSize: 18 }} />}
      badge={
        <SectionBadge>
          {cards.length} engine{cards.length !== 1 ? "s" : ""}
        </SectionBadge>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: -1 }}>
        {cards.map(({ finding, key }) => (
          <EngineCard key={key} finding={finding} />
        ))}
      </Box>
    </SectionShell>
  );
}
