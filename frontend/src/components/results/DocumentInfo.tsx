/**
 * DocumentInfo — Section 4: Document Information
 * Grid of icon stat cards. Empty fields are omitted.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import StorageIcon from "@mui/icons-material/Storage";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import type { DocumentInfoData } from "../../types/verification";
import { DASHBOARD, SectionShell } from "./shared/dashboardShell";

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DescriptionOutlinedIcon;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: "14px",
        backgroundColor: "#F8FAFC",
        border: `1px solid ${DASHBOARD.borderLight}`,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        minHeight: 100,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "9px",
          backgroundColor: "rgba(0,120,212,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon sx={{ fontSize: 18, color: DASHBOARD.accent }} />
      </Box>
      <Box>
        <Typography
          sx={{
            fontSize: "0.5625rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: DASHBOARD.textMuted,
            mb: 0.5,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: DASHBOARD.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

interface DocumentInfoProps {
  data: DocumentInfoData;
}

export default function DocumentInfo({ data }: DocumentInfoProps) {
  const fields = [
    { icon: InsertDriveFileOutlinedIcon, label: "Filename", value: data.fileName },
    { icon: DescriptionOutlinedIcon, label: "Document Type", value: data.documentType },
    { icon: StorageIcon, label: "File Size", value: data.fileSize },
    { icon: LibraryBooksIcon, label: "Pages", value: data.pages },
    { icon: AccessTimeIcon, label: "Upload Time", value: data.uploadTime },
    { icon: TimerOutlinedIcon, label: "Processing Time", value: data.processingTime },
    { icon: EventAvailableIcon, label: "Verified At", value: data.verifiedAt },
    { icon: VerifiedUserOutlinedIcon, label: "Verification Engine", value: data.vendorName },
  ].filter((field): field is { icon: typeof DescriptionOutlinedIcon; label: string; value: string } =>
    Boolean(field.value && field.value !== "—")
  );

  if (fields.length === 0) {
    return null;
  }

  return (
    <SectionShell
      title="Document Information"
      icon={<DescriptionOutlinedIcon sx={{ fontSize: 18 }} />}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
          gap: 1.5,
          mt: -1,
        }}
      >
        {fields.map((field) => (
          <InfoCard key={field.label} {...field} />
        ))}
      </Box>
    </SectionShell>
  );
}
