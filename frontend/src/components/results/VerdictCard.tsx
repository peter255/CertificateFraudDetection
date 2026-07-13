/**
 * VerdictCard — Verification Overview with AI detection + score gauges.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SecurityIcon from "@mui/icons-material/Security";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import type { VerdictType, RiskLevel, AiDetection } from "../../types/verification";
import { CircularGauge } from "./shared/dashboardCharts";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";
import { aiDetectionYesNo, UNSUPPORTED_AI_DETECTION } from "../../utils/aiDetection";

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
  modelConfidence:
    "How sure the model is about its own prediction — not how trustworthy the document is.",
  aiProbability: "Likelihood the content was AI-generated or AI-altered.",
  trustScore:
    "Engine-assessed document trustworthiness — independent of model confidence.",
} as const;

const AI_TEAL = "#0F766E";

interface VerdictCardProps {
  verdict: VerdictType;
  confidence: number | null;
  trustScore?: number | null;
  aiProbability?: number | null;
  aiDetection?: AiDetection | null;
  riskLevel: RiskLevel;
}

export default function VerdictCard({
  verdict,
  confidence,
  trustScore = null,
  aiProbability = null,
  aiDetection = null,
  riskLevel,
}: VerdictCardProps) {
  const cfg = VERDICT_CONFIG[verdict];
  const { Icon } = cfg;
  const riskColor = RISK_COLOR[riskLevel];
  const trustColor = verdict === "authentic" ? cfg.color : riskColor;

  const detection = aiDetection ?? UNSUPPORTED_AI_DETECTION;
  const probability =
    detection.probability != null && Number.isFinite(detection.probability)
      ? detection.probability
      : aiProbability != null && Number.isFinite(aiProbability)
        ? aiProbability
        : null;
  const yesNo = aiDetectionYesNo(
    detection.supported
      ? { ...detection, probability }
      : UNSUPPORTED_AI_DETECTION
  );

  const showConfidence = confidence != null && Number.isFinite(confidence);
  const showAiProbability = probability != null;
  const showTrustScore = trustScore != null && Number.isFinite(trustScore);
  const gaugeCount =
    Number(showConfidence) + Number(showAiProbability) + Number(showTrustScore);
  const gaugeSize = gaugeCount >= 3 ? 112 : 132;

  const aiLabelColor =
    detection.label === "Likely AI Generated"
      ? "#C50F1F"
      : detection.label === "Likely Human Generated"
        ? "#107C10"
        : DASHBOARD.textMuted;

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
      {/* AI Generated Content — top of Overview; explicit engine fields only */}
      <Box
        sx={{
          px: { xs: 2, sm: 2.75 },
          py: { xs: 1.75, sm: 2 },
          borderBottom: `1px solid ${DASHBOARD.borderLight}`,
          backgroundColor: "#F8FAFB",
        }}
      >
        {!detection.supported || (probability == null && yesNo == null) ? (
          <Box>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: DASHBOARD.textMuted,
                mb: 0.5,
              }}
            >
              AI Detection
            </Typography>
            <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: DASHBOARD.textSecondary }}>
              Not Available
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ minWidth: 180 }}>
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: DASHBOARD.textMuted,
                  mb: 0.75,
                }}
              >
                AI Generated Content
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: aiLabelColor,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: { xs: "1rem", sm: "1.125rem" },
                    fontWeight: 700,
                    color: aiLabelColor,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {detection.label}
                </Typography>
              </Box>
              {yesNo != null && (
                <Box sx={{ mt: 1.25 }}>
                  <Typography
                    sx={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: DASHBOARD.textMuted,
                      mb: 0.35,
                    }}
                  >
                    AI Generated
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: DASHBOARD.textPrimary,
                    }}
                  >
                    {yesNo}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

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
              value={probability}
              label="AI Probability"
              description={SCORE_COPY.aiProbability}
              color={AI_TEAL}
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
