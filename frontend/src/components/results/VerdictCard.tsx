/**
 * VerdictCard — Section 1: Verification Overview
 * Forensic command-center layout with SVG gauges.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SecurityIcon from "@mui/icons-material/Security";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import type { VerdictType, RiskLevel } from "../../types/verification";
import { CircularGauge } from "./shared/dashboardCharts";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

interface VerdictConfig {
  label: string;
  description: string;
  color: string;
  bgGradient: string;
  Icon: typeof CheckCircleIcon;
}

const VERDICT_CONFIG: Record<VerdictType, VerdictConfig> = {
  authentic: {
    label: "Trusted",
    description: "High-confidence analysis supports authenticity.",
    color: "#107C10",
    bgGradient: "linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)",
    Icon: CheckCircleIcon,
  },
  suspicious: {
    label: "Suspicious",
    description: "Result is uncertain or weakly supported — manual review recommended.",
    color: "#D97706",
    bgGradient: "linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)",
    Icon: WarningAmberIcon,
  },
  fraudulent: {
    label: "Potentially Fraudulent",
    description: "Strong indicators of tampering or forgery detected.",
    color: "#C50F1F",
    bgGradient: "linear-gradient(180deg, #FEF2F2 0%, #FFFFFF 100%)",
    Icon: CancelIcon,
  },
};

const RISK_LABEL: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High" };
const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#107C10",
  medium: "#D97706",
  high: "#C50F1F",
};

interface VerdictCardProps {
  verdict: VerdictType;
  confidence: number;
  trustScore: number;
  riskLevel: RiskLevel;
}

export default function VerdictCard({
  verdict,
  confidence,
  trustScore,
  riskLevel,
}: VerdictCardProps) {
  const cfg = VERDICT_CONFIG[verdict];
  const { Icon } = cfg;
  const riskColor = RISK_COLOR[riskLevel];
  const trustColor = verdict === "authentic" ? cfg.color : riskColor;

  return (
    <SectionShell
      title="Verification Overview"
      icon={<SecurityIcon sx={{ fontSize: 18 }} />}
      accentColor={cfg.color}
      emphasis="primary"
      badge={
        <SectionBadge color={`${riskColor}18`}>
          <Box component="span" sx={{ color: riskColor }}>
            {RISK_LABEL[riskLevel]} Risk
          </Box>
        </SectionBadge>
      }
      noPadding
    >
      <Box
        sx={{
          background: cfg.bgGradient,
          px: 3,
          py: 3,
          borderBottom: `1px solid ${DASHBOARD.borderLight}`,
          display: "flex",
          alignItems: "center",
          gap: 2.5,
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "14px",
            backgroundColor: "#FFFFFF",
            border: `1.5px solid ${cfg.color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 30, color: cfg.color }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography
            sx={{
              fontSize: { xs: "1.75rem", sm: "2.25rem" },
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: cfg.color,
              lineHeight: 1,
              mb: 0.75,
            }}
          >
            {cfg.label}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.5 }}>
            {cfg.description}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          px: 3,
          py: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 3, sm: 6 },
          flexWrap: "wrap",
          backgroundColor: "#FAFBFD",
        }}
      >
        <CircularGauge
          value={confidence}
          label="Model Confidence"
          color={cfg.color}
          size={150}
        />
        <CircularGauge
          value={trustScore}
          max={100}
          label="Trust Score"
          sublabel="/ 100"
          color={trustColor}
          size={150}
        />
      </Box>
    </SectionShell>
  );
}
