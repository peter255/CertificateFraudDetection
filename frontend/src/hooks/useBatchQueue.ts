/**
 * Client-side batch verification queue with limited concurrency.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { verifyDocument } from "../api/verificationApi";
import type { VerificationResult } from "../types/verification";

export type BatchJobStatus = "pending" | "running" | "done" | "error" | "cancelled";

export interface BatchJob {
  id: string;
  file: File;
  status: BatchJobStatus;
  result: VerificationResult | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  attempts: number;
}

const DEFAULT_CONCURRENCY = 3;
const MAX_FILES = 1000;
const MAX_ATTEMPTS = 3;

function isRetryableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate") ||
    m.includes("503") ||
    m.includes("timeout") ||
    m.includes("temporarily") ||
    m.includes("unavailable")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBatchQueue(concurrency = DEFAULT_CONCURRENCY) {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);
  const jobsRef = useRef<BatchJob[]>([]);
  const durationsRef = useRef<number[]>([]);
  const claimedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const updateJob = useCallback((id: string, patch: Partial<BatchJob>) => {
    setJobs((prev) => {
      const next = prev.map((job) => (job.id === id ? { ...job, ...patch } : job));
      jobsRef.current = next;
      return next;
    });
  }, []);

  const claimNextPending = useCallback((): BatchJob | null => {
    const next = jobsRef.current.find(
      (job) => job.status === "pending" && !claimedRef.current.has(job.id)
    );
    if (!next) return null;
    claimedRef.current.add(next.id);
    const claimed: BatchJob = {
      ...next,
      status: "running",
      startedAt: Date.now(),
      error: null,
    };
    const nextList = jobsRef.current.map((job) => (job.id === next.id ? claimed : job));
    jobsRef.current = nextList;
    setJobs(nextList);
    return claimed;
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const accepted = Array.from(files).filter((file) => {
      const type = (file.type || "").toLowerCase();
      const name = file.name.toLowerCase();
      return (
        type === "application/pdf" ||
        type === "image/jpeg" ||
        type === "image/png" ||
        name.endsWith(".pdf") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png")
      );
    });

    setJobs((prev) => {
      const room = Math.max(0, MAX_FILES - prev.length);
      const slice = accepted.slice(0, room);
      const next: BatchJob[] = [
        ...prev,
        ...slice.map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          status: "pending" as const,
          result: null,
          error: null,
          startedAt: null,
          finishedAt: null,
          durationMs: null,
          attempts: 0,
        })),
      ];
      jobsRef.current = next;
      return next;
    });
  }, []);

  const clearJobs = useCallback(() => {
    cancelRef.current = true;
    claimedRef.current.clear();
    setRunning(false);
    setJobs([]);
    jobsRef.current = [];
    durationsRef.current = [];
  }, []);

  const cancelRemaining = useCallback(() => {
    cancelRef.current = true;
    setJobs((prev) => {
      const next = prev.map((job) =>
        job.status === "pending" && !claimedRef.current.has(job.id)
          ? { ...job, status: "cancelled" as const }
          : job
      );
      jobsRef.current = next;
      return next;
    });
    setRunning(false);
  }, []);

  const runQueue = useCallback(async () => {
    if (running) return;
    cancelRef.current = false;
    claimedRef.current.clear();
    setRunning(true);

    const worker = async () => {
      while (!cancelRef.current) {
        const nextJob = claimNextPending();
        if (!nextJob) break;

        let attempts = nextJob.attempts;
        let lastError: string | null = null;
        let result: VerificationResult | null = null;
        const started = Date.now();

        while (attempts < MAX_ATTEMPTS && !cancelRef.current) {
          attempts += 1;
          try {
            result = await verifyDocument(nextJob.file);
            lastError = null;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (!isRetryableError(lastError) || attempts >= MAX_ATTEMPTS) break;
            await sleep(Math.min(8000, 1000 * 2 ** (attempts - 1)));
          }
        }

        const finishedAt = Date.now();
        const durationMs = finishedAt - started;
        claimedRef.current.delete(nextJob.id);

        if (result) {
          durationsRef.current = [...durationsRef.current.slice(-49), durationMs];
          updateJob(nextJob.id, {
            status: "done",
            result,
            error: null,
            finishedAt,
            durationMs,
            attempts,
          });
        } else {
          updateJob(nextJob.id, {
            status: cancelRef.current ? "cancelled" : "error",
            result: null,
            error: lastError || "Verification failed",
            finishedAt,
            durationMs,
            attempts,
          });
        }
      }
    };

    const pool = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(pool);
    setRunning(false);
  }, [claimNextPending, concurrency, running, updateJob]);

  const retryFailed = useCallback(() => {
    claimedRef.current.clear();
    setJobs((prev) => {
      const next = prev.map((job) =>
        job.status === "error"
          ? {
              ...job,
              status: "pending" as const,
              error: null,
              result: null,
              startedAt: null,
              finishedAt: null,
              durationMs: null,
              attempts: 0,
            }
          : job
      );
      jobsRef.current = next;
      return next;
    });
  }, []);

  const completed = jobs.filter(
    (j) => j.status === "done" || j.status === "error" || j.status === "cancelled"
  ).length;
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;
  const runningCount = jobs.filter((j) => j.status === "running").length;
  const pendingCount = jobs.filter((j) => j.status === "pending").length;
  const avgDuration =
    durationsRef.current.length > 0
      ? durationsRef.current.reduce((a, b) => a + b, 0) / durationsRef.current.length
      : null;
  const etaMs =
    avgDuration != null && pendingCount + runningCount > 0
      ? Math.round((avgDuration * (pendingCount + runningCount)) / Math.max(1, concurrency))
      : null;

  return {
    jobs,
    running,
    addFiles,
    clearJobs,
    cancelRemaining,
    runQueue,
    retryFailed,
    maxFiles: MAX_FILES,
    progress: {
      total: jobs.length,
      completed,
      doneCount,
      errorCount,
      runningCount,
      pendingCount,
      etaMs,
    },
  };
}
