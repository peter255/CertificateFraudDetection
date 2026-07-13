/**
 * Shared visual shell for VERISCAN investigation dashboard sections.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { VS } from "../../../theme";
import {
  ORGANIZATION_NAME,
  PRODUCT_NAME,
  REPORT_TITLE,
} from "../../../branding/constants";

export const DASHBOARD = {
  accent: VS.accent,
  accentGlow: VS.accentDim,
  navy: VS.bgElevated,
  navyMid: VS.bgCard,
  slate: VS.textSecondary,
  cardBg: VS.bgCard,
  panelBg: VS.bgPanel,
  border: VS.border,
  borderLight: VS.border,
  textPrimary: VS.text,
  textSecondary: VS.textSecondary,
  textMuted: VS.textMuted,
  success: VS.success,
  warning: VS.warning,
  danger: VS.danger,
  cardShadow: "none",
  cardShadowHover: `0 0 24px ${VS.accentGlow}`,
  headerGradient: `linear-gradient(180deg, ${VS.bgElevated} 0%, ${VS.bgCard} 100%)`,
  accentStripe: VS.accent,
  mono: VS.mono,
} as const;

interface SectionShellProps {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  accentColor?: string;
  children: ReactNode;
  noPadding?: boolean;
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
        boxShadow: "none",
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
          backgroundColor: isPrimary ? "rgba(255,255,255,0.02)" : DASHBOARD.cardBg,
          borderBottom: `1px solid ${DASHBOARD.border}`,
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
            backgroundColor: isPrimary ? `${accentColor}22` : "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isPrimary ? accentColor : DASHBOARD.textSecondary,
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
  color = "rgba(255,255,255,0.06)",
  textColor,
}: {
  children: ReactNode;
  color?: string;
  textColor?: string;
}) {
  return (
    <Box
      sx={{
        px: 1.1,
        py: 0.35,
        borderRadius: "6px",
        backgroundColor: color,
        border: `1px solid ${DASHBOARD.border}`,
        flexShrink: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: textColor ?? DASHBOARD.textSecondary,
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
  verifiedAt: string;
  certificateId?: string;
}

/** Official investigation report header — verdict lives in Verification Overview. */
export function InvestigationBanner({
  fileName,
  verifiedAt,
  certificateId,
}: InvestigationBannerProps) {
  const showVerified =
    Boolean(verifiedAt?.trim()) &&
    verifiedAt.trim() !== "—" &&
    verifiedAt.trim().toLowerCase() !== "unknown";

  const verificationId = certificateId?.trim()
    ? certificateId.trim().slice(0, 12).toUpperCase()
    : null;

  const metaRows: Array<{ label: string; value: string }> = [
    { label: "Document", value: fileName },
    ...(verificationId
      ? [{ label: "Verification ID", value: verificationId }]
      : []),
    ...(showVerified
      ? [{ label: "Verification Date", value: verifiedAt }]
      : []),
    { label: "Prepared by", value: PRODUCT_NAME },
    { label: "Organization", value: ORGANIZATION_NAME },
  ];

  return (
    <Box
      sx={{
        backgroundColor: DASHBOARD.navy,
        borderRadius: "12px",
        border: `1px solid ${DASHBOARD.border}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          height: 3,
          background: `linear-gradient(90deg, ${VS.accent} 0%, rgba(255,255,255,0.2) 100%)`,
        }}
      />

      <Box
        sx={{
          px: { xs: 2.25, sm: 3 },
          pt: { xs: 2.25, sm: 2.75 },
          pb: { xs: 2, sm: 2.25 },
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: VS.accent,
              fontFamily: VS.mono,
              mb: 0.75,
            }}
          >
            Forensic Analysis Report
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "1.25rem", sm: "1.5rem" },
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
              lineHeight: 1.25,
              mb: 0.5,
            }}
          >
            {REPORT_TITLE}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.45,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: { xs: "100%", sm: 560 },
              fontFamily: VS.mono,
            }}
          >
            {fileName}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          mx: { xs: 2.25, sm: 3 },
          borderTop: `1px solid ${DASHBOARD.border}`,
        }}
      />

      <Box
        sx={{
          px: { xs: 2.25, sm: 3 },
          py: { xs: 1.75, sm: 2 },
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            sm: "repeat(3, 1fr)",
            md: "repeat(5, 1fr)",
          },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        {metaRows.map((row) => (
          <Box key={row.label} sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: "0.5625rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.42)",
                mb: 0.4,
              }}
            >
              {row.label}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.88)",
                lineHeight: 1.35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily:
                  row.label === "Verification ID" ? VS.mono : "inherit",
              }}
              title={row.value}
            >
              {row.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
