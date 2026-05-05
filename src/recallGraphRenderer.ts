import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { RecallGraphIR } from "./recallGraphIR";
import { validateRecallGraphIR } from "./recallGraphIR";
import { computeLayout } from "./layoutEngine";
import { layoutToExcalidrawSkeleton } from "./excalidrawAdapter";
import { getPreset, type StylePreset } from "./stylePresets";
import {
  normalizeRecallDiagramSpec,
  recallDiagramSpecToGraphIR,
  type RecallDiagramSpecV0,
} from "./recallDiagramSpec";

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

export function renderRecallDiagramSpec(
  spec: RecallDiagramSpecV0,
  styleName?: string
): RenderResult & { graph?: RecallGraphIR; warnings?: string[] } {
  const normalization = normalizeRecallDiagramSpec(spec);
  if (!normalization.valid || !normalization.spec) {
    return {
      valid: false,
      errors: normalization.errors,
      warnings: normalization.warnings,
      elements: [],
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    };
  }
  const graph = recallDiagramSpecToGraphIR(normalization.spec);
  const result = renderRecallGraphIR(graph, styleName);
  return {
    ...result,
    graph,
    warnings: normalization.warnings,
  };
}

export { getPreset, type StylePreset };
export { validateRecallGraphIR, computeLayout, layoutToExcalidrawSkeleton };
export { normalizeRecallDiagramSpec, recallDiagramSpecToGraphIR, validateRecallDiagramSpec } from "./recallDiagramSpec";

/**
 * Export a Recall Graph IR as Mermaid-like text for debugging/inspection.
 * Recall IR remains canonical; this is a lossy human-readable view.
 */
export function exportToMermaid(graph: RecallGraphIR): string {
  const dir = graph.layout.direction || "TD";
  const strategy = graph.layout.strategy || "flowchart";
  const header = strategy === "tree" ? "graph" : "flowchart";
  const lines: string[] = [`${header} ${dir}`];

  // Node declarations with labels
  for (const n of graph.nodes) {
    const safeLabel = n.label.replace(/["\n]/g, " ");
    if (safeLabel !== n.id) {
      lines.push(`  ${n.id}["${safeLabel}"]`);
    }
  }

  // Groups / subgraphs
  if (graph.groups) {
    for (const g of graph.groups) {
      lines.push(`  subgraph ${g.id}["${g.label || g.id}"]`);
      for (const nid of g.node_ids) {
        lines.push(`    ${nid}`);
      }
      lines.push(`  end`);
    }
  }

  // Edges
  const edgeLines: string[] = [];
  for (const e of graph.edges) {
    let arrow = " --> ";
    if (e.relation === "dashed") arrow = " -.-> ";
    else if (e.relation === "thick") arrow = " ==> ";

    let line = `  ${e.from}${arrow}${e.to}`;
    if (e.label) {
      line += ` : "${e.label.replace(/["\n]/g, " ")}"`;
    }
    edgeLines.push(line);
  }
  lines.push(...edgeLines);

  return lines.join("\n");
}
