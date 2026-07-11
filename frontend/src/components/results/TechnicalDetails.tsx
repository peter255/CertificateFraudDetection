/**
 * TechnicalDetails — Section 6: Technical Analysis
 * Tile grid with status indicators and coverage meter.
 */

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import ScienceIcon from "@mui/icons-material/Science";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import type { Signal } from "../../types/verification";
import { CircularGauge } from "./shared/dashboardCharts";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

interface AnalysisCategory {
  key: string;
  label: string;
  description: string;
  signalCategories: string[];
}

const ANALYSIS_CATEGORIES: AnalysisCategory[] = [
  { key: "metadata", label: "Metadata", description: "Properties & modification history", signalCategories: ["Metadata Integrity", "Metadata"] },
  { key: "qr", label: "QR Code", description: "Detection & payload validation", signalCategories: ["QR Analysis", "QR Code"] },
  { key: "signature", label: "Signature", description: "Digital & handwritten validity", signalCategories: ["Signature Analysis", "Signature"] },
  { key: "structure", label: "Structure", description: "Layout & format integrity", signalCategories: ["Visual Pattern", "Structure Analysis", "Structure"] },
  { key: "ocr", label: "OCR", description: "Text extraction & consistency", signalCategories: ["OCR Analysis", "OCR"] },
  { key: "ai", label: "AI Forensics", description: "Deep learning classification", signalCategories: ["AI Analysis"] },
];

type ResolvedStatus = "passed" | "warning" | "failed" | "pending";

const STATUS_STYLE: Record<ResolvedStatus, { label: string; color: string; bgColor: string; Icon: typeof CheckCircleIcon }> = {
  passed: { label: "Passed", color: "#107C10", bgColor: "#ECFDF5", Icon: CheckCircleIcon },
  warning: { label: "Warning", color: "#D97706", bgColor: "#FFFBEB", Icon: WarningAmberIcon },
  failed: { label: "Failed", color: "#C50F1F", bgColor: "#FEF2F2", Icon: CancelIcon },
  pending: { label: "Pending", color: "#94A3B8", bgColor: "#F1F5F9", Icon: WarningAmberIcon },
};

function resolveCategoryStatus(
  category: AnalysisCategory,
  signals: Signal[]
): { status: ResolvedStatus; detail: string | null } {
  const matching = signals.filter((s) =>
    category.signalCategories.some((cat) => cat.toLowerCase() === s.category.toLowerCase())
  );

  if (matching.length === 0) return { status: "pending", detail: null };

  const hasFailed = matching.some((s) => s.status === "fail");
  const hasWarning = matching.some((s) => s.status === "warning");
  const status: ResolvedStatus = hasFailed ? "failed" : hasWarning ? "warning" : "passed";
  const detail = matching.map((s) => s.description).join(" · ");

  return { status, detail };
}

function AnalysisTile({ category, signals }: { category: AnalysisCategory; signals: Signal[] }) {
  const { status, detail } = resolveCategoryStatus(category, signals);
  const style = STATUS_STYLE[status];
  const { Icon } = style;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: "14px",
        backgroundColor: "#FFFFFF",
        border: `1px solid ${DASHBOARD.borderLight}`,
        borderTop: `3px solid ${style.color}`,
        minHeight: 130,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: DASHBOARD.textPrimary }}>
          {category.label}
        </Typography>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            backgroundColor: style.bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {status === "pending" ? (
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: style.color }} />
          ) : (
            <Icon sx={{ fontSize: 16, color: style.color }} />
          )}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted, mb: 1, flex: 1, lineHeight: 1.45 }}>
        {detail || category.description}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.5625rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: style.color,
        }}
      >
        {style.label}
      </Typography>
    </Box>
  );
}

interface TechnicalDetailsProps {
  signals: Signal[];
}

export default function TechnicalDetails({ signals }: TechnicalDetailsProps) {
  const [isOpen, setIsOpen] = useState(true);

  const resolvedCount = ANALYSIS_CATEGORIES.filter(
    (cat) => resolveCategoryStatus(cat, signals).status !== "pending"
  ).length;
  const coveragePct = Math.round((resolvedCount / ANALYSIS_CATEGORIES.length) * 100);

  return (
    <SectionShell
      title="Technical Analysis"
      icon={<ScienceIcon sx={{ fontSize: 18 }} />}
      badge={<SectionBadge>{resolvedCount}/{ANALYSIS_CATEGORIES.length} modules</SectionBadge>}
      noPadding
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setIsOpen((prev) => !prev);
        }}
        sx={{
          px: 3,
          py: 2,
          backgroundColor: "#F1F5F9",
          borderBottom: isOpen ? `1px solid ${DASHBOARD.borderLight}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <CircularGauge
            value={coveragePct}
            label=""
            color={DASHBOARD.accent}
            size={80}
            trackColor="#E2E8F0"
          />
          <Box>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: DASHBOARD.textPrimary }}>
              Analysis Coverage
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted }}>
              {resolvedCount} of {ANALYSIS_CATEGORIES.length} forensic modules resolved
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted }}>
          {isOpen ? "Collapse" : "Expand"}
        </Typography>
      </Box>

      <Collapse in={isOpen}>
        <Box
          sx={{
            px: 3,
            py: 3,
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" },
            gap: 1.5,
            backgroundColor: "#FAFBFD",
          }}
        >
          {ANALYSIS_CATEGORIES.map((category) => (
            <AnalysisTile key={category.key} category={category} signals={signals} />
          ))}
        </Box>
      </Collapse>
    </SectionShell>
  );
}
