export type TextGraphNode = {
  id: string;
  label: string;
  body?: string;
  source_shape_id?: string;
  source_text_ids: string[];
  shape_type?: string;
  bounds: { x: number; y: number; width: number; height: number };
};

export type TextGraphEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  from_label: string;
  to_label: string;
  direction: "from_to" | "to_from" | "undirected_or_unclear";
  relation: "arrow";
  status: "bound_visual_relation" | "loose_inferred_relation";
  source_arrow_id: string;
  confidence: number;
  plain_text: string;
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
  schema: "recall-board-text-graph-v1";
  summary: {
    total_element_count: number;
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
  plain_text_graph: string;
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
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number
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
    (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
  );
  const texts = active.filter((el) => el.type === "text");
  const arrows = active.filter((el) => el.type === "arrow");

  const activeIds = new Set(active.map((el) => el.id));

  // --- Group text into shapes ---

  const shapeToTexts: Map<string, LooseEl[]> = new Map();
  const unmatchedTexts: LooseEl[] = [];
  const textIdsMatched = new Set<string>();

  for (const shape of shapes) {
    const matched: LooseEl[] = [];
    for (const t of texts) {
      if (textIdsMatched.has(t.id)) continue;
      if (t.containerId && t.containerId === shape.id) {
        matched.push(t);
        textIdsMatched.add(t.id);
        continue;
      }
      if (shape.boundElements && shape.boundElements.some((be) => be.id === t.id)) {
        matched.push(t);
        textIdsMatched.add(t.id);
        continue;
      }
    }
    if (matched.length > 0) {
      shapeToTexts.set(shape.id, matched);
    }
  }

  for (const t of texts) {
    if (textIdsMatched.has(t.id)) continue;
    const cx = t.x + t.width / 2;
    const cy = t.y + t.height / 2;
    let found = false;
    for (const shape of shapes) {
      if (cx >= shape.x && cx <= shape.x + shape.width && cy >= shape.y && cy <= shape.y + shape.height) {
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

  // --- Build nodes from shapes ---

  const nodes: TextGraphNode[] = [];
  const idToNodeId = new Map<string, string>(); // shape ID or text element ID → node ID
  const textIdToParentNodeId = new Map<string, string>(); // text element ID → parent node ID

  for (const shape of shapes) {
    const matchedTexts = shapeToTexts.get(shape.id) || [];
    matchedTexts.sort((a, b) => { const d = a.y - b.y; return d !== 0 ? d : a.x - b.x; });

    const labelText = matchedTexts.length > 0
      ? (matchedTexts[0].text?.trim().replace(/\s+/g, " ") || "")
      : "";
    const bodyLines: string[] = [];
    for (let i = 1; i < matchedTexts.length; i++) {
      const bt = matchedTexts[i].text?.trim() || "";
      if (bt) bodyLines.push(bt);
    }

    const nodeId = `node_${shape.id}`;
    const node: TextGraphNode = {
      id: nodeId,
      label: labelText || `[unlabeled ${shape.type}]`,
      source_shape_id: shape.id,
      source_text_ids: matchedTexts.map((t) => t.id),
      shape_type: shape.type,
      bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
    };
    if (bodyLines.length > 0) node.body = bodyLines.join("\n");

    nodes.push(node);
    idToNodeId.set(shape.id, nodeId);
    for (const t of matchedTexts) {
      textIdToParentNodeId.set(t.id, nodeId);
      idToNodeId.set(t.id, nodeId);
    }
  }

  // --- Promote ungrouped text that is targeted by arrow bindings ---

  const textsPromoted = new Set<string>();

  function arrowEndpoint(arrow: LooseEl, isEnd: boolean): { px: number; py: number } | null {
    if (arrow.points && arrow.points.length > 0) {
      const idx = isEnd ? arrow.points.length - 1 : 0;
      const pt = arrow.points[idx];
      return { px: arrow.x + pt[0], py: arrow.y + pt[1] };
    }
    if (isEnd) return { px: arrow.x + arrow.width, py: arrow.y + arrow.height / 2 };
    return { px: arrow.x, py: arrow.y + arrow.height / 2 };
  }

  // First pass: collect text element IDs referenced by arrow bindings
  const referencedTextIds = new Set<string>();
  for (const arrow of arrows) {
    if (arrow.startBinding && !idToNodeId.has(arrow.startBinding.elementId) && activeIds.has(arrow.startBinding.elementId)) {
      referencedTextIds.add(arrow.startBinding.elementId);
    }
    if (arrow.endBinding && !idToNodeId.has(arrow.endBinding.elementId) && activeIds.has(arrow.endBinding.elementId)) {
      referencedTextIds.add(arrow.endBinding.elementId);
    }
  }

  for (const t of unmatchedTexts) {
    if (referencedTextIds.has(t.id)) {
      const nodeId = `node_${t.id}`;
      const label = (t.text?.trim().replace(/\s+/g, " ") || "").replace(/\n/g, " ");
      nodes.push({
        id: nodeId,
        label: label || "[unnamed text]",
        source_text_ids: [t.id],
        bounds: { x: t.x, y: t.y, width: t.width, height: t.height },
      });
      idToNodeId.set(t.id, nodeId);
      textsPromoted.add(t.id);
    }
  }

  const finalUngrouped = unmatchedTexts.filter((t) => !textsPromoted.has(t.id));
  const ungroupedText: UngroupedText[] = finalUngrouped.map((t) => ({
    id: t.id,
    text: t.text?.trim() || "",
    x: t.x,
    y: t.y,
  }));

  // --- Resolve arrows into edges ---

  const edges: TextGraphEdge[] = [];
  const unresolvedArrows: UnresolvedArrow[] = [];
  let edgeCounter = 0;

  function nearestShapeId(px: number, py: number, excludeId?: string): string | null {
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const shape of shapes) {
      if (shape.id === excludeId) continue;
      const d = pointToRectDist(px, py, shape.x, shape.y, shape.width, shape.height);
      const inside = px >= shape.x && px <= shape.x + shape.width && py >= shape.y && py <= shape.y + shape.height;
      if ((inside ? d * 0.1 : d) < bestDist) {
        bestDist = inside ? d * 0.1 : d;
        bestId = shape.id;
      }
    }
    // Also check promoted text element bounds
    for (const t of unmatchedTexts) {
      if (!textsPromoted.has(t.id)) continue;
      if (t.id === excludeId) continue;
      const d = pointToRectDist(px, py, t.x, t.y, t.width || 60, t.height || 20);
      if (d < bestDist) {
        bestDist = d;
        bestId = t.id;
      }
    }
    return bestId;
  }

  for (const arrow of arrows) {
    const sb = arrow.startBinding;
    const eb = arrow.endBinding;
    const sbValid = sb ? idToNodeId.has(sb.elementId) : false;
    const ebValid = eb ? idToNodeId.has(eb.elementId) : false;

    let fromNode: string | null = null;
    let toNode: string | null = null;
    const fromElId = sbValid ? sb!.elementId : null;
    const toElId = ebValid ? eb!.elementId : null;

    if (fromElId && idToNodeId.has(fromElId)) fromNode = idToNodeId.get(fromElId)!;
    if (toElId && idToNodeId.has(toElId)) toNode = idToNodeId.get(toElId)!;

    if (!fromNode || !toNode) {
      const startPt = arrowEndpoint(arrow, false);
      const endPt = arrowEndpoint(arrow, true);
      if (startPt && endPt) {
        if (!fromNode) {
          const ns = nearestShapeId(startPt.px, startPt.py, toElId || undefined);
          if (ns && idToNodeId.has(ns)) fromNode = idToNodeId.get(ns)!;
        }
        if (!toNode) {
          const ns = nearestShapeId(endPt.px, endPt.py, fromElId || undefined);
          if (ns && idToNodeId.has(ns)) toNode = idToNodeId.get(ns)!;
        }
      }
    }

    if (fromNode && toNode && fromNode !== toNode) {
      const fromN = nodes.find((n) => n.id === fromNode);
      const toN = nodes.find((n) => n.id === toNode);
      const bound = sbValid && ebValid;
      edgeCounter++;

      const fromLabel = fromN?.label || "?";
      const toLabel = toN?.label || "?";
      const plainText = `${fromLabel} connects to ${toLabel}`;

      edges.push({
        id: `edge_${String(edgeCounter).padStart(3, "0")}`,
        from_node_id: fromNode,
        to_node_id: toNode,
        from_label: fromLabel,
        to_label: toLabel,
        direction: "from_to",
        relation: "arrow",
        status: bound ? "bound_visual_relation" : "loose_inferred_relation",
        source_arrow_id: arrow.id,
        confidence: bound ? 1.0 : 0.75,
        plain_text: plainText,
      });
    } else if (fromNode && toNode && fromNode === toNode) {
      unresolvedArrows.push({ id: arrow.id, reason: "Arrow appears to loop back to the same node (self-loop)." });
    } else {
      const reason = fromNode
        ? "Could not resolve target endpoint to any node."
        : toNode
          ? "Could not resolve source endpoint to any node."
          : "Could not resolve either endpoint to any node.";
      unresolvedArrows.push({ id: arrow.id, reason });
    }
  }

  // --- Build plain_text_graph ---

  const nodeList = nodes.map((n) => `- ${n.label}`).join("\n");
  const edgeList = edges.map((e) => `- ${e.plain_text}`).join("\n");
  const unresolvedList = unresolvedArrows.length > 0
    ? "\n## Unresolved Arrows\n" + unresolvedArrows.map((a) => `- ${a.id}: ${a.reason}`).join("\n")
    : "\n## Unresolved Arrows\n(none)";
  const ungroupedList = ungroupedText.length > 0
    ? "\n## Ungrouped Text\n" + ungroupedText.map((t) => `- ${t.text}`).join("\n")
    : "\n## Ungrouped Text\n(none)";

  const plain_text_graph = `# Board Text Graph

## Nodes
${nodeList}

## Edges
${edgeList}
${unresolvedList}
${ungroupedList}`;

  return {
    schema: "recall-board-text-graph-v1",
    summary: {
      total_element_count: elements.length,
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
    plain_text_graph,
  };
}
