/**
 * VerdictCard — Section 1: Verification Overview
 * Forensic command-center layout with SVG gauges and stat tiles.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SecurityIcon from "@mui/icons-material/Security";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
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
    label: "Authentic",
    description: "Document passed all forensic verification checks.",
    color: "#107C10",
    bgGradient: "linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)",
    Icon: CheckCircleIcon,
  },
  suspicious: {
    label: "Suspicious",
    description: "Anomalies detected — manual review recommended.",
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

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ArticleOutlinedIcon;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        flex: "1 1 140px",
        minWidth: 0,
        p: 2,
        borderRadius: "12px",
        backgroundColor: "#F8FAFC",
        border: `1px solid ${DASHBOARD.borderLight}`,
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "10px",
          backgroundColor: "#FFFFFF",
          border: `1px solid ${DASHBOARD.borderLight}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 18, color: DASHBOARD.accent }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "0.5625rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
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
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

interface VerdictCardProps {
  verdict: VerdictType;
  confidence: number;
  riskScore: number;
  documentType: string;
  issuingAuthority: string;
  issueDate: string;
  holderName: string;
  riskLevel: RiskLevel;
}

export default function VerdictCard({
  verdict,
  confidence,
  riskScore,
  documentType,
  issuingAuthority,
  issueDate,
  holderName,
  riskLevel,
}: VerdictCardProps) {
  const cfg = VERDICT_CONFIG[verdict];
  const { Icon } = cfg;
  const riskColor = RISK_COLOR[riskLevel];

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
          borderBottom: `1px solid ${DASHBOARD.borderLight}`,
          backgroundColor: "#FAFBFD",
        }}
      >
        <CircularGauge
          value={confidence}
          label="Confidence Score"
          color={cfg.color}
          size={150}
        />
        <CircularGauge
          value={riskScore}
          max={100}
          label="Risk Score"
          sublabel="/ 100"
          color={riskColor}
          size={150}
        />
      </Box>

      <Box sx={{ px: 3, py: 3, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <StatTile icon={ArticleOutlinedIcon} label="Document Type" value={documentType} />
        <StatTile icon={AccountBalanceOutlinedIcon} label="Issuing Authority" value={issuingAuthority} />
        <StatTile icon={PersonOutlinedIcon} label="Holder" value={holderName} />
        <StatTile icon={CalendarTodayOutlinedIcon} label="Issue Date" value={issueDate} />
      </Box>
    </SectionShell>
  );
}
