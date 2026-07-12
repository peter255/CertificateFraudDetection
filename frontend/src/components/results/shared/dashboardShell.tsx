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
          px: { xs: 2, sm: 2.75 },
          py: { xs: 1.5, sm: 1.75 },
          pl: isPrimary ? { xs: 2.5, sm: 3.25 } : { xs: 2, sm: 2.75 },
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
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: DASHBOARD.textPrimary,
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>
        {badge}
      </Box>

      <Box
        sx={{
          px: noPadding ? 0 : { xs: 2, sm: 2.75 },
          py: noPadding ? 0 : { xs: 2, sm: 2.5 },
        }}
      >
        {children}
      </Box>
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
        px: 1.1,
        py: 0.35,
        borderRadius: "6px",
        backgroundColor: color,
        border: `1px solid ${DASHBOARD.borderLight}`,
        flexShrink: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: DASHBOARD.textSecondary,
          lineHeight: 1.2,
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
}

export function InvestigationBanner({
  fileName,
  verdict,
  verdictColor,
  verifiedAt,
  certificateId,
}: InvestigationBannerProps) {
  const showVerified =
    Boolean(verifiedAt?.trim()) &&
    verifiedAt.trim() !== "—" &&
    verifiedAt.trim().toLowerCase() !== "unknown";

  return (
    <Box
      sx={{
        backgroundColor: DASHBOARD.navy,
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.06)",
        px: { xs: 2.25, sm: 3 },
        py: { xs: 2.25, sm: 2.75 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              mb: 0.75,
            }}
          >
            Investigation
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "1.125rem", sm: "1.35rem" },
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
              mb: 0.75,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: { xs: "100%", sm: 520 },
              lineHeight: 1.3,
            }}
          >
            {fileName}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1, sm: 2 } }}>
            {showVerified && (
              <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>
                Verified {verifiedAt}
              </Typography>
            )}
            {certificateId?.trim() && (
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  lineHeight: 1.45,
                }}
              >
                ID {certificateId.slice(0, 8).toUpperCase()}
              </Typography>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 1.75,
            py: 0.875,
            borderRadius: "8px",
            backgroundColor: "rgba(255,255,255,0.06)",
            border: `1px solid ${verdictColor}44`,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: verdictColor,
              flexShrink: 0,
            }}
          />
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: verdictColor,
            }}
          >
            {verdict}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
