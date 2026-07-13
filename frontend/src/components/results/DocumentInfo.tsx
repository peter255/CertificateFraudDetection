/**
 * DocumentInfo — Document Information
 * Grid of icon stat cards. Only real available values are shown.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import StorageIcon from "@mui/icons-material/Storage";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import DocumentScannerOutlinedIcon from "@mui/icons-material/DocumentScannerOutlined";
import AspectRatioOutlinedIcon from "@mui/icons-material/AspectRatioOutlined";
import HeightOutlinedIcon from "@mui/icons-material/HeightOutlined";
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import UpdateOutlinedIcon from "@mui/icons-material/UpdateOutlined";
import DataObjectOutlinedIcon from "@mui/icons-material/DataObjectOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { DocumentInfoData } from "../../types/verification";
import { DASHBOARD, SectionShell } from "./shared/dashboardShell";

type FieldIcon = typeof DescriptionOutlinedIcon;

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: FieldIcon;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: "12px",
        backgroundColor: "#F8FAFC",
        border: `1px solid ${DASHBOARD.borderLight}`,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        minHeight: 88,
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
          title={value}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

const INVALID = new Set(["", "-", "—", "–", "unknown", "n/a", "na", "pending", "none"]);

function isRealValue(value: string | null | undefined): value is string {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v.length > 0 && !INVALID.has(v);
}

interface DocumentInfoProps {
  data: DocumentInfoData;
}

export default function DocumentInfo({ data }: DocumentInfoProps) {
  const fields: Array<{ icon: FieldIcon; label: string; value: string }> = [
    { icon: InsertDriveFileOutlinedIcon, label: "File Name", value: data.fileName },
    { icon: StorageIcon, label: "File Size", value: data.fileSize },
    { icon: CategoryOutlinedIcon, label: "File Type", value: data.fileType },
    { icon: DataObjectOutlinedIcon, label: "MIME Type", value: data.mimeType },
    { icon: DescriptionOutlinedIcon, label: "Document Type", value: data.documentType },
    { icon: CategoryOutlinedIcon, label: "File Kind", value: data.fileKind },
    {
      icon: DocumentScannerOutlinedIcon,
      label: "Scan",
      value: data.isScan === true ? "Yes" : data.isScan === false ? "No" : null,
    },
    { icon: AspectRatioOutlinedIcon, label: "Width", value: data.width },
    { icon: HeightOutlinedIcon, label: "Height", value: data.height },
    { icon: GridOnOutlinedIcon, label: "Resolution", value: data.resolution },
    { icon: GridOnOutlinedIcon, label: "DPI", value: data.dpi },
    { icon: PaletteOutlinedIcon, label: "Color Space", value: data.colorSpace },
    { icon: LibraryBooksIcon, label: "Pages", value: data.pages },
    { icon: TagOutlinedIcon, label: "File Hash", value: data.fileHash },
    { icon: PersonOutlinedIcon, label: "Holder", value: data.holderName },
    { icon: ApartmentOutlinedIcon, label: "Issuing Authority", value: data.issuingAuthority },
    { icon: CalendarMonthOutlinedIcon, label: "Issue Date", value: data.issueDate },
    { icon: CalendarMonthOutlinedIcon, label: "Created Date", value: data.createdDate },
    { icon: UpdateOutlinedIcon, label: "Modified Date", value: data.modifiedDate },
    { icon: AccessTimeIcon, label: "Upload Time", value: data.uploadTime },
    { icon: TimerOutlinedIcon, label: "Processing Time", value: data.processingTime },
    ...data.extras.map((extra) => ({
      icon: InfoOutlinedIcon,
      label: extra.label,
      value: extra.value,
    })),
  ].filter((field): field is { icon: FieldIcon; label: string; value: string } =>
    isRealValue(field.value)
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
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 1.25,
          mt: -0.5,
        }}
      >
        {fields.map((field) => (
          <InfoCard key={`${field.label}-${field.value}`} {...field} />
        ))}
      </Box>
    </SectionShell>
  );
}
