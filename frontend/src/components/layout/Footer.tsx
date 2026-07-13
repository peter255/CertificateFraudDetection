import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  ORGANIZATION_NAME,
  PRODUCT_NAME,
  PRODUCT_PILLARS,
} from "../../branding/constants";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        position: "relative",
        zIndex: 1,
        py: 3.5,
        borderTop: "1px solid #E2E8F0",
        backgroundColor: "#FFFFFF",
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 2,
          mx: "auto",
          mb: 2,
          background: "linear-gradient(90deg, transparent, #0F2942, transparent)",
          opacity: 0.35,
        }}
      />
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
        {PRODUCT_NAME}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.8125rem",
          color: "#64748B",
          lineHeight: 1.6,
        }}
      >
        {ORGANIZATION_NAME} · {PRODUCT_PILLARS}
      </Typography>
    </Box>
  );
}
