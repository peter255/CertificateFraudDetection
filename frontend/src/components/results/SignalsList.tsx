/**
 * SignalsList — Section 3: Forgery Indicators
 * Donut chart + bar chart distribution with forensic evidence rows.
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
  ];

  return (
    <Box
      sx={{
        px: 3,
        py: 3,
        borderBottom: `1px solid ${DASHBOARD.borderLight}`,
        backgroundColor: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
      }}
    >
      <DonutChart
        segments={segments}
        size={130}
        centerValue={String(total)}
        centerLabel="Checks"
      />

      <Box sx={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <BarChartRow
          label="Failed"
          value={counts.fail}
          max={total}
          color={STATUS_STYLE.fail.color}
          count={counts.fail}
        />
        <BarChartRow
          label="Warning"
          value={counts.warning}
          max={total}
          color={STATUS_STYLE.warning.color}
          count={counts.warning}
        />
        <BarChartRow
          label="Passed"
          value={counts.pass}
          max={total}
          color={STATUS_STYLE.pass.color}
          count={counts.pass}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {(["fail", "warning", "pass"] as SignalStatus[]).map((status) => {
          const style = STATUS_STYLE[status];
          const { Icon } = style;
          return (
            <Box
              key={status}
              sx={{
                px: 1.75,
                py: 1.25,
                borderRadius: "10px",
                backgroundColor: style.bgColor,
                border: `1px solid ${style.color}33`,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Icon sx={{ fontSize: 16, color: style.color }} />
              <Box>
                <Typography
                  sx={{
                    fontSize: "1.125rem",
                    fontWeight: 800,
                    color: style.color,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {counts[status]}
                </Typography>
                <Typography sx={{ fontSize: "0.625rem", fontWeight: 600, color: DASHBOARD.textMuted }}>
                  {style.label}
                </Typography>
              </Box>
            </Box>
          );
        })}
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
        mx: 3,
        mb: 1.5,
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
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: DASHBOARD.accent,
            mb: 0.5,
          }}
        >
          {signal.category}
        </Typography>
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

interface SignalsListProps {
  signals: Signal[];
}

export default function SignalsList({ signals }: SignalsListProps) {
  const sorted = [...signals].sort(
    (a, b) => STATUS_STYLE[a.status].sortOrder - STATUS_STYLE[b.status].sortOrder
  );

  return (
    <SectionShell
      title="Forgery Indicators"
      icon={<BugReportIcon sx={{ fontSize: 18 }} />}
      accentColor={DASHBOARD.danger}
      emphasis="primary"
      badge={<SectionBadge>{signals.length} checks</SectionBadge>}
      noPadding
    >
      {signals.length > 0 && <DistributionPanel signals={signals} />}

      <Box sx={{ py: 2 }}>
        {sorted.length === 0 ? (
          <Box sx={{ px: 3, py: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.875rem", color: DASHBOARD.textMuted }}>
              No indicator data available
            </Typography>
          </Box>
        ) : (
          sorted.map((signal, i) => (
            <SignalRow key={signal.id} signal={signal} index={i} />
          ))
        )}
      </Box>
    </SectionShell>
  );
}
