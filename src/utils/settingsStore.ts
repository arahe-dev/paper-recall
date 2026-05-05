export type ThemePreference = "dark" | "light" | "tinted" | "system";

export interface RecallSettings {
  theme: ThemePreference;
  autoSaveEnabled: boolean;
  autoSnapEnabled: boolean;
  snapConfidenceThreshold: number;
  defaultExportFormat: string;
}

const SETTINGS_KEY = "recall_settings";

const DEFAULT_SETTINGS: RecallSettings = {
  theme: "system",
  autoSaveEnabled: true,
  autoSnapEnabled: true,
  snapConfidenceThreshold: 0.7,
  defaultExportFormat: "excalidraw",
};

export function getSettings(): RecallSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return saveSettings(DEFAULT_SETTINGS);
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: RecallSettings): RecallSettings {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function updateSettings(patch: Partial<RecallSettings>): RecallSettings {
  return saveSettings({ ...getSettings(), ...patch });
}

function normalizeSettings(value: unknown): RecallSettings {
  const input = value && typeof value === "object" ? value as Partial<RecallSettings> : {};
  return {
    theme: input.theme === "dark" || input.theme === "light" || input.theme === "tinted" || input.theme === "system"
      ? input.theme
      : DEFAULT_SETTINGS.theme,
    autoSaveEnabled: typeof input.autoSaveEnabled === "boolean"
      ? input.autoSaveEnabled
      : DEFAULT_SETTINGS.autoSaveEnabled,
    autoSnapEnabled: typeof input.autoSnapEnabled === "boolean"
      ? input.autoSnapEnabled
      : DEFAULT_SETTINGS.autoSnapEnabled,
    snapConfidenceThreshold: typeof input.snapConfidenceThreshold === "number" &&
      Number.isFinite(input.snapConfidenceThreshold)
      ? Math.max(0.5, Math.min(0.95, input.snapConfidenceThreshold))
      : DEFAULT_SETTINGS.snapConfidenceThreshold,
    defaultExportFormat: typeof input.defaultExportFormat === "string" && input.defaultExportFormat.trim()
      ? input.defaultExportFormat
      : DEFAULT_SETTINGS.defaultExportFormat,
  };
}
