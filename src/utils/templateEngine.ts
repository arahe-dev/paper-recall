import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { buildBoardTextGraph } from "../boardTextGraph";
import type { LooseAppState, LooseElement } from "../exporters/types";
import type { RecallGraphIR } from "../recallGraphIR";
import { renderRecallGraphIR } from "../recallGraphRenderer";
import { currentMonthCalendarTemplateIr } from "../templates/calendar";
import { loadCustomTemplates, saveCustomTemplate } from "../templates/custom";
import { kwlTemplateIr } from "../templates/kwl";
import { swotTemplateIr } from "../templates/swot";

export interface RecallTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "analysis" | "planning" | "note-taking" | "custom";
  ir: RecallGraphIR;
  style?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type TemplateMetadata = {
  name: string;
  description?: string;
  icon?: string;
};

export const BUILT_IN_TEMPLATES: RecallTemplate[] = [
  {
    id: "kwl",
    name: "KWL Chart",
    description: "Track what you know, what you need to learn, and what you learned.",
    icon: "K",
    category: "note-taking",
    ir: kwlTemplateIr,
  },
  {
    id: "swot",
    name: "SWOT Analysis",
    description: "Map strengths, weaknesses, opportunities, and threats in a 2x2 matrix.",
    icon: "S",
    category: "analysis",
    ir: swotTemplateIr,
  },
  {
    id: "calendar_current_month",
    name: currentMonthCalendarTemplateIr.title,
    description: "Create a 7-column planning calendar for the current month.",
    icon: "C",
    category: "planning",
    ir: currentMonthCalendarTemplateIr,
  },
];

export function getAllTemplates(): RecallTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates()];
}

export function applyTemplate(template: RecallTemplate): ExcalidrawElement[] {
  const result = renderRecallGraphIR(template.ir, template.style);
  if (!result.valid) {
    throw new Error(result.errors.join("; "));
  }
  return result.elements;
}

export function saveAsTemplate(
  elements: readonly LooseElement[],
  _appState: LooseAppState,
  metadata: TemplateMetadata
): RecallTemplate {
  const graph = buildBoardTextGraph(elements);
  const nodes = graph.nodes.length > 0
    ? graph.nodes.map((node, index) => ({
      id: node.id.replace(/[^a-zA-Z0-9_-]/g, "_") || `node_${index + 1}`,
      label: node.label,
      body: node.body,
      order: index + 1,
    }))
    : [{
      id: "template_note",
      label: metadata.name || "Custom template",
      body: "Add structure here",
      order: 1,
    }];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges
    .map((edge, index) => ({
      id: edge.id.replace(/[^a-zA-Z0-9_-]/g, "_") || `edge_${index + 1}`,
      from: edge.from_node_id.replace(/[^a-zA-Z0-9_-]/g, "_"),
      to: edge.to_node_id.replace(/[^a-zA-Z0-9_-]/g, "_"),
      label: edge.label,
      order: index + 1,
    }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const now = Date.now();
  const template: RecallTemplate = {
    id: `custom_${now}`,
    name: metadata.name.trim() || "Custom Template",
    description: metadata.description?.trim() || "Saved from the current board.",
    icon: metadata.icon?.trim().slice(0, 2).toUpperCase() || "T",
    category: "custom",
    createdAt: now,
    updatedAt: now,
    ir: {
      schema: "recall-graph-ir-v2",
      title: metadata.name.trim() || "Custom Template",
      diagram_type: "concept_map",
      layout: {
        style: "readable_flowchart",
        strategy: edges.length > 0 ? "tree" : "mixed",
        direction: "LR",
        density: "readable",
      },
      nodes,
      edges,
    },
  };
  return saveCustomTemplate(template);
}

export { loadCustomTemplates };
