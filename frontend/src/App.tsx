import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ForensicBackdrop from "./components/branding/ForensicBackdrop";
import VerificationPage from "./pages/VerificationPage";
import BatchVerificationPage from "./pages/BatchVerificationPage";
import { VS } from "./theme";

type AppView = "single" | "batch";

export default function App() {
  const [view, setView] = useState<AppView>("single");
  const [resetKey, setResetKey] = useState(0);
  const [scanMeta, setScanMeta] = useState<{
    scanId: string | null;
    pathLabel: string;
  }>({ scanId: null, pathLabel: "/" });

  const handleNewAnalysis = useCallback(() => {
    setView("single");
    setResetKey((k) => k + 1);
    setScanMeta({ scanId: null, pathLabel: "/" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: VS.bg,
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
          activeView={view}
          onNavigate={(next) => {
            setView(next);
            setScanMeta({
              scanId: null,
              pathLabel: next === "batch" ? "/BATCH" : "/",
            });
          }}
          onNewAnalysis={handleNewAnalysis}
          scanId={scanMeta.scanId}
          pathLabel={scanMeta.pathLabel}
        />
        <Box sx={{ flex: 1 }}>
          {view === "single" ? (
            <VerificationPage
              key={resetKey}
              onOpenBatch={() => setView("batch")}
              onScanMetaChange={setScanMeta}
              onNewAnalysis={handleNewAnalysis}
            />
          ) : (
            <BatchVerificationPage onBack={() => setView("single")} />
          )}
        </Box>
        <Footer />
      </Box>
    </Box>
  );
}
