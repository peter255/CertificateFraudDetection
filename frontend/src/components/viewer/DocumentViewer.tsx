/**
 * DocumentViewer — fixed-height preview panel with optional forensic overlays.
 *
 * Overlays (bboxes / heatmap) render only when the engine returned real data.
 * Zoom uses CSS transform; page navigation works for PDFs.
 */

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import BugReportIcon from "@mui/icons-material/BugReport";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TamperRegion } from "../../types/verification";
import {
  projectRawAsXywh,
  projectToContent,
  type OverlayProjection,
} from "../../utils/localization";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_FIT = 1.0;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff"]);
const PDF_EXTENSIONS = new Set(["pdf"]);

const SEVERITY_COLOR: Record<TamperRegion["severity"], string> = {
  critical: "#9F1239",
  high: "#C50F1F",
  medium: "#D97706",
  low: "#CA8A04",
};

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ViewerMode = "empty" | "image" | "pdf";

function fileExtension(file: File): string {
  const parts = file.name.split(".");
  return parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
}

function resolveViewerMode(file: File | null): ViewerMode {
  if (!file) return "empty";
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  const ext = fileExtension(file);
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (PDF_EXTENSIONS.has(ext)) return "pdf";
  return "pdf";
}

/** Accept only engine-returned regions with usable spatial data. */
export function isValidOverlayRegion(region: TamperRegion): boolean {
  if (!region?.bbox || region.bbox.length !== 4) return false;
  const [x, y, w, h] = region.bbox;
  if (![x, y, w, h, region.imageWidth, region.imageHeight].every((n) => Number.isFinite(n))) {
    return false;
  }
  if (w <= 0 || h <= 0 || region.imageWidth <= 0 || region.imageHeight <= 0) return false;
  if (region.page != null && (!Number.isFinite(region.page) || region.page < 1)) return false;
  return true;
}

function resolveHeatmapUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const scrollAreaSx = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  scrollbarGutter: "stable" as const,
  backgroundColor: "#EEF2F7",
};

interface OverlayLayerProps {
  regions: TamperRegion[];
  heatmapUrl: string | null;
  selectedId: string | null;
  onSelectRegion?: (id: string) => void;
  /** Measured content box (img/canvas) in CSS pixels. */
  contentSize: { width: number; height: number } | null;
  debug?: boolean;
}

function formatProj(p: OverlayProjection): string {
  return (
    `scale=${p.scale.toFixed(4)} (sx=${p.scaleX.toFixed(4)}, sy=${p.scaleY.toFixed(4)}) ` +
    `offset=(${p.offsetX.toFixed(1)}, ${p.offsetY.toFixed(1)}) ` +
    `content=${p.contentWidth.toFixed(0)}×${p.contentHeight.toFixed(0)} ` +
    `src=${p.imageWidth}×${p.imageHeight}`
  );
}

