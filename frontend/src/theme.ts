import { createTheme } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";

/** VERISCAN dark cyber palette */
export const VS = {
  bg: "#0a0c0d",
  bgElevated: "#111416",
  bgCard: "#14181b",
  bgPanel: "#0e1113",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#F4F7FA",
  textSecondary: "#9AA3AD",
  textMuted: "#6B737C",
  accent: "#00FFA3",
  accentDim: "rgba(0,255,163,0.14)",
  accentGlow: "rgba(0,255,163,0.35)",
  danger: "#FF4B6B",
  dangerDim: "rgba(255,75,107,0.14)",
  warning: "#F5A524",
  warningDim: "rgba(245,165,36,0.14)",
  success: "#00E676",
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  sans: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

const shadows: Shadows = Array(25).fill("none") as Shadows;

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: VS.accent,
      light: "#5CFFC4",
      dark: "#00C87F",
      contrastText: "#0A0C0D",
    },
    secondary: {
      main: VS.textSecondary,
      contrastText: VS.bg,
    },
    background: {
      default: VS.bg,
      paper: VS.bgCard,
    },
    text: {
      primary: VS.text,
      secondary: VS.textSecondary,
      disabled: VS.textMuted,
    },
    divider: VS.border,
    success: {
      main: VS.success,
      light: VS.accentDim,
      dark: "#00C853",
      contrastText: VS.bg,
    },
    warning: {
      main: VS.warning,
      light: VS.warningDim,
      dark: "#D4890F",
      contrastText: VS.bg,
    },
    error: {
      main: VS.danger,
      light: VS.dangerDim,
      dark: "#E03555",
      contrastText: "#FFFFFF",
    },
  },
  typography: {
    fontFamily: VS.sans,
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
      color: VS.text,
    },
    h2: {
      fontSize: "1.5rem",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      lineHeight: 1.25,
      color: VS.text,
    },
    h3: {
      fontSize: "1.0625rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.4,
      color: VS.text,
    },
    body1: {
      fontSize: "0.9375rem",
      fontWeight: 400,
      lineHeight: 1.7,
    },
    body2: {
      fontSize: "0.8125rem",
      fontWeight: 400,
      lineHeight: 1.6,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0",
      fontSize: "0.9375rem",
    },
    caption: {
      fontSize: "0.6875rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontFamily: VS.mono,
    },
  },
  shape: {
    borderRadius: 10,
  },
  shadows,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: VS.bg,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
        "::selection": {
          backgroundColor: VS.accent,
          color: VS.bg,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        disableRipple: false,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "10px 20px",
          fontWeight: 600,
          letterSpacing: 0,
          transition:
            "background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
          "&:active": { transform: "scale(0.99)" },
        },
        sizeLarge: {
          padding: "13px 24px",
          fontSize: "0.9375rem",
        },
        contained: {
          backgroundColor: VS.accent,
          color: VS.bg,
          "&:hover": {
            backgroundColor: "#5CFFC4",
            boxShadow: `0 0 24px ${VS.accentGlow}`,
          },
        },
        outlined: {
          borderColor: VS.borderStrong,
          color: VS.text,
          "&:hover": {
            borderColor: VS.accent,
            backgroundColor: VS.accentDim,
          },
        },
        text: {
          color: VS.textSecondary,
          "&:hover": { backgroundColor: "rgba(255,255,255,0.04)", color: VS.text },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.08)",
          height: 4,
        },
        bar: {
          borderRadius: 4,
          backgroundColor: VS.accent,
          transition: "transform 0.5s ease",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: VS.border },
      },
    },
  },
});

export default theme;
