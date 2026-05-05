import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  excalidrawThemeFor,
  getThemeCanvasBackground,
  resolveThemePreference,
  type ThemeName,
} from "../styles/theme";
import { getSettings, updateSettings, type ThemePreference } from "../utils/settingsStore";

type ThemeContextValue = {
  preference: ThemePreference;
  activeTheme: ThemeName;
  excalidrawTheme: "dark" | "light";
  canvasBackgroundColor: string;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => getSettings().theme);
  const [systemTheme, setSystemTheme] = useState<ThemeName>(() => resolveThemePreference("system"));
  const activeTheme = preference === "system" ? systemTheme : resolveThemePreference(preference);

  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!media) return;
    const handleChange = () => {
      setSystemTheme(resolveThemePreference("system"));
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setPreference(theme);
    updateSettings({ theme });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    activeTheme,
    excalidrawTheme: excalidrawThemeFor(activeTheme),
    canvasBackgroundColor: getThemeCanvasBackground(activeTheme),
    setTheme,
  }), [activeTheme, preference, setTheme]);

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export type { ThemeName };