function OverlayLayer({
  regions,
  heatmapUrl,
  selectedId,
  onSelectRegion,
  contentSize,
  debug = false,
}: OverlayLayerProps) {
  const hasRegions = regions.length > 0;
  const hasHeatmap = Boolean(heatmapUrl);

  const canProject =
    contentSize != null && contentSize.width > 0 && contentSize.height > 0;

  useEffect(() => {
    if (!debug || !canProject || !contentSize) return;
    for (const region of regions) {
      const projected = projectToContent(
        region.bbox,
        region.imageWidth,
        region.imageHeight,
        contentSize.width,
        contentSize.height
      );
      if (!projected) continue;
      const rawProj = region.rawBBox
        ? projectRawAsXywh(
            region.rawBBox,
            region.imageWidth,
            region.imageHeight,
            contentSize.width,
            contentSize.height
          )
        : null;
      // eslint-disable-next-line no-console
      console.info("[localization-debug]", {
        id: region.id,
        page: region.page,
        format: region.bboxFormat,
        ambiguous: region.bboxAmbiguous,
        originalBBox: region.rawBBox,
        interpretedXywh: region.bbox,
        imageSize: [region.imageWidth, region.imageHeight],
        viewportSize: [contentSize.width, contentSize.height],
        scaleFactor: projected.scale,
        scaleX: projected.scaleX,
        scaleY: projected.scaleY,
        offset: [projected.offsetX, projected.offsetY],
        scaledBBox: [projected.left, projected.top, projected.width, projected.height],
        rawAsXywhRendered: rawProj
          ? [rawProj.left, rawProj.top, rawProj.width, rawProj.height]
          : null,
      });
    }
  }, [debug, canProject, contentSize, regions]);

  if (!hasRegions && !hasHeatmap) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: hasRegions ? "auto" : "none",
        zIndex: 2,
        overflow: "hidden",
      }}
    >
      {hasHeatmap && heatmapUrl && (
        <Box
          component="img"
          src={heatmapUrl}
          alt="Forensic heatmap"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: hasRegions ? 0.4 : 0.55,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      )}
      {canProject &&
        regions.map((region) => {
          const color = SEVERITY_COLOR[region.severity] ?? SEVERITY_COLOR.medium;
          const selected = region.id === selectedId;
          const projected = projectToContent(
            region.bbox,
            region.imageWidth,
            region.imageHeight,
            contentSize.width,
            contentSize.height
          );
          if (!projected) return null;

          const rawProj =
            debug && region.rawBBox
              ? projectRawAsXywh(
                  region.rawBBox,
                  region.imageWidth,
                  region.imageHeight,
                  contentSize.width,
                  contentSize.height
                )
              : null;

          return (
            <Box key={region.id} component="span" sx={{ display: "contents" }}>
              {/* Production overlay — interpreted + uniformly scaled */}
              <Box
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectRegion?.(region.id);
                }}
                title={
                  debug
                    ? [
                        region.label,
                        `page=${region.page}`,
                        `format=${region.bboxFormat ?? "?"}`,
                        `raw=[${(region.rawBBox || []).join(", ")}]`,
                        `xywh=[${region.bbox.join(", ")}]`,
                        `rendered=[${projected.left.toFixed(1)}, ${projected.top.toFixed(1)}, ${projected.width.toFixed(1)}, ${projected.height.toFixed(1)}]`,
                        formatProj(projected),
                      ].join(" | ")
                    : region.label
                }
                sx={{
                  position: "absolute",
                  left: projected.left,
                  top: projected.top,
                  width: projected.width,
                  height: projected.height,
                  border: debug ? `2px solid #2563EB` : `2px solid ${color}`,
                  backgroundColor: selected
                    ? debug
                      ? "rgba(37,99,235,0.18)"
                      : `${color}33`
                    : debug
                      ? "rgba(37,99,235,0.08)"
                      : `${color}22`,
                  borderRadius: debug ? 0 : "4px",
                  boxShadow: selected
                    ? `0 0 0 3px ${debug ? "#2563EB55" : `${color}55`}, 0 8px 20px rgba(15,23,42,0.18)`
                    : undefined,
                  cursor: onSelectRegion ? "pointer" : "default",
                  zIndex: selected ? 3 : 2,
                  boxSizing: "border-box",
                }}
              />

              {/* Debug: green = raw vendor tuple treated as xywh (no conversion) */}
              {debug && rawProj && (
                <Box
                  sx={{
                    position: "absolute",
                    left: rawProj.left,
                    top: rawProj.top,
                    width: Math.max(rawProj.width, 1),
                    height: Math.max(rawProj.height, 1),
                    border: "2px solid #16A34A",
                    backgroundColor: "transparent",
                    pointerEvents: "none",
                    zIndex: 4,
                    boxSizing: "border-box",
                  }}
                />
              )}

              {debug && (
                <Box
                  sx={{
                    position: "absolute",
                    left: Math.max(0, projected.left),
                    top: Math.max(0, projected.top - 18),
                    px: 0.5,
                    py: 0.125,
                    backgroundColor: "rgba(15,23,42,0.82)",
                    color: "#F8FAFC",
                    fontSize: "0.5625rem",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    lineHeight: 1.35,
                    pointerEvents: "none",
                    zIndex: 5,
                    whiteSpace: "nowrap",
                    maxWidth: "96%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  p{region.page} {region.bboxFormat}
                  {region.bboxAmbiguous ? " ?" : ""} | raw[
                  {(region.rawBBox || []).map((n) => Math.round(n)).join(",")}
                  ] → xywh[{region.bbox.map((n) => Math.round(n)).join(",")}] |{" "}
                  {region.imageWidth}×{region.imageHeight} →{" "}
                  {contentSize.width.toFixed(0)}×{contentSize.height.toFixed(0)} @
                  {projected.scale.toFixed(3)}
                </Box>
              )}
            </Box>
          );
        })}
    </Box>
  );
}

