import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearStoredVerificationEngine,
  getActiveVerificationEngine,
  getActiveVerificationEnginePath,
  readStoredVerificationEngine,
  writeStoredVerificationEngine,
} from "../config/engineSettings";
import {
  DEFAULT_VERIFICATION_ENGINE,
  getEngineDescription,
  getEngineDisplayName,
  getEnginePath,
  VERIFICATION_ENGINE_OPTIONS,
  type VerificationEngineId,
} from "../config/vendors";

interface VerificationEngineContextValue {
  engine: VerificationEngineId;
  defaultEngine: VerificationEngineId;
  enginePath: string;
  displayName: string;
  description: string;
  hasRuntimeOverride: boolean;
  setEngine: (engine: VerificationEngineId) => void;
  resetToDefault: () => void;
  options: VerificationEngineId[];
}

const VerificationEngineContext =
  createContext<VerificationEngineContextValue | null>(null);

export function VerificationEngineProvider({ children }: { children: ReactNode }) {
  const [engine, setEngineState] = useState<VerificationEngineId>(() =>
    getActiveVerificationEngine()
  );

  const setEngine = useCallback((next: VerificationEngineId) => {
    writeStoredVerificationEngine(next);
    setEngineState(next);
  }, []);

  const resetToDefault = useCallback(() => {
    clearStoredVerificationEngine();
    setEngineState(DEFAULT_VERIFICATION_ENGINE);
  }, []);

  const value = useMemo<VerificationEngineContextValue>(() => {
    const stored = readStoredVerificationEngine();
    return {
      engine,
      defaultEngine: DEFAULT_VERIFICATION_ENGINE,
      enginePath: getActiveVerificationEnginePath(),
      displayName: getEngineDisplayName(engine),
      description: getEngineDescription(engine),
      hasRuntimeOverride: stored != null,
      setEngine,
      resetToDefault,
      options: VERIFICATION_ENGINE_OPTIONS,
    };
  }, [engine, resetToDefault, setEngine]);

  return (
    <VerificationEngineContext.Provider value={value}>
      {children}
    </VerificationEngineContext.Provider>
  );
}

export function useVerificationEngine(): VerificationEngineContextValue {
  const ctx = useContext(VerificationEngineContext);
  if (!ctx) {
    throw new Error("useVerificationEngine must be used within VerificationEngineProvider");
  }
  return ctx;
}

export function getEnginePathFor(engine: VerificationEngineId): string {
  return getEnginePath(engine);
}
