import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  ORGANIZATION_NAME,
  PRODUCT_NAME,
  PRODUCT_PILLARS,
} from "../../branding/constants";
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
        backgroundColor: VS.bgElevated,
        textAlign: "center",
      }}
    >
      <Typography
        sx={{
          fontFamily: VS.heading,
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: VS.textSecondary,
          mb: 0.5,
        }}
      >
        {PRODUCT_NAME}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.75rem",
          color: VS.textMuted,
        }}
      >
        {ORGANIZATION_NAME} · {PRODUCT_PILLARS}
      </Typography>
    </Box>
  );
}