interface ToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  showPageNav: boolean;
  disabled?: boolean;
  debug?: boolean;
  onToggleDebug?: () => void;
  showDebugToggle?: boolean;
}

function Toolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  showPageNav,
  disabled = false,
  debug = false,
  onToggleDebug,
  showDebugToggle = false,
}: ToolbarProps) {
  const isFit = Math.abs(zoom - ZOOM_FIT) < 0.001;
  const btnSx = {
    color: "#475569",
    borderRadius: "7px",
    "&:hover": { backgroundColor: "#E8EEF5" },
    "&.Mui-disabled": { color: "#CBD5E1" },
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        px: 1.5,
        py: 0.875,
        borderBottom: "1px solid #E2E8F0",
        backgroundColor: "#F8FAFC",
        flexShrink: 0,
        minHeight: 44,
      }}
    >
      <Tooltip title="Zoom out">
        <span>
          <IconButton
            size="small"
            onClick={onZoomOut}
            disabled={disabled || zoom <= ZOOM_MIN}
            sx={btnSx}
          >
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "#334155",
          fontVariantNumeric: "tabular-nums",
          minWidth: 36,
          textAlign: "center",
          userSelect: "none",
        }}
      >
        {Math.round(zoom * 100)}%
      </Typography>

      <Tooltip title="Zoom in">
        <span>
          <IconButton
            size="small"
            onClick={onZoomIn}
            disabled={disabled || zoom >= ZOOM_MAX}
            sx={btnSx}
          >
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Fit width">
        <span>
          <IconButton
            size="small"
            onClick={onFitWidth}
            disabled={disabled}
            sx={{
              ...btnSx,
              color: isFit ? "#0078D4" : btnSx.color,
              backgroundColor: isFit ? "rgba(0,120,212,0.08)" : "transparent",
            }}
          >
            <FitScreenIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {showPageNav && (
        <>
          <Box sx={{ width: "1px", height: 16, backgroundColor: "#E2E8F0", mx: 0.75, flexShrink: 0 }} />
          <Tooltip title="Previous page">
            <span>
              <IconButton
                size="small"
                onClick={onPrevPage}
                disabled={disabled || currentPage <= 1 || totalPages === 0}
                sx={btnSx}
              >
                <NavigateBeforeIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "#475569",
              fontVariantNumeric: "tabular-nums",
              userSelect: "none",
              whiteSpace: "nowrap",
              minWidth: 48,
              textAlign: "center",
            }}
          >
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : "— / —"}
          </Typography>
          <Tooltip title="Next page">
            <span>
              <IconButton
                size="small"
                onClick={onNextPage}
                disabled={disabled || totalPages === 0 || currentPage >= totalPages}
                sx={btnSx}
              >
                <NavigateNextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}

      {showDebugToggle && (
        <>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={debug ? "Hide localization debug" : "Show localization debug"}>
            <IconButton
              size="small"
              onClick={onToggleDebug}
              sx={{
                ...btnSx,
                color: debug ? "#16A34A" : btnSx.color,
                backgroundColor: debug ? "rgba(22,163,74,0.12)" : "transparent",
              }}
            >
              <BugReportIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}

function EmptyState() {
  return (
    <Box
      sx={{
        ...scrollAreaSx,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.75,
        px: 4,
        backgroundColor: "#F8FAFC",
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "14px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DescriptionOutlinedIcon sx={{ fontSize: 28, color: "#94A3B8" }} />
      </Box>
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: "#334155", mb: 0.5 }}>
          No document loaded
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: "#94A3B8", lineHeight: 1.55 }}>
          Upload a certificate to begin fraud detection analysis
        </Typography>
      </Box>
    </Box>
  );
}

