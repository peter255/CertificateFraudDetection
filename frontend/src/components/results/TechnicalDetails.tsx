/**
 * Technical Analysis — executive forensic investigation report.
 * Human-language cards only. Raw payloads live in Developer Technical Details.
 */

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import ScienceIcon from "@mui/icons-material/Science";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import type { VerificationResult } from "../../types/verification";
import {
  buildForensicReport,
  forensicStatusStyle,
  type ForensicCard,
  type ForensicStatus,
  type TimelineStep,
} from "../../utils/forensicAnalysis";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

function StatusIcon({ status }: { status: ForensicStatus }) {
  const style = forensicStatusStyle(status);
  const sx = { fontSize: 16, color: style.color };
  if (status === "passed") return <CheckCircleIcon sx={sx} />;
  if (status === "warning") return <WarningAmberIcon sx={sx} />;
  if (status === "failed") return <CancelIcon sx={sx} />;
  if (status === "informed") return <InfoOutlinedIcon sx={sx} />;
  return <HelpOutlineOutlinedIcon sx={sx} />;
}

function StatusBadge({ status }: { status: ForensicStatus }) {
  const style = forensicStatusStyle(status);
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        px: 1.1,
        py: 0.4,
        borderRadius: "8px",
        backgroundColor: style.bg,
        border: `1px solid ${style.color}33`,
        flexShrink: 0,
      }}
    >
      <StatusIcon status={status} />
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
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography
      sx={{
        fontSize: "0.5625rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: DASHBOARD.textMuted,
        mb: 0.4,
      }}
    >
      {children}
    </Typography>
  );
}

function ForensicEvidenceCard({ card }: { card: ForensicCard }) {
  const style = forensicStatusStyle(card.status);
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: "14px",
        backgroundColor: "#FFFFFF",
        border: `1px solid ${DASHBOARD.borderLight}`,
        borderTop: `3px solid ${style.color}`,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        minHeight: 220,
        boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: DASHBOARD.textPrimary, lineHeight: 1.3 }}>
          {card.title}
        </Typography>
        <StatusBadge status={card.status} />
      </Box>

      <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}>
        {card.description}
      </Typography>

      {card.metric && (
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: "10px",
            backgroundColor: "#F8FAFC",
            border: `1px solid ${DASHBOARD.borderLight}`,
          }}
        >
          <FieldLabel>{card.metric.label}</FieldLabel>
          <Typography
            sx={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: DASHBOARD.textPrimary,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {card.metric.value}
          </Typography>
        </Box>
      )}

      <Box>
        <FieldLabel>Finding</FieldLabel>
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: DASHBOARD.textPrimary, lineHeight: 1.5 }}>
          {card.finding}
        </Typography>
      </Box>

      <Box sx={{ mt: "auto" }}>
        <FieldLabel>Business Interpretation</FieldLabel>
        <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}>
          {card.interpretation}
        </Typography>
      </Box>
    </Box>
  );
}

