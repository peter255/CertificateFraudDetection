/**
 * VendorAnalysis — Section 5: Vendor Analysis
 * Vendor cards with radial confidence meters.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import type { VendorFinding } from "../../types/verification";
import { RadialMeter } from "./shared/dashboardCharts";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

interface StatusStyle {
  label: string;
  color: string;
  bgColor: string;
  Icon: typeof CheckCircleIcon;
}

function resolveStatusStyle(status: string): StatusStyle {
  const normalized = status.toLowerCase();

  if (normalized.includes("authentic") || normalized.includes("pass")) {
    return { label: status, color: "#107C10", bgColor: "#ECFDF5", Icon: CheckCircleIcon };
  }
  if (normalized.includes("fraud") || normalized.includes("fail") || normalized.includes("reject")) {
    return { label: status, color: "#C50F1F", bgColor: "#FEF2F2", Icon: CancelIcon };
  }
  if (
    normalized.includes("inconclusive") ||
    normalized.includes("suspicious") ||
    normalized.includes("warning") ||
    normalized.includes("pending")
  ) {
    return { label: status, color: "#D97706", bgColor: "#FFFBEB", Icon: WarningAmberIcon };
  }

  return { label: status || "Unknown", color: "#64748B", bgColor: "#F8FAFC", Icon: HelpOutlineOutlinedIcon };
}

function VendorCard({ finding }: { finding: VendorFinding }) {
  const style = resolveStatusStyle(finding.status);
  const { Icon } = style;
  const confidencePct = Math.round(finding.confidenceScore * 1000) / 10;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2.5,
        p: 2.5,
        borderRadius: "14px",
        backgroundColor: "#F8FAFC",
        border: `1px solid ${DASHBOARD.borderLight}`,
        flexWrap: "wrap",
      }}
    >
      <RadialMeter value={confidencePct} color={style.color} size={72} />

      <Box sx={{ flex: 1, minWidth: 160 }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: DASHBOARD.textPrimary, mb: 0.25 }}>
          {finding.vendor}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted, mb: 1.5 }}>
          Forensic verification provider
        </Typography>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.5,
            py: 0.625,
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
      </Box>

      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: DASHBOARD.textMuted, mb: 0.25 }}>
          Confidence
        </Typography>
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: style.color, fontVariantNumeric: "tabular-nums" }}>
          {confidencePct}%
        </Typography>
      </Box>
    </Box>
  );
}

interface VendorAnalysisProps {
  vendorFindings: VendorFinding[];
}

export default function VendorAnalysis({ vendorFindings }: VendorAnalysisProps) {
  return (
    <SectionShell
      title="Vendor Analysis"
      icon={<BusinessCenterIcon sx={{ fontSize: 18 }} />}
      badge={
        <SectionBadge>
          {vendorFindings.length} vendor{vendorFindings.length !== 1 ? "s" : ""}
        </SectionBadge>
      }
    >
      {vendorFindings.length === 0 ? (
        <Box
          sx={{
            py: 4,
            textAlign: "center",
            border: `2px dashed ${DASHBOARD.borderLight}`,
            borderRadius: "12px",
            backgroundColor: "#F8FAFC",
          }}
        >
          <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textMuted }}>
            No vendor analysis data available
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: -1 }}>
          {vendorFindings.map((finding) => (
            <VendorCard key={finding.vendor} finding={finding} />
          ))}
        </Box>
      )}
    </SectionShell>
  );
}