interface ImageViewerProps {
  objectUrl: string;
  zoom: number;
  pageRegions: TamperRegion[];
  heatmapUrl: string | null;
  selectedRegionId: string | null;
  onSelectRegion?: (id: string) => void;
  debug?: boolean;
}

function ImageViewer({
  objectUrl,
  zoom,
  pageRegions,
  heatmapUrl,
  selectedRegionId,
  onSelectRegion,
  debug = false,
}: ImageViewerProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(
    null
  );

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width > 0 && height > 0) {
      setContentSize({ width, height });
    }
  }, []);

  useEffect(() => {
    setContentSize(null);
  }, [objectUrl]);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    measure();
    const obs = new ResizeObserver(() => measure());
    obs.observe(el);
    return () => obs.disconnect();
  }, [objectUrl, zoom, measure]);

  return (
    <Box sx={{ ...scrollAreaSx, p: 2.5 }}>
      {debug && contentSize && (
        <Box
          sx={{
            mb: 1,
            px: 1.25,
            py: 0.75,
            borderRadius: "6px",
            backgroundColor: "rgba(15,23,42,0.88)",
            color: "#E2E8F0",
            fontSize: "0.625rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            lineHeight: 1.45,
          }}
        >
          <Box component="span" sx={{ color: "#4ADE80" }}>
            ■ green
          </Box>
          {" = raw vendor as xywh  "}
          <Box component="span" sx={{ color: "#60A5FA" }}>
            ■ blue
          </Box>
          {" = interpreted + scaled  | viewport content "}
          {contentSize.width.toFixed(0)}×{contentSize.height.toFixed(0)}px | zoom{" "}
          {Math.round(zoom * 100)}%
        </Box>
      )}
      <Box
        sx={{
          width: `${zoom * 100}%`,
          mx: "auto",
        }}
      >
        <Box
          sx={{
            width: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            position: "relative",
            lineHeight: 0,
            borderRadius: "6px",
            boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
            // outline avoids border-box shrinking the image content vs overlay.
            outline: "1px solid #E2E8F0",
            backgroundColor: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          <Box
            component="img"
            ref={imgRef}
            src={objectUrl}
            alt="Certificate preview"
            onLoad={measure}
            sx={{
              width: "100%",
              maxWidth: "none",
              height: "auto",
              display: "block",
              // No border on the img — border lives on the wrapper so overlays
              // align to the image content box with zero offset.
            }}
          />
          <OverlayLayer
            regions={pageRegions}
            heatmapUrl={heatmapUrl}
            selectedId={selectedRegionId}
            onSelectRegion={onSelectRegion}
            contentSize={contentSize}
            debug={debug}
          />
        </Box>
      </Box>
    </Box>
  );
}

interface PdfViewerProps {
  file: File;
  zoom: number;
  currentPage: number;
  onLoadSuccess: (numPages: number) => void;
  onLoadError: () => void;
  pageRegions: TamperRegion[];
  heatmapUrl: string | null;
  selectedRegionId: string | null;
  onSelectRegion?: (id: string) => void;
  debug?: boolean;
}

function PdfViewer({
  file,
  zoom,
  currentPage,
  onLoadSuccess,
  onLoadError,
  pageRegions,
  heatmapUrl,
  selectedRegionId,
  onSelectRegion,
  debug = false,
}: PdfViewerProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const lockedWidth = useRef(0);

  useEffect(() => {
    setIsLoading(true);
    setUseNativeFallback(false);
    lockedWidth.current = 0;
    setBaseWidth(0);
    setContentSize(null);
  }, [file]);

  useEffect(() => {
    setContentSize(null);
  }, [currentPage]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const measure = () => {
      const w = Math.floor(el.clientWidth - 40);
      if (w < 200) return;
      if (lockedWidth.current > 0 && Math.abs(w - lockedWidth.current) < 24) {
        return;
      }
      lockedWidth.current = w;
      setBaseWidth(w);
    };

    const raf = requestAnimationFrame(measure);
    const obs = new ResizeObserver(() => measure());
    obs.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [file]);

  const measurePageBox = useCallback(() => {
    const el = pageBoxRef.current;
    if (!el) return;
    // Prefer the rendered canvas size (exact PDF page pixels after react-pdf).
    const canvas = el.querySelector("canvas");
    const width = canvas?.clientWidth || el.clientWidth;
    const height = canvas?.clientHeight || el.clientHeight;
    if (width > 0 && height > 0) {
      setContentSize({ width, height });
    }
  }, []);

  useEffect(() => {
    const el = pageBoxRef.current;
    if (!el) return;
    measurePageBox();
    const obs = new ResizeObserver(() => measurePageBox());
    obs.observe(el);
    return () => obs.disconnect();
  }, [baseWidth, currentPage, zoom, measurePageBox]);

  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setIsLoading(false);
      onLoadSuccess(numPages);
      // Canvas may mount one frame later.
      requestAnimationFrame(() => measurePageBox());
    },
    [onLoadSuccess, measurePageBox]
  );

  const hasOverlays = pageRegions.length > 0 || Boolean(heatmapUrl);

  const handleLoadError = useCallback(() => {
    setIsLoading(false);
    // Prefer react-pdf path when overlays exist — native iframe cannot draw them.
    if (!hasOverlays) {
      setUseNativeFallback(true);
    }
    onLoadError();
  }, [onLoadError, hasOverlays]);

  return (
    <Box ref={measureRef} sx={{ ...scrollAreaSx, p: useNativeFallback ? 0 : 2.5, position: "relative" }}>
      {debug && contentSize && (
        <Box
          sx={{
            mb: 1,
            px: 1.25,
            py: 0.75,
            borderRadius: "6px",
            backgroundColor: "rgba(15,23,42,0.88)",
            color: "#E2E8F0",
            fontSize: "0.625rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            lineHeight: 1.45,
          }}
        >
          <Box component="span" sx={{ color: "#4ADE80" }}>
            ■ green
          </Box>
          {" = raw vendor as xywh  "}
          <Box component="span" sx={{ color: "#60A5FA" }}>
            ■ blue
          </Box>
          {" = interpreted + scaled  | PDF page "}
          {currentPage} content {contentSize.width.toFixed(0)}×{contentSize.height.toFixed(0)}px
        </Box>
      )}

      {(isLoading || baseWidth === 0) && !useNativeFallback && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#EEF2F7",
            zIndex: 1,
          }}
        >
          <CircularProgress size={28} thickness={3} sx={{ color: "#0078D4" }} />
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "#64748B",
              mt: 1.75,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            Loading document…
          </Typography>
        </Box>
      )}

      {!isLoading && !useNativeFallback && baseWidth === 0 && hasOverlays && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#EEF2F7",
            zIndex: 1,
            px: 3,
          }}
        >
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748B", textAlign: "center" }}>
            Document preview unavailable — overlays cannot be shown in fallback mode.
          </Typography>
        </Box>
      )}

      {useNativeFallback ? (
        <NativePdfFallback file={file} />
      ) : (
        baseWidth > 0 && (
          <Box
            sx={{
              width: `${zoom * 100}%`,
              mx: "auto",
            }}
          >
            <Box
              sx={{
                width: `${100 / zoom}%`,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
            >
              <Document
                file={file}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={handleLoadError}
                loading=""
                error=""
              >
                <Box
                  ref={pageBoxRef}
                  sx={{
                    boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
                    borderRadius: "6px",
                    overflow: "hidden",
                    // outline (not border) so box-sizing cannot shrink the
                    // content box relative to react-pdf's canvas width.
                    outline: "1px solid #E2E8F0",
                    backgroundColor: "#FFFFFF",
                    width: baseWidth,
                    position: "relative",
                    lineHeight: 0,
                  }}
                >
                  <Page
                    pageNumber={currentPage}
                    width={baseWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={measurePageBox}
                  />
                  <OverlayLayer
                    regions={pageRegions}
                    heatmapUrl={heatmapUrl}
                    selectedId={selectedRegionId}
                    onSelectRegion={onSelectRegion}
                    contentSize={contentSize}
                    debug={debug}
                  />
                </Box>
              </Document>
            </Box>
          </Box>
        )
      )}
    </Box>
  );
}

function NativePdfFallback({ file }: { file: File }) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  return (
    <Box
      component="iframe"
      title={file.name}
      src={`${objectUrl}#view=FitH`}
      sx={{
        width: "100%",
        height: "100%",
        border: "none",
        backgroundColor: "#FFFFFF",
        flex: 1,
        minHeight: 0,
      }}
    />
  );
}

