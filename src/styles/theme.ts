import { getSettings, type ThemePreference } from "../utils/settingsStore";

export type ThemeName = "dark" | "light" | "tinted";

type ThemeTokens = Record<`--${string}`, string>;

const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: {
    "--bg-root": "#111215",
    "--bg-panel": "#1b1d22",
    "--bg-panel-muted": "#20242b",
    "--bg-panel-hover": "#292d35",
    "--bg-panel-active": "#343945",
    "--bg-input": "#111318",
    "--bg-error": "#2a1a1a",
    "--bg-code": "#2a2a2a",
    "--bg-overlay": "rgba(0, 0, 0, 0.6)",
    "--canvas-bg": "#ffffff",
    "--border-subtle": "#30343d",
    "--border-panel": "#3d4350",
    "--border-strong": "#596274",
    "--border-danger": "#552222",
    "--text-primary": "#e0e0e0",
    "--text-secondary": "#c9d1d9",
    "--text-tertiary": "#aaaaaa",
    "--text-muted": "#888888",
    "--text-subtle": "#cccccc",
    "--text-soft": "#dddddd",
    "--text-danger": "#f87171",
    "--text-warning": "#fbbf24",
    "--text-success": "#34d399",
    "--text-success-strong": "#4ade80",
    "--text-unknown": "#9ca3af",
    "--color-accent": "#8ab4f8",
    "--color-transparent": "transparent",
    "--badge-success-bg": "rgba(34, 197, 94, 0.15)",
    "--badge-danger-bg": "rgba(239, 68, 68, 0.15)",
    "--badge-neutral-bg": "rgba(156, 163, 175, 0.15)",
    "--shadow-panel": "0 8px 24px rgba(0, 0, 0, 0.34)",
    "--glass-bg": "rgba(27, 29, 34, 0.82)",
    "--glass-border": "rgba(255, 255, 255, 0.1)",
    "--glass-highlight": "rgba(255, 255, 255, 0.1)",
    "--glass-shadow": "0 18px 42px rgba(0, 0, 0, 0.3)",
    "--glass-blur": "14px",
    "--glass-saturation": "150%",
  },
  light: {
    "--bg-root": "#f6f7f9",
    "--bg-panel": "#ffffff",
    "--bg-panel-muted": "#f1f3f5",
    "--bg-panel-hover": "#eef1f5",
    "--bg-panel-active": "#e2e7ee",
    "--bg-input": "#ffffff",
    "--bg-error": "#fff1f1",
    "--bg-code": "#eef1f5",
    "--bg-overlay": "rgba(15, 23, 42, 0.28)",
    "--canvas-bg": "#ffffff",
    "--border-subtle": "#d8dee6",
    "--border-panel": "#c9d1dc",
    "--border-strong": "#9aa8b7",
    "--border-danger": "#f5b5b5",
    "--text-primary": "#172033",
    "--text-secondary": "#334155",
    "--text-tertiary": "#64748b",
    "--text-muted": "#7b8794",
    "--text-subtle": "#475569",
    "--text-soft": "#334155",
    "--text-danger": "#dc2626",
    "--text-warning": "#b45309",
    "--text-success": "#047857",
    "--text-success-strong": "#15803d",
    "--text-unknown": "#64748b",
    "--color-accent": "#2563eb",
    "--color-transparent": "transparent",
    "--badge-success-bg": "rgba(22, 163, 74, 0.12)",
    "--badge-danger-bg": "rgba(220, 38, 38, 0.12)",
    "--badge-neutral-bg": "rgba(100, 116, 139, 0.14)",
    "--shadow-panel": "0 10px 28px rgba(15, 23, 42, 0.14)",
    "--glass-bg": "rgba(255, 255, 255, 0.78)",
    "--glass-border": "rgba(255, 255, 255, 0.55)",
    "--glass-highlight": "rgba(255, 255, 255, 0.8)",
    "--glass-shadow": "0 18px 45px rgba(15, 23, 42, 0.14)",
    "--glass-blur": "18px",
    "--glass-saturation": "180%",
  },
  tinted: {
    "--bg-root": "#111318",
    "--bg-panel": "#1b2028",
    "--bg-panel-muted": "#222936",
    "--bg-panel-hover": "#2b3442",
    "--bg-panel-active": "#354255",
    "--bg-input": "#111822",
    "--bg-error": "#301d22",
    "--bg-code": "#202733",
    "--bg-overlay": "rgba(5, 10, 18, 0.62)",
    "--canvas-bg": "#fbfbf7",
    "--border-subtle": "#303847",
    "--border-panel": "#435064",
    "--border-strong": "#607089",
    "--border-danger": "#6e3038",
    "--text-primary": "#f0f4f8",
    "--text-secondary": "#d4dce6",
    "--text-tertiary": "#a9b5c4",
    "--text-muted": "#8491a3",
    "--text-subtle": "#c6d0dd",
    "--text-soft": "#dbe4ef",
    "--text-danger": "#fb7185",
    "--text-warning": "#facc15",
    "--text-success": "#5eead4",
    "--text-success-strong": "#7dd3fc",
    "--text-unknown": "#c4b5fd",
    "--color-accent": "#7dd3fc",
    "--color-transparent": "transparent",
    "--badge-success-bg": "rgba(45, 212, 191, 0.16)",
    "--badge-danger-bg": "rgba(251, 113, 133, 0.14)",
    "--badge-neutral-bg": "rgba(196, 181, 253, 0.14)",
    "--shadow-panel": "0 10px 28px rgba(0, 0, 0, 0.38)",
    "--glass-bg": "rgba(27, 32, 40, 0.78)",
    "--glass-border": "rgba(125, 211, 252, 0.18)",
    "--glass-highlight": "rgba(255, 255, 255, 0.1)",
    "--glass-shadow": "0 18px 45px rgba(0, 0, 0, 0.34)",
    "--glass-blur": "18px",
    "--glass-saturation": "180%",
  },
};

const SHARED_TOKENS: ThemeTokens = {
  "--radius-sm": "10px",
  "--radius-md": "14px",
  "--radius-lg": "18px",
  "--radius-xl": "22px",
  "--transition-default": "180ms cubic-bezier(0.2, 0, 0, 1)",
  "--font-sans": "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
  "--font-mono": "ui-monospace, Consolas, monospace",
};

export function applyTheme(name: ThemeName): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const tokens = { ...SHARED_TOKENS, ...THEMES[name] };
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = name;
  root.style.colorScheme = name === "light" ? "light" : "dark";
}

export function initializeTheme(): void {
  if (typeof window === "undefined") return;
  applyTheme(resolveThemePreference(getSettings().theme));
}

export function resolveThemePreference(preference: ThemePreference): ThemeName {
  if (preference === "dark" || preference === "light" || preference === "tinted") {
    return preference;
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function excalidrawThemeFor(theme: ThemeName): "dark" | "light" {
  return theme === "light" ? "light" : "dark";
}

export function getThemeCanvasBackground(theme: ThemeName): string {
  return THEMES[theme]["--canvas-bg"];
}
