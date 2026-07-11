/**
 * DocumentViewer — enterprise document preview panel.
 *
 * Features:
 *   - Toolbar: zoom in/out, fit-width reset, page navigation (PDF only)
 *   - Image rendering: native browser via URL.createObjectURL + CSS width zoom
 *   - PDF rendering: react-pdf with page controls
 *   - Loading indicator while PDF loads
 *   - Object URLs revoked on unmount/file change
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

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_DEFAULT = 1.0;

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ViewerMode = "empty" | "image" | "pdf";

function resolveViewerMode(file: File | null): ViewerMode {
  if (!file) return "empty";
  if (file.type.startsWith("image/")) return "image";
  return "pdf";
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
}: ToolbarProps) {
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
        flexWrap: "wrap",
      }}
    >
      <Tooltip title="Zoom out">
        <span>
          <IconButton
            size="small"
            onClick={onZoomOut}
            disabled={zoom <= ZOOM_MIN}
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
            disabled={zoom >= ZOOM_MAX}
            sx={btnSx}
          >
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Fit width">
        <IconButton
          size="small"
          onClick={onFitWidth}
          sx={{
            ...btnSx,
            color: zoom === ZOOM_DEFAULT ? "#0078D4" : btnSx.color,
          }}
        >
          <FitScreenIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {showPageNav && totalPages > 0 && (
        <>
          <Box
            sx={{
              width: "1px",
              height: 16,
              backgroundColor: "#E2E8F0",
              mx: 0.75,
              flexShrink: 0,
            }}
          />
          <Tooltip title="Previous page">
            <span>
              <IconButton
                size="small"
                onClick={onPrevPage}
                disabled={currentPage <= 1}
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
            }}
          >
            {currentPage} / {totalPages}
          </Typography>

          <Tooltip title="Next page">
            <span>
              <IconButton
                size="small"
                onClick={onNextPage}
                disabled={currentPage >= totalPages}
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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
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

function ImageViewer({ objectUrl, zoom }: { objectUrl: string; zoom: number }) {
  return (
    <Box
      sx={{
        flex: 1,
        overflow: "auto",
        display: "flex",
        alignItems: zoom > 1 ? "flex-start" : "center",
        justifyContent: "center",
        p: 2.5,
        minHeight: 0,
        backgroundColor: "#EEF2F7",
      }}
    >
      <Box
        component="img"
        src={objectUrl}
        alt="Certificate preview"
        sx={{
          width: `${zoom * 100}%`,
          height: "auto",
          display: "block",
          borderRadius: "6px",
          boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
          border: "1px solid #E2E8F0",
          minWidth: "50%",
          backgroundColor: "#FFFFFF",
        }}
      />
    </Box>
  );
}

interface PdfViewerProps {
  file: File;
  zoom: number;
  currentPage: number;
  onLoadSuccess: (numPages: number) => void;
  onLoadError: () => void;
}

function PdfViewer({ file, zoom, currentPage, onLoadSuccess, onLoadError }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setIsLoading(false);
      setHasError(false);
      onLoadSuccess(numPages);
    },
    [onLoadSuccess]
  );

  const handleLoadError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onLoadError();
  }, [onLoadError]);

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        p: 2.5,
        minHeight: 0,
        position: "relative",
        backgroundColor: "#EEF2F7",
      }}
    >
      {isLoading && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(248,250,252,0.92)",
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

      {hasError && (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Typography sx={{ fontSize: "0.875rem", color: "#64748B" }}>
            Unable to render document
          </Typography>
        </Box>
      )}

      {!hasError && (
        <Document
          file={objectUrl}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading=""
        >
          <Box
            sx={{
              boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
            }}
          >
            <Page
              pageNumber={currentPage}
              width={Math.floor(containerWidth * zoom - 40)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Box>
        </Document>
      )}
    </Box>
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

function ViewerFooter({ file }: { file: File }) {
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
      }}
    >
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: "#334155",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {file.name}
      </Typography>
      <Box
        sx={{
          px: 1.1,
          py: 0.3,
          borderRadius: "5px",
          backgroundColor: "#F1F5F9",
        }}
      >
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
    </Box>
  );
}

interface DocumentViewerProps {
  file: File | null;
  onPageCountChange?: (count: number) => void;
  variant?: "default" | "dashboard";
}

export default function DocumentViewer({
  file,
  onPageCountChange,
  variant = "default",
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const mode = resolveViewerMode(file);
  const isDashboard = variant === "dashboard";

  useEffect(() => {
    setZoom(ZOOM_DEFAULT);
    setCurrentPage(1);
    setTotalPages(0);
    onPageCountChange?.(0);
  }, [file, onPageCountChange]);

  useEffect(() => {
    if (!file || mode !== "image") {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, mode]);

  const handleZoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => clampZoom(z - ZOOM_STEP)), []);
  const handleFitWidth = useCallback(() => setZoom(ZOOM_DEFAULT), []);

  const handleLoadSuccess = useCallback(
    (numPages: number) => {
      setTotalPages(numPages);
      onPageCountChange?.(numPages);
    },
    [onPageCountChange]
  );

  const handleLoadError = useCallback(() => {
    setTotalPages(0);
    onPageCountChange?.(0);
  }, [onPageCountChange]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const showToolbar = mode !== "empty";
  const showPageNav = mode === "pdf";

  return (
    <Box
      sx={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: { xs: "auto", md: isDashboard ? "calc(100vh - 96px)" : "100%" },
        minHeight: { xs: 320, md: isDashboard ? 560 : 0 },
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
      }}
    >
      <ViewerHeader file={file} />

      {showToolbar && (
        <Toolbar
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitWidth={handleFitWidth}
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          showPageNav={showPageNav}
        />
      )}

      {mode === "empty" && <EmptyState />}

      {mode === "image" && objectUrl && (
        <ImageViewer objectUrl={objectUrl} zoom={zoom} />
      )}

      {mode === "pdf" && file && (
        <PdfViewer
          file={file}
          zoom={zoom}
          currentPage={currentPage}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
        />
      )}

      {file && <ViewerFooter file={file} />}
    </Box>
  );
}
