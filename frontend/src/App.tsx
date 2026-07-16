import { useState, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ForensicBackdrop from "./components/branding/ForensicBackdrop";
import VerificationPage from "./pages/VerificationPage";
import BatchVerificationPage from "./pages/BatchVerificationPage";
import EngineSettingsPage from "./pages/EngineSettingsPage";
import { useThemeMode } from "./providers/ThemeModeProvider";

type AppView = "single" | "batch" | "engine";

const ENGINE_HASH = "#/engine";

function readHashView(): AppView {
  const hash = window.location.hash.toLowerCase();
  return hash === ENGINE_HASH ? "engine" : "single";
}

export default function App() {
  const { vs } = useThemeMode();
  const [view, setView] = useState<AppView>(() => readHashView());
  const [resetKey, setResetKey] = useState(0);
  const [scanMeta, setScanMeta] = useState<{
    scanId: string | null;
    pathLabel: string;
  }>({ scanId: null, pathLabel: "/" });

  useEffect(() => {
    const syncFromHash = () => {
      setView(readHashView());
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const navigateTo = useCallback((next: AppView) => {
    setView(next);
    if (next === "engine") {
      if (window.location.hash.toLowerCase() !== ENGINE_HASH) {
        window.location.hash = ENGINE_HASH;
      }
      setScanMeta({ scanId: null, pathLabel: "/ENGINE" });
      return;
    }

    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    setScanMeta({
      scanId: null,
      pathLabel: next === "batch" ? "/BATCH" : "/",
    });
  }, []);

  const handleNewAnalysis = useCallback(() => {
    navigateTo("single");
    setResetKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigateTo]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: vs.bg,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <ForensicBackdrop />
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        <Navbar
          activeView={view === "engine" ? "single" : view}
          onNavigate={navigateTo}
          onNewAnalysis={handleNewAnalysis}
          scanId={scanMeta.scanId}
          pathLabel={scanMeta.pathLabel}
        />
        <Box sx={{ flex: 1 }}>
          {view === "engine" ? (
            <EngineSettingsPage onBack={() => navigateTo("single")} />
          ) : view === "single" ? (
            <VerificationPage
              key={resetKey}
              onOpenBatch={() => navigateTo("batch")}
              onScanMetaChange={setScanMeta}
              onNewAnalysis={handleNewAnalysis}
            />
          ) : (
            <BatchVerificationPage onBack={() => navigateTo("single")} />
          )}
        </Box>
        <Footer />
      </Box>
    </Box>
  );
}
