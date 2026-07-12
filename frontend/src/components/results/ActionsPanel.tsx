/**
 * ActionsPanel — Section 7: Actions
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import { useState } from "react";
import { DASHBOARD } from "./shared/dashboardShell";
import type { VerificationResult } from "../../types/verification";
import { downloadVerificationReport } from "../../utils/downloadReport";

interface ActionsPanelProps {
  result: VerificationResult;
  fileName?: string;
  onVerifyAnother: () => void;
}

export default function ActionsPanel({
  result,
  fileName = "certificate",
  onVerifyAnother,
}: ActionsPanelProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadVerificationReport(result, fileName);
    } catch (err) {
      console.error("Failed to generate PDF report", err);
      window.alert("Could not generate the PDF report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: "12px",
        backgroundColor: DASHBOARD.cardBg,
        border: `1px solid ${DASHBOARD.border}`,
        px: { xs: 2, sm: 2.75 },
        py: { xs: 2.25, sm: 2.75 },
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: DASHBOARD.textPrimary,
          mb: 0.75,
        }}
      >
        Actions
      </Typography>
      <Typography
        sx={{
          fontSize: "0.875rem",
          color: DASHBOARD.textSecondary,
          mb: 2.25,
          lineHeight: 1.6,
        }}
      >
        Download the investigation report or verify another document.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.25, flexDirection: { xs: "column", sm: "row" } }}>
        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={handleDownload}
          disabled={downloading}
          sx={{
            flex: 1,
            minWidth: 0,
            height: 44,
            borderRadius: "8px",
          }}
        >
          {downloading ? "Preparing PDF..." : "Download PDF Report"}
        </Button>
        <Button
          variant="contained"
          startIcon={<ReplayIcon />}
          onClick={onVerifyAnother}
          sx={{
            flex: 1,
            minWidth: 0,
            height: 44,
            borderRadius: "8px",
          }}
        >
          Verify Another
        </Button>
      </Box>
    </Box>
  );
}
