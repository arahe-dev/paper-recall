import { useTheme, type ThemeName } from "../hooks/useTheme";

const OPTIONS: Array<{ value: ThemeName; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "tinted", label: "Tinted" },
];

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { activeTheme, setTheme } = useTheme();

  return (
    <div className={compact ? "theme-toggle compact" : "theme-toggle"} role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={activeTheme === option.value ? "active" : ""}
          aria-pressed={activeTheme === option.value}
          onClick={() => setTheme(option.value)}
        >
          {compact ? option.label.slice(0, 1) : option.label}
        </button>
      ))}
    </div>
  );
}
