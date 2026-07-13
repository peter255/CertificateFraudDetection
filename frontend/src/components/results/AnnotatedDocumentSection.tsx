/**
 * AnnotatedDocumentSection — document viewer with engine-returned overlays.
 * Bounding boxes / heatmaps render only when the active engine provided them.
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

  useEffect(() => {
    if (selected && selected.page !== activePage) {
      setActivePage(selected.page);
    }
  }, [selected, activePage]);

  return (
    <SectionShell
      title="Document Tamper Map"
      icon={<TravelExploreIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.danger}
      emphasis="primary"
      badge={
        hasOverlays ? (
          <SectionBadge color="rgba(197,15,31,0.10)">
            <Box component="span" sx={{ color: DASHBOARD.danger }}>
              {validRegions.length > 0
                ? `${validRegions.length} marked region${validRegions.length === 1 ? "" : "s"}`
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
            lg: hasOverlays ? "minmax(0, 1.55fr) minmax(280px, 0.85fr)" : "1fr",
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
              <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.5 }}>
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
                Marked areas
              </Typography>
              <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.5 }}>
                {validRegions.length > 0
                  ? "Click a region or list item to highlight where manipulation was detected."
                  : "A forensic heatmap highlights likely manipulation zones on the document."}
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                maxHeight: { xs: 360, lg: 560 },
              }}
            >
              {validRegions.length === 0 ? (
                <Box sx={{ p: 2, color: DASHBOARD.textMuted, fontSize: "0.875rem" }}>
                  Heatmap overlay is shown on the document.
                </Box>
              ) : (
                validRegions.map((region, index) => {
                  const style = SEVERITY_STYLE[region.severity];
                  const active = region.id === selectedId;
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
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
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
                          {region.label}
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
                      <Typography
                        sx={{ fontSize: "0.75rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}
                      >
                        {region.description}
                      </Typography>
                      <Typography sx={{ fontSize: "0.6875rem", color: DASHBOARD.textMuted, mt: 0.75 }}>
                        {[
                          `Page ${region.page}`,
                          region.location || null,
                          region.layer ? `Layer: ${region.layer}` : null,
                          region.confidence != null
                            ? `Confidence: ${Math.round(region.confidence * 1000) / 10}%`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Typography>
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
