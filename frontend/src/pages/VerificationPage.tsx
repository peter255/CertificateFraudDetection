/**
 * VerificationPage — Root page for the single verification workflow.
 *
 * Layout strategy:
 *   - idle:      Centered single-column layout.  The upload zone is the
 *                only focal point; no competing panels.
 *   - uploaded / analyzing / results:
 *                Two-panel split on md+ screens.
 *                  LEFT  (sticky) — DocumentViewer, fixed width, fills viewport height
 *                  RIGHT (scroll) — Workflow content: CTA → progress → results
 *                Single column on xs/sm (left panel stacks above right).
 *
 * Timing:
 *   uploadTime   — Date captured when the user selects a file (real value).
 *   processingMs — Duration from startAnalysis() to results ready (real value).
 *   Both are passed to DocumentInfo to populate real fields without fake data.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import UploadZone from "../components/upload/UploadZone";
import AnalysisProgress from "../components/analysis/AnalysisProgress";
import DocumentViewer from "../components/viewer/DocumentViewer";
import VerdictCard from "../components/results/VerdictCard";
import ExecutiveSummaryCard, {
  resolveAiProbability,
  resolveEngineTrustScore,
} from "../components/results/ExecutiveSummaryCard";
import SignalsList from "../components/results/SignalsList";
import ExecutiveReport from "../components/results/ExecutiveReport";
import DocumentInfo from "../components/results/DocumentInfo";
import AnnotatedDocumentSection from "../components/results/AnnotatedDocumentSection";
import TechnicalDetails from "../components/results/TechnicalDetails";
import VendorAnalysis from "../components/results/VendorAnalysis";
import ActionsPanel from "../components/results/ActionsPanel";
import { InvestigationBanner } from "../components/results/shared/dashboardShell";
import { verifyDocument } from "../api/verificationApi";
import { buildDocumentInfoData } from "../utils/documentMetadata";
import type { DocumentInfoData, VerificationResult } from "../types/verification";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Step = "idle" | "uploaded" | "analyzing" | "results";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatProcessingTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatVerifiedAt(iso: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FileDocIcon() {
  return (
    <svg
      viewBox="0 0 20 24"
      width="18"
      height="22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M12 1H3a2 2 0 00-2 2v18a2 2 0 002 2h14a2 2 0 002-2V7L12 1z"
        fill="#F9FAFB"
        stroke="#D1D5DB"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 1v6h6"
        stroke="#D1D5DB"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5 13h10M5 17h6"
        stroke="#9CA3AF"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ErrorAlertIcon() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
      <circle cx="20" cy="20" r="19" stroke="#DC2626" strokeWidth="1.5" />
      <path
        d="M20 12v10"
        stroke="#DC2626"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="27" r="1.25" fill="#DC2626" />
    </svg>
  );
}

interface ErrorCardProps {
  onRetry: () => void;
  message?: string | null;
}

function ErrorCard({ onRetry, message }: ErrorCardProps) {
  return (
    <Box
      sx={{
        backgroundColor: "#FEF2F2",
        border: "1px solid",
        borderColor: "#FECACA",
        borderLeft: "4px solid #DC2626",
        borderRadius: "12px",
        p: { xs: 3, sm: 4.5 },
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2.5,
        "@keyframes errFadeUp": {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        animation: "errFadeUp 0.3s ease-out",
      }}
    >
      <ErrorAlertIcon />

      <Box>
        <Typography
          sx={{
            fontSize: { xs: "1.125rem", sm: "1.25rem" },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#B91C1C",
            mb: 0.75,
          }}
        >
          Verification Failed
        </Typography>
        <Typography
          sx={{
            fontSize: "0.9375rem",
            color: "#DC2626",
            opacity: 0.8,
            lineHeight: 1.6,
          }}
        >
          {message?.trim()
            ? message
            : "We couldn't complete the verification. Please try again."}
        </Typography>
      </Box>

      <Button
        variant="contained"
        onClick={onRetry}
        sx={{
          height: 44,
          px: 3,
          borderRadius: "10px",
          backgroundColor: "#DC2626",
          "&:hover": { backgroundColor: "#B91C1C" },
        }}
      >
        Try Again
      </Button>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Split-panel shell
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SplitLayout wraps the left (document viewer) and right (workflow) panels.
 * The left panel is sticky on desktop so it stays visible as the right panel
 * scrolls through analysis steps and results.
 */
function SplitLayout({
  left,
  right,
  variant = "default",
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  variant?: "default" | "dashboard";
}) {
  const isDashboard = variant === "dashboard";

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, md: isDashboard ? 4 : 5 },
        pt: { xs: 3, md: isDashboard ? 4 : 5 },
        pb: { xs: 8, md: isDashboard ? 7 : 10 },
        maxWidth: isDashboard ? 1680 : 1400,
        mx: "auto",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 3, md: isDashboard ? 4 : 4 },
          alignItems: { md: "flex-start" },
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: "100%", md: "38%" },
            minWidth: { md: 360 },
            maxWidth: { md: 520 },
            position: { md: "sticky" },
            top: { md: "64px" },
            height: { xs: 420, md: "calc(100vh - 96px)" },
            maxHeight: { xs: 420, md: "calc(100vh - 96px)" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          {left}
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            width: { xs: "100%", md: isDashboard ? "62%" : "auto" },
          }}
        >
          {right}
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VerificationPage
// ─────────────────────────────────────────────────────────────────────────────

