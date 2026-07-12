import { useState } from "react";
import Box from "@mui/material/Box";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import VerificationPage from "./pages/VerificationPage";
import BatchVerificationPage from "./pages/BatchVerificationPage";

type AppView = "single" | "batch";

export default function App() {
  const [view, setView] = useState<AppView>("single");

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#F4F7FB",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar
        activeView={view}
        onNavigate={(next) => setView(next)}
      />
      <Box sx={{ flex: 1 }}>
        {view === "single" ? (
          <VerificationPage onOpenBatch={() => setView("batch")} />
        ) : (
          <BatchVerificationPage onBack={() => setView("single")} />
        )}
      </Box>
      <Footer />
    </Box>
  );
}
