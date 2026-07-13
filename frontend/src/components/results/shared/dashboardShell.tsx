/**
 * Shared visual shell for investigation dashboard sections.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import {
  ORGANIZATION_NAME,
  PRODUCT_NAME,
  REPORT_TITLE,
} from "../../../branding/constants";

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
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          height: 3,
          background: "linear-gradient(90deg, #0078D4 0%, rgba(255,255,255,0.35) 100%)",
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
              color: "rgba(255,255,255,0.5)",
              mb: 0.75,
            }}
          >
            Official Investigation Document
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
            }}
          >
            {fileName}
          </Typography>
        </Box>

        {/* Verification seal — decorative */}
        <Box
          aria-hidden
          sx={{
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.22)",
            display: { xs: "none", sm: "flex" },
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.12) 0%, transparent 70%)",
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1px dashed rgba(255,255,255,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.5rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              Verified
              <br />
              Seal
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          mx: { xs: 2.25, sm: 3 },
          borderTop: "1px solid rgba(255,255,255,0.1)",
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
                  row.label === "Verification ID"
                    ? "ui-monospace, SFMono-Regular, Menlo, monospace"
                    : "inherit",
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
