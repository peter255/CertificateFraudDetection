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
  projectToContent,
  type OverlayProjection,
} from "../../utils/localization";
import { VS } from "../../theme";

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
  if (!Number.isFinite(region.page) || region.page < 1) return false;
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

/** Size the preview to the rendered page instead of stretching to fill the panel. */
const fitContentScrollAreaSx = {
  flex: "0 0 auto",
  overflow: "auto",
  backgroundColor: "#EEF2F7",
};

interface OverlayLayerProps {
  regions: TamperRegion[];
  heatmapUrl: string | null;
  selectedId: string | null;
  onSelectRegion?: (id: string) => void;
  debug?: boolean;
}

function formatProj(p: OverlayProjection): string {
  return (
    `sx=${p.scaleX.toFixed(4)} sy=${p.scaleY.toFixed(4)} ` +
    `fileSurface=${p.contentWidth.toFixed(0)}×${p.contentHeight.toFixed(0)} ` +
    `src=${p.imageWidth}×${p.imageHeight}`
  );
}

/**
 * Overlay host must be sized exactly to the file surface (img / PDF canvas).
 * Boxes are percentages of vendor image_width × image_height mapped onto that surface.
 */
function OverlayLayer({
  regions,
  heatmapUrl,
  selectedId,
  onSelectRegion,
  debug = false,
}: OverlayLayerProps) {
  const hasRegions = regions.length > 0;
  const hasHeatmap = Boolean(heatmapUrl);
  const hostRef = useRef<HTMLDivElement>(null);
  const [surfaceSize, setSurfaceSize] = useState<{ width: number; height: number } | null>(
    null
  );

  const measureSurface = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width > 0 && height > 0) {
      setSurfaceSize({ width, height });
    }
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    measureSurface();
    const obs = new ResizeObserver(() => measureSurface());
    obs.observe(el);
    return () => obs.disconnect();
  }, [measureSurface, regions, heatmapUrl]);

  useEffect(() => {
    if (!debug || !surfaceSize) return;
    for (const region of regions) {
      const projected = projectToContent(
        region.bbox,
        region.imageWidth,
        region.imageHeight,
        surfaceSize.width,
        surfaceSize.height
      );
      if (!projected) continue;
      // eslint-disable-next-line no-console
      console.info("[localization-debug]", {
        id: region.id,
        page: region.page,
        format: region.bboxFormat,
        originalBBox: region.rawBBox,
        interpretedXywh: region.bbox,
        imageSize: [region.imageWidth, region.imageHeight],
        fileSurfaceSize: [surfaceSize.width, surfaceSize.height],
        scaleX: projected.scaleX,
        scaleY: projected.scaleY,
        renderedOnFile: [projected.left, projected.top, projected.width, projected.height],
      });
    }
  }, [debug, surfaceSize, regions]);

  if (!hasRegions && !hasHeatmap) {
    return null;
  }

  return (
    <Box
      ref={hostRef}
      sx={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
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
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            opacity: hasRegions ? 0.4 : 0.55,
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      )}
      {regions.map((region, index) => {
        const color = SEVERITY_COLOR[region.severity] ?? SEVERITY_COLOR.medium;
        const selected = region.id === selectedId;
        const [x, y, w, h] = region.bbox;
        const leftPct = (x / region.imageWidth) * 100;
        const topPct = (y / region.imageHeight) * 100;
        const widthPct = (w / region.imageWidth) * 100;
        const heightPct = (h / region.imageHeight) * 100;

        const projected =
          surfaceSize &&
          projectToContent(
            region.bbox,
            region.imageWidth,
            region.imageHeight,
            surfaceSize.width,
            surfaceSize.height
          );

        const rawPct =
          debug && region.rawBBox
            ? {
                left: (region.rawBBox[0] / region.imageWidth) * 100,
                top: (region.rawBBox[1] / region.imageHeight) * 100,
                width: (region.rawBBox[2] / region.imageWidth) * 100,
                height: (region.rawBBox[3] / region.imageHeight) * 100,
              }
            : null;

        return (
          <Box key={`${region.id}-${index}`} component="span" sx={{ display: "contents" }}>
            <Box
              onClick={(event) => {
                event.stopPropagation();
                onSelectRegion?.(region.id);
              }}
              title={
                debug && projected
                  ? [
                      region.label,
                      `page=${region.page}`,
                      `format=${region.bboxFormat ?? "?"}`,
                      `raw=[${(region.rawBBox || []).join(", ")}]`,
                      `xywh=[${region.bbox.join(", ")}]`,
                      `fileSurface=${surfaceSize?.width.toFixed(0)}×${surfaceSize?.height.toFixed(0)}`,
                      formatProj(projected),
                    ].join(" | ")
                  : region.label
              }
              sx={{
                position: "absolute",
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                border: debug ? `2px solid #2563EB` : `2px solid ${color}`,
                backgroundColor: selected
                  ? debug
                    ? "rgba(37,99,235,0.18)"
                    : `${color}33`
                  : debug
                    ? "rgba(37,99,235,0.08)"
                    : `${color}22`,
                borderRadius: debug ? 0 : "2px",
                boxShadow: selected
                  ? `0 0 0 3px ${debug ? "#2563EB55" : `${color}55`}`
                  : undefined,
                cursor: onSelectRegion ? "pointer" : "default",
                zIndex: selected ? 3 : 2,
                boxSizing: "border-box",
              }}
            />

            {debug && rawPct && (
              <Box
                sx={{
                  position: "absolute",
                  left: `${rawPct.left}%`,
                  top: `${rawPct.top}%`,
                  width: `${Math.max(rawPct.width, 0.1)}%`,
                  height: `${Math.max(rawPct.height, 0.1)}%`,
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
                  left: `${Math.max(0, leftPct)}%`,
                  top: `calc(${Math.max(0, topPct)}% - 16px)`,
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
                {region.bboxAmbiguous ? " ?" : ""} | [{region.bbox.map((n) => Math.round(n)).join(",")}]
                {" @ "}
                {region.imageWidth}×{region.imageHeight}
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
    color: VS.textSecondary,
    borderRadius: "7px",
    "&:hover": { backgroundColor: "rgba(35,37,40,0.06)" },
    "&.Mui-disabled": { color: VS.textMuted },
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        px: 1.5,
        py: 0.875,
        borderBottom: "1px solid rgba(35,37,40,0.08)",
        backgroundColor: VS.bgElevated,
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
          color: VS.text,
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
              color: isFit ? VS.accent : btnSx.color,
              backgroundColor: isFit ? "rgba(146,114,42,0.12)" : "transparent",
            }}
          >
            <FitScreenIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {showPageNav && (
        <>
          <Box sx={{ width: "1px", height: 16, backgroundColor: "rgba(35,37,40,0.12)", mx: 0.75, flexShrink: 0 }} />
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
              color: VS.textSecondary,
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
                color: debug ? VS.accent : btnSx.color,
                backgroundColor: debug ? "rgba(146,114,42,0.12)" : "transparent",
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
        backgroundColor: VS.bgPanel,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "14px",
          backgroundColor: VS.bgCard,
          border: "1px solid rgba(35,37,40,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DescriptionOutlinedIcon sx={{ fontSize: 28, color: VS.textMuted }} />
      </Box>
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: VS.text, mb: 0.5 }}>
          No document loaded
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: VS.textMuted, lineHeight: 1.55 }}>
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
  fitContent?: boolean;
}

function ImageViewer({
  objectUrl,
  zoom,
  pageRegions,
  heatmapUrl,
  selectedRegionId,
  onSelectRegion,
  debug = false,
  fitContent = false,
}: ImageViewerProps) {
  return (
    <Box sx={{ ...(fitContent ? fitContentScrollAreaSx : scrollAreaSx), p: 2.5 }}>
      {debug && (
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
          {" = raw as xywh  "}
          <Box component="span" sx={{ color: "#60A5FA" }}>
            ■ blue
          </Box>
          {" = interpreted — drawn on file surface only"}
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
          }}
        >
          {/* File surface: sized by the image itself — overlays attach here only. */}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              lineHeight: 0,
              borderRadius: "6px",
              boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
              outline: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
              overflow: "hidden",
            }}
          >
            <Box
              component="img"
              src={objectUrl}
              alt="Certificate preview"
              sx={{
                width: "100%",
                maxWidth: "none",
                height: "auto",
                display: "block",
                verticalAlign: "top",
              }}
            />
            <OverlayLayer
              regions={pageRegions}
              heatmapUrl={heatmapUrl}
              selectedId={selectedRegionId}
              onSelectRegion={onSelectRegion}
              debug={debug}
            />
          </Box>
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
  fitContent?: boolean;
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
  fitContent = false,
}: PdfViewerProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  /** Exact PDF canvas box relative to pageBoxRef — overlays mount here only. */
  const [fileSurface, setFileSurface] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const lockedWidth = useRef(0);

  useEffect(() => {
    setIsLoading(true);
    setUseNativeFallback(false);
    lockedWidth.current = 0;
    setBaseWidth(0);
    setFileSurface(null);
  }, [file]);

  useEffect(() => {
    setFileSurface(null);
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

  const measureFileSurface = useCallback(() => {
    const host = pageBoxRef.current;
    if (!host) return;
    const canvas = host.querySelector("canvas");
    if (!canvas) return;
    // Position relative to the page host — NOT the outer scroll container.
    setFileSurface({
      left: canvas.offsetLeft,
      top: canvas.offsetTop,
      width: canvas.offsetWidth,
      height: canvas.offsetHeight,
    });
  }, []);

  useEffect(() => {
    const el = pageBoxRef.current;
    if (!el) return;
    measureFileSurface();
    const obs = new ResizeObserver(() => measureFileSurface());
    obs.observe(el);
    const canvas = el.querySelector("canvas");
    if (canvas) obs.observe(canvas);
    return () => obs.disconnect();
  }, [baseWidth, currentPage, zoom, measureFileSurface]);

  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setIsLoading(false);
      onLoadSuccess(numPages);
      requestAnimationFrame(() => measureFileSurface());
    },
    [onLoadSuccess, measureFileSurface]
  );

  const hasOverlays = pageRegions.length > 0 || Boolean(heatmapUrl);

  const handleLoadError = useCallback(() => {
    setIsLoading(false);
    if (!hasOverlays) {
      setUseNativeFallback(true);
    }
    onLoadError();
  }, [onLoadError, hasOverlays]);

  return (
    <Box
      ref={measureRef}
      sx={{
        ...(fitContent ? fitContentScrollAreaSx : scrollAreaSx),
        p: useNativeFallback ? 0 : 2.5,
        position: "relative",
        // Keep a short placeholder while measuring so the panel does not collapse to 0.
        minHeight:
          fitContent && (isLoading || (baseWidth === 0 && !useNativeFallback))
            ? 240
            : undefined,
      }}
    >
      {debug && fileSurface && (
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
          Drawn on PDF canvas only — page {currentPage} file surface{" "}
          {fileSurface.width}×{fileSurface.height}px @ ({fileSurface.left},{fileSurface.top})
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
        <NativePdfFallback file={file} fitContent={fitContent} />
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
                    onRenderSuccess={measureFileSurface}
                  />
                  {/* Overlay host = exact canvas rect, not the page container. */}
                  {fileSurface && fileSurface.width > 0 && fileSurface.height > 0 && (
                    <Box
                      sx={{
                        position: "absolute",
                        left: fileSurface.left,
                        top: fileSurface.top,
                        width: fileSurface.width,
                        height: fileSurface.height,
                        pointerEvents: "none",
                        zIndex: 2,
                        "& > *": { pointerEvents: "auto" },
                      }}
                    >
                      <OverlayLayer
                        regions={pageRegions}
                        heatmapUrl={heatmapUrl}
                        selectedId={selectedRegionId}
                        onSelectRegion={onSelectRegion}
                        debug={debug}
                      />
                    </Box>
                  )}
                </Box>
              </Document>
            </Box>
          </Box>
        )
      )}
    </Box>
  );
}

