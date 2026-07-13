import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import GovernmentBrand from "../branding/GovernmentBrand";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "../../branding/constants";
import { VS } from "../../theme";

interface NavbarProps {
  activeView?: "single" | "batch";
  onNavigate?: (view: "single" | "batch") => void;
  onNewAnalysis?: () => void;
  scanId?: string | null;
  pathLabel?: string;
}

export default function Navbar({
  activeView = "single",
  onNavigate,
  onNewAnalysis,
  scanId,
  pathLabel = "/",
}: NavbarProps) {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "rgba(10,12,13,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${VS.border}`,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: { xs: 2, md: 3.5 },
          py: 1.5,
          minHeight: 64,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1.25, sm: 2 },
            minWidth: 0,
          }}
        >
          <GovernmentBrand size="md" variant="dark" />

          <Box
            sx={{
              width: "1px",
              alignSelf: "stretch",
              backgroundColor: VS.border,
              display: { xs: "none", sm: "block" },
              my: 0.5,
            }}
          />

          <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
            <Typography
              sx={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: VS.text,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {PRODUCT_NAME}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                color: VS.textMuted,
                lineHeight: 1.35,
                mt: 0.25,
              }}
            >
              {PRODUCT_TAGLINE}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1.25, sm: 2.5 },
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 2.5,
              fontFamily: VS.mono,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: VS.accent,
                  boxShadow: `0 0 8px ${VS.accentGlow}`,
                }}
              />
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  color: VS.accent,
                  fontFamily: VS.mono,
                }}
              >
                SYSTEM ONLINE
              </Typography>
            </Box>

            {scanId && (
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  color: VS.textMuted,
                  fontFamily: VS.mono,
                  letterSpacing: "0.02em",
                }}
              >
                ID: {scanId}
              </Typography>
            )}

            <Typography
              sx={{
                fontSize: "0.6875rem",
                color: VS.textMuted,
                fontFamily: VS.mono,
                letterSpacing: "0.02em",
              }}
            >
              PATH: {pathLabel}
            </Typography>
          </Box>

          {onNavigate && (
            <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 0.5 }}>
              <Button
                size="small"
                onClick={() => onNavigate("single")}
                sx={{
                  minWidth: 0,
                  px: 1.25,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: activeView === "single" ? VS.accent : VS.textMuted,
                  backgroundColor:
                    activeView === "single" ? VS.accentDim : "transparent",
                }}
              >
                Single
              </Button>
              <Button
                size="small"
                onClick={() => onNavigate("batch")}
                sx={{
                  minWidth: 0,
                  px: 1.25,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: activeView === "batch" ? VS.accent : VS.textMuted,
                  backgroundColor:
                    activeView === "batch" ? VS.accentDim : "transparent",
                }}
              >
                Batch
              </Button>
            </Box>
          )}

          <Button
            variant="contained"
            size="small"
            onClick={onNewAnalysis}
            sx={{
              height: 36,
              px: 2,
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.8125rem",
              boxShadow: `0 0 16px ${VS.accentGlow}`,
            }}
          >
            New Analysis
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
