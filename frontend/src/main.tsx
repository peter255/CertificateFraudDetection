import React from "react";
import ReactDOM from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
// @ts-ignore
import "@fontsource/outfit/400.css";
// @ts-ignore
import "@fontsource/outfit/500.css";
// @ts-ignore
import "@fontsource/outfit/600.css";
// @ts-ignore
import "@fontsource/outfit/700.css";
// @ts-ignore
import "@fontsource/jetbrains-mono/400.css";
// @ts-ignore
import "@fontsource/jetbrains-mono/500.css";
// @ts-ignore
import "@fontsource/jetbrains-mono/600.css";
import App from "./App";
import theme from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
