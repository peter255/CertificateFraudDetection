/**
 * Subtle forensic grid + security watermark for enterprise atmosphere.
 * Decorative only — does not affect layout or interaction.
 */

import Box from "@mui/material/Box";

interface ForensicBackdropProps {
  /** Watermark opacity (0–1). Keep very low for calm authority. */
  watermarkOpacity?: number;
}

export default function ForensicBackdrop({
  watermarkOpacity = 0.028,
}: ForensicBackdropProps) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundImage: `
          linear-gradient(180deg, rgba(15,41,66,0.03) 0%, transparent 28%),
          linear-gradient(rgba(15,41,66,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15,41,66,0.035) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 28px 28px, 28px 28px",
        backgroundPosition: "0 0, 0 0, 0 0",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          right: { xs: "-8%", md: "4%" },
          bottom: { xs: "8%", md: "12%" },
          width: { xs: 220, md: 320 },
          height: { xs: 220, md: 320 },
          opacity: watermarkOpacity,
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' fill='none'>
              <path d='M60 8L104 28V58C104 86 84 106 60 112C36 106 16 86 16 58V28L60 8Z' stroke='#0F2942' stroke-width='3'/>
              <path d='M42 60L54 72L80 46' stroke='#0F2942' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/>
            </svg>`
          )}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
        }}
      />
    </Box>
  );
}
