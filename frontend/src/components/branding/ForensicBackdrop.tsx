/**
 * Atmosphere backdrop — light UAE wash or dark cyber grid.
 */

import Box from "@mui/material/Box";
import { useThemeMode } from "../../providers/ThemeModeProvider";

export default function ForensicBackdrop() {
  const { vs, isDark } = useThemeMode();

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
        backgroundImage: isDark
          ? `
          radial-gradient(ellipse 55% 40% at 50% 28%, ${vs.accentDim} 0%, transparent 70%),
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `
          : `
          radial-gradient(ellipse 60% 45% at 50% 0%, ${vs.accentDim} 0%, transparent 65%)
        `,
        backgroundSize: isDark ? "100% 100%, 32px 32px, 32px 32px" : "100% 100%",
        backgroundPosition: "0 0, 0 0, 0 0",
      }}
    />
  );
}
