/**
 * Dark grid + green halo atmosphere for VERISCAN.
 */

import Box from "@mui/material/Box";
import { VS } from "../../theme";

export default function ForensicBackdrop() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: VS.bg,
        backgroundImage: `
          radial-gradient(ellipse 55% 40% at 50% 28%, rgba(0,255,163,0.07) 0%, transparent 70%),
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 32px 32px, 32px 32px",
        backgroundPosition: "0 0, 0 0, 0 0",
      }}
    />
  );
}
