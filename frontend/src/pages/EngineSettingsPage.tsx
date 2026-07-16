import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useVerificationEngine } from "../providers/VerificationEngineProvider";
import {
  getEngineDescription,
  getEngineDisplayName,
  getEnginePath,
  type VerificationEngineId,
} from "../config/vendors";
import { useThemeMode } from "../providers/ThemeModeProvider";

interface EngineSettingsPageProps {
  onBack: () => void;
}

export default function EngineSettingsPage({ onBack }: EngineSettingsPageProps) {
  const { vs } = useThemeMode();
  const {
    engine,
    defaultEngine,
    hasRuntimeOverride,
    setEngine,
    resetToDefault,
    options,
  } = useVerificationEngine();

  const handleChange = (value: string) => {
    if (value === "v1" || value === "v2") {
      setEngine(value);
    }
  };

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, md: 3.5 },
        pt: { xs: 2.5, md: 3 },
        pb: { xs: 6, md: 8 },
        maxWidth: 720,
        mx: "auto",
      }}
    >
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{
          mb: 2.5,
          color: vs.textSecondary,
          fontWeight: 600,
          fontSize: "0.8125rem",
        }}
      >
        Back to verification
      </Button>

      <Typography
        sx={{
          fontFamily: vs.heading,
          fontSize: { xs: "1.375rem", md: "1.5rem" },
          fontWeight: 700,
          color: vs.text,
          letterSpacing: "-0.02em",
          mb: 0.75,
        }}
      >
        Verification engine
      </Typography>
      <Typography sx={{ fontSize: "0.875rem", color: vs.textSecondary, mb: 3 }}>
        Switch the active vendor at runtime. Changes apply immediately to the next
        upload — no rebuild or restart required. This page is not linked from the
        navigation bar; bookmark{" "}
        <Box component="code" sx={{ fontFamily: vs.mono, fontSize: "0.8125rem" }}>
          /#/engine
        </Box>{" "}
        to return here.
      </Typography>

      <Card
        variant="outlined"
        sx={{
          borderColor: vs.border,
          backgroundColor: vs.bgCard,
          borderRadius: "12px",
          mb: 2.5,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              flexWrap: "wrap",
              mb: 2,
            }}
          >
            <Typography sx={{ fontWeight: 600, color: vs.text }}>
              Active engine
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={getEngineDisplayName(engine)}
                sx={{
                  fontWeight: 600,
                  backgroundColor: vs.accentDim,
                  color: vs.accent,
                }}
              />
              {hasRuntimeOverride ? (
                <Chip
                  size="small"
                  label="Runtime override"
                  sx={{
                    fontWeight: 600,
                    backgroundColor: vs.warningDim,
                    color: vs.warning,
                  }}
                />
              ) : (
                <Chip
                  size="small"
                  label="From .env default"
                  sx={{
                    fontWeight: 600,
                    backgroundColor: vs.successDim,
                    color: vs.success,
                  }}
                />
              )}
            </Box>
          </Box>

          <RadioGroup value={engine} onChange={(_, value) => handleChange(value)}>
            {options.map((option) => (
              <EngineOption
                key={option}
                id={option}
                selected={engine === option}
                isDefault={defaultEngine === option}
              />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={resetToDefault}
          disabled={!hasRuntimeOverride}
          sx={{
            borderColor: vs.border,
            color: vs.textSecondary,
            fontWeight: 600,
          }}
        >
          Reset to .env default ({getEngineDisplayName(defaultEngine)})
        </Button>
      </Box>
    </Box>
  );
}

function EngineOption({
  id,
  selected,
  isDefault,
}: {
  id: VerificationEngineId;
  selected: boolean;
  isDefault: boolean;
}) {
  const { vs } = useThemeMode();

  return (
    <Box
      sx={{
        border: `1px solid ${selected ? vs.accent : vs.border}`,
        borderRadius: "10px",
        px: 1.5,
        py: 0.5,
        mb: 1.25,
        backgroundColor: selected ? vs.accentDim : "transparent",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
      }}
    >
      <FormControlLabel
        value={id}
        control={
          <Radio
            size="small"
            sx={{
              color: vs.textMuted,
              "&.Mui-checked": { color: vs.accent },
            }}
          />
        }
        label={
          <Box sx={{ py: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 600, color: vs.text, fontSize: "0.9375rem" }}>
                {getEngineDisplayName(id)}
              </Typography>
              {isDefault && (
                <Chip
                  size="small"
                  label=".env default"
                  sx={{
                    height: 22,
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    backgroundColor: vs.bgPanel,
                    color: vs.textMuted,
                  }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: "0.8125rem", color: vs.textSecondary, mt: 0.25 }}>
              {getEngineDescription(id)}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: vs.textMuted,
                fontFamily: vs.mono,
                mt: 0.5,
              }}
            >
              POST /api/v1{getEnginePath(id)}
            </Typography>
          </Box>
        }
        sx={{ alignItems: "flex-start", mx: 0, width: "100%" }}
      />
    </Box>
  );
}
