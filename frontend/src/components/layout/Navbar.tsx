import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import GovernmentBrand from "../branding/GovernmentBrand";
import SecureConnectionBadge from "../branding/SecureConnectionBadge";
import {
  PRODUCT_NAME,
  PRODUCT_PILLARS,
  PRODUCT_TAGLINE,
} from "../../branding/constants";

interface NavbarProps {
  activeView?: "single" | "batch";
  onNavigate?: (view: "single" | "batch") => void;
}

export default function Navbar({ activeView = "single", onNavigate }: NavbarProps) {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
        boxShadow: "0 1px 0 rgba(15,23,42,0.03)",
      }}
    >
      {/* Accent rail — calm authority */}
      <Box
        sx={{
          height: 3,
          background: "linear-gradient(90deg, #0F2942 0%, #163A5F 55%, #0078D4 100%)",
        }}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: { xs: 2.5, md: 5 },
          py: { xs: 1.5, sm: 1.75 },
          minHeight: { xs: 72, sm: 88 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1.5, sm: 2.25 },
            minWidth: 0,
          }}
        >
          <GovernmentBrand size="lg" />

          <Box
            sx={{
              width: "1px",
              alignSelf: "stretch",
              backgroundColor: "#E2E8F0",
              display: { xs: "none", sm: "block" },
              my: 0.5,
            }}
          />

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
              <VerifiedUserOutlinedIcon
                sx={{
                  fontSize: 15,
                  color: "#0F2942",
                  display: { xs: "none", sm: "block" },
                }}
              />
              <Typography
                sx={{
                  fontSize: { xs: "0.9375rem", sm: "1.0625rem" },
                  fontWeight: 700,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {PRODUCT_NAME}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: { xs: "0.625rem", sm: "0.6875rem" },
                fontWeight: 500,
                letterSpacing: "0.02em",
                color: "#64748B",
                lineHeight: 1.35,
                mb: 0.35,
              }}
            >
              {PRODUCT_TAGLINE}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.5625rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#94A3B8",
                display: { xs: "none", sm: "block" },
              }}
            >
              {PRODUCT_PILLARS}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
          {onNavigate && (
            <>
              <Button
                size="small"
                onClick={() => onNavigate("single")}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: activeView === "single" ? "#0078D4" : "#64748B",
                  backgroundColor:
                    activeView === "single" ? "rgba(0,120,212,0.08)" : "transparent",
                }}
              >
                Single
              </Button>
              <Button
                size="small"
                onClick={() => onNavigate("batch")}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: activeView === "batch" ? "#0078D4" : "#64748B",
                  backgroundColor:
                    activeView === "batch" ? "rgba(0,120,212,0.08)" : "transparent",
                }}
              >
                Batch verify
              </Button>
            </>
          )}

          <SecureConnectionBadge />
        </Box>
      </Box>
    </Box>
  );
}
