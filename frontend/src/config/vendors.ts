/**
 * Active verification engine configuration.
 *
 * Default engine: VITE_VERIFICATION_ENGINE=v1|v2
 * Runtime override: localStorage key `cfd-verification-engine` (see engineSettings.ts)
 */

export type VerificationEngineId = "v1" | "v2";

const ENGINE_PATHS: Record<VerificationEngineId, string> = {
  v1: "/vendors/v1/verify",
  v2: "/vendors/v2/verify",
};

const ENGINE_DISPLAY_NAMES: Record<VerificationEngineId, string> = {
  v1: "Engine V1",
  v2: "Engine V2",
};

const ENGINE_DESCRIPTIONS: Record<VerificationEngineId, string> = {
  v1: "TruthScan-based verification pipeline",
  v2: "Paperwork-based verification pipeline",
};

const configured = (import.meta.env.VITE_VERIFICATION_ENGINE ?? "v1").toLowerCase();

export const DEFAULT_VERIFICATION_ENGINE: VerificationEngineId =
  configured === "v2" ? "v2" : "v1";

/** Build-time default (no runtime override). */
export const ACTIVE_VERIFICATION_ENGINE: VerificationEngineId = DEFAULT_VERIFICATION_ENGINE;

export const VERIFICATION_ENGINE_PATH: string =
  import.meta.env.VITE_VERIFICATION_PATH ??
  ENGINE_PATHS[DEFAULT_VERIFICATION_ENGINE];

export const ACTIVE_ENGINE_DISPLAY_NAME: string =
  ENGINE_DISPLAY_NAMES[DEFAULT_VERIFICATION_ENGINE];

export const VERIFICATION_ENGINE_OPTIONS: VerificationEngineId[] = ["v1", "v2"];

export function getEnginePath(engine: VerificationEngineId): string {
  return ENGINE_PATHS[engine];
}

export function getEngineDisplayName(engine: VerificationEngineId): string {
  return ENGINE_DISPLAY_NAMES[engine];
}

export function getEngineDescription(engine: VerificationEngineId): string {
  return ENGINE_DESCRIPTIONS[engine];
}

export function isVerificationEngineId(value: string): value is VerificationEngineId {
  return value === "v1" || value === "v2";
}
