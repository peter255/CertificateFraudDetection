import React from "react";
import ReactDOM from "react-dom/client";
// @ts-ignore
import "@fontsource/roboto/400.css";
// @ts-ignore
import "@fontsource/roboto/500.css";
// @ts-ignore
import "@fontsource/roboto/700.css";
// @ts-ignore
import "@fontsource/inter/400.css";
// @ts-ignore
import "@fontsource/inter/600.css";
// @ts-ignore
import "@fontsource/inter/700.css";
import App from "./App";
import { AppThemeProvider } from "./providers/ThemeModeProvider";
import { VerificationEngineProvider } from "./providers/VerificationEngineProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <VerificationEngineProvider>
        <App />
      </VerificationEngineProvider>
    </AppThemeProvider>
  </React.StrictMode>
);