function ViewerHeader({ file }: { file: File | null }) {
  const ext = file ? (file.name.split(".").pop()?.toUpperCase() ?? "FILE") : null;

  return (
    <Box
      sx={{
        px: 2.5,
        py: 1.75,
        borderBottom: "1px solid #E2E8F0",
        backgroundColor: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        flexShrink: 0,
        minHeight: 52,
      }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: file ? "#107C10" : "#CBD5E1",
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#0F172A",
          flex: 1,
        }}
      >
        Document Evidence
      </Typography>
      {ext && (
        <Box
          sx={{
            px: 1,
            py: 0.3,
            borderRadius: "5px",
            backgroundColor: "#F1F5F9",
            border: "1px solid #E2E8F0",
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "#64748B",
            }}
          >
            {ext}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function ViewerFooter({ file }: { file: File | null }) {
  return (
    <Box
      sx={{
        px: 2.5,
        py: 1.5,
        borderTop: "1px solid #E2E8F0",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        flexShrink: 0,
        backgroundColor: "#FFFFFF",
        minHeight: 48,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: file ? "#334155" : "#94A3B8",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {file?.name ?? "No file selected"}
      </Typography>
      {file && (
        <Box sx={{ px: 1.1, py: 0.3, borderRadius: "5px", backgroundColor: "#F1F5F9" }}>
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "#64748B",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatFileSize(file.size)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

interface DocumentViewerProps {
  file: File | null;
  onPageCountChange?: (count: number) => void;
  variant?: "default" | "dashboard";
  /** Engine-returned tamper / highlight regions. Invalid entries are ignored. */
  regions?: TamperRegion[];
  /** Engine-returned heatmap URL. Empty / missing values hide the layer. */
  heatmapUrl?: string | null;
  selectedRegionId?: string | null;
  onSelectRegion?: (id: string) => void;
  /** Controlled page (optional). When omitted, viewer manages page state. */
  currentPage?: number;
  onPageChange?: (page: number) => void;
  hideChrome?: boolean;
  /** Toggleable localization debug overlays (green raw / blue scaled). */
  debugLocalization?: boolean;
  onToggleDebugLocalization?: () => void;
}

export default function DocumentViewer({
  file,
  onPageCountChange,
  regions = [],
  heatmapUrl = null,
  selectedRegionId = null,
  onSelectRegion,
  currentPage: controlledPage,
  onPageChange,
  hideChrome = false,
  debugLocalization = false,
  onToggleDebugLocalization,
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(ZOOM_FIT);
  const [internalPage, setInternalPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const onPageCountChangeRef = useRef(onPageCountChange);
  onPageCountChangeRef.current = onPageCountChange;

  const mode = resolveViewerMode(file);
  const currentPage = controlledPage ?? internalPage;

  const validRegions = useMemo(
    () => regions.filter(isValidOverlayRegion),
    [regions]
  );
  const resolvedHeatmap = useMemo(() => resolveHeatmapUrl(heatmapUrl), [heatmapUrl]);
  const pageRegions = useMemo(
    () => validRegions.filter((region) => (region.page || 1) === currentPage),
    [validRegions, currentPage]
  );

  useEffect(() => {
    setZoom(ZOOM_FIT);
    setInternalPage(1);
    const pages = mode === "image" ? 1 : 0;
    setTotalPages(pages);
    onPageCountChangeRef.current?.(pages);
  }, [file, mode]);

  useEffect(() => {
    if (!file || mode !== "image") {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, mode]);

  const setPage = useCallback(
    (page: number) => {
      if (onPageChange) onPageChange(page);
      else setInternalPage(page);
    },
    [onPageChange]
  );

  const handleZoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => clampZoom(z - ZOOM_STEP)), []);
  const handleFitWidth = useCallback(() => setZoom(ZOOM_FIT), []);

  const handleLoadSuccess = useCallback((numPages: number) => {
    setTotalPages(numPages);
    onPageCountChangeRef.current?.(numPages);
  }, []);

  const handleLoadError = useCallback(() => {
    setTotalPages(0);
    onPageCountChangeRef.current?.(0);
  }, []);

  const handlePrevPage = useCallback(() => {
    setPage(Math.max(1, currentPage - 1));
  }, [currentPage, setPage]);

  const handleNextPage = useCallback(() => {
    setPage(Math.min(totalPages || currentPage, currentPage + 1));
  }, [currentPage, totalPages, setPage]);

  const showDebugToggle =
    Boolean(onToggleDebugLocalization) &&
    (validRegions.length > 0 || Boolean(resolvedHeatmap));

  return (
    <Box
      sx={{
        backgroundColor: "#FFFFFF",
        border: hideChrome ? "none" : "1px solid #E2E8F0",
        borderRadius: hideChrome ? 0 : "12px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        minHeight: 0,
        maxHeight: "100%",
        boxShadow: hideChrome
          ? "none"
          : "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
      }}
    >
      {!hideChrome && <ViewerHeader file={file} />}

      <Toolbar
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitWidth={handleFitWidth}
        currentPage={currentPage}
        totalPages={mode === "image" ? Math.max(1, totalPages || 1) : totalPages}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        showPageNav={mode === "pdf" || mode === "empty"}
        disabled={mode === "empty"}
        debug={debugLocalization}
        onToggleDebug={onToggleDebugLocalization}
        showDebugToggle={showDebugToggle}
      />

      {mode === "empty" && <EmptyState />}
      {mode === "image" && objectUrl && (
        <ImageViewer
          objectUrl={objectUrl}
          zoom={zoom}
          pageRegions={pageRegions}
          heatmapUrl={resolvedHeatmap}
          selectedRegionId={selectedRegionId}
          onSelectRegion={onSelectRegion}
          debug={debugLocalization}
        />
      )}
      {mode === "pdf" && file && (
        <PdfViewer
          file={file}
          zoom={zoom}
          currentPage={currentPage}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          pageRegions={pageRegions}
          heatmapUrl={resolvedHeatmap}
          selectedRegionId={selectedRegionId}
          onSelectRegion={onSelectRegion}
          debug={debugLocalization}
        />
      )}

      {!hideChrome && <ViewerFooter file={file} />}
    </Box>
  );
}
