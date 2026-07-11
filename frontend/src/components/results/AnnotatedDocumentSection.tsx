/**
 * AnnotatedDocumentSection — full-width document with tamper region overlays.
 * Shown as the 2nd results section after analysis completes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TamperRegion } from "../../types/verification";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const SEVERITY_STYLE = {
  critical: { color: "#9F1239", bg: "rgba(159,18,57,0.18)", label: "Critical" },
  high: { color: "#C50F1F", bg: "rgba(197,15,31,0.16)", label: "High" },
  medium: { color: "#D97706", bg: "rgba(217,119,6,0.16)", label: "Medium" },
  low: { color: "#CA8A04", bg: "rgba(202,138,4,0.14)", label: "Low" },
} as const;

function isImageFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
}

function regionBoxStyle(region: TamperRegion, selected: boolean) {
  const style = SEVERITY_STYLE[region.severity];
  const [x, y, w, h] = region.bbox;
  return {
    position: "absolute" as const,
    left: `${(x / region.imageWidth) * 100}%`,
    top: `${(y / region.imageHeight) * 100}%`,
    width: `${(w / region.imageWidth) * 100}%`,
    height: `${(h / region.imageHeight) * 100}%`,
    border: `2px solid ${style.color}`,
    backgroundColor: selected ? `${style.color}33` : style.bg,
    borderRadius: "4px",
    boxShadow: selected
      ? `0 0 0 3px ${style.color}55, 0 8px 20px rgba(15,23,42,0.18)`
      : `0 0 0 1px ${style.color}22`,
    cursor: "pointer",
    transition: "background-color 160ms ease, box-shadow 160ms ease",
    zIndex: selected ? 3 : 2,
  };
}

interface AnnotatedDocumentSectionProps {
  file: File;
  regions: TamperRegion[];
}

export default function AnnotatedDocumentSection({
  file,
  regions,
}: AnnotatedDocumentSectionProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(regions[0]?.id ?? null);
  const [pageWidth, setPageWidth] = useState(720);
  const [pdfPages, setPdfPages] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const imageMode = isImageFile(file);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const update = () => {
      const width = Math.max(280, Math.min(960, node.clientWidth - 48));
      setPageWidth((prev) => (Math.abs(prev - width) > 8 ? width : prev));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!regions.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !regions.some((r) => r.id === selectedId)) {
      setSelectedId(regions[0].id);
    }
  }, [regions, selectedId]);

  const pageRegions = useMemo(
    () => regions.filter((r) => r.page === activePage),
    [regions, activePage]
  );

  const selected = regions.find((r) => r.id === selectedId) ?? null;

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
        <SectionBadge color="rgba(197,15,31,0.10)">
          <Box component="span" sx={{ color: DASHBOARD.danger }}>
            {regions.length} marked region{regions.length === 1 ? "" : "s"}
          </Box>
        </SectionBadge>
      }
      noPadding
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.55fr) minmax(280px, 0.85fr)" },
          minHeight: { xs: 480, md: 620 },
        }}
      >
        <Box
          ref={stageRef}
          sx={{
            position: "relative",
            background: "radial-gradient(ellipse at top, #1E293B 0%, #0B1220 55%)",
            borderRight: { lg: `1px solid ${DASHBOARD.border}` },
            borderBottom: { xs: `1px solid ${DASHBOARD.border}`, lg: "none" },
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            p: { xs: 2, md: 3 },
          }}
        >
          {!previewUrl ? (
            <Box sx={{ py: 10 }}>
              <CircularProgress size={28} sx={{ color: "#94A3B8" }} />
            </Box>
          ) : (
            <Box sx={{ position: "relative", width: "100%", maxWidth: pageWidth }}>
              {imageMode ? (
                <Box sx={{ position: "relative", width: "100%", lineHeight: 0 }}>
                  <Box
                    component="img"
                    src={previewUrl}
                    alt={file.name}
                    sx={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      borderRadius: "8px",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                    }}
                  />
                  {pageRegions.map((region) => (
                    <Box
                      key={region.id}
                      sx={regionBoxStyle(region, region.id === selectedId)}
                      onClick={() => setSelectedId(region.id)}
                      title={region.label}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          top: -22,
                          left: 0,
                          px: 0.75,
                          py: 0.15,
                          borderRadius: "4px",
                          backgroundColor: SEVERITY_STYLE[region.severity].color,
                          color: "#fff",
                          fontSize: "0.625rem",
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {region.label}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ position: "relative", width: "100%" }}>
                  <Document
                    file={previewUrl}
                    loading={
                      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
                        <CircularProgress size={28} sx={{ color: "#94A3B8" }} />
                      </Box>
                    }
                    onLoadSuccess={({ numPages }) => setPdfPages(numPages)}
                  >
                    <Box sx={{ position: "relative", display: "inline-block", width: "100%" }}>
                      <Page
                        pageNumber={activePage}
                        width={pageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      {pageRegions.map((region) => (
                        <Box
                          key={region.id}
                          sx={regionBoxStyle(region, region.id === selectedId)}
                          onClick={() => setSelectedId(region.id)}
                          title={region.label}
                        />
                      ))}
                    </Box>
                  </Document>
                  {pdfPages > 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
                      {Array.from({ length: pdfPages }, (_, i) => i + 1).map((page) => (
                        <Box
                          key={page}
                          onClick={() => setActivePage(page)}
                          sx={{
                            px: 1.25,
                            py: 0.5,
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: page === activePage ? "#fff" : "#94A3B8",
                            backgroundColor:
                              page === activePage ? DASHBOARD.accent : "rgba(148,163,184,0.15)",
                          }}
                        >
                          Page {page}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {regions.length === 0 && (
                <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
                  <Box
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderRadius: "10px",
                      backgroundColor: "rgba(15,23,42,0.72)",
                      color: "#E2E8F0",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                    }}
                  >
                    No spatial tamper markers were returned for this file
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

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
              Click a region or list item to highlight where manipulation was detected.
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
            {regions.length === 0 ? (
              <Box sx={{ p: 2, color: DASHBOARD.textMuted, fontSize: "0.875rem" }}>
                No bounding-box evidence available.
              </Box>
            ) : (
              regions.map((region, index) => {
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
                    <Typography sx={{ fontSize: "0.75rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}>
                      {region.description}
                    </Typography>
                    <Typography sx={{ fontSize: "0.6875rem", color: DASHBOARD.textMuted, mt: 0.75 }}>
                      Page {region.page}
                      {region.location ? ` · ${region.location}` : ""}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
    </SectionShell>
  );
}
