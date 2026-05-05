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
  label?: string;
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

export type RootNodeInsight = {
  node_id: string;
  label: string;
  reason: string;
  outgoing_edge_count: number;
  incoming_edge_count: number;
};

export type LeafNodeInsight = {
  node_id: string;
  label: string;
  reason: string;
  outgoing_edge_count: number;
  incoming_edge_count: number;
};

export type LowestConfidenceEdge = {
  id: string;
  plain_text: string;
  confidence: number;
  status: "bound_visual_relation" | "loose_inferred_relation";
};

export type GraphInsights = {
  likely_root_nodes: RootNodeInsight[];
  likely_leaf_nodes: LeafNodeInsight[];
  direct_branch_count: number;
  max_depth_estimate: number | null;
  has_unresolved_arrows: boolean;
  has_ungrouped_text: boolean;
  lowest_confidence_edge: LowestConfidenceEdge | null;
  relation_status_counts: {
    bound_visual_relation: number;
    loose_inferred_relation: number;
  };
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
  graph_insights: GraphInsights;
  plain_text_graph: string;
};

type LooseEl = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  customData?: Record<string, unknown>;
  isDeleted?: boolean;
  text?: string;
  containerId?: string | null;
  points?: readonly (readonly [number, number])[];
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  boundElements?: readonly { id: string; type: string }[] | null;
};

