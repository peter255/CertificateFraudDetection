import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { VS } from "../../theme";

export const ANALYSIS_STAGES = [
  {
    title: "OCR Text Extraction",
    description: "Parsing glyphs, layout, and metadata",
  },
  {
    title: "LLM Logic Consistency",
    description: "Cross-checking dates, IDs, and grades",
  },
  {
    title: "Text Manipulation API",
    description: "Detecting edits and font substitutions",
  },
  {
    title: "Image Manipulation API",
    description: "Copy-move, splicing, resampling",
  },
  {
    title: "File Structure Verification",
    description: "XMP, incremental saves, embedded fonts",
  },
  {
    title: "LLM Consolidation",
    description: "Synthesizing evidence into a verdict",
  },
] as const;

type StepStatus = "complete" | "active" | "pending";

interface AnalysisProgressProps {
  currentStep: number;
  progress: number;
}

export default function AnalysisProgress({
  currentStep,
}: AnalysisProgressProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        "@keyframes apFadeUp": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        animation: "apFadeUp 0.35s ease-out",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.8125rem",
          color: VS.textSecondary,
          mb: 0.75,
          lineHeight: 1.5,
        }}
      >
        Six stages, executed in sequence. Do not close this window.
      </Typography>

      {ANALYSIS_STAGES.map((stage, index) => {
        const status: StepStatus =
          index < currentStep
            ? "complete"
            : index === currentStep
              ? "active"
              : "pending";

        return (
          <Box
            key={stage.title}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.75,
              px: 2,
              py: 1.75,
              borderRadius: "10px",
              border: "1px solid",
              borderColor:
                status === "active"
                  ? VS.accent
                  : status === "complete"
                    ? VS.border
                    : VS.border,
              backgroundColor:
                status === "active"
                  ? VS.accentDim
                  : status === "complete"
                    ? VS.bgPanel
                    : VS.bgCard,
              opacity: status === "pending" ? 0.55 : 1,
              transition: "border-color 0.3s ease, opacity 0.3s ease, background-color 0.3s ease",
              boxShadow: "none",
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                backgroundColor:
                  status === "complete" ? VS.accent : "transparent",
                border:
                  status === "active"
                    ? `2px solid ${VS.accent}`
                    : status === "pending"
                      ? `1.5px solid ${VS.borderStrong}`
                      : "none",
              }}
            >
              {status === "complete" && (
                <CheckRoundedIcon sx={{ fontSize: 16, color: VS.onAccent }} />
              )}
              {status === "active" && (
                <CircularProgress
                  size={14}
                  thickness={5}
                  sx={{ color: VS.accent }}
                />
              )}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: VS.text,
                  lineHeight: 1.3,
                  mb: 0.25,
                }}
              >
                {stage.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: VS.textSecondary,
                  lineHeight: 1.4,
                }}
              >
                {stage.description}
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color:
                  status === "active"
                    ? VS.accent
                    : status === "complete"
                      ? VS.textMuted
                      : VS.textMuted,
                fontFamily: VS.mono,
                flexShrink: 0,
              }}
            >
              {status === "complete"
                ? "COMPLETE"
                : status === "active"
                  ? "PROCESSING"
                  : "PENDING"}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
