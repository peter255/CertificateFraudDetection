/**
 * Shared visual shell for UAE Design System–aligned dashboard sections.
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
  get accent() {
    return VS.accent;
  },
  get accentGlow() {
    return VS.accentDim;
  },
  get navy() {
    return VS.bgElevated;
  },
  get navyMid() {
    return VS.bgCard;
  },
  get slate() {
    return VS.textSecondary;
  },
  get cardBg() {
    return VS.bgCard;
  },
  get panelBg() {
    return VS.bgPanel;
  },
  get border() {
    return VS.border;
  },
  get borderLight() {
    return VS.border;
  },
  get textPrimary() {
    return VS.text;
  },
  get textSecondary() {
    return VS.textSecondary;
  },
  get textMuted() {
    return VS.textMuted;
  },
  get success() {
    return VS.success;
  },
  get warning() {
    return VS.warning;
  },
  get danger() {
    return VS.danger;
  },
  get cardShadow() {
    return "none";
  },
  get cardShadowHover() {
    return `0 2px 12px ${VS.accentGlow}`;
  },
  get headerGradient() {
    return `linear-gradient(180deg, ${VS.bgElevated} 0%, ${VS.bgCard} 100%)`;
  },
  get accentStripe() {
    return VS.accent;
  },
  get mono() {
    return VS.mono;
  },
};

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
        borderRadius: "8px",
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
          backgroundColor: isPrimary ? VS.accentDim : VS.bgPanel,
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
            backgroundColor: isPrimary ? `${accentColor}22` : "rgba(35,37,40,0.04)",
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
            fontFamily: VS.heading,
            fontSize: "0.8125rem",
            fontWeight: 600,
            letterSpacing: "0.01em",
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
  color = "rgba(35,37,40,0.06)",
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
          fontSize: "0.75rem",
          fontWeight: 600,
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
        borderRadius: "8px",
        border: `1px solid ${DASHBOARD.border}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          height: 3,
          background: `linear-gradient(90deg, ${VS.accent} 0%, ${VS.brandGold} 100%)`,
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
              fontSize: "0.75rem",
              fontWeight: 600,
              color: VS.accent,
              mb: 0.75,
            }}
          >
            Forensic Analysis Report
          </Typography>
          <Typography
            sx={{
              fontFamily: VS.heading,
              fontSize: { xs: "1.25rem", sm: "1.5rem" },
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: VS.text,
              lineHeight: 1.25,
              mb: 0.5,
            }}
          >
            {REPORT_TITLE}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.8125rem",
              color: VS.textSecondary,
              lineHeight: 1.45,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: { xs: "100%", sm: 560 },
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
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: VS.textMuted,
                mb: 0.4,
              }}
            >
              {row.label}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: VS.text,
                lineHeight: 1.35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
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
