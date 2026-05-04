import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { RecallGraphIR } from "./recallGraphIR";
import { validateRecallGraphIR } from "./recallGraphIR";
import { computeLayout } from "./layoutEngine";
import { layoutToExcalidrawSkeleton } from "./excalidrawAdapter";
import { getPreset, type StylePreset } from "./stylePresets";

export interface RenderResult {
  valid: boolean;
  errors: string[];
  elements: ExcalidrawElement[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export function renderRecallGraphIR(
  graph: RecallGraphIR,
  styleName?: string
): RenderResult {
  const validation = validateRecallGraphIR(graph);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, elements: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  }

  const preset = getPreset(styleName || graph.layout.style || "readable_compact");
  const layout = computeLayout(graph, preset);
  const skeleton = layoutToExcalidrawSkeleton(layout, preset);
  const elements = convertToExcalidrawElements(skeleton as any, { regenerateIds: false });

  return {
    valid: true,
    errors: [],
    elements,
    bounds: layout.bounds,
  };
}

export { getPreset, type StylePreset };
export { validateRecallGraphIR, computeLayout, layoutToExcalidrawSkeleton };
