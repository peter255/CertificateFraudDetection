import { useRef, useState, useCallback } from "react";
import type { DragEvent, ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
}

function UploadIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="48"
      height="48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transition: "transform 180ms ease", transform: active ? "translateY(-2px)" : "none" }}
    >
      <rect
        x="8"
        y="6"
        width="24"
        height="30"
        rx="3"
        fill={active ? "rgba(0,120,212,0.08)" : "#F8FAFC"}
        stroke={active ? "#0078D4" : "#CBD5E1"}
        strokeWidth="1.5"
      />
      <rect x="13" y="10" width="14" height="2" rx="1" fill={active ? "#0078D4" : "#94A3B8"} />
      <rect x="13" y="15" width="10" height="2" rx="1" fill={active ? "#2B88D8" : "#CBD5E1"} />
      <circle cx="35" cy="35" r="10" fill="#0078D4" />
      <path
        d="M35 31v8M35 31l-3 3M35 31l3 3"
        stroke="white"
        strokeWidth="1.75"
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
          borderRadius: "14px",
          border: "1.5px dashed",
          borderColor: isDragging ? "#0078D4" : "#C5D3E0",
          backgroundColor: isDragging ? "rgba(0,120,212,0.04)" : "#FFFFFF",
          boxShadow: isDragging
            ? "0 0 0 3px rgba(0,120,212,0.1), 0 8px 24px rgba(15,23,42,0.06)"
            : "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)",
          px: { xs: 3, sm: 5 },
          py: { xs: 4.5, sm: 5.5 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
          "&:hover": {
            borderColor: "#0078D4",
            transform: "translateY(-1px)",
            boxShadow: "0 2px 4px rgba(15,23,42,0.04), 0 12px 28px rgba(15,23,42,0.06)",
          },
        }}
      >
        <UploadIcon active={isDragging} />

        <Box sx={{ textAlign: "center" }}>
          <Typography
            sx={{
              fontSize: "1.0625rem",
              fontWeight: 600,
              color: "#0F172A",
              mb: 0.75,
              lineHeight: 1.4,
            }}
          >
            {isDragging ? "Release to upload" : "Drag & drop a certificate"}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.6 }}>
            or{" "}
            <Box
              component="span"
              sx={{
                color: "#0078D4",
                fontWeight: 600,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              browse files
            </Box>
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {["PDF", "JPG", "PNG"].map((fmt) => (
            <Box
              key={fmt}
              sx={{
                px: 1.25,
                py: 0.375,
                borderRadius: "6px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "#64748B",
                }}
              >
                {fmt}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
}
