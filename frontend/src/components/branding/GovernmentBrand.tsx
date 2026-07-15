/**
 * GovernmentBrand — MOHESR logo slot.
 *
 * Official logo: public/brand/mohesr-logo.svg (or .png).
 * Landscape wordmark is sized by height; width follows aspect ratio.
 */

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { BRAND_LOGO_PATHS, ORGANIZATION_NAME } from "../../branding/constants";

type BrandSize = "sm" | "md" | "lg";

/** Height for the landscape MOHESR wordmark. */
const HEIGHT_PX: Record<BrandSize, number> = {
  sm: 28,
  md: 40,
  lg: 48,
};

/** Approx width from logo viewBox 869.9 × 226.8 (~3.84:1). */
const WIDTH_PX: Record<BrandSize, number> = {
  sm: 108,
  md: 154,
  lg: 184,
};

interface GovernmentBrandProps {
  size?: BrandSize;
  /** Show organization label beside the mark (header layout). */
  showLabel?: boolean;
  variant?: "light" | "dark";
}

export default function GovernmentBrand({
  size = "md",
  showLabel = false,
  variant = "light",
}: GovernmentBrandProps) {
  const [pathIndex, setPathIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const height = HEIGHT_PX[size];
  const width = WIDTH_PX[size];
  const isDark = variant === "dark";
  const logoSrc = !failed ? BRAND_LOGO_PATHS[pathIndex] : null;

  const handleError = () => {
    if (pathIndex < BRAND_LOGO_PATHS.length - 1) {
      setPathIndex((i) => i + 1);
      return;
    }
    setFailed(true);
  };

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.5,
        flexShrink: 0,
      }}
      aria-label={ORGANIZATION_NAME}
    >
      <Box
        sx={{
          width,
          height,
          maxWidth: { xs: 120, sm: width },
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logoSrc ? (
          <Box
            component="img"
            src={logoSrc}
            alt={ORGANIZATION_NAME}
            onError={handleError}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "left center",
              display: "block",
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              border: isDark
                ? "1px solid rgba(255,255,255,0.18)"
                : "1px solid #E2E8F0",
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#FFFFFF",
            }}
          >
            <Typography
              component="span"
              sx={{
                fontSize: size === "sm" ? "0.5rem" : size === "md" ? "0.5625rem" : "0.625rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: isDark ? "rgba(255,255,255,0.85)" : "#232528",
                lineHeight: 1.15,
                textAlign: "center",
                px: 0.5,
              }}
            >
              {ORGANIZATION_NAME}
            </Typography>
          </Box>
        )}
      </Box>

      {showLabel && (
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isDark ? "rgba(255,255,255,0.55)" : "#5A5E63",
            lineHeight: 1.2,
            display: { xs: "none", sm: "block" },
          }}
        >
          {ORGANIZATION_NAME}
        </Typography>
      )}
    </Box>
  );
}
