import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import GovernmentBrand from "../branding/GovernmentBrand";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "../../branding/constants";
import { useThemeMode } from "../../providers/ThemeModeProvider";

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
  const { vs, isDark, toggleMode } = useThemeMode();

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: isDark
          ? "rgba(10,12,13,0.92)"
          : "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${vs.border}`,
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
          <GovernmentBrand size="md" variant={isDark ? "dark" : "light"} />

          <Box
            sx={{
              width: "1px",
              alignSelf: "stretch",
              backgroundColor: vs.border,
              display: { xs: "none", sm: "block" },
              my: 0.5,
            }}
          />

          <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
            <Typography
              sx={{
                fontFamily: vs.heading,
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: vs.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              {PRODUCT_NAME}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                color: vs.textMuted,
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
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: vs.success,
                }}
              />
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: vs.success,
                }}
              >
                System online
              </Typography>
            </Box>

            {scanId && (
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  color: vs.textMuted,
                }}
              >
                ID: {scanId}
              </Typography>
            )}

            <Typography
              sx={{
                fontSize: "0.75rem",
                color: vs.textMuted,
              }}
            >
              Path: {pathLabel}
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
                  color: activeView === "single" ? vs.accent : vs.textMuted,
                  backgroundColor:
                    activeView === "single" ? vs.accentDim : "transparent",
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
                  color: activeView === "batch" ? vs.accent : vs.textMuted,
                  backgroundColor:
                    activeView === "batch" ? vs.accentDim : "transparent",
                }}
              >
                Batch
              </Button>
            </Box>
          )}

          <Tooltip title={isDark ? "Switch to UAE light theme" : "Switch to dark theme"}>
            <IconButton
              size="small"
              onClick={toggleMode}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              sx={{
                color: vs.textSecondary,
                border: `1px solid ${vs.border}`,
                borderRadius: "8px",
                width: 36,
                height: 36,
                "&:hover": {
                  backgroundColor: vs.accentDim,
                  color: vs.accent,
                },
              }}
            >
              {isDark ? (
                <LightModeOutlinedIcon sx={{ fontSize: 18 }} />
              ) : (
                <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            size="small"
            onClick={onNewAnalysis}
            sx={{
              height: 36,
              px: 2,
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.8125rem",
            }}
          >
            New Analysis
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
