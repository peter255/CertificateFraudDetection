/**
 * TechnicalDetails — engine technical payloads only.
 * Forensic indicators live in SignalsList; this section does not re-list them.
 */

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import ScienceIcon from "@mui/icons-material/Science";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { EngineTechnicalDetails } from "../../types/verification";
import { CircularGauge } from "./shared/dashboardCharts";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function summarizeValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return value.map(String).join(", ");
    }
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (keys.length === 0) return "";
    return keys
      .slice(0, 12)
      .map((key) => {
        const nested = (value as Record<string, unknown>)[key];
        if (
          typeof nested === "string" ||
          typeof nested === "number" ||
          typeof nested === "boolean"
        ) {
          return `${humanizeKey(key)}: ${nested}`;
        }
        if (Array.isArray(nested)) return `${humanizeKey(key)}: ${nested.length} items`;
        if (nested && typeof nested === "object") {
          return `${humanizeKey(key)}: ${Object.keys(nested).length} fields`;
        }
        return "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

interface ResolvedModule {
  key: string;
  label: string;
  detail: string;
}

function extrasFromTechnical(technical?: EngineTechnicalDetails | null): ResolvedModule[] {
  if (!technical) return [];
  const modules: ResolvedModule[] = [];

  const push = (key: string, label: string, detail: string) => {
    if (!detail.trim()) return;
    modules.push({ key, label, detail });
  };

  if (technical.analysisStatus) {
    push("analysis-status", "Analysis Status", technical.analysisStatus);
  }
  if (technical.layersApplied?.length) {
    push("layers-applied", "Layers Applied", technical.layersApplied.join(", "));
  }
  if (technical.classification) {
    push("classification", "Classification", summarizeValue(technical.classification));
  }
  if (technical.pdfFraudSubscores) {
    push("pdf-fraud-subscores", "PDF Fraud Subscores", summarizeValue(technical.pdfFraudSubscores));
  }
  if (technical.structuralProfile) {
    push("structural-profile", "Structural Profile", summarizeValue(technical.structuralProfile));
  }
  if (technical.engineResults) {
    push("engine-results", "Engine Results", summarizeValue(technical.engineResults));
  }
  if (technical.layerDetails) {
    push("layer-details", "Layer Details", summarizeValue(technical.layerDetails));
  }
  if (technical.evidenceGroups) {
    push("evidence-groups", "Evidence Groups", summarizeValue(technical.evidenceGroups));
  }
  if (technical.analysisFlow?.length) {
    push(
      "analysis-flow",
      "Analysis Flow",
      technical.analysisFlow
        .map((step, index) => {
          const summary = summarizeValue(step);
          return summary ? `${index + 1}. ${summary}` : "";
        })
        .filter(Boolean)
        .join(" · ")
    );
  }

  return modules;
}

function AnalysisTile({ module }: { module: ResolvedModule }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: "14px",
        backgroundColor: "#FFFFFF",
        border: `1px solid ${DASHBOARD.borderLight}`,
        borderTop: `3px solid ${DASHBOARD.accent}`,
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
            backgroundColor: "rgba(0,120,212,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 16, color: DASHBOARD.accent }} />
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted, mb: 1, flex: 1, lineHeight: 1.45 }}>
        {module.detail}
      </Typography>
    </Box>
  );
}

interface TechnicalDetailsProps {
  /** @deprecated Signals belong in SignalsList; ignored here. */
  signals?: unknown;
  technical?: EngineTechnicalDetails | null;
}

export default function TechnicalDetails({
  technical = null,
}: TechnicalDetailsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const modules = useMemo(() => extrasFromTechnical(technical), [technical]);

  if (modules.length === 0) {
    return null;
  }

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
            value={Math.min(100, modules.length * 12)}
            label=""
            color={DASHBOARD.accent}
            size={80}
            trackColor="#E2E8F0"
          />
          <Box>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: DASHBOARD.textPrimary }}>
              Engine Technical Payloads
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textMuted }}>
              {modules.length} technical module{modules.length !== 1 ? "s" : ""} from the API
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
