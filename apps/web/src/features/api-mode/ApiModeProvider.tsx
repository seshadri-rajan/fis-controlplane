import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ApiMode = "mock" | "backend";

const STORAGE_KEY = "calendar-api-mode";

export function getInitialApiMode(): ApiMode {
  if (!import.meta.env.DEV) return "backend";
  return window.localStorage.getItem(STORAGE_KEY) === "backend" ? "backend" : "mock";
}

export async function activateApiMode(mode: ApiMode): Promise<void> {
  if (!import.meta.env.DEV) return;

  const { worker } = await import("../../lib/api/mocks/browser");
  if (mode === "mock") {
    await worker.start();
  } else {
    worker.stop();
  }
}

type ApiModeContextValue = {
  mode: ApiMode;
  isLocalBackend: boolean;
  setMode: (mode: ApiMode) => Promise<void>;
};

const ApiModeContext = createContext<ApiModeContextValue | null>(null);

export function ApiModeProvider({
  initialMode,
  children,
}: {
  initialMode: ApiMode;
  children: ReactNode;
}) {
  const [mode, setMode] = useState(initialMode);

  const changeMode = useCallback(
    async (nextMode: ApiMode) => {
      if (!import.meta.env.DEV) {
        throw new Error("API mode can only be changed in development.");
      }
      if (nextMode === mode) return;

      await activateApiMode(nextMode);
      window.localStorage.setItem(STORAGE_KEY, nextMode);
      setMode(nextMode);
    },
    [mode],
  );

  const value = useMemo(
    () => ({ mode, isLocalBackend: import.meta.env.DEV && mode === "backend", setMode: changeMode }),
    [changeMode, mode],
  );

  return <ApiModeContext.Provider value={value}>{children}</ApiModeContext.Provider>;
}

export function useApiMode(): ApiModeContextValue {
  const value = useContext(ApiModeContext);
  if (!value) throw new Error("useApiMode must be used inside ApiModeProvider");
  return value;
}
