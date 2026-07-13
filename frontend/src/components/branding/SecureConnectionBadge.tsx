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
        border: "1px solid #DCFCE7",
        backgroundColor: "#F0FDF4",
      }}
      aria-label="Secure connection"
    >
      <LockOutlinedIcon sx={{ fontSize: 13, color: "#166534" }} />
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "#166534",
        }}
      >
        Secure Connection
      </Typography>
    </Box>
  );
}
