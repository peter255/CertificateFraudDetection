/**
 * VerificationPage — VERISCAN single verification workflow.
 *
 * idle:      Centered landing (upload)
 * uploaded:  Split — document preview + analyze CTA
 * analyzing: Split — document preview + 6-stage progress
 * results:   Full ResultsDashboard (doc + scores + findings)
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CropFreeIcon from "@mui/icons-material/CropFree";

import UploadZone from "../components/upload/UploadZone";
import AnalysisProgress, {
  ANALYSIS_STAGES,
} from "../components/analysis/AnalysisProgress";
import DocumentViewer from "../components/viewer/DocumentViewer";
import ResultsDashboard from "../components/results/ResultsDashboard";
import { verifyDocument } from "../api/verificationApi";
import {
  PRODUCT_NAME,
  PRODUCT_PILLARS,
  PRODUCT_TAGLINE,
} from "../branding/constants";
import { VS } from "../theme";

type Step = "idle" | "uploaded" | "analyzing" | "results";

interface VerificationPageProps {
  onOpenBatch?: () => void;
  onNewAnalysis?: () => void;
  onScanMetaChange?: (meta: {
    scanId: string | null;
    pathLabel: string;
  }) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeScanId(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `#SCAN-${n}-${letter}`;
}

function SplitLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, md: 3.5 },
        pt: { xs: 2.5, md: 3 },
        pb: { xs: 6, md: 8 },
        maxWidth: 1400,
        mx: "auto",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 2.5, md: 3 },
          alignItems: { md: "flex-start" },
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            width: { xs: "100%", md: "auto" },
          }}
        >
          {right}
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: "100%", md: "46%" },
            minWidth: { md: 360 },
            maxWidth: { md: 560 },
            position: { md: "sticky" },
            top: { md: 72 },
            height: { xs: 420, md: "calc(100vh - 104px)" },
            maxHeight: { xs: 420, md: "calc(100vh - 104px)" },
            display: "flex",
            flexDirection: "column",
            order: { xs: -1, md: 0 },
          }}
        >
          {left}
        </Box>
      </Box>
    </Box>
  );
}

function ErrorCard({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message?: string | null;
}) {
  return (
    <Box
      sx={{
        backgroundColor: VS.dangerDim,
        border: `1px solid ${VS.danger}55`,
        borderRadius: "12px",
        p: { xs: 3, sm: 4 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: VS.danger }}>
        Verification Failed
      </Typography>
      <Typography sx={{ fontSize: "0.9375rem", color: VS.textSecondary, lineHeight: 1.6 }}>
        {message?.trim()
          ? message
          : "We couldn't complete the verification. Please try again."}
      </Typography>
      <Button
        variant="contained"
        onClick={onRetry}
        sx={{
          alignSelf: "flex-start",
          backgroundColor: VS.danger,
          color: "#fff",
          "&:hover": { backgroundColor: "#E03555" },
        }}
      >
        Try Again
      </Button>
    </Box>
  );
}

export default function VerificationPage({
  onOpenBatch,
  onNewAnalysis,
  onScanMetaChange,
}: VerificationPageProps) {
  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [verificationResult, setVerificationResult] = useState<
    Awaited<ReturnType<typeof verifyDocument>> | null
  >(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const syncMeta = useCallback(
    (nextStep: Step, id: string | null) => {
      if (!onScanMetaChange) return;
      const path =
        nextStep === "idle"
          ? "/"
          : nextStep === "results"
            ? "/REPORT"
            : nextStep === "analyzing"
              ? "/ANALYZE"
              : "/UPLOAD";
      onScanMetaChange({ scanId: id, pathLabel: path });
    },
    [onScanMetaChange]
  );

  const handleFileSelected = useCallback(
    (selected: File) => {
      const id = makeScanId();
      setFile(selected);
      setScanId(id);
      setVerificationResult(null);
      setPageCount(null);
      setError(false);
      setErrorMessage(null);
      setStep("uploaded");
      syncMeta("uploaded", id);
    },
    [syncMeta]
  );

  const startAnalysis = useCallback(async () => {
    if (!file) return;

    setStep("analyzing");
    syncMeta("analyzing", scanId);
    setProgress(0);
    setAnalysisStep(0);
    setError(false);
    setErrorMessage(null);

    const stageCount = ANALYSIS_STAGES.length;
    let count = 0;
    const interval = setInterval(() => {
      count = Math.min(count + 1, stageCount - 1);
      setAnalysisStep(count);
      setProgress((count / stageCount) * 100);
    }, 900);

    try {
      const result = await verifyDocument(file);
      clearInterval(interval);
      setAnalysisStep(stageCount);
      setProgress(100);
      setVerificationResult(result);
      setTimeout(() => {
        setStep("results");
        syncMeta("results", scanId);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setError(true);
      setErrorMessage(
        err instanceof Error ? err.message : "Verification failed."
      );
      setStep("uploaded");
      syncMeta("uploaded", scanId);
    }
  }, [file, scanId, syncMeta]);

  const reset = useCallback(() => {
    if (onNewAnalysis) {
      onNewAnalysis();
      return;
    }
    setStep("idle");
    setFile(null);
    setProgress(0);
    setAnalysisStep(0);
    setVerificationResult(null);
    setPageCount(null);
    setError(false);
    setErrorMessage(null);
    setScanId(null);
    syncMeta("idle", null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [onNewAnalysis, syncMeta]);

  useEffect(() => {
    if (step === "results") {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 250);
    }
  }, [step]);

  // Suppress unused pageCount warning — kept for future metadata wiring
  void pageCount;

  // ── Idle: VERISCAN landing ────────────────────────────────────────────────
  if (step === "idle") {
    return (
      <Box
        sx={{
          minHeight: "calc(100vh - 140px)",
          px: { xs: 3, sm: 4, md: 5 },
          pt: { xs: 6, sm: 8 },
          pb: { xs: 6, sm: 8 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Box sx={{ maxWidth: 720, width: "100%", textAlign: "center" }}>
          {/* Glow ring */}
          <Box
            sx={{
              width: 56,
              height: 56,
              mx: "auto",
              mb: 3,
              borderRadius: "50%",
              border: `2px solid ${VS.accent}`,
              boxShadow: `0 0 32px ${VS.accentGlow}, inset 0 0 16px ${VS.accentDim}`,
              "@keyframes ringPulse": {
                "0%, 100%": { boxShadow: `0 0 24px ${VS.accentGlow}` },
                "50%": { boxShadow: `0 0 40px ${VS.accentGlow}` },
              },
              animation: "ringPulse 3s ease-in-out infinite",
            }}
          />

          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: VS.accent,
              fontFamily: VS.mono,
              mb: 1.75,
            }}
          >
            {PRODUCT_TAGLINE}
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: "2rem", sm: "2.75rem" },
              fontWeight: 700,
              letterSpacing: "-0.035em",
              color: VS.text,
              mb: 1,
              lineHeight: 1.1,
            }}
          >
            {PRODUCT_NAME}
          </Typography>

          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: VS.textMuted,
              mb: 1.75,
            }}
          >
            {PRODUCT_PILLARS}
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: "0.9375rem", sm: "1.0625rem" },
              color: VS.textSecondary,
              lineHeight: 1.7,
              maxWidth: 440,
              mx: "auto",
              mb: 4.5,
            }}
          >
            Upload a certificate for deep-layer forensic analysis.
          </Typography>

          <UploadZone onFileSelected={handleFileSelected} />

          <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
            <Button
              variant="contained"
              disabled
              startIcon={<CropFreeIcon sx={{ fontSize: 18 }} />}
              sx={{
                height: 48,
                px: 3.5,
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.9375rem",
                opacity: 0.45,
                boxShadow: `0 0 20px ${VS.accentGlow}`,
                "&.Mui-disabled": {
                  backgroundColor: VS.accent,
                  color: VS.bg,
                },
              }}
            >
              Analyze Certificate
            </Button>
          </Box>

          <Typography
            sx={{
              mt: 1.5,
              fontSize: "0.75rem",
              color: VS.textMuted,
            }}
          >
            Drop a file above to enable analysis
          </Typography>

          {onOpenBatch && (
            <Box sx={{ mt: 2.5 }}>
              <Button
                variant="text"
                onClick={onOpenBatch}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  color: VS.accent,
                  fontSize: "0.8125rem",
                }}
              >
                Or verify a batch of certificates
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (step === "results" && verificationResult) {
    return (
      <Box ref={resultsRef}>
        <ResultsDashboard
          result={verificationResult}
          file={file}
          onVerifyAnother={reset}
          onPageCountChange={setPageCount}
        />
      </Box>
    );
  }

  // ── Uploaded / Analyzing split ────────────────────────────────────────────
  const leftPanel = (
    <DocumentViewer file={file} onPageCountChange={setPageCount} />
  );

  let rightPanel: React.ReactNode;

  if (step === "uploaded" && error) {
    rightPanel = <ErrorCard onRetry={startAnalysis} message={errorMessage} />;
  } else if (step === "uploaded" && file) {
    rightPanel = (
      <Box
        sx={{
          backgroundColor: VS.bgCard,
          border: `1px solid ${VS.border}`,
          borderRadius: "12px",
          p: { xs: 3, sm: 4 },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: VS.accent,
            fontFamily: VS.mono,
            mb: 1,
          }}
        >
          {PRODUCT_NAME} · READY
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: "1.25rem", sm: "1.5rem" },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: VS.text,
            mb: 0.75,
          }}
        >
          Ready to analyze
        </Typography>
        <Typography
          sx={{ fontSize: "0.9375rem", color: VS.textSecondary, mb: 3 }}
        >
          Run deep-layer forensic analysis on this document.
        </Typography>

        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.25,
            backgroundColor: "rgba(255,255,255,0.03)",
            border: `1px solid ${VS.border}`,
            borderRadius: "8px",
            mb: 3,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: VS.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 280,
                fontFamily: VS.mono,
              }}
            >
              {file.name}
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: VS.textMuted }}>
              {formatFileSize(file.size)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={startAnalysis}
            startIcon={<CropFreeIcon sx={{ fontSize: 18 }} />}
            sx={{
              height: 52,
              borderRadius: "8px",
              fontWeight: 700,
              boxShadow: `0 0 20px ${VS.accentGlow}`,
            }}
          >
            Analyze Certificate
          </Button>
          <Button
            variant="text"
            fullWidth
            onClick={reset}
            sx={{ height: 40, fontSize: "0.875rem" }}
          >
            Change file
          </Button>
        </Box>
      </Box>
    );
  } else if (step === "analyzing") {
    rightPanel = (
      <AnalysisProgress currentStep={analysisStep} progress={progress} />
    );
  }

  return <SplitLayout left={leftPanel} right={rightPanel} />;
}
