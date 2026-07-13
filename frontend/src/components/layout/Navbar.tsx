import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { PRODUCT_NAME } from "../../branding/constants";
import { VS } from "../../theme";

interface NavbarProps {
  activeView?: "single" | "batch";
  onNavigate?: (view: "single" | "batch") => void;
  onNewAnalysis?: () => void;
  scanId?: string | null;
  pathLabel?: string;
}

function ShieldLogo() {
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: "8px",
        backgroundColor: VS.accentDim,
        border: `1px solid rgba(0,255,163,0.35)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3L20 6.5V11.5C20 16.2 16.4 20.3 12 21.5C7.6 20.3 4 16.2 4 11.5V6.5L12 3Z"
          stroke={VS.accent}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9 12L11 14L15.5 9.5"
          stroke={VS.accent}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
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
          minHeight: 56,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <ShieldLogo />
          <Typography
            sx={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: VS.text,
              lineHeight: 1,
            }}
          >
            {PRODUCT_NAME}
          </Typography>
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
