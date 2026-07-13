/**
 * BatchVerificationPage — multi-file verification with progress and export.
 */

import { useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import ReplayIcon from "@mui/icons-material/Replay";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { BatchJob } from "../hooks/useBatchQueue";
import { useBatchQueue } from "../hooks/useBatchQueue";
import {
  downloadBatchCsv,
  downloadBatchJson,
  resultToExportRow,
} from "../utils/batchExport";
import { downloadVerificationReport } from "../utils/downloadReport";
import VerdictCard from "../components/results/VerdictCard";
import ExecutiveSummaryCard from "../components/results/ExecutiveSummaryCard";
import SignalsList from "../components/results/SignalsList";
import ExecutiveReport from "../components/results/ExecutiveReport";
import AnnotatedDocumentSection from "../components/results/AnnotatedDocumentSection";
import TechnicalDetails from "../components/results/TechnicalDetails";
import VendorAnalysis from "../components/results/VendorAnalysis";
import ActionsPanel from "../components/results/ActionsPanel";
import { DASHBOARD } from "../components/results/shared/dashboardShell";
import { PRODUCT_NAME } from "../branding/constants";

interface BatchVerificationPageProps {
  onBack: () => void;
}

const STATUS_COLOR: Record<BatchJob["status"], string> = {
  pending: "#64748B",
  running: "#0078D4",
  done: "#107C10",
  error: "#C50F1F",
  cancelled: "#94A3B8",
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

export default function BatchVerificationPage({ onBack }: BatchVerificationPageProps) {
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
  const selected = jobs.find((j) => j.id === selectedId && j.status === "done") ?? null;

  const exportRows = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "done" || j.status === "error")
        .map((j) =>
          resultToExportRow(j.file.name, j.status, j.result, j.error, j.durationMs)
        ),
    [jobs]
  );

  const pct =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, md: 4 },
        pt: { xs: 3, md: 4 },
        pb: { xs: 8, md: 7 },
        maxWidth: 1400,
        mx: "auto",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Single verify
        </Button>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.02em" }}>
            Batch verification
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "#64748B" }}>
            {PRODUCT_NAME} · upload up to {maxFiles} certificates. Concurrency 3. Export CSV or JSON when done.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          p: 3,
          borderRadius: "16px",
          border: `1px dashed ${DASHBOARD.border}`,
          backgroundColor: "#FFFFFF",
          mb: 2.5,
          textAlign: "center",
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
        <UploadFileOutlinedIcon sx={{ fontSize: 36, color: DASHBOARD.accent, mb: 1 }} />
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
          Select certificate files
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: "#64748B", mb: 2 }}>
          PDF, JPG, or PNG — {jobs.length} / {maxFiles} queued
        </Typography>
        <Button
          variant="contained"
          onClick={() => inputRef.current?.click()}
          disabled={running || jobs.length >= maxFiles}
          sx={{ textTransform: "none", fontWeight: 600, mr: 1 }}
        >
          Add files
        </Button>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => void runQueue()}
          disabled={running || progress.pendingCount === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Start batch
        </Button>
        <Button
          variant="outlined"
          startIcon={<StopIcon />}
          onClick={cancelRemaining}
          disabled={!running}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Cancel remaining
        </Button>
        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={() => {
            retryFailed();
          }}
          disabled={running || progress.errorCount === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Retry failed
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineOutlinedIcon />}
          onClick={() => {
            setSelectedId(null);
            clearJobs();
          }}
          disabled={running || jobs.length === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Clear
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => downloadBatchCsv(exportRows)}
          disabled={exportRows.length === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Export CSV
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => downloadBatchJson(exportRows)}
          disabled={exportRows.length === 0}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Export JSON
        </Button>
      </Box>

      {progress.total > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75, gap: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
              {progress.completed} / {progress.total} completed ({pct}%)
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748B" }}>
              Running {progress.runningCount} · Pending {progress.pendingCount} · Done{" "}
              {progress.doneCount} · Errors {progress.errorCount} · ETA {formatEta(progress.etaMs)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{ height: 8, borderRadius: 999, backgroundColor: "#E2E8F0" }}
          />
        </Box>
      )}

      <Box
        sx={{
          borderRadius: "14px",
          border: `1px solid ${DASHBOARD.borderLight}`,
          backgroundColor: "#FFFFFF",
          overflow: "hidden",
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 2fr) 100px 110px 90px 90px 90px minmax(120px, 1.2fr)",
            gap: 1,
            px: 2,
            py: 1.25,
            backgroundColor: "#F8FAFC",
            borderBottom: `1px solid ${DASHBOARD.borderLight}`,
            fontSize: "0.625rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: DASHBOARD.textMuted,
          }}
        >
          <Box>File</Box>
          <Box>Status</Box>
          <Box>Verdict</Box>
          <Box>Confidence</Box>
          <Box>AI Prob.</Box>
          <Box>Duration</Box>
          <Box>Error</Box>
        </Box>

        {jobs.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: "center", color: "#64748B", fontSize: "0.875rem" }}>
            No files queued yet.
          </Box>
        ) : (
          jobs.map((job) => {
            const clickable = job.status === "done" && job.result;
            return (
              <Box
                key={job.id}
                onClick={() => {
                  if (clickable) setSelectedId(job.id);
                }}
                sx={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(160px, 2fr) 100px 110px 90px 90px 90px minmax(120px, 1.2fr)",
                  gap: 1,
                  px: 2,
                  py: 1.25,
                  borderBottom: `1px solid ${DASHBOARD.borderLight}`,
                  fontSize: "0.8125rem",
                  alignItems: "center",
                  cursor: clickable ? "pointer" : "default",
                  backgroundColor: selectedId === job.id ? "rgba(0,120,212,0.06)" : "transparent",
                  "&:hover": clickable ? { backgroundColor: "rgba(0,120,212,0.04)" } : undefined,
                }}
              >
                <Typography sx={{ fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.file.name}
                </Typography>
                <Typography sx={{ color: STATUS_COLOR[job.status], fontWeight: 700, textTransform: "capitalize" }}>
                  {job.status}
                </Typography>
                <Typography sx={{ color: "#334155", textTransform: "capitalize" }}>
                  {job.result?.verdict ?? "—"}
                </Typography>
                <Typography sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {job.result != null ? `${job.result.confidence}%` : "—"}
                </Typography>
                <Typography sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {job.result?.aiProbability != null ? `${job.result.aiProbability}%` : "—"}
                </Typography>
                <Typography sx={{ fontVariantNumeric: "tabular-nums", color: "#64748B" }}>
                  {formatDuration(job.durationMs)}
                </Typography>
                <Typography sx={{ color: "#C50F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {job.error || "—"}
                </Typography>
              </Box>
            );
          })
        )}
      </Box>

      {selected?.result && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A" }}>
              Detail — {selected.file.name}
            </Typography>
            <Button
              variant="outlined"
              onClick={() =>
                void downloadVerificationReport(selected.result!, selected.file.name)
              }
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Download fraud detection report
            </Button>
          </Box>

          <ExecutiveSummaryCard result={selected.result} />
          <VerdictCard
            verdict={selected.result.verdict}
            confidence={selected.result.confidence}
            trustScore={selected.result.engineTrustScore}
            riskLevel={selected.result.report.riskLevel}
            riskScore={selected.result.report.riskScore}
          />
          <AnnotatedDocumentSection
            file={selected.file}
            regions={selected.result.tamperRegions}
            heatmapUrl={selected.result.heatmapUrl}
          />
          <ExecutiveReport report={selected.result.report} />
          <SignalsList signals={selected.result.signals} />
          <TechnicalDetails result={selected.result} />
          <VendorAnalysis vendorFindings={selected.result.vendorFindings} />
          <ActionsPanel
            result={selected.result}
            fileName={selected.file.name}
            onVerifyAnother={() => setSelectedId(null)}
          />
        </Box>
      )}
    </Box>
  );
}
