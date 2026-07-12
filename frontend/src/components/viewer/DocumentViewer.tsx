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
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TamperRegion } from "../../types/verification";

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
}

function OverlayLayer({
  regions,
  heatmapUrl,
  selectedId,
  onSelectRegion,
}: OverlayLayerProps) {
  const hasRegions = regions.length > 0;
  const hasHeatmap = Boolean(heatmapUrl);

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
      {regions.map((region) => {
        const color = SEVERITY_COLOR[region.severity] ?? SEVERITY_COLOR.medium;
        const [x, y, w, h] = region.bbox;
        const selected = region.id === selectedId;
        return (
          <Box
            key={region.id}
            onClick={(event) => {
              event.stopPropagation();
              onSelectRegion?.(region.id);
            }}
            title={region.label}
            sx={{
              position: "absolute",
              left: `${(x / region.imageWidth) * 100}%`,
              top: `${(y / region.imageHeight) * 100}%`,
              width: `${(w / region.imageWidth) * 100}%`,
              height: `${(h / region.imageHeight) * 100}%`,
              border: `2px solid ${color}`,
              backgroundColor: selected ? `${color}33` : `${color}22`,
              borderRadius: "4px",
              boxShadow: selected
                ? `0 0 0 3px ${color}55, 0 8px 20px rgba(15,23,42,0.18)`
                : `0 0 0 1px ${color}22`,
              cursor: onSelectRegion ? "pointer" : "default",
              zIndex: selected ? 3 : 2,
            }}
          />
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
          Upload a certificate to preview evidence here
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
}

function ImageViewer({
  objectUrl,
  zoom,
  pageRegions,
  heatmapUrl,
  selectedRegionId,
  onSelectRegion,
}: ImageViewerProps) {
  return (
    <Box sx={{ ...scrollAreaSx, p: 2.5 }}>
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
              borderRadius: "6px",
              boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
              border: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
            }}
          />
          <OverlayLayer
            regions={pageRegions}
            heatmapUrl={heatmapUrl}
            selectedId={selectedRegionId}
            onSelectRegion={onSelectRegion}
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
}: PdfViewerProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const lockedWidth = useRef(0);

  useEffect(() => {
    setIsLoading(true);
    setUseNativeFallback(false);
    lockedWidth.current = 0;
    setBaseWidth(0);
  }, [file]);

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

  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setIsLoading(false);
      onLoadSuccess(numPages);
    },
    [onLoadSuccess]
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
                  sx={{
                    boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: "1px solid #E2E8F0",
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
                  />
                  <OverlayLayer
                    regions={pageRegions}
                    heatmapUrl={heatmapUrl}
                    selectedId={selectedRegionId}
                    onSelectRegion={onSelectRegion}
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
        />
      )}

      {!hideChrome && <ViewerFooter file={file} />}
    </Box>
  );
}
