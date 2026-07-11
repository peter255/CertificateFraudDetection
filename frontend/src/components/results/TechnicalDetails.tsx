/**
 * TechnicalDetails — Section 6: Technical Analysis
 * Shows only modules that returned real findings after verification.
 */

import { useMemo, useState } from "react";
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

/** Known forensic modules. Only rendered when the engine returns matching signals. */
const ANALYSIS_CATEGORIES: AnalysisCategory[] = [
  {
    key: "metadata",
    label: "Metadata",
    description: "Properties & modification history",
    signalCategories: ["Metadata Integrity", "Metadata"],
  },
  {
    key: "provenance",
    label: "Provenance",
    description: "C2PA / digital provenance checks",
    signalCategories: ["Provenance / C2PA", "Provenance"],
  },
  {
    key: "qr",
    label: "QR Code",
    description: "Detection & payload validation",
    signalCategories: ["QR Analysis", "QR Code"],
  },
  {
    key: "signature",
    label: "Signature",
    description: "Digital & handwritten validity",
    signalCategories: ["Signature Analysis", "Signature"],
  },
  {
    key: "structure",
    label: "Structure",
    description: "Layout & format integrity",
    signalCategories: ["Visual Pattern", "Structure Analysis", "Structure", "Visual / Overlay"],
  },
  {
    key: "ocr",
    label: "OCR",
    description: "Text extraction & consistency",
    signalCategories: ["OCR Analysis", "OCR"],
  },
  {
    key: "forensic",
    label: "Forensic",
    description: "Forensic engine checks",
    signalCategories: ["Forensic"],
  },
  {
    key: "perceptual",
    label: "Perceptual",
    description: "Perceptual / visual consistency",
    signalCategories: ["Perceptual"],
  },
  {
    key: "field",
    label: "Field Evidence",
    description: "Field-assigned anomalies",
    signalCategories: ["Field Evidence"],
  },
  {
    key: "ai",
    label: "AI Forensics",
    description: "Deep learning classification",
    signalCategories: [
      "AI Analysis",
      "AI Indicator",
      "AI Review",
      "ML Model",
      "Detection Pipeline",
      "Document Validity",
      "Semantic",
    ],
  },
];

type ResolvedStatus = "passed" | "warning" | "failed";

const STATUS_STYLE: Record<
  ResolvedStatus,
  { label: string; color: string; bgColor: string; Icon: typeof CheckCircleIcon }
> = {
  passed: { label: "Passed", color: "#107C10", bgColor: "#ECFDF5", Icon: CheckCircleIcon },
  warning: { label: "Warning", color: "#D97706", bgColor: "#FFFBEB", Icon: WarningAmberIcon },
  failed: { label: "Failed", color: "#C50F1F", bgColor: "#FEF2F2", Icon: CancelIcon },
};

interface ResolvedModule {
  key: string;
  label: string;
  detail: string;
  status: ResolvedStatus;
}

function statusFromSignals(matching: Signal[]): ResolvedStatus {
  if (matching.some((s) => s.status === "fail")) return "failed";
  if (matching.some((s) => s.status === "warning")) return "warning";
  return "passed";
}

function resolveReportedModules(signals: Signal[]): ResolvedModule[] {
  const claimed = new Set<string>();
  const modules: ResolvedModule[] = [];

  for (const category of ANALYSIS_CATEGORIES) {
    const matching = signals.filter((s) =>
      category.signalCategories.some((cat) => cat.toLowerCase() === s.category.toLowerCase())
    );
    if (matching.length === 0) continue;

    matching.forEach((s) => claimed.add(s.id));
    modules.push({
      key: category.key,
      label: category.label,
      detail: matching.map((s) => s.description).join(" · "),
      status: statusFromSignals(matching),
    });
  }

  // Surface any engine-specific categories that are not in the known map.
  const leftovers = new Map<string, Signal[]>();
  for (const signal of signals) {
    if (claimed.has(signal.id)) continue;
    const key = signal.category.trim() || "Additional Findings";
    const list = leftovers.get(key) ?? [];
    list.push(signal);
    leftovers.set(key, list);
  }

  for (const [label, matching] of leftovers) {
    modules.push({
      key: `extra-${label.toLowerCase().replace(/\s+/g, "-")}`,
      label,
      detail: matching.map((s) => s.description).join(" · "),
      status: statusFromSignals(matching),
    });
  }

  return modules;
}

function AnalysisTile({ module }: { module: ResolvedModule }) {
  const style = STATUS_STYLE[module.status];
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
          {module.label}
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
          <Icon sx={{ fontSize: 16, color: style.color }} />
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted, mb: 1, flex: 1, lineHeight: 1.45 }}>
        {module.detail}
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
  const modules = useMemo(() => resolveReportedModules(signals), [signals]);

  if (modules.length === 0) {
    return (
      <SectionShell
        title="Technical Analysis"
        icon={<ScienceIcon sx={{ fontSize: 18 }} />}
        badge={<SectionBadge>Not Available</SectionBadge>}
      >
        <Box
          sx={{
            py: 3.5,
            px: 2,
            textAlign: "center",
            borderRadius: "12px",
            backgroundColor: "#F8FAFC",
            border: `1px solid ${DASHBOARD.borderLight}`,
            mt: -1,
          }}
        >
          <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textMuted }}>
            Not Provided by Engine
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted, mt: 0.75 }}>
            This verification engine did not return module-level technical findings.
          </Typography>
        </Box>
      </SectionShell>
    );
  }

  const passedCount = modules.filter((m) => m.status === "passed").length;
  const coveragePct = Math.round((passedCount / modules.length) * 100);

  return (
    <SectionShell
      title="Technical Analysis"
      icon={<ScienceIcon sx={{ fontSize: 18 }} />}
      badge={
        <SectionBadge>
          {modules.length} module{modules.length !== 1 ? "s" : ""} reported
        </SectionBadge>
      }
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
              Module Results
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted }}>
              {passedCount} of {modules.length} reported modules passed
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
          {modules.map((module) => (
            <AnalysisTile key={module.key} module={module} />
          ))}
        </Box>
      </Collapse>
    </SectionShell>
  );
}
