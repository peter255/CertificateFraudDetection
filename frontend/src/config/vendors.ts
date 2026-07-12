/**
 * Active verification engine configuration.
 *
 * Switch engines with VITE_VERIFICATION_ENGINE=v1|v2
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

const configured = (import.meta.env.VITE_VERIFICATION_ENGINE ?? "v1").toLowerCase();

export const ACTIVE_VERIFICATION_ENGINE: VerificationEngineId =
  configured === "v2" ? "v2" : "v1";

export const VERIFICATION_ENGINE_PATH: string =
  import.meta.env.VITE_VERIFICATION_PATH ?? ENGINE_PATHS[ACTIVE_VERIFICATION_ENGINE];

export const ACTIVE_ENGINE_DISPLAY_NAME: string =
  ENGINE_DISPLAY_NAMES[ACTIVE_VERIFICATION_ENGINE];
