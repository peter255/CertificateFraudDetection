import {
  DEFAULT_VERIFICATION_ENGINE,
  getEngineDisplayName,
  getEnginePath,
  isVerificationEngineId,
  type VerificationEngineId,
} from "./vendors";

export const ENGINE_SETTINGS_STORAGE_KEY = "cfd-verification-engine";

export function readStoredVerificationEngine(): VerificationEngineId | null {
  try {
    const raw = localStorage.getItem(ENGINE_SETTINGS_STORAGE_KEY);
    if (raw && isVerificationEngineId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredVerificationEngine(engine: VerificationEngineId): void {
  try {
    localStorage.setItem(ENGINE_SETTINGS_STORAGE_KEY, engine);
  } catch {
    /* ignore */
  }
}

export function clearStoredVerificationEngine(): void {
  try {
    localStorage.removeItem(ENGINE_SETTINGS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Effective engine for API calls — runtime override wins over .env default. */
export function getActiveVerificationEngine(): VerificationEngineId {
  return readStoredVerificationEngine() ?? DEFAULT_VERIFICATION_ENGINE;
}

export function getActiveVerificationEnginePath(): string {
  const engine = getActiveVerificationEngine();
  const customPath = import.meta.env.VITE_VERIFICATION_PATH;
  if (customPath && engine === DEFAULT_VERIFICATION_ENGINE) {
    return customPath;
  }
  return getEnginePath(engine);
}

export function getActiveEngineDisplayName(): string {
  return getEngineDisplayName(getActiveVerificationEngine());
}

export function isUsingRuntimeEngineOverride(): boolean {
  const stored = readStoredVerificationEngine();
  return stored != null && stored !== DEFAULT_VERIFICATION_ENGINE;
}
