import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import { PRODUCT_NAME } from "../../branding/constants";

const ANALYSIS_STEPS = [
  "Uploading document",
  "Reading document structure",
  "Inspecting metadata",
  "Verifying authenticity",
  "Generating AI report",
];

type StepStatus = "complete" | "active" | "pending";

function CompleteDot() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="8" fill="#16A34A" />
      <path
        d="M4.5 8L7 10.5L11.5 5.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === "complete") return <CompleteDot />;

  if (status === "active") {
    return (
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid #0078D4",
          flexShrink: 0,
          position: "relative",
          "@keyframes activePulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.35 },
          },
          animation: "activePulse 1.6s ease-in-out infinite",
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "1.5px solid #D1D5DB",
        flexShrink: 0,
      }}
    />
  );
}

function LiveIndicator() {
  return (
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: "#0078D4",
        flexShrink: 0,
        "@keyframes liveBlink": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.15 },
        },
        animation: "liveBlink 1.4s ease-in-out infinite",
      }}
    />
  );
}

interface AnalysisProgressProps {
  currentStep: number;
  progress: number;
}

export default function AnalysisProgress({
  currentStep,
  progress,
}: AnalysisProgressProps) {
  const activeIndex = Math.min(currentStep, ANALYSIS_STEPS.length - 1);
  const currentLabel = ANALYSIS_STEPS[activeIndex];
  const isFinishing = currentStep >= ANALYSIS_STEPS.length;

  return (
    <Box
      sx={{
        backgroundColor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "14px",
        overflow: "hidden",
        "@keyframes apFadeUp": {
          from: { opacity: 0, transform: "translateY(14px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        animation: "apFadeUp 0.35s ease-out",
      }}
    >
      {/* Live status header */}
      <Box
        sx={{
          px: { xs: 3, sm: 4 },
          pt: 3.5,
          pb: 3,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.625rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#94A3B8",
            mb: 1.25,
          }}
        >
          {PRODUCT_NAME}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 0.75,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            {!isFinishing && <LiveIndicator />}
            <Typography
              sx={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "text.primary",
                letterSpacing: "-0.01em",
              }}
            >
              {isFinishing ? "Analysis complete" : currentLabel}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "text.secondary",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.min(currentStep, ANALYSIS_STEPS.length)} of{" "}
            {ANALYSIS_STEPS.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 2,
            borderRadius: 1,
            mt: 1.5,
            backgroundColor: "#F1F5F9",
            "& .MuiLinearProgress-bar": {
              borderRadius: 1,
              backgroundColor: "#0078D4",
              transition: "transform 0.6s ease",
            },
          }}
        />
      </Box>

      {/* Steps list */}
      <Box
        sx={{
          px: { xs: 3, sm: 4 },
          py: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2.25,
        }}
      >
        {ANALYSIS_STEPS.map((step, index) => {
          const status: StepStatus =
            index < currentStep
              ? "complete"
              : index === currentStep
              ? "active"
              : "pending";

          return (
            <Box
              key={step}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.75,
                opacity: status === "pending" ? 0.3 : 1,
                transition: "opacity 0.4s ease",
              }}
            >
              <StepDot status={status} />
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: status === "complete" ? 400 : status === "active" ? 500 : 400,
                  color: status === "complete" ? "text.secondary" : "text.primary",
                  transition: "color 0.3s ease",
                  textDecoration: status === "complete" ? "none" : "none",
                }}
              >
                {step}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
