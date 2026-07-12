/**
 * SignalsList — Forensic Indicators
 * Groups real engine-returned indicators by category. No placeholders.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CancelIcon from "@mui/icons-material/Cancel";
import type { Signal, SignalStatus } from "../../types/verification";
import { BarChartRow, DonutChart } from "./shared/dashboardCharts";
import { DASHBOARD, SectionBadge, SectionShell } from "./shared/dashboardShell";

interface StatusStyle {
  label: string;
  color: string;
  bgColor: string;
  Icon: typeof CheckCircleIcon;
  sortOrder: number;
}

const STATUS_STYLE: Record<SignalStatus, StatusStyle> = {
  fail: {
    label: "Failed",
    color: "#C50F1F",
    bgColor: "#FEF2F2",
    Icon: CancelIcon,
    sortOrder: 0,
  },
  warning: {
    label: "Warning",
    color: "#D97706",
    bgColor: "#FFFBEB",
    Icon: WarningAmberIcon,
    sortOrder: 1,
  },
  pass: {
    label: "Passed",
    color: "#107C10",
    bgColor: "#ECFDF5",
    Icon: CheckCircleIcon,
    sortOrder: 2,
  },
};

const PLACEHOLDER_TEXT = new Set([
  "",
  "-",
  "—",
  "pending",
  "not provided",
  "not available",
  "n/a",
  "na",
  "none",
  "unknown",
]);

/** Normalize engine category labels for display without inventing new groups. */
function displayCategory(raw: string): string {
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    "ml model": "AI Generation",
    "ai indicator": "AI Generation",
    "ai review": "AI Review",
    "ocr analysis": "OCR Consistency",
    "ocr consistency": "OCR Consistency",
    metadata: "Metadata Integrity",
    "metadata integrity": "Metadata Integrity",
    "visual pattern": "Visual Manipulation",
    "visual / overlay": "Visual Manipulation",
    "visual manipulation": "Visual Manipulation",
    forensic: "Forensic Analysis",
    perceptual: "Perceptual Analysis",
    semantic: "Semantic Analysis",
    "field evidence": "Field Evidence",
    "detection pipeline": "Detection Pipeline",
    "document validity": "Document Validity",
    "engine signal": "Forensic Indicator",
  };
  if (map[key]) return map[key];
  return raw.trim() || "Forensic Indicator";
}

function isRealSignal(signal: Signal): boolean {
  const category = (signal.category || "").trim();
  const description = (signal.description || "").trim();
  if (!category && !description) return false;
  if (PLACEHOLDER_TEXT.has(category.toLowerCase())) return false;
  if (PLACEHOLDER_TEXT.has(description.toLowerCase())) return false;
  if (category.toLowerCase() === "pending") return false;
  return true;
}

interface SignalGroup {
  category: string;
  signals: Signal[];
  worstStatus: SignalStatus;
}

function groupSignals(signals: Signal[]): SignalGroup[] {
  const groups = new Map<string, Signal[]>();

  for (const signal of signals) {
    const category = displayCategory(signal.category);
    const list = groups.get(category) ?? [];
    list.push(signal);
    groups.set(category, list);
  }

  const ranked = (status: SignalStatus) => STATUS_STYLE[status].sortOrder;

  return [...groups.entries()]
    .map(([category, items]) => {
      const sortedItems = [...items].sort(
        (a, b) => ranked(a.status) - ranked(b.status)
      );
      const worstStatus = sortedItems.reduce<SignalStatus>(
        (worst, item) => (ranked(item.status) < ranked(worst) ? item.status : worst),
        "pass"
      );
      return { category, signals: sortedItems, worstStatus };
    })
    .sort((a, b) => {
      const byStatus = ranked(a.worstStatus) - ranked(b.worstStatus);
      if (byStatus !== 0) return byStatus;
      return a.category.localeCompare(b.category);
    });
}

