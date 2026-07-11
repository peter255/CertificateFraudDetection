import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function BrandMark() {
  return (
    <svg
      viewBox="0 0 28 28"
      width="28"
      height="28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="28" height="28" rx="7" fill="#0078D4" />
      <path
        d="M8 14.5L12 18.5L20 10"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Navbar() {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 64,
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 3, md: 6 },
        boxShadow: "0 1px 0 rgba(15,23,42,0.03)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <BrandMark />
        <Box>
          <Typography
            sx={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "#0F172A",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            CertVerify
          </Typography>
          <Typography
            sx={{
              fontSize: "0.5625rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#64748B",
            }}
          >
            Investigation Platform
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: { xs: "none", sm: "inline-flex" },
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.625,
          borderRadius: "6px",
          border: "1px solid #DCFCE7",
          backgroundColor: "#F0FDF4",
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#107C10",
          }}
        />
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "#166534",
          }}
        >
          Systems Online
        </Typography>
      </Box>
    </Box>
  );
}
