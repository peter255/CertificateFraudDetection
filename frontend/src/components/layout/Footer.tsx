import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { PRODUCT_NAME, PRODUCT_PILLARS } from "../../branding/constants";
import { VS } from "../../theme";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        position: "relative",
        zIndex: 1,
        py: 2.5,
        borderTop: `1px solid ${VS.border}`,
        backgroundColor: "transparent",
        textAlign: "center",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: VS.textMuted,
          fontFamily: VS.mono,
          mb: 0.5,
        }}
      >
        {PRODUCT_NAME}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.6875rem",
          color: VS.textMuted,
          letterSpacing: "0.04em",
          fontFamily: VS.mono,
        }}
      >
        {PRODUCT_PILLARS}
      </Typography>
    </Box>
  );
}
