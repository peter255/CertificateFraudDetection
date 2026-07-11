import Box from "@mui/material/Box";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import VerificationPage from "./pages/VerificationPage";

export default function App() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#F4F7FB",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar />
      <Box sx={{ flex: 1 }}>
        <VerificationPage />
      </Box>
      <Footer />
    </Box>
  );
}