function DistributionPanel({ signals }: { signals: Signal[] }) {
  const total = signals.length;
  const counts = {
    pass: signals.filter((s) => s.status === "pass").length,
    warning: signals.filter((s) => s.status === "warning").length,
    fail: signals.filter((s) => s.status === "fail").length,
  };

  const segments = [
    { label: "Failed", value: counts.fail, color: STATUS_STYLE.fail.color },
    { label: "Warning", value: counts.warning, color: STATUS_STYLE.warning.color },
    { label: "Passed", value: counts.pass, color: STATUS_STYLE.pass.color },
  ].filter((segment) => segment.value > 0);

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 2.75 },
        py: { xs: 2, sm: 2.5 },
        borderBottom: `1px solid ${DASHBOARD.borderLight}`,
        backgroundColor: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        gap: { xs: 2.5, sm: 3.5 },
        flexWrap: "wrap",
      }}
    >
      <DonutChart
        segments={segments}
        size={112}
        centerValue={String(total)}
        centerLabel="Checks"
      />

      <Box sx={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 1.25 }}>
        {(["fail", "warning", "pass"] as SignalStatus[])
          .filter((status) => counts[status] > 0)
          .map((status) => (
            <BarChartRow
              key={status}
              label={STATUS_STYLE[status].label}
              value={counts[status]}
              max={total}
              color={STATUS_STYLE[status].color}
              count={counts[status]}
            />
          ))}
      </Box>
    </Box>
  );
}

function SignalRow({ signal, index }: { signal: Signal; index: number }) {
  const s = STATUS_STYLE[signal.status];
  const { Icon } = s;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        mb: 1.25,
        borderRadius: "12px",
        overflow: "hidden",
        border: `1px solid ${DASHBOARD.borderLight}`,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
        "&:hover": { boxShadow: DASHBOARD.cardShadow },
      }}
    >
      <Box
        sx={{
          width: 4,
          backgroundColor: s.color,
          flexShrink: 0,
        }}
      />
      <Box
        sx={{
          width: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: s.bgColor,
          flexShrink: 0,
          borderRight: `1px solid ${DASHBOARD.borderLight}`,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 800,
            color: DASHBOARD.textMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, px: 2.5, py: 2 }}>
        <Typography
          sx={{ fontSize: "0.875rem", color: DASHBOARD.textSecondary, lineHeight: 1.55 }}
        >
          {signal.description}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.5,
            py: 0.75,
            borderRadius: "8px",
            backgroundColor: s.bgColor,
            border: `1px solid ${s.color}33`,
          }}
        >
          <Icon sx={{ fontSize: 14, color: s.color }} />
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: s.color,
            }}
          >
            {s.label}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function CategoryGroup({ group, startIndex }: { group: SignalGroup; startIndex: number }) {
  const style = STATUS_STYLE[group.worstStatus];

  return (
    <Box sx={{ px: { xs: 2, sm: 2.75 }, mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: DASHBOARD.textPrimary,
          }}
        >
          {group.category}
        </Typography>
        <Box
          sx={{
            px: 1,
            py: 0.3,
            borderRadius: "999px",
            backgroundColor: style.bgColor,
            color: style.color,
            fontSize: "0.625rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {group.signals.length}
        </Box>
      </Box>
      {group.signals.map((signal, i) => (
        <SignalRow key={signal.id || `${group.category}-${i}`} signal={signal} index={startIndex + i} />
      ))}
    </Box>
  );
}

interface SignalsListProps {
  signals: Signal[];
}

export default function SignalsList({ signals }: SignalsListProps) {
  const realSignals = signals.filter(isRealSignal);
  const groups = groupSignals(realSignals);

  if (groups.length === 0) {
    return null;
  }

  let runningIndex = 0;

  return (
    <SectionShell
      title="Forensic Indicators"
      icon={<BugReportIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.danger}
      emphasis="primary"
      badge={<SectionBadge>{realSignals.length} checks</SectionBadge>}
      noPadding
    >
      <DistributionPanel signals={realSignals} />

      <Box sx={{ py: 2.5 }}>
        {groups.map((group) => {
          const startIndex = runningIndex;
          runningIndex += group.signals.length;
          return (
            <CategoryGroup
              key={group.category}
              group={group}
              startIndex={startIndex}
            />
          );
        })}
      </Box>
    </SectionShell>
  );
}