function NativePdfFallback({
  file,
  fitContent = false,
}: {
  file: File;
  fitContent?: boolean;
}) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  return (
    <Box
      component="iframe"
      title={file.name}
      src={`${objectUrl}#view=FitH`}
      sx={{
        width: "100%",
        height: fitContent ? 480 : "100%",
        border: "none",
        backgroundColor: "#FFFFFF",
        flex: fitContent ? "0 0 auto" : 1,
        minHeight: fitContent ? 320 : 0,
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
        borderBottom: "1px solid rgba(35,37,40,0.08)",
        backgroundColor: VS.bgCard,
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
          backgroundColor: file ? VS.accent : VS.textMuted,
          boxShadow: "none",
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: VS.text,
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
            backgroundColor: "rgba(35,37,40,0.04)",
            border: "1px solid rgba(35,37,40,0.08)",
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: VS.textSecondary,
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
        borderTop: "1px solid rgba(35,37,40,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        flexShrink: 0,
        backgroundColor: VS.bgCard,
        minHeight: 48,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: file ? VS.text : VS.textMuted,
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
        <Box
          sx={{
            px: 1.1,
            py: 0.3,
            borderRadius: "5px",
            backgroundColor: "rgba(35,37,40,0.04)",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: VS.textSecondary,
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
  /**
   * Size the panel to the rendered page instead of stretching to fill a
   * fixed parent height (used on upload / analyzing split view).
   */
  fitContent?: boolean;
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
  fitContent = false,
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
        backgroundColor: hideChrome ? "transparent" : VS.bgElevated,
        border: hideChrome ? "none" : "1px solid rgba(35,37,40,0.08)",
        borderRadius: hideChrome ? 0 : "12px",
        display: "flex",
        flexDirection: "column",
        overflow: fitContent ? "visible" : "hidden",
        height: fitContent ? "auto" : "100%",
        minHeight: 0,
        maxHeight: fitContent ? "none" : "100%",
        boxShadow: "none",
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
          fitContent={fitContent}
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
          fitContent={fitContent}
        />
      )}

      {!hideChrome && <ViewerFooter file={file} />}
    </Box>
  );
}
