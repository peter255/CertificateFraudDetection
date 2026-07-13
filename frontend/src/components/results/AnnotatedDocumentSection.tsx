/**
 * AnnotatedDocumentSection — Tamper Localization
 * Bounding boxes / heatmaps render only when the verification engine provided them.
 */

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import type { TamperRegion } from "../../types/verification";
import DocumentViewer, { isValidOverlayRegion } from "../viewer/DocumentViewer";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

const SEVERITY_STYLE = {
  critical: { color: "#9F1239", bg: "rgba(159,18,57,0.18)", label: "Critical" },
  high: { color: "#C50F1F", bg: "rgba(197,15,31,0.16)", label: "High" },
  medium: { color: "#D97706", bg: "rgba(217,119,6,0.16)", label: "Medium" },
  low: { color: "#CA8A04", bg: "rgba(202,138,4,0.14)", label: "Low" },
} as const;

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography
      sx={{
        fontSize: "0.5625rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: DASHBOARD.textMuted,
        mb: 0.35,
      }}
    >
      {children}
    </Typography>
  );
}

interface AnnotatedDocumentSectionProps {
  file: File;
  regions: TamperRegion[];
  heatmapUrl?: string | null;
}

export default function AnnotatedDocumentSection({
  file,
  regions,
  heatmapUrl = null,
}: AnnotatedDocumentSectionProps) {
  const validRegions = useMemo(
    () => regions.filter(isValidOverlayRegion),
    [regions]
  );
  const resolvedHeatmap =
    typeof heatmapUrl === "string" && heatmapUrl.trim() ? heatmapUrl.trim() : null;
  const hasOverlays = validRegions.length > 0 || Boolean(resolvedHeatmap);

  const [selectedId, setSelectedId] = useState<string | null>(validRegions[0]?.id ?? null);
  const [activePage, setActivePage] = useState(1);
  const [debugLocalization, setDebugLocalization] = useState(false);

  useEffect(() => {
    if (!validRegions.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !validRegions.some((r) => r.id === selectedId)) {
      setSelectedId(validRegions[0].id);
    }
  }, [validRegions, selectedId]);

  const selected = validRegions.find((r) => r.id === selectedId) ?? null;

  // Jump to the region's page when selection changes. Do not depend on
  // activePage — that fought toolbar prev/next and always snapped back.
  useEffect(() => {
    const region = validRegions.find((r) => r.id === selectedId);
    if (region) {
      setActivePage(region.page);
    }
  }, [selectedId, validRegions]);

  return (
    <SectionShell
      title="Tamper Localization"
      icon={<TravelExploreIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.danger}
      emphasis="primary"
      badge={
        hasOverlays ? (
          <SectionBadge color="rgba(197,15,31,0.10)">
            <Box component="span" sx={{ color: DASHBOARD.danger }}>
              {validRegions.length > 0
                ? "Suspicious regions marked"
                : "Heatmap available"}
            </Box>
          </SectionBadge>
        ) : undefined
      }
      noPadding
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: hasOverlays ? "minmax(0, 1.55fr) minmax(300px, 0.85fr)" : "1fr",
          },
          minHeight: { xs: 480, md: 620 },
        }}
      >
        <Box
          sx={{
            minHeight: { xs: 420, md: 560 },
            borderRight: hasOverlays
              ? { lg: `1px solid ${DASHBOARD.border}` }
              : "none",
            borderBottom: hasOverlays
              ? { xs: `1px solid ${DASHBOARD.border}`, lg: "none" }
              : "none",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!hasOverlays && (
            <Box
              sx={{
                px: 2.5,
                py: 1.75,
                borderBottom: `1px solid ${DASHBOARD.borderLight}`,
                backgroundColor: "#FAFBFD",
              }}
            >
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: DASHBOARD.textPrimary, mb: 0.5 }}>
                No localized findings
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: DASHBOARD.textSecondary, lineHeight: 1.5 }}>
                No suspicious regions were provided by the verification engine.
              </Typography>
            </Box>
          )}
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <DocumentViewer
              file={file}
              regions={validRegions}
              heatmapUrl={resolvedHeatmap}
              selectedRegionId={selectedId}
              onSelectRegion={setSelectedId}
              currentPage={activePage}
              onPageChange={setActivePage}
              hideChrome
              debugLocalization={debugLocalization}
              onToggleDebugLocalization={
                hasOverlays ? () => setDebugLocalization((v) => !v) : undefined
              }
            />
          </Box>
        </Box>

        {hasOverlays && (
          <Box
            sx={{
              backgroundColor: "#FAFBFD",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${DASHBOARD.borderLight}` }}>
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: DASHBOARD.textMuted,
                  mb: 0.75,
                }}
              >
                Localized evidence
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: DASHBOARD.textSecondary, lineHeight: 1.5 }}>
                {validRegions.length > 0
                  ? "Select a region to highlight where the verification engine reported possible manipulation."
                  : "The forensic heatmap highlights areas the verification engine associated with possible manipulation. Warmer zones indicate higher attention from the detection model."}
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                maxHeight: { xs: 360, lg: 560 },
              }}
            >
              {validRegions.length === 0 ? (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: "12px",
                    backgroundColor: "#FFFFFF",
                    border: `1px solid ${DASHBOARD.borderLight}`,
                  }}
                >
                  <FieldLabel>Heatmap</FieldLabel>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: DASHBOARD.textPrimary, mb: 0.75 }}>
                    Forensic attention map
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}>
                    This overlay was provided by the verification engine. It indicates relative
                    suspicion across the document surface. It is not a precise boundary and does not
                    invent region coordinates.
                  </Typography>
                </Box>
              ) : (
                validRegions.map((region, index) => {
                  const style = SEVERITY_STYLE[region.severity];
                  const active = region.id === selectedId;
                  const confidencePct =
                    region.confidence != null && Number.isFinite(region.confidence)
                      ? Math.round(region.confidence * 1000) / 10
                      : null;
                  const reason =
                    region.label?.trim() ||
                    (region.description?.trim() ? "Suspicious region" : "Marked region");

                  return (
                    <Box
                      key={region.id}
                      onClick={() => {
                        setSelectedId(region.id);
                        setActivePage(region.page);
                      }}
                      sx={{
                        p: 1.75,
                        borderRadius: "12px",
                        cursor: "pointer",
                        backgroundColor: active ? "#FFFFFF" : "transparent",
                        border: `1px solid ${active ? style.color : DASHBOARD.borderLight}`,
                        boxShadow: active ? `0 0 0 3px ${style.color}22` : "none",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
                        <Box
                          sx={{
                            width: 22,
                            height: 22,
                            borderRadius: "6px",
                            backgroundColor: style.color,
                            color: "#fff",
                            fontSize: "0.625rem",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: "0.875rem",
                            fontWeight: 700,
                            color: DASHBOARD.textPrimary,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {reason}
                        </Typography>
                        <Box
                          sx={{
                            px: 0.875,
                            py: 0.25,
                            borderRadius: "999px",
                            backgroundColor: `${style.color}18`,
                            color: style.color,
                            fontSize: "0.625rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {style.label}
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 1,
                          mb: 1.25,
                        }}
                      >
                        <Box>
                          <FieldLabel>Page</FieldLabel>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: DASHBOARD.textPrimary }}>
                            {region.page}
                          </Typography>
                        </Box>
                        <Box>
                          <FieldLabel>Confidence</FieldLabel>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: DASHBOARD.textPrimary }}>
                            {confidencePct != null ? `${confidencePct}%` : "Not provided by the verification engine."}
                          </Typography>
                        </Box>
                      </Box>

                      <Box>
                        <FieldLabel>Description</FieldLabel>
                        <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}>
                          {region.description?.trim()
                            ? region.description
                            : "Not provided by the verification engine."}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        )}
      </Box>
    </SectionShell>
  );
}
