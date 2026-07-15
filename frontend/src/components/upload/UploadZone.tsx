import { useRef, useState, useCallback } from "react";
import type { DragEvent, ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { VS } from "../../theme";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
}

function CloudUploadIcon({ active }: { active: boolean }) {
  const stroke = active ? VS.accent : VS.textMuted;
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <path
        d="M16 32h-1.5A8.5 8.5 0 0116 15.1 12 12 0 0138.4 18 7.5 7.5 0 0136.5 32H32"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 34V20M24 20l-5 5M24 20l5 5"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function UploadZone({ onFileSelected }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (ACCEPTED_TYPES.includes(file.type)) {
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />
      <Box
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        sx={{
          cursor: "pointer",
          borderRadius: "12px",
          border: "1.5px dashed",
          borderColor: isDragging ? VS.accent : VS.borderStrong,
          backgroundColor: isDragging
            ? VS.accentDim
            : VS.bgCard,
          px: { xs: 3, sm: 5 },
          py: { xs: 5, sm: 6 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.75,
          transition:
            "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
          "&:hover": {
            borderColor: VS.accent,
            backgroundColor: VS.accentDim,
          },
        }}
      >
        <CloudUploadIcon active={isDragging} />

        <Box sx={{ textAlign: "center" }}>
          <Typography
            sx={{
              fontSize: "1.0625rem",
              fontWeight: 600,
              color: VS.text,
              mb: 1,
              lineHeight: 1.4,
            }}
          >
            {isDragging
              ? "Release to upload"
              : "Drop PDF or high-resolution JPEG / PNG"}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontWeight: 500,
              color: VS.textMuted,
            }}
          >
            Max 50MB · Encrypted in transit
          </Typography>
        </Box>
      </Box>
    </>
  );
}
