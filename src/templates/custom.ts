import type { RecallTemplate } from "../utils/templateEngine";

const CUSTOM_TEMPLATE_KEY = "recall_custom_templates";

export function loadCustomTemplates(): RecallTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(isRecallTemplate)
      : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: RecallTemplate): RecallTemplate {
  const existing = loadCustomTemplates().filter((item) => item.id !== template.id);
  const updated = [{ ...template, category: "custom" as const }, ...existing].slice(0, 30);
  localStorage.setItem(CUSTOM_TEMPLATE_KEY, JSON.stringify(updated));
  return updated[0];
}

function isRecallTemplate(value: unknown): value is RecallTemplate {
  if (!value || typeof value !== "object") return false;
  const template = value as Partial<RecallTemplate>;
  return (
    typeof template.id === "string" &&
    typeof template.name === "string" &&
    typeof template.description === "string" &&
    typeof template.icon === "string" &&
    template.ir?.schema === "recall-graph-ir-v2"
  );
}
