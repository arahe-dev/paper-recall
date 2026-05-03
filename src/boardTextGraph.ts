export type TextGraphNode = {
  id: string;
  label: string;
  body?: string;
  source_shape_id: string;
  source_text_ids: string[];
  shape_type: string;
  bounds: { x: number; y: number; width: number; height: number };
};

export type TextGraphEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  from_label: string;
  to_label: string;
  relation: "arrow";
  status: "bound_visual_relation" | "loose_inferred_relation";
  source_arrow_id: string;
  confidence: number;
};

export type UnresolvedArrow = {
  id: string;
  reason: string;
};

export type UngroupedText = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export type BoardTextGraph = {
  schema: "recall-board-text-graph-v0";
  summary: {
    active_element_count: number;
    deleted_element_count: number;
    node_count: number;
    edge_count: number;
    unresolved_arrow_count: number;
    ungrouped_text_count: number;
  };
  nodes: TextGraphNode[];
  edges: TextGraphEdge[];
  unresolved_arrows: UnresolvedArrow[];
  ungrouped_text: UngroupedText[];
};

type LooseEl = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  text?: string;
  containerId?: string | null;
  points?: readonly (readonly [number, number])[];
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  boundElements?: readonly { id: string; type: string }[] | null;
};

function pointToRectDist(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): number {
  const cx = Math.max(rx, Math.min(px, rx + rw));
  const cy = Math.max(ry, Math.min(py, ry + rh));
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function buildBoardTextGraph(elements: readonly LooseEl[]): BoardTextGraph {
  const active = elements.filter((el) => !el.isDeleted);
  const deleted = elements.filter((el) => el.isDeleted);

  const shapes = active.filter(
    (el) =>
      el.type === "rectangle" ||
      el.type === "ellipse" ||
      el.type === "diamond"
  );

  const texts = active.filter((el) => el.type === "text");
  const arrows = active.filter((el) => el.type === "arrow");

  const activeIds = new Set(active.map((el) => el.id));

  // --- Group text into shapes ---

  const shapeToTexts: Map<string, LooseEl[]> = new Map();
  const unmatchedTexts: LooseEl[] = [];

  // Rule 1: containerId on text element
  // Rule 2: boundElements on shape
  // Rule 3: geometry fallback

  const textIdsMatched = new Set<string>();

  for (const shape of shapes) {
    const matched: LooseEl[] = [];
    for (const t of texts) {
      if (textIdsMatched.has(t.id)) continue;
      // containerId
      if (t.containerId && t.containerId === shape.id) {
        matched.push(t);
        textIdsMatched.add(t.id);
        continue;
      }
      // boundElements reference
      if (
        shape.boundElements &&
        shape.boundElements.some((be) => be.id === t.id)
      ) {
        matched.push(t);
        textIdsMatched.add(t.id);
        continue;
      }
    }
    if (matched.length > 0) {
      shapeToTexts.set(shape.id, matched);
    }
  }

  // Geometry fallback for remaining unmatched texts
  for (const t of texts) {
    if (textIdsMatched.has(t.id)) continue;
    const cx = t.x + t.width / 2;
    const cy = t.y + t.height / 2;
    let found = false;
    for (const shape of shapes) {
      const left = shape.x;
      const right = shape.x + shape.width;
      const top = shape.y;
      const bottom = shape.y + shape.height;
      if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
        const list = shapeToTexts.get(shape.id) || [];
        list.push(t);
        shapeToTexts.set(shape.id, list);
        textIdsMatched.add(t.id);
        found = true;
        break;
      }
    }
    if (!found) {
      unmatchedTexts.push(t);
    }
  }

  // --- Build nodes ---

  const nodes: TextGraphNode[] = [];
  const shapeIdToNodeId = new Map<string, string>();

  for (const shape of shapes) {
    const matchedTexts = shapeToTexts.get(shape.id) || [];
    if (matchedTexts.length === 0) {
      // unlabeled shape – still create a node
      const nodeId = `node_${shape.id}`;
      nodes.push({
        id: nodeId,
        label: "[unlabeled shape]",
        source_shape_id: shape.id,
        source_text_ids: [],
        shape_type: shape.type,
        bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
      });
      shapeIdToNodeId.set(shape.id, nodeId);
      continue;
    }

    // sort texts by y then x
    matchedTexts.sort((a, b) => {
      const dy = a.y - b.y;
      return dy !== 0 ? dy : a.x - b.x;
    });

    const labelText = matchedTexts[0].text?.trim().replace(/\s+/g, " ") || "";
    const bodyLines: string[] = [];
    for (let i = 1; i < matchedTexts.length; i++) {
      const bt = matchedTexts[i].text?.trim() || "";
      if (bt) bodyLines.push(bt);
    }

    const nodeId = `node_${shape.id}`;
    const node: TextGraphNode = {
      id: nodeId,
      label: labelText || "[unlabeled shape]",
      source_shape_id: shape.id,
      source_text_ids: matchedTexts.map((t) => t.id),
      shape_type: shape.type,
      bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
    };
    if (bodyLines.length > 0) {
      node.body = bodyLines.join("\n");
    }
    nodes.push(node);
    shapeIdToNodeId.set(shape.id, nodeId);
  }

  // --- Parse arrows ---

  const edges: TextGraphEdge[] = [];
  const unresolvedArrows: UnresolvedArrow[] = [];
  let edgeCounter = 0;

  function nearestShapeId(
    px: number,
    py: number,
    excludeId?: string
  ): string | null {
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const shape of shapes) {
      if (shape.id === excludeId) continue;
      // Prefer containment (distance 0 = inside)
      const d = pointToRectDist(px, py, shape.x, shape.y, shape.width, shape.height);
      const inside =
        px >= shape.x &&
        px <= shape.x + shape.width &&
        py >= shape.y &&
        py <= shape.y + shape.height;
      const effective = inside ? d * 0.1 : d;
      if (effective < bestDist) {
        bestDist = effective;
        bestId = shape.id;
      }
    }
    return bestId;
  }

  function arrowEndpoint(
    arrow: LooseEl,
    isEnd: boolean
  ): { px: number; py: number } | null {
    if (arrow.points && arrow.points.length > 0) {
      const idx = isEnd ? arrow.points.length - 1 : 0;
      const pt = arrow.points[idx];
      return { px: arrow.x + pt[0], py: arrow.y + pt[1] };
    }
    // fallback: use element center edge
    if (isEnd) {
      return { px: arrow.x + arrow.width, py: arrow.y + arrow.height / 2 };
    }
    return { px: arrow.x, py: arrow.y + arrow.height / 2 };
  }

  for (const arrow of arrows) {
    const sb = arrow.startBinding;
    const eb = arrow.endBinding;
    const sbValid = sb ? activeIds.has(sb.elementId) : false;
    const ebValid = eb ? activeIds.has(eb.elementId) : false;

    let fromNode: string | null = null;
    let toNode: string | null = null;
    const fromShapeId = sbValid ? sb!.elementId : null;
    const toShapeId = ebValid ? eb!.elementId : null;

    if (fromShapeId && shapeIdToNodeId.has(fromShapeId)) {
      fromNode = shapeIdToNodeId.get(fromShapeId)!;
    }
    if (toShapeId && shapeIdToNodeId.has(toShapeId)) {
      toNode = shapeIdToNodeId.get(toShapeId)!;
    }

    // Fallback geometric inference for missing sides
    if (!fromNode || !toNode) {
      const startPt = arrowEndpoint(arrow, false);
      const endPt = arrowEndpoint(arrow, true);
      if (startPt && endPt) {
        if (!fromNode) {
          const ns = nearestShapeId(startPt.px, startPt.py, toShapeId || undefined);
          if (ns && shapeIdToNodeId.has(ns)) {
            fromNode = shapeIdToNodeId.get(ns)!;
          }
        }
        if (!toNode) {
          const ns = nearestShapeId(endPt.px, endPt.py, fromShapeId || undefined);
          if (ns && shapeIdToNodeId.has(ns)) {
            toNode = shapeIdToNodeId.get(ns)!;
          }
        }
      }
    }

    if (fromNode && toNode && fromNode !== toNode) {
      const fromN = nodes.find((n) => n.id === fromNode);
      const toN = nodes.find((n) => n.id === toNode);
      const bound = sbValid && ebValid;
      edgeCounter++;
      edges.push({
        id: `edge_${String(edgeCounter).padStart(3, "0")}`,
        from_node_id: fromNode,
        to_node_id: toNode,
        from_label: fromN?.label || "",
        to_label: toN?.label || "",
        relation: "arrow",
        status: bound ? "bound_visual_relation" : "loose_inferred_relation",
        source_arrow_id: arrow.id,
        confidence: bound ? 1.0 : 0.7,
      });
    } else if (fromNode && toNode && fromNode === toNode) {
      unresolvedArrows.push({
        id: arrow.id,
        reason: "Arrow appears to loop back to the same node (self-loop).",
      });
    } else {
      const reason = fromNode
        ? "Could not resolve target endpoint to any node."
        : toNode
          ? "Could not resolve source endpoint to any node."
          : "Could not resolve either endpoint to any node.";
      unresolvedArrows.push({ id: arrow.id, reason });
    }
  }

  // --- Ungrouped text ---

  const ungroupedText: UngroupedText[] = unmatchedTexts.map((t) => ({
    id: t.id,
    text: t.text?.trim() || "",
    x: t.x,
    y: t.y,
  }));

  return {
    schema: "recall-board-text-graph-v0",
    summary: {
      active_element_count: active.length,
      deleted_element_count: deleted.length,
      node_count: nodes.length,
      edge_count: edges.length,
      unresolved_arrow_count: unresolvedArrows.length,
      ungrouped_text_count: ungroupedText.length,
    },
    nodes,
    edges,
    unresolved_arrows: unresolvedArrows,
    ungrouped_text: ungroupedText,
  };
}
