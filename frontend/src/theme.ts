import { createTheme } from "@mui/material/styles";
import type { Shadows, Theme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark";

export type VSTokens = {
  bg: string;
  bgElevated: string;
  bgCard: string;
  bgPanel: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  brandGold: string;
  accentDim: string;
  accentGlow: string;
  onAccent: string;
  danger: string;
  dangerDim: string;
  warning: string;
  warningDim: string;
  success: string;
  successDim: string;
  sans: string;
  heading: string;
  mono: string;
};

const FONT_SANS =
  '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_HEADING =
  '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * UAE Design System–aligned palette (light).
 * Primary: AE Gold primary-600 (#92722A).
 */
export const lightVS: VSTokens = {
  bg: "#F2F2F2",
  bgElevated: "#FFFFFF",
  bgCard: "#FFFFFF",
  bgPanel: "#FAFAFA",
  border: "rgba(35,37,40,0.12)",
  borderStrong: "rgba(35,37,40,0.22)",
  text: "#232528",
  textSecondary: "#5A5E63",
  textMuted: "#7A7E85",
  accent: "#92722A",
  accentHover: "#B68A35",
  brandGold: "#CA9A2C",
  accentDim: "rgba(146,114,42,0.12)",
  accentGlow: "rgba(146,114,42,0.18)",
  onAccent: "#FFFFFF",
  danger: "#C8102E",
  dangerDim: "rgba(200,16,46,0.1)",
  warning: "#9A6B1F",
  warningDim: "rgba(154,107,31,0.12)",
  success: "#006B48",
  successDim: "rgba(0,107,72,0.1)",
  sans: FONT_SANS,
  heading: FONT_HEADING,
  mono: FONT_SANS,
};

/**
 * UAE Design System–aligned palette (dark).
 * Same gold accent and semantic colors as light; inverted neutrals.
 */
export const darkVS: VSTokens = {
  bg: "#1C1D21",
  bgElevated: "#232528",
  bgCard: "#282A2E",
  bgPanel: "#222427",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  text: "#F2F2F2",
  textSecondary: "#B0B4BA",
  textMuted: "#7A7E85",
  accent: "#CA9A2C",
  accentHover: "#D4AB47",
  brandGold: "#CA9A2C",
  accentDim: "rgba(202,154,44,0.16)",
  accentGlow: "rgba(202,154,44,0.22)",
  onAccent: "#FFFFFF",
  danger: "#E5485C",
  dangerDim: "rgba(200,16,46,0.18)",
  warning: "#D4A043",
  warningDim: "rgba(154,107,31,0.18)",
  success: "#34A87A",
  successDim: "rgba(0,107,72,0.18)",
  sans: FONT_SANS,
  heading: FONT_HEADING,
  mono: FONT_SANS,
};

/** Active tokens — reassigned on mode change (ESM live binding). */
export let VS: VSTokens = lightVS;

export function tokensFor(mode: ThemeMode): VSTokens {
  return mode === "dark" ? darkVS : lightVS;
}

export function setActiveTokens(mode: ThemeMode): void {
  VS = tokensFor(mode);
}

function buildShadows(mode: ThemeMode): Shadows {
  const shadows: Shadows = Array(25).fill("none") as Shadows;
  if (mode === "light") {
    shadows[1] = "0 1px 2px rgba(35,37,40,0.06)";
    shadows[2] =
      "0 1px 3px rgba(35,37,40,0.08), 0 1px 2px rgba(35,37,40,0.04)";
    shadows[4] = "0 4px 12px rgba(35,37,40,0.08)";
  } else {
    shadows[1] = "0 1px 2px rgba(0,0,0,0.2)";
    shadows[2] =
      "0 1px 3px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.15)";
    shadows[4] = "0 4px 12px rgba(0,0,0,0.3)";
  }
  return shadows;
}

export function createAppTheme(mode: ThemeMode): Theme {
  const vs = tokensFor(mode);
  const isDark = mode === "dark";
  const hoverWash = isDark
    ? "rgba(255,255,255,0.04)"
    : "rgba(35,37,40,0.04)";
  const trackBg = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(35,37,40,0.08)";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: vs.accent,
        light: vs.accentHover,
        dark: "#782C0B",
        contrastText: vs.onAccent,
      },
      secondary: {
        main: vs.textSecondary,
        contrastText: vs.onAccent,
      },
      background: {
        default: vs.bg,
        paper: vs.bgCard,
      },
      text: {
        primary: vs.text,
        secondary: vs.textSecondary,
        disabled: vs.textMuted,
      },
      divider: vs.border,
      success: {
        main: vs.success,
        light: vs.successDim,
        dark: "#004D34",
        contrastText: vs.onAccent,
      },
      warning: {
        main: vs.warning,
        light: vs.warningDim,
        dark: "#7A5418",
        contrastText: vs.onAccent,
      },
      error: {
        main: vs.danger,
        light: vs.dangerDim,
        dark: "#9A0C22",
        contrastText: vs.onAccent,
      },
    },
    typography: {
      fontFamily: vs.sans,
      h1: {
        fontFamily: vs.heading,
        fontSize: "2.5rem",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        color: vs.text,
      },
      h2: {
        fontFamily: vs.heading,
        fontSize: "1.5rem",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: 1.3,
        color: vs.text,
      },
      h3: {
        fontFamily: vs.heading,
        fontSize: "1.0625rem",
        fontWeight: 600,
        letterSpacing: "0",
        lineHeight: 1.4,
        color: vs.text,
      },
      body1: {
        fontSize: "1rem",
        fontWeight: 400,
        lineHeight: 1.5,
      },
      body2: {
        fontSize: "0.875rem",
        fontWeight: 400,
        lineHeight: 1.5,
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
        letterSpacing: "0",
        fontSize: "0.9375rem",
        fontFamily: vs.sans,
      },
      caption: {
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.01em",
        textTransform: "none",
        fontFamily: vs.sans,
        color: vs.textMuted,
      },
    },
    shape: {
      borderRadius: 8,
    },
    shadows: buildShadows(mode),
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: vs.bg,
            color: vs.text,
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          },
          "::selection": {
            backgroundColor: vs.accentDim,
            color: vs.text,
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
              "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          },
          sizeLarge: {
            padding: "13px 24px",
            fontSize: "0.9375rem",
          },
          contained: {
            backgroundColor: vs.accent,
            color: vs.onAccent,
            "&:hover": {
              backgroundColor: vs.accentHover,
            },
          },
          outlined: {
            borderColor: vs.borderStrong,
            color: vs.text,
            "&:hover": {
              borderColor: vs.accent,
              backgroundColor: vs.accentDim,
            },
          },
          text: {
            color: vs.textSecondary,
            "&:hover": {
              backgroundColor: hoverWash,
              color: vs.text,
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: vs.bgCard,
            border: `1px solid ${vs.border}`,
            borderRadius: 8,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: trackBg,
            height: 4,
          },
          bar: {
            borderRadius: 4,
            backgroundColor: vs.accent,
            transition: "transform 0.5s ease",
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: vs.border },
        },
      },
    },
  });
}

/** Default MUI theme (light). Prefer AppThemeProvider at runtime. */
const theme = createAppTheme("light");
export default theme;
