/**
 * ActionsPanel — Section 7: Actions
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
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
  const handleDownload = () => {
    downloadVerificationReport(result, fileName);
  };

  return (
    <Box
      sx={{
        borderRadius: "12px",
        backgroundColor: DASHBOARD.cardBg,
        border: `1px solid ${DASHBOARD.border}`,
        px: 3.5,
        py: 3.25,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: DASHBOARD.textPrimary,
          mb: 1,
        }}
      >
        Actions
      </Typography>
      <Typography
        sx={{
          fontSize: "0.875rem",
          color: DASHBOARD.textSecondary,
          mb: 2.75,
          lineHeight: 1.65,
        }}
      >
        Export the investigation report or start a new verification session.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={handleDownload}
          sx={{
            flex: 1,
            minWidth: 180,
            height: 46,
            borderRadius: "8px",
          }}
        >
          Download Report
        </Button>
        <Button
          variant="contained"
          startIcon={<ReplayIcon />}
          onClick={onVerifyAnother}
          sx={{
            flex: 1,
            minWidth: 180,
            height: 46,
            borderRadius: "8px",
          }}
        >
          Verify Another
        </Button>
      </Box>
    </Box>
  );
}
