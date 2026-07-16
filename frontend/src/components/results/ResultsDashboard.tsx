/**
 * ResultsDashboard — VERISCAN two-column forensic report layout.
 * Left: annotated document preview. Right: scores, verdict, findings, actions.
 *
 * DETAILED FINDINGS order:
 * 1) Visual evidence list (page + bbox only — clickable navigation)
 * 2) Text / Image / File Structure category cards below
 */

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import type {
  RiskLevel,
  Signal,
  SignalStatus,
  TamperRegion,
  VerificationResult,
} from "../../types/verification";
import DocumentViewer, { isValidOverlayRegion } from "../viewer/DocumentViewer";
import { downloadVerificationReport } from "../../utils/downloadReport";
import {
  buildLocalCategorySummary,
  categoryRiskLabel,
  clampSummary,
  computeAnalysisDisplayScores,
  fileStructureDisplaySummary,
  overallRiskLabel,
  pdfStructureRiskLabel,
  riskUiFromScore,
  verdictFallback,
} from "../../utils/findingsDisplay";
import {
  humanizeLabel,
  sanitizeFindingText,
  shortenFindingDescription,
} from "../../utils/findingLabels";
import {
  DOCUMENT_LEVEL_NOTE,
  classifyFindingScope,
} from "../../utils/findingScope";
import { VS } from "../../theme";

interface ResultsDashboardProps {
  result: VerificationResult;
  file: File | null;
  onPageCountChange?: (n: number) => void;
}

function severityColor(severity: TamperRegion["severity"]): string {
  if (severity === "critical" || severity === "high") return VS.danger;
  if (severity === "medium") return VS.warning;
  return VS.accent;
}

const SEVERITY_LABEL: Record<TamperRegion["severity"], string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

/**
 * Element findings with Azure highlights, plus document-level findings (no box).
 */
function isDetailedFinding(region: TamperRegion): boolean {
  const scope = region.scope ?? classifyFindingScope(region);
  if (scope === "document") {
    return Boolean(region.label?.trim() || region.description?.trim());
  }
  // Element: list even without highlight; only require identity text.
  return Boolean(region.label?.trim() || region.description?.trim());
}

function findingCanHighlight(region: TamperRegion): boolean {
  const scope = region.scope ?? classifyFindingScope(region);
  if (scope !== "element") return false;
  if (region.canHighlight === false) return false;
  if (region.bboxSource !== "azure_document_intelligence") return false;
  if (!isValidOverlayRegion(region)) return false;
  if (!Number.isFinite(region.page) || region.page < 1) return false;
  return true;
}

function riskLabel(level: RiskLevel, score: number): string {
  return overallRiskLabel(level, score);
}

function scoreColor(value: number, invert = false): string {
  const v = invert ? 100 - value : value;
  if (v >= 70) return VS.danger;
  if (v >= 40) return VS.warning;
  return VS.accent;
}

function statusColor(status: SignalStatus): string {
  if (status === "fail") return VS.danger;
  if (status === "warning") return VS.warning;
  return VS.accent;
}

function categoryRiskUi(
  signals: Signal[]
): { label: string; color: string; score: number } {
  const { label, score } = categoryRiskLabel(signals);
  if (label === "HIGH RISK") {
    return { label, color: VS.danger, score };
  }
  if (label === "MEDIUM") {
    return { label, color: VS.warning, score };
  }
  return { label, color: VS.accent, score };
}

function riskUiFromLabel(
  label: string,
  score: number
): { label: string; color: string; score: number } {
  if (label === "HIGH RISK") {
    return { label, color: VS.danger, score };
  }
  if (label === "MEDIUM") {
    return { label, color: VS.warning, score };
  }
  return { label, color: VS.accent, score };
}

