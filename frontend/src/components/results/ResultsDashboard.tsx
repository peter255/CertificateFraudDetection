/**
 * ResultsDashboard — VERISCAN two-column forensic report layout.
 * Left: annotated document preview. Right: scores, verdict, findings, actions.
 */

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
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
  categoryRisk,
  clampSummary,
  computeAnalysisDisplayScores,
  confOf,
  verdictFallback,
} from "../../utils/findingsDisplay";
import { VS } from "../../theme";

type OverlayMode = "heatmap" | "polygons" | "both" | "none";

interface ResultsDashboardProps {
  result: VerificationResult;
  file: File | null;
  onVerifyAnother: () => void;
  onPageCountChange?: (n: number) => void;
}

function riskLabel(level: RiskLevel, score: number): string {
  if (score >= 75 || level === "high") return "CRITICAL";
  if (score >= 40 || level === "medium") return "ELEVATED";
  return "LOW";
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
  const { score } = categoryRisk(signals);
  if (!signals.length) {
    return { label: "LOW RISK", color: VS.accent, score };
  }
  const fails = signals.filter((s) => s.status === "fail").length;
  const warns = signals.filter((s) => s.status === "warning").length;
  if (fails > 0 || score >= 55) {
    return { label: "HIGH RISK", color: VS.danger, score };
  }
  if (warns > 0 || score >= 25) {
    return { label: "MEDIUM", color: VS.warning, score };
  }
  return { label: "LOW RISK", color: VS.accent, score };
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
        backgroundColor: "rgba(255,255,255,0.08)",
        "& .MuiLinearProgress-bar": {
          borderRadius: 2,
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}88`,
        },
      }}
    />
  );
}

function FindingCard({
  title,
  description,
  code,
  confidence,
  color,
}: {
  title: string;
  description: string;
  code: string;
  confidence: number;
  color: string;
}) {
  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.5,
        borderRadius: "8px",
        border: `1px solid ${VS.border}`,
        backgroundColor: "rgba(255,255,255,0.02)",
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
          {title}
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
          mb: 1.25,
        }}
      >
        {description}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={{ flex: 1 }}>
          <ScoreBar value={confidence} color={color} />
        </Box>
        <Typography
          sx={{
            fontSize: "0.6875rem",
            color: VS.textMuted,
            fontFamily: VS.mono,
            whiteSpace: "nowrap",
          }}
        >
          {confidence}% conf.
        </Typography>
      </Box>
    </Box>
  );
}

function FindingCategory({
  title,
  icon,
  signals,
  prefix,
  summary,
}: {
  title: string;
  icon: React.ReactNode;
  signals: Signal[];
  prefix: string;
  /** Azure OpenAI plain-English summary — shown instead of dumping raw cards when present. */
  summary?: string | null;
}) {
  const risk = categoryRiskUi(signals);
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
              confidence={confOf(signal)}
              color={statusColor(signal.status)}
            />
          ))}
      </Box>
    </Box>
  );
}

export default function ResultsDashboard({
  result,
  file,
  onVerifyAnother,
  onPageCountChange,
}: ResultsDashboardProps) {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("both");
  const [downloading, setDownloading] = useState(false);

  const validRegions = useMemo(
    () => result.tamperRegions.filter(isValidOverlayRegion),
    [result.tamperRegions]
  );

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

  const criticalLabel = riskLabel(result.report.riskLevel, riskScore);
  const criticalColor = scoreColor(riskScore);

  const showHeatmap =
    overlayMode === "heatmap" || overlayMode === "both"
      ? result.heatmapUrl
      : null;
  const showRegions =
    overlayMode === "polygons" || overlayMode === "both" ? validRegions : [];

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

  const modes: OverlayMode[] = ["heatmap", "polygons", "both", "none"];

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
          alignItems: "start",
        }}
      >
        {/* ── Left: document + overlays ─────────────────────────────────── */}
        <Box
          sx={{
            borderRadius: "12px",
            border: `1px solid ${VS.border}`,
            backgroundColor: VS.bgCard,
            overflow: "hidden",
            position: { lg: "sticky" },
            top: { lg: 72 },
            maxHeight: { lg: "calc(100vh - 96px)" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderBottom: `1px solid ${VS.border}`,
              flexWrap: "wrap",
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
                maxWidth: { xs: "100%", sm: 280 },
              }}
            >
              {(file?.name ?? "DOCUMENT").toUpperCase()}
            </Typography>

            <Box sx={{ display: "flex", gap: 0.5 }}>
              {modes.map((mode) => (
                <Button
                  key={mode}
                  size="small"
                  onClick={() => setOverlayMode(mode)}
                  sx={{
                    minWidth: 0,
                    px: 1.1,
                    py: 0.4,
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    fontFamily: VS.mono,
                    color: overlayMode === mode ? VS.bg : VS.textMuted,
                    backgroundColor:
                      overlayMode === mode ? VS.accent : "transparent",
                    border: `1px solid ${
                      overlayMode === mode ? VS.accent : VS.border
                    }`,
                    borderRadius: "6px",
                    "&:hover": {
                      backgroundColor:
                        overlayMode === mode ? VS.accent : VS.accentDim,
                      color: overlayMode === mode ? VS.bg : VS.accent,
                    },
                  }}
                >
                  {mode.toUpperCase()}
                </Button>
              ))}
            </Box>
          </Box>

          <Box sx={{ flex: 1, minHeight: { xs: 420, lg: 560 }, height: { lg: "100%" } }}>
            <DocumentViewer
              file={file}
              regions={showRegions as TamperRegion[]}
              heatmapUrl={showHeatmap}
              onPageCountChange={onPageCountChange}
              hideChrome
            />
          </Box>
        </Box>

        {/* ── Right: analytics ──────────────────────────────────────────── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Score summary */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 1.5,
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
                    /100
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

          {/* Detailed findings */}
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: VS.textMuted,
              fontFamily: VS.mono,
              mt: 0.5,
            }}
          >
            DETAILED FINDINGS
          </Typography>

          <FindingCategory
            title="Text Manipulation"
            icon={<TextFieldsIcon sx={{ fontSize: 18 }} />}
            signals={buckets.text}
            prefix="TXT"
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
            summary={clampSummary(
              result.pdfStructureSummary?.trim() ||
                buildLocalCategorySummary("File structure", buckets.pdf) ||
                ""
            )}
          />

          {/* Actions */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.25,
              pt: 0.5,
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={handleExport}
              disabled={downloading}
              sx={{
                flex: 1,
                minWidth: 180,
                height: 48,
                borderRadius: "8px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                backgroundColor: VS.danger,
                color: "#fff",
                boxShadow: `0 0 20px ${VS.danger}55`,
                "&:hover": {
                  backgroundColor: "#E03555",
                  boxShadow: `0 0 28px ${VS.danger}77`,
                },
              }}
            >
              {downloading ? "PREPARING…" : "EXPORT FULL REPORT"}
            </Button>
          </Box>
          <Button
            variant="text"
            onClick={onVerifyAnother}
            sx={{
              alignSelf: "flex-start",
              fontSize: "0.8125rem",
              color: VS.textMuted,
            }}
          >
            Start New Analysis
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

