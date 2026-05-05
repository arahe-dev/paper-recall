import type { LooseElement } from "./types";

export function createAiContext(elements: readonly LooseElement[]) {
  const total_element_count_in_scene = elements.length;
  const activeElements = elements.filter((el) => !el.isDeleted);
  const deletedElements = elements.filter((el) => el.isDeleted);

  const activeIds = new Set(activeElements.map((el) => el.id));

  const shapes = activeElements.filter(
    (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
  );
  const texts = activeElements.filter((el) => el.type === "text");
  const arrows = activeElements.filter((el) => el.type === "arrow");

  const nodes = activeElements.map((el) => {
    const node: Record<string, unknown> = {
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
    };
    if (el.text !== undefined) {
      node.text = el.text;
    }
    if (el.boundElements !== undefined && el.boundElements !== null) {
      node.boundElements = el.boundElements;
    }
    if (el.startBinding !== undefined) {
      node.startBinding = el.startBinding;
    }
    if (el.endBinding !== undefined) {
      node.endBinding = el.endBinding;
    }
    return node;
  });

  const brokenBindingIds: string[] = [];

  const arrowRelations = arrows.map((arrow) => {
    const sb = arrow.startBinding;
    const eb = arrow.endBinding;
    const sbValid = sb ? activeIds.has(sb.elementId) : false;
    const ebValid = eb ? activeIds.has(eb.elementId) : false;

    if (sb && !sbValid) brokenBindingIds.push(arrow.id);
    if (eb && !ebValid) brokenBindingIds.push(arrow.id);

    let semantic_status: string;
    if ((sb && !sbValid) || (eb && !ebValid)) {
      semantic_status = "broken_visual_relation";
    } else if (sbValid || ebValid) {
      semantic_status = "bound_visual_relation";
    } else {
      semantic_status = "loose_visual_arrow";
    }

    return {
      id: arrow.id,
      startBinding: sb ?? null,
      endBinding: eb ?? null,
      semantic_status,
    };
  });

  const candidateGroupings: Array<Record<string, unknown>> = [];
  for (const text of texts) {
    const cx = text.x + text.width / 2;
    const cy = text.y + text.height / 2;
    for (const shape of shapes) {
      const left = shape.x;
      const right = shape.x + shape.width;
      const top = shape.y;
      const bottom = shape.y + shape.height;
      if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
        candidateGroupings.push({
          shape_id: shape.id,
          text_id: text.id,
          text_preview:
            (text.text ?? "").slice(0, 80) +
            ((text.text ?? "").length > 80 ? "..." : ""),
          confidence: 0.8,
          status: "candidate_grouping",
          recommended_action: "promote_to_semantic_card",
        });
      }
    }
  }

  const summary = {
    total_element_count_in_scene,
    active_element_count: activeElements.length,
    deleted_element_count: deletedElements.length,
    text_count: texts.length,
    arrow_count: arrows.length,
    rectangle_count: activeElements.filter((el) => el.type === "rectangle").length,
    ellipse_count: activeElements.filter((el) => el.type === "ellipse").length,
    diamond_count: activeElements.filter((el) => el.type === "diamond").length,
  };

  const diagnostics: Array<Record<string, unknown>> = [];
  if (brokenBindingIds.length > 0) {
    diagnostics.push({
      code: "binding_target_deleted",
      severity: "warning",
      message: "An active arrow is bound to a deleted/tombstoned element.",
      object_ids: Array.from(new Set(brokenBindingIds)),
    });
  }

  return {
    schema: "recall-ai-context-excalidraw-v0",
    screenshot_required: false,
    summary,
    policy: {
      deleted_elements: "excluded_from_ai_context_by_default",
      bound_arrow: "visual relation attached to elements",
      loose_arrow: "candidate relation only",
      text_and_shape: "candidate grouping only unless explicitly promoted",
    },
    excluded: {
      deleted_element_count: deletedElements.length,
      reason: "Deleted/tombstoned elements are ignored for AI understanding.",
    },
    nodes,
    arrow_relations: arrowRelations,
    candidate_groupings: candidateGroupings,
    diagnostics,
    instructions_for_ai: [
      "This context is a structured representation of an Excalidraw board.",
      "Deleted/tombstoned elements are excluded from AI context by default.",
      "Bound arrows indicate visual attachment, not confirmed semantic edges.",
      "Loose arrows are candidate relations requiring confirmation.",
      "Shape + text proximity groupings are candidate semantic cards.",
      "No screenshot is required; all spatial and structural data is included.",
    ],
  };
}

export function serializeAiContext(elements: readonly LooseElement[]): string {
  return JSON.stringify(createAiContext(elements), null, 2);
}