function refCode(signal: Signal, index: number, prefix: string): string {
  const id = (signal.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (id.length >= 4) return `${prefix}-${id.slice(-2)}`;
  return `${prefix}-${String(index + 1).padStart(2, "0")}`;
}

function highlightVerdict(text: string) {
  // Split on dates / tool-like tokens for accent highlighting
  const parts = text.split(
    /(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:19|20)\d{2}\b|\bAdobe\b|\bPhotoshop\b|\bIllustrator\b|\bAcrobat\b)/gi
  );
  return parts.map((part, i) => {
    if (!part) return null;
    const isDate = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^(?:19|20)\d{2}$/.test(
      part
    );
    const isTool = /adobe|photoshop|illustrator|acrobat/i.test(part);
    return (
      <Box
        key={i}
        component="span"
        sx={{
          color: isDate ? VS.danger : isTool ? VS.accent : "inherit",
          fontWeight: isDate || isTool ? 600 : 400,
        }}
      >
        {part}
      </Box>
    );
  });
}

function ScoreBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  return (
    <LinearProgress
      variant="determinate"
      value={Math.min(100, Math.max(0, value))}
      sx={{
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(35,37,40,0.08)",
        "& .MuiLinearProgress-bar": {
          borderRadius: 2,
          backgroundColor: color,
          boxShadow: "none",
        },
      }}
    />
  );
}

function FindingCard({
  title,
  description,
  code,
  color,
}: {
  title: string;
  description: string;
  code: string;
  color: string;
}) {
  const friendlyTitle = humanizeLabel(title) || title;
  const shortDescription = shortenFindingDescription(description) || description;

  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.5,
        borderRadius: "8px",
        border: `1px solid ${VS.border}`,
        backgroundColor: "rgba(35,37,40,0.03)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 0.5,
        }}
      >
        <Typography
          sx={{ fontSize: "0.875rem", fontWeight: 600, color: VS.text, lineHeight: 1.35 }}
        >
          {friendlyTitle}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.6875rem",
            color: VS.textMuted,
            fontFamily: VS.mono,
            flexShrink: 0,
          }}
        >
          {code}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: "0.8125rem",
          color: VS.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {shortDescription}
      </Typography>
      {/* color kept for left accent via border on failure statuses */}
      <Box
        sx={{
          mt: 1.25,
          height: 2,
          borderRadius: 1,
          backgroundColor: `${color}55`,
          maxWidth: 48,
        }}
      />
    </Box>
  );
}

