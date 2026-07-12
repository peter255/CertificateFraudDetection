/**
 * VerdictCard — Verification Overview with score gauges.
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
    description: "Analysis supports authenticity.",
    color: "#107C10",
    bgGradient: "linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)",
    Icon: CheckCircleIcon,
  },
  suspicious: {
    label: "Suspicious",
    description: "Result is uncertain — manual review recommended.",
    color: "#D97706",
    bgGradient: "linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)",
    Icon: WarningAmberIcon,
  },
  fraudulent: {
    label: "Potentially Fraudulent",
    description: "Strong indicators of tampering or forgery.",
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

const SCORE_COPY = {
  modelConfidence: "Confidence in the model prediction.",
  aiProbability: "Likelihood of AI-generated or AI-altered content.",
  trustScore: "Engine-assessed document trustworthiness.",
} as const;

interface VerdictCardProps {
  verdict: VerdictType;
  confidence: number | null;
  trustScore?: number | null;
  aiProbability?: number | null;
  riskLevel: RiskLevel;
}

export default function VerdictCard({
  verdict,
  confidence,
  trustScore = null,
  aiProbability = null,
  riskLevel,
}: VerdictCardProps) {
  const cfg = VERDICT_CONFIG[verdict];
  const { Icon } = cfg;
  const riskColor = RISK_COLOR[riskLevel];
  const trustColor = verdict === "authentic" ? cfg.color : riskColor;

  const showConfidence = confidence != null && Number.isFinite(confidence);
  const showAiProbability = aiProbability != null && Number.isFinite(aiProbability);
  const showTrustScore = trustScore != null && Number.isFinite(trustScore);
  const gaugeCount =
    Number(showConfidence) + Number(showAiProbability) + Number(showTrustScore);
  const gaugeSize = gaugeCount >= 3 ? 112 : 132;

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
          px: { xs: 2, sm: 2.75 },
          py: { xs: 2.25, sm: 2.75 },
          borderBottom: gaugeCount > 0 ? `1px solid ${DASHBOARD.borderLight}` : "none",
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "12px",
            backgroundColor: "#FFFFFF",
            border: `1.5px solid ${cfg.color}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 26, color: cfg.color }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography
            sx={{
              fontSize: { xs: "1.5rem", sm: "1.85rem" },
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: cfg.color,
              lineHeight: 1.1,
              mb: 0.5,
            }}
          >
            {cfg.label}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.5 }}>
            {cfg.description}
          </Typography>
        </Box>
      </Box>

      {gaugeCount > 0 && (
        <Box
          sx={{
            px: { xs: 2, sm: 2.75 },
            py: { xs: 2.5, sm: 3 },
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: { xs: 2.5, sm: 4 },
            flexWrap: "wrap",
            backgroundColor: "#FAFBFD",
          }}
        >
          {showConfidence && (
            <CircularGauge
              value={confidence}
              label="Model Confidence"
              description={SCORE_COPY.modelConfidence}
              color={cfg.color}
              size={gaugeSize}
            />
          )}
          {showAiProbability && (
            <CircularGauge
              value={aiProbability}
              label="AI Probability"
              description={SCORE_COPY.aiProbability}
              color="#0F766E"
              size={gaugeSize}
            />
          )}
          {showTrustScore && (
            <CircularGauge
              value={trustScore}
              max={100}
              label="Trust Score"
              sublabel="/ 100"
              description={SCORE_COPY.trustScore}
              color={trustColor}
              size={gaugeSize}
            />
          )}
        </Box>
      )}
    </SectionShell>
  );
}
