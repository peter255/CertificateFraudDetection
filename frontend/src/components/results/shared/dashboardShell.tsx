/**
 * Shared visual shell for investigation dashboard sections.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export const DASHBOARD = {
  accent: "#0078D4",
  accentGlow: "rgba(0,120,212,0.12)",
  navy: "#0F2942",
  navyMid: "#163A5F",
  slate: "#334155",
  cardBg: "#FFFFFF",
  panelBg: "#F4F7FB",
  border: "#E2E8F0",
  borderLight: "#EEF2F7",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  success: "#107C10",
  warning: "#D97706",
  danger: "#C50F1F",
  cardShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
  cardShadowHover: "0 2px 4px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06)",
  headerGradient: "linear-gradient(180deg, #0F2942 0%, #163A5F 100%)",
  accentStripe: "#0078D4",
} as const;

interface SectionShellProps {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  accentColor?: string;
  children: ReactNode;
  noPadding?: boolean;
  /** Primary sections keep a soft left accent; secondary stay quieter. */
  emphasis?: "primary" | "secondary";
}

export function SectionShell({
  title,
  icon,
  badge,
  accentColor = DASHBOARD.accent,
  children,
  noPadding = false,
  emphasis = "secondary",
}: SectionShellProps) {
  const isPrimary = emphasis === "primary";

  return (
    <Box
      sx={{
        backgroundColor: DASHBOARD.cardBg,
        border: `1px solid ${DASHBOARD.border}`,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: isPrimary ? DASHBOARD.cardShadow : "none",
        position: "relative",
        transition: "box-shadow 180ms ease",
      }}
    >
      {isPrimary && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: accentColor,
            zIndex: 1,
          }}
        />
      )}

      <Box
        sx={{
          backgroundColor: isPrimary ? "#F8FAFC" : "#FFFFFF",
          borderBottom: `1px solid ${DASHBOARD.borderLight}`,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 3,
          py: 2,
          pl: isPrimary ? 3.5 : 3,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "7px",
            backgroundColor: isPrimary ? "rgba(0,120,212,0.08)" : "#F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isPrimary ? DASHBOARD.accent : DASHBOARD.textSecondary,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: DASHBOARD.textPrimary,
            flex: 1,
          }}
        >
          {title}
        </Typography>
        {badge}
      </Box>

      <Box sx={{ px: noPadding ? 0 : 3.5, py: noPadding ? 0 : 3.5 }}>{children}</Box>
    </Box>
  );
}

export function SectionBadge({
  children,
  color = "#F1F5F9",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.375,
        borderRadius: "6px",
        backgroundColor: color,
        border: `1px solid ${DASHBOARD.border}`,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: DASHBOARD.textSecondary,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

interface InvestigationBannerProps {
  fileName: string;
  verdict: string;
  verdictColor: string;
  verifiedAt: string;
  certificateId?: string;
  confidence?: number;
  riskScore?: number;
  signalCount?: number;
  vendorCount?: number;
}

export function InvestigationBanner({
  fileName,
  verdict,
  verdictColor,
  verifiedAt,
  certificateId,
  confidence,
  riskScore,
  signalCount,
  vendorCount,
}: InvestigationBannerProps) {
  const metrics = [
    { label: "Confidence", value: confidence != null ? `${confidence}%` : "—" },
    { label: "Risk Score", value: riskScore != null ? `${riskScore}/100` : "—" },
    { label: "Signals", value: signalCount != null ? String(signalCount) : "—" },
    { label: "Vendors", value: vendorCount != null ? String(vendorCount) : "—" },
  ];

  return (
    <Box
      sx={{
        backgroundColor: DASHBOARD.navy,
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 8px 28px rgba(15,41,66,0.18)",
        px: { xs: 2.5, sm: 3.5 },
        py: { xs: 2.75, sm: 3.25 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              mb: 1,
            }}
          >
            Investigation Summary
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "1.25rem", sm: "1.5rem" },
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "#FFFFFF",
              mb: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 560,
              lineHeight: 1.25,
            }}
          >
            {fileName}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
              Verified {verifiedAt}
            </Typography>
            {certificateId && (
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  lineHeight: 1.5,
                }}
              >
                Case ID {certificateId.slice(0, 8).toUpperCase()}
              </Typography>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: "8px",
            backgroundColor: "rgba(255,255,255,0.06)",
            border: `1px solid ${verdictColor}55`,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: verdictColor,
            }}
          />
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: verdictColor,
            }}
          >
            {verdict}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(4, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >
        {metrics.map((metric) => (
          <Box
            key={metric.label}
            sx={{
              px: 2,
              py: 1.75,
              borderRadius: "10px",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.5625rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)",
                mb: 0.75,
              }}
            >
              {metric.label}
            </Typography>
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "#FFFFFF",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.2,
              }}
            >
              {metric.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
