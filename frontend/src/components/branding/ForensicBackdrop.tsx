/**
 * Atmosphere backdrop — subtle UAE gold wash (light and dark).
 */

import Box from "@mui/material/Box";
import { useThemeMode } from "../../providers/ThemeModeProvider";

export default function ForensicBackdrop() {
  const { vs } = useThemeMode();

  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: vs.bg,
        backgroundImage: `
          radial-gradient(ellipse 60% 45% at 50% 0%, ${vs.accentDim} 0%, transparent 65%)
        `,
        backgroundSize: "100% 100%",
      }}
    />
  );
}
