/**
 * BatchVerificationPage — VERISCAN multi-file verification queue.
 */

import { useMemo, useRef, useState, type DragEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import ReplayIcon from "@mui/icons-material/Replay";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import type { BatchJob } from "../hooks/useBatchQueue";
import { useBatchQueue } from "../hooks/useBatchQueue";
import {
  downloadBatchCsv,
  downloadBatchJson,
  resultToExportRow,
} from "../utils/batchExport";
import ResultsDashboard from "../components/results/ResultsDashboard";
import { PRODUCT_NAME } from "../branding/constants";
import { VS } from "../theme";

interface BatchVerificationPageProps {
  onBack: () => void;
}

const STATUS_META: Record<
  BatchJob["status"],
  { color: string; label: string }
> = {
  pending: { color: VS.textMuted, label: "PENDING" },
  running: { color: VS.accent, label: "PROCESSING" },
  done: { color: VS.success, label: "COMPLETE" },
  error: { color: VS.danger, label: "ERROR" },
  cancelled: { color: VS.textMuted, label: "CANCELLED" },
};

function formatEta(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `~${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `~${min}m ${rem}s`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusIcon({ status }: { status: BatchJob["status"] }) {
  const color = STATUS_META[status].color;
  if (status === "done") {
    return (
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          backgroundColor: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <CheckRoundedIcon sx={{ fontSize: 14, color: VS.bg }} />
      </Box>
    );
  }
  if (status === "running") {
    return <CircularProgress size={18} thickness={5} sx={{ color, flexShrink: 0 }} />;
  }
  if (status === "error") {
    return <ErrorOutlineOutlinedIcon sx={{ fontSize: 20, color, flexShrink: 0 }} />;
  }
  return <HourglassEmptyIcon sx={{ fontSize: 18, color, flexShrink: 0 }} />;
}

function StatChip({
  label,
  value,
  color = VS.textSecondary,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.25,
        borderRadius: "8px",
        border: `1px solid ${VS.border}`,
        backgroundColor: VS.bgCard,
        minWidth: 96,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.5625rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          color: VS.textMuted,
          fontFamily: VS.mono,
          mb: 0.35,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: "1.125rem",
          fontWeight: 700,
          color,
          fontFamily: VS.mono,
          lineHeight: 1,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function BatchVerificationPage({
  onBack,
}: BatchVerificationPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    jobs,
    running,
    addFiles,
    clearJobs,
    cancelRemaining,
    runQueue,
    retryFailed,
    maxFiles,
    progress,
  } = useBatchQueue(3);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const selected =
    jobs.find((j) => j.id === selectedId && j.status === "done") ?? null;

  const exportRows = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "done" || j.status === "error")
        .map((j) =>
          resultToExportRow(
            j.file.name,
            j.status,
            j.result,
            j.error,
            j.durationMs
          )
        ),
    [jobs]
  );

  const pct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (running || jobs.length >= maxFiles) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const btnOutlined = {
    height: 40,
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "0.8125rem",
    borderColor: VS.borderStrong,
    color: VS.text,
    "&:hover": {
      borderColor: VS.accent,
      backgroundColor: VS.accentDim,
    },
    "&.Mui-disabled": {
      borderColor: VS.border,
      color: VS.textMuted,
    },
  } as const;

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, md: 3.5 },
        pt: { xs: 2.5, md: 3 },
        pb: { xs: 6, md: 7 },
        maxWidth: 1400,
        mx: "auto",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Button
            startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
            onClick={onBack}
            sx={{
              mb: 1.5,
              px: 0,
              minWidth: 0,
              color: VS.textMuted,
              fontWeight: 600,
              fontSize: "0.8125rem",
              "&:hover": { color: VS.accent, backgroundColor: "transparent" },
            }}
          >
            Back to single analysis
          </Button>
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: VS.accent,
              fontFamily: VS.mono,
              mb: 0.75,
            }}
          >
            {PRODUCT_NAME} · BATCH PROTOCOL
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "1.5rem", sm: "1.75rem" },
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: VS.text,
              mb: 0.5,
            }}
          >
            Batch verification
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: VS.textSecondary }}>
            Upload up to {maxFiles} certificates · concurrency 3 · export CSV /
            JSON when done
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <StatChip label="QUEUED" value={jobs.length} />
          <StatChip
            label="DONE"
            value={progress.doneCount}
            color={VS.success}
          />
          <StatChip
            label="ERRORS"
            value={progress.errorCount}
            color={progress.errorCount > 0 ? VS.danger : VS.textSecondary}
          />
          <StatChip
            label="ETA"
            value={formatEta(progress.etaMs)}
            color={VS.accent}
          />
        </Box>
      </Box>

      {/* Dropzone */}
      <Box
        onClick={() => {
          if (!running && jobs.length < maxFiles) inputRef.current?.click();
        }}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: "12px",
          border: "1.5px dashed",
          borderColor: dragging ? VS.accent : "rgba(255,255,255,0.16)",
          backgroundColor: dragging ? VS.accentDim : "rgba(255,255,255,0.02)",
          mb: 2.5,
          textAlign: "center",
          cursor:
            running || jobs.length >= maxFiles ? "not-allowed" : "pointer",
          opacity: running || jobs.length >= maxFiles ? 0.55 : 1,
          transition: "border-color 160ms ease, background-color 160ms ease",
          "&:hover":
            running || jobs.length >= maxFiles
              ? undefined
              : {
                  borderColor: VS.accent,
                  backgroundColor: VS.accentDim,
                },
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <UploadFileOutlinedIcon
          sx={{ fontSize: 36, color: dragging ? VS.accent : VS.textMuted, mb: 1.25 }}
        />
        <Typography
          sx={{
            fontSize: "1.0625rem",
            fontWeight: 600,
            color: VS.text,
            mb: 0.75,
          }}
        >
          {dragging
            ? "Release to queue files"
            : "Drop multiple PDFs or high-resolution JPEG / PNG"}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: VS.textMuted,
            fontFamily: VS.mono,
          }}
        >
          {jobs.length} / {maxFiles} QUEUED · MAX 50MB EACH · ENCRYPTED IN
          TRANSIT
        </Typography>
      </Box>

      {/* Actions */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          mb: 2.5,
          alignItems: "center",
        }}
      >
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => void runQueue()}
          disabled={running || progress.pendingCount === 0}
          sx={{
            height: 40,
            borderRadius: "8px",
            fontWeight: 700,
            boxShadow: `0 0 16px ${VS.accentGlow}`,
          }}
        >
          Start batch
        </Button>
        <Button
          variant="outlined"
          startIcon={<StopIcon />}
          onClick={cancelRemaining}
          disabled={!running}
          sx={btnOutlined}
        >
          Cancel remaining
        </Button>
        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={retryFailed}
          disabled={running || progress.errorCount === 0}
          sx={btnOutlined}
        >
          Retry failed
        </Button>
        <Button
          variant="outlined"
          startIcon={<DeleteOutlineOutlinedIcon />}
          onClick={() => {
            setSelectedId(null);
            clearJobs();
          }}
          disabled={running || jobs.length === 0}
          sx={{
            ...btnOutlined,
            borderColor: progress.errorCount > 0 ? `${VS.danger}66` : VS.borderStrong,
            color: VS.danger,
            "&:hover": {
              borderColor: VS.danger,
              backgroundColor: VS.dangerDim,
            },
          }}
        >
          Clear
        </Button>

        <Box sx={{ flex: 1, minWidth: 8 }} />

        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => downloadBatchCsv(exportRows)}
          disabled={exportRows.length === 0}
          sx={btnOutlined}
        >
          Export CSV
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => downloadBatchJson(exportRows)}
          disabled={exportRows.length === 0}
          sx={btnOutlined}
        >
          Export JSON
        </Button>
      </Box>

      {/* Progress */}
      {progress.total > 0 && (
        <Box
          sx={{
            mb: 2.5,
            p: 2,
            borderRadius: "10px",
            border: `1px solid ${VS.border}`,
            backgroundColor: VS.bgCard,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mb: 1.25,
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: VS.text,
                fontFamily: VS.mono,
              }}
            >
              {progress.completed} / {progress.total} COMPLETED · {pct}%
            </Typography>
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: VS.textMuted,
                fontFamily: VS.mono,
              }}
            >
              RUNNING {progress.runningCount} · PENDING {progress.pendingCount}{" "}
              · DONE {progress.doneCount} · ERRORS {progress.errorCount} · ETA{" "}
              {formatEta(progress.etaMs)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.08)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 2,
                backgroundColor: VS.accent,
                boxShadow: `0 0 10px ${VS.accentGlow}`,
              },
            }}
          />
        </Box>
      )}

      {/* Job list */}
      <Box
        sx={{
          borderRadius: "12px",
          border: `1px solid ${VS.border}`,
          backgroundColor: VS.bgCard,
          overflow: "hidden",
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateColumns:
              "minmax(180px, 2.2fr) 120px 110px 90px 90px 90px minmax(120px, 1.2fr)",
            gap: 1,
            px: 2.25,
            py: 1.35,
            borderBottom: `1px solid ${VS.border}`,
            backgroundColor: "rgba(255,255,255,0.02)",
          }}
        >
          {["FILE", "STATUS", "VERDICT", "CONF.", "AI PROB.", "DURATION", "ERROR"].map(
            (h) => (
              <Typography
                key={h}
                sx={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: VS.textMuted,
                  fontFamily: VS.mono,
                }}
              >
                {h}
              </Typography>
            )
          )}
        </Box>

        {jobs.length === 0 ? (
          <Box sx={{ px: 2, py: 5, textAlign: "center" }}>
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: VS.textMuted,
                fontFamily: VS.mono,
              }}
            >
              NO FILES QUEUED — DROP CERTIFICATES ABOVE TO BEGIN
            </Typography>
          </Box>
        ) : (
          jobs.map((job) => {
            const meta = STATUS_META[job.status];
            const clickable = job.status === "done" && Boolean(job.result);
            const active = selectedId === job.id;

            return (
              <Box
                key={job.id}
                onClick={() => {
                  if (clickable) setSelectedId(job.id);
                }}
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(180px, 2.2fr) 120px 110px 90px 90px 90px minmax(120px, 1.2fr)",
                  },
                  gap: { xs: 0.75, md: 1 },
                  px: 2.25,
                  py: 1.5,
                  borderBottom: `1px solid ${VS.border}`,
                  alignItems: "center",
                  cursor: clickable ? "pointer" : "default",
                  backgroundColor: active
                    ? VS.accentDim
                    : job.status === "running"
                      ? "rgba(0,255,163,0.04)"
                      : "transparent",
                  borderLeft: active
                    ? `3px solid ${VS.accent}`
                    : "3px solid transparent",
                  transition: "background-color 150ms ease",
                  "&:hover": clickable
                    ? { backgroundColor: "rgba(0,255,163,0.08)" }
                    : undefined,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    minWidth: 0,
                  }}
                >
                  <StatusIcon status={job.status} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: VS.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontFamily: VS.mono,
                      }}
                      title={job.file.name}
                    >
                      {job.file.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.6875rem",
                        color: VS.textMuted,
                        display: { xs: "block", md: "none" },
                      }}
                    >
                      {formatBytes(job.file.size)}
                    </Typography>
                  </Box>
                </Box>

                <Typography
                  sx={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: meta.color,
                    fontFamily: VS.mono,
                  }}
                >
                  {meta.label}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    color: VS.textSecondary,
                    textTransform: "capitalize",
                  }}
                >
                  {job.result?.verdict ?? "—"}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    fontVariantNumeric: "tabular-nums",
                    color: VS.textSecondary,
                    fontFamily: VS.mono,
                  }}
                >
                  {job.result != null ? `${job.result.confidence}%` : "—"}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    fontVariantNumeric: "tabular-nums",
                    color: VS.textSecondary,
                    fontFamily: VS.mono,
                  }}
                >
                  {job.result?.aiProbability != null
                    ? `${job.result.aiProbability}%`
                    : "—"}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    fontVariantNumeric: "tabular-nums",
                    color: VS.textMuted,
                    fontFamily: VS.mono,
                  }}
                >
                  {formatDuration(job.durationMs)}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    color: job.error ? VS.danger : VS.textMuted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={job.error || undefined}
                >
                  {job.error || "—"}
                </Typography>
              </Box>
            );
          })
        )}
      </Box>

      {selected?.result && (
        <Box>
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: VS.accent,
              fontFamily: VS.mono,
              mb: 1.5,
            }}
          >
            SELECTED REPORT · {selected.file.name.toUpperCase()}
          </Typography>
          <ResultsDashboard
            result={selected.result}
            file={selected.file}
          />
        </Box>
      )}
    </Box>
  );
}
