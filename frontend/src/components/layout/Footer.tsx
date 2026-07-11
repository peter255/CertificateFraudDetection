import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        py: 3.5,
        borderTop: "1px solid #E2E8F0",
        backgroundColor: "#FFFFFF",
        textAlign: "center",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#0F172A",
          mb: 0.5,
        }}
      >
        CertVerify
      </Typography>
      <Typography
        sx={{
          fontSize: "0.8125rem",
          color: "#64748B",
          lineHeight: 1.6,
        }}
      >
        Enterprise document authentication · AI-powered authenticity analysis
      </Typography>
    </Box>
  );
}
