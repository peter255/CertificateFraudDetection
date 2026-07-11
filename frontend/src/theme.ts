import { createTheme } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";

const shadows: Shadows = [
  "none",
  "0 1px 2px 0 rgba(15,23,42,0.04)",
  "0 1px 3px 0 rgba(15,23,42,0.06), 0 1px 2px -1px rgba(15,23,42,0.04)",
  "0 4px 6px -1px rgba(15,23,42,0.05), 0 2px 4px -2px rgba(15,23,42,0.04)",
  "0 10px 15px -3px rgba(15,23,42,0.05), 0 4px 6px -4px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
  "0 20px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.04)",
];

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0078D4",
      light: "#2B88D8",
      dark: "#005A9E",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#64748B",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F4F7FB",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0F172A",
      secondary: "#64748B",
      disabled: "#CBD5E1",
    },
    divider: "#E2E8F0",
    success: {
      main: "#107C10",
      light: "#F0FDF4",
      dark: "#0B5A0B",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#D97706",
      light: "#FFFBEB",
      dark: "#B45309",
      contrastText: "#FFFFFF",
    },
    error: {
      main: "#C50F1F",
      light: "#FEF2F2",
      dark: "#A80000",
      contrastText: "#FFFFFF",
    },
  },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
      color: "#0F172A",
    },
    h2: {
      fontSize: "1.5rem",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      lineHeight: 1.25,
      color: "#0F172A",
    },
    h3: {
      fontSize: "1.0625rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.4,
      color: "#0F172A",
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
      fontWeight: 500,
      letterSpacing: "0",
      fontSize: "0.9375rem",
    },
    caption: {
      fontSize: "0.6875rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
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
          backgroundColor: "#F4F7FB",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
        "::selection": {
          backgroundColor: "#0078D4",
          color: "#FFFFFF",
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
          fontWeight: 500,
          letterSpacing: 0,
          transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
          "&:active": { transform: "scale(0.99)" },
        },
        sizeLarge: {
          padding: "13px 24px",
          fontSize: "0.9375rem",
        },
        contained: {
          backgroundColor: "#0078D4",
          color: "#FFFFFF",
          "&:hover": { backgroundColor: "#106EBE" },
        },
        outlined: {
          borderColor: "#D0D7DE",
          color: "#0F172A",
          "&:hover": {
            borderColor: "#0078D4",
            backgroundColor: "rgba(0,120,212,0.04)",
          },
        },
        text: {
          "&:hover": { backgroundColor: "rgba(0,120,212,0.04)" },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: "#E2E8F0",
          height: 4,
        },
        bar: {
          borderRadius: 4,
          backgroundColor: "#0078D4",
          transition: "transform 0.5s ease",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "#E2E8F0" },
      },
    },
  },
});

export default theme;