function FindingCategory({
  title,
  icon,
  signals,
  prefix,
  summary,
  riskOverride,
}: {
  title: string;
  icon: React.ReactNode;
  signals: Signal[];
  prefix: string;
  /** Azure OpenAI plain-English summary — shown instead of dumping raw cards when present. */
  summary?: string | null;
  /** When set (e.g. File Structure), use multi-indicator scoring instead of raw status counts. */
  riskOverride?: { label: string; color: string; score: number };
}) {
  const risk = riskOverride ?? categoryRiskUi(signals);
  const hasAiSummary = Boolean(summary?.trim());
  const displaySummary = hasAiSummary ? clampSummary(summary!.trim()) : "";
  const items =
    signals.length > 0
      ? signals
      : hasAiSummary
        ? []
        : [
            {
              id: `${prefix}-ok`,
              category: title,
              description: "No anomalies detected in this layer.",
              status: "pass" as const,
            },
          ];

  return (
    <Box
      sx={{
        borderRadius: "10px",
        border: `1px solid ${VS.border}`,
        backgroundColor: VS.bgCard,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${VS.border}`,
        }}
      >
        <Box sx={{ color: risk.color, display: "flex" }}>{icon}</Box>
        <Typography
          sx={{
            flex: 1,
            fontSize: "0.8125rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: VS.text,
          }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            px: 1,
            py: 0.35,
            borderRadius: "5px",
            backgroundColor: `${risk.color}22`,
            border: `1px solid ${risk.color}55`,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: risk.color,
              fontFamily: VS.mono,
            }}
          >
            {risk.label}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
        {hasAiSummary && (
          <Box
            sx={{
              px: 1.5,
              py: 1.35,
              borderRadius: "8px",
              border: `1px solid ${VS.border}`,
              backgroundColor: VS.bg,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.625rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: VS.textMuted,
                fontFamily: VS.mono,
                mb: 0.75,
              }}
            >
              AI SUMMARY
            </Typography>
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: VS.textSecondary,
                lineHeight: 1.65,
              }}
            >
              {displaySummary}
            </Typography>
          </Box>
        )}

        {!hasAiSummary &&
          items.map((signal, i) => (
            <FindingCard
              key={signal.id || `${prefix}-${i}`}
              title={
                signal.check?.trim() ||
                signal.fieldLabel?.trim() ||
                signal.category?.trim() ||
                title
              }
              description={signal.description}
              code={refCode(signal, i, prefix)}
              color={statusColor(signal.status)}
            />
          ))}
      </Box>
    </Box>
  );
}

function VisualFindingCard({
  region,
  index,
  active,
  onSelect,
}: {
  region: TamperRegion;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const color = severityColor(region.severity);
  const scope = region.scope ?? classifyFindingScope(region);
  const isDocumentLevel = scope === "document";
  const canHighlight = findingCanHighlight(region);
  const confidencePct =
    region.confidence != null && Number.isFinite(region.confidence)
      ? Math.round(region.confidence * 1000) / 10
      : null;
  const title =
    humanizeLabel(region.label) ||
    (region.description?.trim() ? "Suspicious region" : "Marked region");
  const fullDescription =
    sanitizeFindingText(region.description) || title;
  const shortDescription = shortenFindingDescription(fullDescription);

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      sx={{
        all: "unset",
        boxSizing: "border-box",
        display: "block",
        width: "100%",
        cursor: "pointer",
        px: 1.75,
        py: 1.5,
        borderRadius: "8px",
        border: `1px solid ${active ? color : VS.border}`,
        backgroundColor: active ? `${color}14` : "rgba(35,37,40,0.03)",
        boxShadow: active ? `0 0 0 1px ${color}55` : "none",
        transition: "border-color 120ms ease, background-color 120ms ease",
        "&:hover": {
          borderColor: color,
          backgroundColor: `${color}10`,
        },
        "&:focus-visible": {
          outline: `2px solid ${VS.accent}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 0.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: "5px",
              backgroundColor: color,
              color: VS.onAccent,
              fontSize: "0.625rem",
              fontWeight: 800,
              fontFamily: VS.mono,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              mt: 0.15,
            }}
          >
            {index + 1}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: VS.text,
                lineHeight: 1.35,
              }}
            >
              {title}
            </Typography>
            {isDocumentLevel && (
              <Box
                sx={{
                  mt: 0.75,
                  display: "inline-flex",
                  alignItems: "center",
                  px: 0.85,
                  py: 0.25,
                  borderRadius: "4px",
                  border: `1px solid ${VS.borderStrong}`,
                  backgroundColor: "rgba(35,37,40,0.04)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: VS.textSecondary,
                    fontFamily: VS.mono,
                    textTransform: "uppercase",
                  }}
                >
                  Document-Level Finding
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Typography
          sx={{
            fontSize: "0.625rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color,
            fontFamily: VS.mono,
            flexShrink: 0,
          }}
        >
          {SEVERITY_LABEL[region.severity]}
        </Typography>
      </Box>

      {fullDescription ? (
        <Typography
          sx={{
            fontSize: "0.8125rem",
            color: VS.textSecondary,
            lineHeight: 1.5,
            mb: 1,
            pl: 4.25,
            display: "-webkit-box",
            WebkitLineClamp: active ? "unset" : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {active ? fullDescription : shortDescription}
        </Typography>
      ) : null}

      {isDocumentLevel && active ? (
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: VS.textMuted,
            lineHeight: 1.5,
            mb: 1,
            pl: 4.25,
            fontStyle: "italic",
          }}
        >
          {DOCUMENT_LEVEL_NOTE}
        </Typography>
      ) : null}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.25,
          pl: 4.25,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6875rem",
            color: VS.textMuted,
            fontFamily: VS.mono,
          }}
        >
          {isDocumentLevel
            ? "NO LOCATION HIGHLIGHT"
            : canHighlight
              ? `PAGE ${region.page}`
              : "LOCATION UNAVAILABLE"}
        </Typography>
        {active && confidencePct != null && (
          <Typography
            sx={{
              fontSize: "0.6875rem",
              color: VS.textMuted,
              fontFamily: VS.mono,
              whiteSpace: "nowrap",
            }}
          >
            Confidence {confidencePct}%
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeFromName(fileName: string | null): string {
  if (!fileName || !fileName.includes(".")) return "—";
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  if (!ext) return "—";
  if (ext === "pdf") return "PDF";
  if (ext === "jpeg" || ext === "jpg") return "JPEG";
  return ext.toUpperCase();
}

function ReportListSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: "12px",
        border: `1px solid ${VS.border}`,
        backgroundColor: VS.bgCard,
        flexShrink: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          color: VS.textMuted,
          fontFamily: VS.mono,
          mb: 1.25,
        }}
      >
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography sx={{ fontSize: "0.875rem", color: VS.textMuted, lineHeight: 1.6 }}>
          {emptyText}
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
          {items.map((item, index) => (
            <Typography
              key={`${title}-${index}`}
              component="li"
              sx={{
                fontSize: "0.875rem",
                color: VS.textSecondary,
                lineHeight: 1.65,
                mb: 0.75,
              }}
            >
              {item}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

function FileInformationSection({
  fileType,
  fileSize,
  numPages,
}: {
  fileType: string;
  fileSize: string;
  numPages: number;
}) {
  const rows = [
    { label: "File Type", value: fileType },
    { label: "File Size", value: fileSize },
    { label: "Number of Pages", value: String(numPages) },
  ];

  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: "12px",
        border: `1px solid ${VS.border}`,
        backgroundColor: VS.bgCard,
        flexShrink: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          color: VS.textMuted,
          fontFamily: VS.mono,
          mb: 1.25,
        }}
      >
        FILE INFORMATION
      </Typography>
      <Box sx={{ display: "grid", gap: 1 }}>
        {rows.map((row) => (
          <Box
            key={row.label}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              py: 0.5,
              borderBottom: `1px solid ${VS.border}`,
            }}
          >
            <Typography sx={{ fontSize: "0.8125rem", color: VS.textMuted }}>
              {row.label}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: VS.textSecondary,
                textAlign: "right",
              }}
            >
              {row.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function ResultsDashboard({
  result,
  file,
  onPageCountChange,
}: ResultsDashboardProps) {
  const [downloading, setDownloading] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);

  /** Overlay draw list — Detailed Findings (element + document-level cards). */
  const visualFindings = useMemo(() => {
    const list = result.tamperRegions.filter(isDetailedFinding);
    const seen = new Set<string>();
    const unique: TamperRegion[] = [];
    for (const region of list) {
      const scope = region.scope ?? classifyFindingScope(region);
      const key =
        scope === "document"
          ? `doc:${region.id}:${region.label}`
          : `${region.page}:${region.bbox.map((n) => Math.round(n)).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(region);
    }
    return unique;
  }, [result.tamperRegions]);

  // Keep selection only if it still exists — never auto-pick on load.
  useEffect(() => {
    if (!selectedRegionId) return;
    if (!visualFindings.some((r) => r.id === selectedRegionId)) {
      setSelectedRegionId(null);
    }
  }, [visualFindings, selectedRegionId]);

  useEffect(() => {
    const region = visualFindings.find((r) => r.id === selectedRegionId);
    if (region && findingCanHighlight(region)) setActivePage(region.page);
  }, [selectedRegionId, visualFindings]);

  const {
    riskScore,
    fraudProbability,
    aiProbability,
    textScore,
    imageScore,
    pdfScore,
    buckets,
  } = useMemo(() => computeAnalysisDisplayScores(result), [result]);
  const aiProbabilitySource = result.aiDetection?.source ?? null;

  const certificateFlags = useMemo(() => {
    if (result.certificateFlags?.length) return result.certificateFlags;
    const merged = [...(result.vendorFlags || []), ...(result.metadataFlags || [])];
    const seen = new Set<string>();
    return merged.filter((flag) => {
      const key = flag.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [result.certificateFlags, result.vendorFlags, result.metadataFlags]);

  const fileInformation = useMemo(() => {
    if (result.fileInformation) return result.fileInformation;
    return {
      fileType: fileTypeFromName(file?.name ?? null),
      fileSize: file ? formatBytes(file.size) : "—",
      numPages: 1,
    };
  }, [result.fileInformation, file]);

  const recommendations = result.recommendations ?? [];

  const criticalLabel = riskLabel(result.report.riskLevel, riskScore);
  const criticalColor = scoreColor(riskScore);

  // Draw Azure highlights only for element-level findings.
  const showRegions = useMemo(() => {
    if (!selectedRegionId) return [];
    const selected = visualFindings.find((r) => r.id === selectedRegionId);
    if (!selected || !findingCanHighlight(selected)) return [];
    return [selected];
  }, [selectedRegionId, visualFindings]);

  const selectFinding = (region: TamperRegion) => {
    setSelectedRegionId((current) => (current === region.id ? null : region.id));
    if (findingCanHighlight(region)) setActivePage(region.page);
  };

  const handleExport = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadVerificationReport(result, file?.name ?? "certificate");
    } catch (err) {
      console.error(err);
      window.alert("Could not generate the PDF report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  /** Minimum row height; row grows when the document preview is taller. */
  const viewerRowMin = {
    xs: "min(60vh, 600px)",
    lg: "calc(100vh - 280px)",
  };

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 2.5, md: 3 },
        pt: { xs: 2, md: 2.5 },
        pb: { xs: 4, md: 5 },
        maxWidth: 1680,
        mx: "auto",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.05fr) minmax(0, 0.95fr)" },
          gap: { xs: 2.5, lg: 3 },
          alignItems: "stretch",
          minHeight: viewerRowMin,
        }}
      >
        {/* ── Left: document + overlays ─────────────────────────────────── */}
        <Box
          sx={{
            borderRadius: "12px",
            border: `1px solid ${VS.border}`,
            backgroundColor: VS.bgCard,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: viewerRowMin,
            height: "auto",
            alignSelf: "stretch",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: 2,
              py: 1.25,
              borderBottom: `1px solid ${VS.border}`,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: VS.textSecondary,
                fontFamily: VS.mono,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {(file?.name ?? "DOCUMENT").toUpperCase()}
            </Typography>
          </Box>

          <Box sx={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <DocumentViewer
              file={file}
              regions={showRegions as TamperRegion[]}
              heatmapUrl={null}
              selectedRegionId={selectedRegionId}
              onSelectRegion={setSelectedRegionId}
              currentPage={activePage}
              onPageChange={setActivePage}
              onPageCountChange={onPageCountChange}
              hideChrome
              fitContent
            />
          </Box>
        </Box>

        {/* ── Right: analytics + visual findings (height tracks viewer column) ─ */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minHeight: viewerRowMin,
            height: "100%",
            alignSelf: "stretch",
            overflow: "hidden",
          }}
        >
          {/* Score summary */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 1.5,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                p: 2.25,
                borderRadius: "12px",
                border: `1px solid ${VS.border}`,
                backgroundColor: VS.bgCard,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  color: VS.textMuted,
                  fontFamily: VS.mono,
                  mb: 1,
                }}
              >
                RISK SCORE
              </Typography>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, mb: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    color: criticalColor,
                    lineHeight: 1,
                  }}
                >
                  {Math.round(riskScore)}
                  <Box
                    component="span"
                    sx={{ fontSize: "1rem", color: VS.textMuted, fontWeight: 500 }}
                  >
                    / 100
                  </Box>
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: "5px",
                    backgroundColor: `${criticalColor}22`,
                    border: `1px solid ${criticalColor}66`,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: criticalColor,
                      fontFamily: VS.mono,
                    }}
                  >
                    {criticalLabel}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                p: 2.25,
                borderRadius: "12px",
                border: `1px solid ${VS.border}`,
                backgroundColor: VS.bgCard,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  color: VS.textMuted,
                  fontFamily: VS.mono,
                  mb: 1,
                }}
              >
                FRAUD PROBABILITY
              </Typography>
              <Typography
                sx={{
                  fontSize: "2.5rem",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  color: scoreColor(fraudProbability),
                  lineHeight: 1,
                  mb: 1.25,
                }}
              >
                {Math.round(fraudProbability)}%
              </Typography>
              <ScoreBar
                value={fraudProbability}
                color={scoreColor(fraudProbability)}
              />
            </Box>

            <Box
              sx={{
                p: 2.25,
                borderRadius: "12px",
                border: `1px solid ${VS.border}`,
                backgroundColor: VS.bgCard,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  color: VS.textMuted,
                  fontFamily: VS.mono,
                  mb: 1,
                }}
              >
                AI PROBABILITY
              </Typography>
              {aiProbability != null ? (
                <>
                  <Typography
                    sx={{
                      fontSize: "2.5rem",
                      fontWeight: 700,
                      letterSpacing: "-0.04em",
                      color: scoreColor(aiProbability),
                      lineHeight: 1,
                      mb: 0.75,
                    }}
                  >
                    {aiProbability % 1 === 0
                      ? `${Math.round(aiProbability)}%`
                      : `${aiProbability}%`}
                  </Typography>
                  {aiProbabilitySource === "azure_openai" && (
                    <Typography
                      sx={{
                        fontSize: "0.5625rem",
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        color: VS.textMuted,
                        fontFamily: VS.mono,
                        mb: 1,
                      }}
                    >
                      ESTIMATED
                    </Typography>
                  )}
                  <ScoreBar
                    value={aiProbability}
                    color={scoreColor(aiProbability)}
                  />
                </>
              ) : (
                <Typography
                  sx={{
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    color: VS.textMuted,
                    lineHeight: 1,
                  }}
                >
                  —
                </Typography>
              )}
            </Box>
          </Box>

          {/* Sub-scores */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1.25,
              flexShrink: 0,
            }}
          >
            {[
              { label: "TEXT LOGIC", value: textScore },
              { label: "IMAGE FORENSICS", value: imageScore },
              { label: "FILE STRUCTURE", value: pdfScore },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  p: 1.75,
                  borderRadius: "10px",
                  border: `1px solid ${VS.border}`,
                  backgroundColor: VS.bgCard,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.5625rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    color: VS.textMuted,
                    fontFamily: VS.mono,
                    mb: 0.75,
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "1.375rem",
                    fontWeight: 700,
                    color: scoreColor(item.value),
                    mb: 1,
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                  <Box
                    component="span"
                    sx={{
                      fontSize: "0.75rem",
                      color: VS.textMuted,
                      fontWeight: 500,
                      ml: 0.25,
                    }}
                  >
                    / 100
                  </Box>
                </Typography>
                <ScoreBar value={item.value} color={scoreColor(item.value)} />
              </Box>
            ))}
          </Box>

          {/* Consolidated verdict */}
          <Box
            sx={{
              p: 2.25,
              borderRadius: "12px",
              border: `1px solid ${VS.border}`,
              backgroundColor: VS.bgCard,
              flexShrink: 0,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: VS.textMuted,
                fontFamily: VS.mono,
                mb: 1.25,
              }}
            >
              CONSOLIDATED VERDICT
            </Typography>
            <Typography
              sx={{
                fontSize: "0.9375rem",
                color: VS.textSecondary,
                lineHeight: 1.7,
              }}
            >
              {result.aiSummary?.trim()
                ? highlightVerdict(clampSummary(result.aiSummary.trim()))
                : verdictFallback(result.verdict)}
            </Typography>
          </Box>

          {/* Detailed findings — fixed remaining height inside the locked row */}
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: VS.textMuted,
              fontFamily: VS.mono,
              mt: 0.5,
              flexShrink: 0,
            }}
          >
            DETAILED FINDINGS
          </Typography>

          <Box
            sx={{
              flex: 1,
              minHeight: { xs: 280, lg: 200 },
              display: "flex",
              flexDirection: "column",
              borderRadius: "10px",
              border: `1px solid ${VS.border}`,
              backgroundColor: VS.bgCard,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.35,
                borderBottom: `1px solid ${VS.border}`,
                flexShrink: 0,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: VS.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                {visualFindings.length > 0
                  ? "Select a finding. Element-level items highlight Azure layout regions; document-level items explain overall forensic signals without a box."
                  : "No localized visual evidence was returned for this document."}
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                overflow: "auto",
              }}
            >
              {visualFindings.map((region, index) => (
                <VisualFindingCard
                  key={region.id}
                  region={region}
                  index={index}
                  active={region.id === selectedRegionId}
                  onSelect={() => selectFinding(region)}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Category analysis — full width under Viewer + Detailed Findings */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          mt: { xs: 2.5, lg: 3 },
        }}
      >
        <FindingCategory
          title="Text Manipulation"
          icon={<TextFieldsIcon sx={{ fontSize: 18 }} />}
          signals={buckets.text}
          prefix="TXT"
          riskOverride={(() => {
            const scored = riskUiFromScore(textScore);
            return riskUiFromLabel(scored.label, scored.score);
          })()}
          summary={clampSummary(
            result.textManipulationSummary?.trim() ||
              buildLocalCategorySummary("Text manipulation", buckets.text) ||
              ""
          )}
        />
        <FindingCategory
          title="Image Manipulation"
          icon={<ImageIcon sx={{ fontSize: 18 }} />}
          signals={buckets.image}
          prefix="IMG"
          riskOverride={(() => {
            const scored = riskUiFromScore(imageScore);
            return riskUiFromLabel(scored.label, scored.score);
          })()}
          summary={clampSummary(
            result.imageManipulationSummary?.trim() ||
              buildLocalCategorySummary("Image manipulation", buckets.image) ||
              ""
          )}
        />
        <FindingCategory
          title="File Structure"
          icon={<InsertDriveFileIcon sx={{ fontSize: 18 }} />}
          signals={buckets.pdf}
          prefix="FILE"
          riskOverride={(() => {
            if (result.displayScores?.fileStructureScore != null) {
              const scored = riskUiFromScore(pdfScore);
              return riskUiFromLabel(scored.label, scored.score);
            }
            const pdfRisk = pdfStructureRiskLabel(buckets.pdf, {
              verdict: result.verdict,
              riskScore,
              fraudScore: fraudProbability,
            });
            return riskUiFromLabel(pdfRisk.label, pdfRisk.score);
          })()}
          summary={clampSummary(
            result.pdfStructureSummary?.trim() ||
              fileStructureDisplaySummary(
                buckets.pdf,
                result.pdfStructureSummary,
                {
                  verdict: result.verdict,
                  riskScore,
                  fraudScore: fraudProbability,
                }
              )
          )}
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          mt: { xs: 2.5, lg: 3 },
        }}
      >
        <ReportListSection
          title="RECOMMENDATIONS"
          items={recommendations}
          emptyText="No recommendations were generated for this examination."
        />
        <FileInformationSection
          fileType={fileInformation.fileType}
          fileSize={fileInformation.fileSize}
          numPages={fileInformation.numPages}
        />
        <ReportListSection
          title="CERTIFICATE FLAGS"
          items={certificateFlags}
          emptyText="No certificate flags were reported."
        />
      </Box>

      {/* Actions — side by side at page bottom */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 1.5,
          pt: 2.5,
          width: "100%",
        }}
      >
        <Button
          variant="contained"
          startIcon={<DownloadOutlinedIcon />}
          onClick={handleExport}
          disabled={downloading}
          sx={{
            flex: 1,
            height: 48,
            borderRadius: "8px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            backgroundColor: VS.danger,
            color: VS.onAccent,
            "&:hover": {
              backgroundColor: "#9A0C22",
            },
          }}
        >
          {downloading ? "Preparing…" : "Export full report"}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FlagOutlinedIcon />}
          sx={{
            flex: 1,
            height: 48,
            borderRadius: "8px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: VS.textSecondary,
            borderColor: VS.borderStrong,
            "&:hover": {
              borderColor: VS.accent,
              color: VS.accent,
              backgroundColor: VS.accentDim,
            },
          }}
        >
          Flag for Review
        </Button>
      </Box>
    </Box>
  );
}