export default function VerificationPage() {
  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [uploadTime, setUploadTime] = useState<Date | null>(null);
  const [processingMs, setProcessingMs] = useState<number | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleFileSelected = useCallback((selected: File) => {
    setFile(selected);
    setUploadTime(new Date());
    setProcessingMs(null);
    setVerificationResult(null);
    setPageCount(null);
    setError(false);
    setErrorMessage(null);
    setStep("uploaded");
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!file) return;

    setStep("analyzing");
    setProgress(0);
    setAnalysisStep(0);
    setError(false);
    setErrorMessage(null);
    const startTime = Date.now();

    // Animate progress steps while the API call is in-flight.
    let count = 0;
    const interval = setInterval(() => {
      count = Math.min(count + 1, 4);
      setAnalysisStep(count);
      setProgress((count / 5) * 100);
    }, 900);

    try {
      const result = await verifyDocument(file);

      clearInterval(interval);
      setAnalysisStep(5);
      setProgress(100);
      setVerificationResult(result);
      setProcessingMs(Date.now() - startTime);

      setTimeout(() => setStep("results"), 500);
    } catch (err) {
      clearInterval(interval);
      setError(true);
      setErrorMessage(err instanceof Error ? err.message : "Verification failed.");
      setStep("uploaded");
    }
  }, [file]);

  const reset = useCallback(() => {
    setStep("idle");
    setFile(null);
    setProgress(0);
    setAnalysisStep(0);
    setUploadTime(null);
    setProcessingMs(null);
    setVerificationResult(null);
    setPageCount(null);
    setError(false);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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

  // Build DocumentInfoData from real available file + engine metadata only.
  const documentInfo: DocumentInfoData | null = buildDocumentInfoData({
    file,
    result: step === "results" ? verificationResult : null,
    pageCount,
    uploadTime,
    processingMs,
    formatUploadTime,
    formatProcessingTime,
    formatVerifiedAt,
  });

  // ── Idle state: premium investigation landing ──────────────────────────────
  if (step === "idle") {
    const capabilities = [
      "AI verification",
      "Fraud detection",
      "Metadata analysis",
      "OCR validation",
      "Multi-layer checks",
      "Executive report",
    ];

    const pipeline = [
      { step: "01", title: "Upload", detail: "PDF, JPG, or PNG" },
      { step: "02", title: "Analyze", detail: "AI + forensic signals" },
      { step: "03", title: "Investigate", detail: "Risk & authenticity" },
      { step: "04", title: "Report", detail: "Executive findings" },
    ];

    return (
      <Box
        sx={{
          minHeight: "calc(100vh - 140px)",
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(0,120,212,0.07) 0%, transparent 50%), #F4F7FB",
          px: { xs: 3, sm: 4, md: 5 },
          pt: { xs: 4, sm: 5.5 },
          pb: { xs: 6, sm: 8 },
        }}
      >
        <Box sx={{ maxWidth: 920, width: "100%", mx: "auto" }}>
          <Box sx={{ mb: { xs: 3.5, sm: 4 }, textAlign: "center" }}>
            <Typography
              sx={{
                display: "inline-block",
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#0078D4",
                mb: 1.75,
              }}
            >
              Certificate Investigation Platform
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "2rem", sm: "2.5rem" },
                fontWeight: 700,
                letterSpacing: "-0.035em",
                color: "#0F172A",
                mb: 1.5,
                lineHeight: 1.15,
              }}
            >
              Verify a Certificate
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "0.9375rem", sm: "1.0625rem" },
                color: "#64748B",
                lineHeight: 1.7,
                maxWidth: 520,
                mx: "auto",
              }}
            >
              Run AI-powered authenticity checks, forgery indicators, and a full
              investigation report in one workspace.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 1,
              mb: { xs: 3, sm: 3.5 },
            }}
          >
            {capabilities.map((label) => (
              <Box
                key={label}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#0078D4",
                    opacity: 0.7,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#334155",
                    letterSpacing: "0.01em",
                  }}
                >
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>

          <UploadZone onFileSelected={handleFileSelected} />

          <Box
            sx={{
              mt: { xs: 3.5, sm: 4.5 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
              gap: 1.5,
            }}
          >
            {pipeline.map((item) => (
              <Box
                key={item.step}
                sx={{
                  px: 2,
                  py: 2.25,
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#0078D4",
                    mb: 0.75,
                  }}
                >
                  Step {item.step}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    mb: 0.35,
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.5 }}>
                  {item.detail}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              mt: 2,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 1.5,
            }}
          >
            {[
              { label: "Analysis", value: "AI forensic authenticity checks" },
              { label: "Security", value: "Encrypted in transit · no public sharing" },
              { label: "Output", value: "Executive risk & evidence pack" },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  px: 2.25,
                  py: 2,
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  backgroundColor: "rgba(255,255,255,0.7)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#94A3B8",
                    mb: 0.75,
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#334155", lineHeight: 1.45 }}
                >
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Non-idle states: split-panel layout ───────────────────────────────────

  const leftPanel = (
    <DocumentViewer
      file={file}
      onPageCountChange={setPageCount}
      variant="default"
    />
  );

  let rightPanel: React.ReactNode;

  // ── uploaded + error: friendly error card ──────────────────────────────────
  if (step === "uploaded" && error) {
    rightPanel = <ErrorCard onRetry={startAnalysis} message={errorMessage} />;
  }

  // ── uploaded + no error: CTA to start analysis ─────────────────────────────
  else if (step === "uploaded" && file) {
    rightPanel = (
      <Box
        sx={{
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "14px",
          p: { xs: 3, sm: 4.5 },
          "@keyframes ctaFadeUp": {
            from: { opacity: 0, transform: "translateY(12px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          animation: "ctaFadeUp 0.3s ease-out",
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: "1.25rem", sm: "1.5rem" },
            fontWeight: 600,
            letterSpacing: "-0.02em",
            mb: 0.75,
          }}
        >
          Ready to verify
        </Typography>
        <Typography
          sx={{ fontSize: "0.9375rem", color: "text.secondary", mb: 3.5 }}
        >
          Run AI-powered forensic analysis on this document.
        </Typography>

        {/* File chip */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.25,
            backgroundColor: "#F9FAFB",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px",
            mb: 3.5,
          }}
        >
          <FileDocIcon />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 280,
              }}
            >
              {file.name}
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
              {formatFileSize(file.size)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={startAnalysis}
            sx={{ height: 52, borderRadius: "10px" }}
          >
            Begin Verification
          </Button>
          <Button
            variant="text"
            fullWidth
            onClick={reset}
            sx={{
              height: 40,
              color: "text.secondary",
              fontSize: "0.875rem",
              "&:hover": { color: "text.primary", backgroundColor: "transparent" },
            }}
          >
            Change file
          </Button>
        </Box>
      </Box>
    );
  }

  // ── analyzing: progress panel ───────────────────────────────────────────────
  else if (step === "analyzing") {
    rightPanel = (
      <AnalysisProgress currentStep={analysisStep} progress={progress} />
    );
  }

  // ── results: full-width investigation layout (no side viewer) ──────────────
  else if (step === "results" && verificationResult) {
    const verifiedAtDisplay = formatVerifiedAt(verificationResult.verifiedAt) ?? "—";

    const VERDICT_DISPLAY: Record<string, { label: string; color: string }> = {
      authentic: { label: "Trusted", color: "#107C10" },
      suspicious: { label: "Suspicious", color: "#D97706" },
      fraudulent: { label: "Potentially Fraudulent", color: "#C50F1F" },
    };
    const verdictDisplay = VERDICT_DISPLAY[verificationResult.verdict] ?? VERDICT_DISPLAY.suspicious;

    return (
      <Box
        sx={{
          px: { xs: 2, sm: 3, md: 4 },
          pt: { xs: 3, md: 4 },
          pb: { xs: 8, md: 7 },
          maxWidth: 1680,
          mx: "auto",
        }}
      >
        <Box
          ref={resultsRef}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: 2.25, sm: 2.75 },
          }}
        >
          <InvestigationBanner
            fileName={file?.name ?? "certificate.pdf"}
            verdict={verdictDisplay.label}
            verdictColor={verdictDisplay.color}
            verifiedAt={verifiedAtDisplay}
            certificateId={verificationResult.certificateId}
          />

          <ExecutiveSummaryCard result={verificationResult} />

          <VerdictCard
            verdict={verificationResult.verdict}
            confidence={verificationResult.confidence}
            trustScore={resolveEngineTrustScore(verificationResult)}
            aiProbability={resolveAiProbability(verificationResult)}
            riskLevel={verificationResult.report.riskLevel}
          />

          {file && (
            <AnnotatedDocumentSection
              file={file}
              regions={verificationResult.tamperRegions}
              heatmapUrl={verificationResult.heatmapUrl}
            />
          )}

          <ExecutiveReport report={verificationResult.report} />

          <SignalsList signals={verificationResult.signals} />

          <TechnicalDetails
            signals={verificationResult.signals}
            technical={verificationResult.technical}
          />

          <VendorAnalysis vendorFindings={verificationResult.vendorFindings} />

          {documentInfo && <DocumentInfo data={documentInfo} />}

          <ActionsPanel
            result={verificationResult}
            fileName={file?.name ?? "certificate"}
            onVerifyAnother={reset}
          />
        </Box>
      </Box>
    );
  }

  return (
    <SplitLayout
      left={leftPanel}
      right={rightPanel}
      variant="default"
    />
  );
}
