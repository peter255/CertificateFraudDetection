/**
 * SVG chart primitives for the investigation dashboard.
 * Pure SVG — no external chart library.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// ─────────────────────────────────────────────────────────────────────────────
// Circular gauge
// ─────────────────────────────────────────────────────────────────────────────

interface CircularGaugeProps {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  color: string;
  size?: number;
  trackColor?: string;
}

export function CircularGauge({
  value,
  max = 100,
  label,
  sublabel,
  color,
  size = 140,
  trackColor = "rgba(148,163,184,0.2)",
}: CircularGaugeProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box sx={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
          />
        </svg>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: size > 120 ? "1.75rem" : "1.25rem",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#0F172A",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {max === 100 && !sublabel?.includes("/") ? `${Math.round(value)}%` : value}
          </Typography>
          {sublabel && (
            <Typography
              sx={{
                fontSize: "0.625rem",
                fontWeight: 600,
                color: "#64748B",
                mt: 0.5,
                letterSpacing: "0.04em",
              }}
            >
              {sublabel}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#64748B",
          mt: 1.25,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Donut chart
// ─────────────────────────────────────────────────────────────────────────────

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  segments,
  size = 120,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;

  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {total === 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
          />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((segment) => {
              const pct = segment.value / total;
              const dash = pct * circumference;
              const offset = -cumulative * circumference;
              cumulative += pct;

              return (
                <circle
                  key={segment.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                />
              );
            })
        )}
      </svg>
      {(centerLabel || centerValue) && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {centerValue && (
            <Typography
              sx={{
                fontSize: "1.375rem",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {centerValue}
            </Typography>
          )}
          {centerLabel && (
            <Typography
              sx={{
                fontSize: "0.5625rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#94A3B8",
                mt: 0.25,
              }}
            >
              {centerLabel}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizontal bar chart row
// ─────────────────────────────────────────────────────────────────────────────

export function BarChartRow({
  label,
  value,
  max,
  color,
  count,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  count: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "#475569",
          width: 56,
          flexShrink: 0,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          backgroundColor: "#E2E8F0",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 700,
          color,
          width: 24,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini radial meter (for vendor cards)
// ─────────────────────────────────────────────────────────────────────────────

export function RadialMeter({
  value,
  color,
  size = 64,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;

  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "#0F172A",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(pct)}%
        </Typography>
      </Box>
    </Box>
  );
}