function isSemanticShape(el: LooseEl): boolean {
  if (!(el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")) {
    return false;
  }
  if (el.id.startsWith("bg-") || el.id.startsWith("bg-subtree-")) {
    return false;
  }
  if (el.strokeColor === "transparent" && !el.boundElements?.length) {
    return false;
  }
  return true;
}

function textLines(text: string | undefined): string[] {
  return (text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

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

  const arrows = active.filter((el) => el.type === "arrow");
  const arrowIds = new Set(arrows.map((el) => el.id));
  const shapes = active.filter(isSemanticShape);
  const texts = active.filter((el) => el.type === "text");
  const arrowLabelTexts = texts.filter((el) => el.containerId && arrowIds.has(el.containerId));
  const nodeTexts = texts.filter((el) => !(el.containerId && arrowIds.has(el.containerId)));

  const arrowLabels = new Map<string, string>();
  for (const text of arrowLabelTexts) {
    const label = textLines(text.text).join(" ");
    if (!label || !text.containerId) continue;
    const existing = arrowLabels.get(text.containerId);
    arrowLabels.set(text.containerId, existing ? `${existing} ${label}` : label);
  }

  const activeIds = new Set(active.map((el) => el.id));

  // --- Group text into shapes ---

  const shapeToTexts: Map<string, LooseEl[]> = new Map();
  const unmatchedTexts: LooseEl[] = [];
  const textIdsMatched = new Set<string>();

  for (const shape of shapes) {
    const matched: LooseEl[] = [];
    for (const t of nodeTexts) {
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

  for (const t of nodeTexts) {
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

    const recallLabel = shape.customData?.recallLabel;
    const recallBody = shape.customData?.recallBody;
    const firstTextLines = matchedTexts.length > 0 ? textLines(matchedTexts[0].text) : [];
    const labelText = typeof recallLabel === "string"
      ? recallLabel.trim().replace(/\s+/g, " ")
      : firstTextLines.length > 0
        ? (firstTextLines.join(" ").trim().replace(/\s+/g, " ") || "")
        : "";
    const bodyLines: string[] = [];
    if (typeof recallBody === "string" && recallBody.trim()) {
      bodyLines.push(recallBody.trim());
    } else if (typeof recallLabel !== "string" && matchedTexts.length > 1) {
      for (let i = 1; i < matchedTexts.length; i++) {
        for (const bt of textLines(matchedTexts[i].text)) {
          if (bt) bodyLines.push(bt);
        }
      }
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
      const edgeLabel = arrowLabels.get(arrow.id)?.trim();
      const plainText = edgeLabel
        ? `${fromLabel} connects to ${toLabel} (${edgeLabel})`
        : `${fromLabel} connects to ${toLabel}`;

      edges.push({
        id: `edge_${String(edgeCounter).padStart(3, "0")}`,
        from_node_id: fromNode,
        to_node_id: toNode,
        from_label: fromLabel,
        to_label: toLabel,
        ...(edgeLabel ? { label: edgeLabel } : {}),
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

  // --- Build graph_insights ---

  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();
  for (const n of nodes) {
    outgoingCount.set(n.id, 0);
    incomingCount.set(n.id, 0);
  }
  for (const e of edges) {
    outgoingCount.set(e.from_node_id, (outgoingCount.get(e.from_node_id) || 0) + 1);
    incomingCount.set(e.to_node_id, (incomingCount.get(e.to_node_id) || 0) + 1);
  }

  const likelyRootNodes: RootNodeInsight[] = [];
  const likelyLeafNodes: LeafNodeInsight[] = [];

  // Roots: nodes with outgoing > 0 and incoming === 0, ranked by outgoing desc
  const rootCandidates: { id: string; out: number; in: number }[] = [];
  for (const n of nodes) {
    const out = outgoingCount.get(n.id) || 0;
    const inn = incomingCount.get(n.id) || 0;
    if (out > 0 && inn === 0) {
      rootCandidates.push({ id: n.id, out, in: inn });
    }
  }
  rootCandidates.sort((a, b) => b.out - a.out);

  for (const rc of rootCandidates) {
    const node = nodes.find((n) => n.id === rc.id);
    likelyRootNodes.push({
      node_id: rc.id,
      label: node?.label || "?",
      reason: "highest outgoing edge count with no incoming edges",
      outgoing_edge_count: rc.out,
      incoming_edge_count: rc.in,
    });
  }

  // If no pure roots, fallback to highest outgoing overall
  if (likelyRootNodes.length === 0) {
    const allByOut = nodes
      .map((n) => ({ id: n.id, out: outgoingCount.get(n.id) || 0, in: incomingCount.get(n.id) || 0 }))
      .filter((x) => x.out > 0 || x.in > 0)
      .sort((a, b) => b.out - a.out);
    if (allByOut.length > 0) {
      const top = allByOut[0];
      const node = nodes.find((n) => n.id === top.id);
      likelyRootNodes.push({
        node_id: top.id,
        label: node?.label || "?",
        reason: top.in === 0
          ? "highest outgoing edge count with no incoming edges"
          : "highest outgoing edge count",
        outgoing_edge_count: top.out,
        incoming_edge_count: top.in,
      });
    }
  }

  // Leaves: incoming > 0 and outgoing === 0, ranked by incoming desc
  const leafCandidates: { id: string; out: number; in: number }[] = [];
  for (const n of nodes) {
    const out = outgoingCount.get(n.id) || 0;
    const inn = incomingCount.get(n.id) || 0;
    if (inn > 0 && out === 0) {
      leafCandidates.push({ id: n.id, out, in: inn });
    }
  }
  leafCandidates.sort((a, b) => b.in - a.in);

  for (const lc of leafCandidates) {
    const node = nodes.find((n) => n.id === lc.id);
    likelyLeafNodes.push({
      node_id: lc.id,
      label: node?.label || "?",
      reason: "has incoming edge(s) and no outgoing edges",
      outgoing_edge_count: lc.out,
      incoming_edge_count: lc.in,
    });
  }

  // Direct branch count: outgoing of top root
  const directBranchCount = likelyRootNodes.length > 0 ? likelyRootNodes[0].outgoing_edge_count : 0;

  // Max depth estimate: BFS from top root
  let maxDepth: number | null = null;
  if (likelyRootNodes.length > 0) {
    const rootId = likelyRootNodes[0].node_id;
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of edges) {
      const list = adj.get(e.from_node_id);
      if (list) list.push(e.to_node_id);
    }
    const visited = new Set<string>();
    const depth = new Map<string, number>();
    const queue: string[] = [rootId];
    visited.add(rootId);
    depth.set(rootId, 0);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curDepth = depth.get(cur) || 0;
      for (const next of adj.get(cur) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          depth.set(next, curDepth + 1);
          queue.push(next);
        }
      }
    }
    let maxD = 0;
    for (const d of depth.values()) {
      if (d > maxD) maxD = d;
    }
    maxDepth = maxD;
  }

  // Relation status counts
  let boundCount = 0;
  let looseCount = 0;
  for (const e of edges) {
    if (e.status === "bound_visual_relation") boundCount++;
    else looseCount++;
  }

  // Lowest confidence edge
  let lowestEdge: TextGraphEdge | null = null;
  for (const e of edges) {
    if (!lowestEdge || e.confidence < lowestEdge.confidence) {
      lowestEdge = e;
    }
  }
  const lowestConfidenceEdge: LowestConfidenceEdge | null = lowestEdge
    ? {
        id: lowestEdge.id,
        plain_text: lowestEdge.plain_text,
        confidence: lowestEdge.confidence,
        status: lowestEdge.status,
      }
    : null;

  const graph_insights: GraphInsights = {
    likely_root_nodes: likelyRootNodes,
    likely_leaf_nodes: likelyLeafNodes,
    direct_branch_count: directBranchCount,
    max_depth_estimate: maxDepth,
    has_unresolved_arrows: unresolvedArrows.length > 0,
    has_ungrouped_text: ungroupedText.length > 0,
    lowest_confidence_edge: lowestConfidenceEdge,
    relation_status_counts: {
      bound_visual_relation: boundCount,
      loose_inferred_relation: looseCount,
    },
  };

  // --- Build plain_text_graph ---

  const nodeList = nodes.map((n) => `- ${n.label}`).join("\n");
  const edgeList = edges.map((e) => `- ${e.plain_text}`).join("\n");
  const unresolvedList = unresolvedArrows.length > 0
    ? "\n## Unresolved Arrows\n" + unresolvedArrows.map((a) => `- ${a.id}: ${a.reason}`).join("\n")
    : "\n## Unresolved Arrows\n(none)";
  const ungroupedList = ungroupedText.length > 0
    ? "\n## Ungrouped Text\n" + ungroupedText.map((t) => `- ${t.text}`).join("\n")
    : "\n## Ungrouped Text\n(none)";

  const rootLine = likelyRootNodes.length > 0
    ? `- Likely root: ${likelyRootNodes[0].label} (${likelyRootNodes[0].outgoing_edge_count} outgoing, ${likelyRootNodes[0].incoming_edge_count} incoming)`
    : "- Likely root: none identified";
  const leafLines = likelyLeafNodes.length > 0
    ? "- Likely leaves:\n" + likelyLeafNodes.map((l) => `    - ${l.label}`).join("\n")
    : "- Likely leaves: none identified";
  const branchLine = `- Direct branches from root: ${directBranchCount}`;
  const depthLine = `- Max depth estimate: ${maxDepth !== null ? maxDepth : "N/A"}`;
  const statusLine = `- Relation statuses: ${boundCount} bound, ${looseCount} loose inferred`;
  const lowEdgeLine = lowestConfidenceEdge
    ? `- Lowest confidence edge: ${lowestConfidenceEdge.plain_text} (${lowestConfidenceEdge.confidence}, ${lowestConfidenceEdge.status})`
    : "- Lowest confidence edge: none";
  const unresolvedFlag = unresolvedArrows.length > 0 ? `- Unresolved arrows: ${unresolvedArrows.length}` : "- Unresolved arrows: none";
  const ungroupedFlag = ungroupedText.length > 0 ? `- Ungrouped text: ${ungroupedText.length} items` : "- Ungrouped text: none";

  const plain_text_graph = `# Board Text Graph

## Graph Insights
${rootLine}
${leafLines}
${branchLine}
${depthLine}
${statusLine}
${lowEdgeLine}
${unresolvedFlag}
${ungroupedFlag}

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
    graph_insights,
    plain_text_graph,
  };
}
