import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

export default function SecureConnectionBadge() {
  return (
    <Box
      sx={{
        display: { xs: "none", sm: "inline-flex" },
        alignItems: "center",
        gap: 0.75,
        px: 1.5,
        py: 0.625,
        borderRadius: "6px",
        border: "1px solid rgba(0,107,72,0.25)",
        backgroundColor: "rgba(0,107,72,0.08)",
      }}
      aria-label="Secure connection"
    >
      <LockOutlinedIcon sx={{ fontSize: 13, color: "#006B48" }} />
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#006B48",
        }}
      >
        Secure Connection
      </Typography>
    </Box>
  );
}