function InvestigationTimeline({ steps }: { steps: TimelineStep[] }) {
  if (steps.length === 0) return null;

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 2.75 },
        py: { xs: 2.25, sm: 2.75 },
        borderBottom: `1px solid ${DASHBOARD.borderLight}`,
        backgroundColor: "#F8FAFC",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <AccountTreeOutlinedIcon sx={{ fontSize: 18, color: DASHBOARD.accent }} />
        <Box>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: DASHBOARD.textPrimary }}>
            Investigation Timeline
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted, mt: 0.25 }}>
            Completed steps reported for this verification.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <Box key={step.id} sx={{ display: "flex", gap: 1.5, minHeight: isLast ? 28 : 44 }}>
              <Box
                sx={{
                  width: 22,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    backgroundColor: step.complete ? "#ECFDF5" : "#F1F5F9",
                    border: `1.5px solid ${step.complete ? "#107C10" : DASHBOARD.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                >
                  {step.complete ? (
                    <CheckCircleIcon sx={{ fontSize: 14, color: "#107C10" }} />
                  ) : (
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: DASHBOARD.textMuted }} />
                  )}
                </Box>
                {!isLast && (
                  <Box
                    sx={{
                      width: 2,
                      flex: 1,
                      backgroundColor: DASHBOARD.border,
                      my: 0.35,
                    }}
                  />
                )}
              </Box>
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: DASHBOARD.textPrimary,
                  pt: 0.15,
                  lineHeight: 1.4,
                }}
              >
                {step.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function DeveloperTechnicalDetails({ payload }: { payload: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  return (
    <Box sx={{ borderTop: `1px solid ${DASHBOARD.borderLight}` }}>
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        sx={{
          px: { xs: 2, sm: 2.75 },
          py: 1.75,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          cursor: "pointer",
          backgroundColor: open ? "#F1F5F9" : "#FAFBFD",
          "&:hover": { backgroundColor: "#F1F5F9" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <CodeOutlinedIcon sx={{ fontSize: 18, color: DASHBOARD.textMuted }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: DASHBOARD.textPrimary }}>
              Developer Technical Details
            </Typography>
            <Typography sx={{ fontSize: "0.6875rem", color: DASHBOARD.textMuted }}>
              Raw engine payloads for engineering and audit support. Collapsed by default.
            </Typography>
          </Box>
        </Box>
        <ExpandMoreIcon
          sx={{
            fontSize: 22,
            color: DASHBOARD.textMuted,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.75 },
            pb: 2.5,
            backgroundColor: "#0F172A",
          }}
        >
          <Box
            component="pre"
            sx={{
              m: 0,
              mt: 2,
              p: 2,
              borderRadius: "10px",
              backgroundColor: "#020617",
              color: "#E2E8F0",
              fontSize: "0.6875rem",
              lineHeight: 1.55,
              overflow: "auto",
              maxHeight: 420,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            {json}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

interface TechnicalDetailsProps {
  /** @deprecated Prefer passing `result`. */
  signals?: unknown;
  technical?: VerificationResult["technical"] | null;
  /** Preferred: full result for forensic cards (structure, AI, timeline). */
  result?: VerificationResult | null;
}

export default function TechnicalDetails({
  technical = null,
  result = null,
}: TechnicalDetailsProps) {
  const report = useMemo(() => {
    if (result) return buildForensicReport(result);
    if (!technical) return null;
    // Legacy technical-only path (batch callers may still pass technical alone).
    const stub = {
      certificateId: "",
      verdict: "suspicious" as const,
      confidence: 0,
      aiProbability: null,
      aiDetection: {
        supported: false,
        probability: null,
        label: "Unknown" as const,
        explanation: null,
      },
      engineTrustScore: null,
      documentType: null,
      issuingAuthority: null,
      holderName: null,
      issueDate: null,
      verifiedAt: "",
      aiSummary: "",
      signals: [],
      report: {
        summary: "",
        riskLevel: "medium" as const,
        riskScore: 50,
        trustScore: 50,
        findings: [],
        recommendation: "",
      },
      vendorFindings: [],
      tamperRegions: [],
      engineDurationMs: null,
      engineVerdictLabel: null,
      analysisStatus: technical.analysisStatus,
      fraudScore: null,
      fraudColor: null,
      isScan: null,
      fileKind: null,
      technical,
    };
    return buildForensicReport(stub);
  }, [result, technical]);

  if (!report) return null;

  const providedCount = report.cards.filter((c) => c.status !== "unavailable").length;

  return (
    <SectionShell
      title="Technical Analysis"
      icon={<ScienceIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.accent}
      emphasis="primary"
      badge={
        <SectionBadge>
          {providedCount > 0
            ? "Forensic inspection report"
            : "Awaiting engine evidence"}
        </SectionBadge>
      }
      noPadding
    >
      <Box
        sx={{
          px: { xs: 2, sm: 2.75 },
          py: 1.75,
          borderBottom: `1px solid ${DASHBOARD.borderLight}`,
          backgroundColor: "#FAFBFD",
        }}
      >
        <Typography sx={{ fontSize: "0.8125rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}>
          Forensic inspection areas reviewed by the verification engine. Each card explains what was
          inspected, what was found, and what it means for the investigation.
        </Typography>
      </Box>

      <InvestigationTimeline steps={report.timeline} />

      <Box
        sx={{
          px: { xs: 2, sm: 2.75 },
          py: { xs: 2.25, sm: 2.75 },
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            lg: "repeat(3, 1fr)",
          },
          gap: 1.5,
          backgroundColor: "#FFFFFF",
        }}
      >
        {report.cards.map((card) => (
          <ForensicEvidenceCard key={card.id} card={card} />
        ))}
      </Box>

      {report.hasDeveloperPayload && (
        <DeveloperTechnicalDetails payload={report.developerPayload} />
      )}
    </SectionShell>
  );
}
