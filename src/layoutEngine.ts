import dagre from "dagre";
import type { RecallGraphAnnotation, RecallGraphGroup, RecallGraphIR, RecallGraphNode } from "./recallGraphIR";
import type { StylePreset } from "./stylePresets";

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  body?: string;
  kind?: string;
  level: number;
  children: string[];
  parent?: string;
}

export interface PositionedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind?: string;
  points?: { x: number; y: number }[];
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  groups?: PositionedGroup[];
  annotations?: PositionedAnnotation[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  strategy?: string;
  direction?: "TD" | "LR" | "BT" | "RL";
  childrenMap?: Map<string, string[]>;
}

export interface PositionedGroup {
  id: string;
  label?: string;
  nodeIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedAnnotation {
  id: string;
  text: string;
  kind?: string;
  targetIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

function estimateLines(text: string, maxWidthPx: number, fontSize: number): number {
  const avgCharWidth = fontSize * 0.55;
  const charsPerLine = Math.max(1, Math.floor(maxWidthPx / avgCharWidth));
  const words = text.split(/\s+/);
  let lines = 1;
  let currentLineChars = 0;
  for (const word of words) {
    const wordLen = word.length;
    if (currentLineChars + wordLen + (currentLineChars > 0 ? 1 : 0) > charsPerLine) {
      lines++;
      currentLineChars = wordLen;
    } else {
      currentLineChars += wordLen + (currentLineChars > 0 ? 1 : 0);
    }
  }
  return lines;
}

function computeNodeSize(node: RecallGraphNode, preset: StylePreset): { width: number; height: number } {
  const labelLines = estimateLines(node.label, preset.nodeMaxWidth - preset.nodePaddingHorizontal * 2, preset.fontSize);
  let bodyLines = 0;
  if (node.body) {
    bodyLines = estimateLines(node.body, preset.nodeMaxWidth - preset.nodePaddingHorizontal * 2, preset.fontSize);
  }
  const totalLines = labelLines + bodyLines;
  const textHeight = totalLines * preset.fontSize * preset.lineHeight;
  const height = Math.max(preset.nodeHeight, textHeight + preset.nodePaddingVertical * 2);

  let width: number;
  if (preset.compactWidth) {
    const textWidth = Math.max(
      estimateTextWidth(node.label, preset.fontSize),
      node.body ? estimateTextWidth(node.body, preset.fontSize) : 0
    );
    width = Math.max(preset.nodeMinWidth, Math.min(preset.nodeMaxWidth, textWidth + preset.nodePaddingHorizontal * 2));
  } else {
    width = preset.nodeWidth;
  }

  return { width, height };
}

function parseLayoutHint(hint: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!hint) return result;
  for (const part of hint.split(";")) {
    const [rawKey, ...rawValue] = part.split(":");
    const key = rawKey?.trim();
    const value = rawValue.join(":").trim();
    if (key && value) result[key] = value;
  }
  return result;
}

function sortChildren(
  children: string[],
  childrenOrder: Map<string, string[]>,
  nodeOrder: Map<string, number>
): string[] {
  const ordered = [...children];
  ordered.sort((a, b) => {
    // 1. Explicit children_order
    // Find first parent that has an explicit order list containing both
    for (const [, list] of childrenOrder) {
      const ia = list.indexOf(a);
      const ib = list.indexOf(b);
      if (ia !== -1 && ib !== -1) {
        return ia - ib;
      }
    }
    // 2. Node order field
    const oa = nodeOrder.get(a) ?? Infinity;
    const ob = nodeOrder.get(b) ?? Infinity;
    if (oa !== ob) return oa - ob;
    // 3. Stable fallback: id
    return a.localeCompare(b);
  });
  return ordered;
}

function buildTree(graph: RecallGraphIR): {
  roots: string[];
  childrenMap: Map<string, string[]>;
  parentMap: Map<string, string>;
  levels: Map<string, number>;
} {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const rawChildrenMap = new Map<string, string[]>();
  const allNodeIds = new Set(graph.nodes.map((n) => n.id));
  const nodeOrder = new Map<string, number>();
  for (const n of graph.nodes) {
    nodeOrder.set(n.id, n.order ?? Infinity);
  }

  for (const n of graph.nodes) {
    incoming.set(n.id, 0);
    outgoing.set(n.id, 0);
    rawChildrenMap.set(n.id, []);
  }

  for (const e of graph.edges) {
    if (!allNodeIds.has(e.from) || !allNodeIds.has(e.to)) continue;
    incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
    outgoing.set(e.from, (outgoing.get(e.from) || 0) + 1);
    const list = rawChildrenMap.get(e.from) || [];
    if (!list.includes(e.to)) {
      list.push(e.to);
      rawChildrenMap.set(e.from, list);
    }
  }

  // Build children_order map from explicit declaration
  const explicitChildrenOrder = new Map<string, string[]>();
  if (graph.children_order) {
    for (const [parentId, childList] of Object.entries(graph.children_order)) {
      if (allNodeIds.has(parentId)) {
        explicitChildrenOrder.set(
          parentId,
          childList.filter((id) => allNodeIds.has(id))
        );
      }
    }
  }

  // Sort all children arrays
  const childrenMap = new Map<string, string[]>();
  for (const [id, raw] of rawChildrenMap) {
    childrenMap.set(id, sortChildren(raw, explicitChildrenOrder, nodeOrder));
  }

  // Determine roots
  let roots: string[] = [];
  if (graph.layout.root_ids && graph.layout.root_ids.length > 0) {
    for (const rid of graph.layout.root_ids) {
      if (allNodeIds.has(rid)) roots.push(rid);
    }
  }
  if (roots.length === 0) {
    for (const [id, count] of incoming.entries()) {
      if (count === 0 && (outgoing.get(id) || 0) > 0) {
        roots.push(id);
      }
    }
  }
  if (roots.length === 0) {
    let best = "";
    let bestOut = -1;
    for (const [id, out] of outgoing.entries()) {
      if (out > bestOut) {
        bestOut = out;
        best = id;
      }
    }
    if (best) roots.push(best);
  }

  // Sort roots by order then id
  roots.sort((a, b) => {
    const oa = nodeOrder.get(a) ?? Infinity;
    const ob = nodeOrder.get(b) ?? Infinity;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  // Parent map: pick first edge for each child
  const parentMap = new Map<string, string>();
  for (const e of graph.edges) {
    if (!parentMap.has(e.to) && allNodeIds.has(e.from) && allNodeIds.has(e.to)) {
      parentMap.set(e.to, e.from);
    }
  }

  // Compute levels
  const rankPolicy = graph.layout.rank_policy || "from_root_depth";
  const levels = new Map<string, number>();

  if (rankPolicy === "explicit") {
    for (const n of graph.nodes) {
      levels.set(n.id, n.rank ?? 0);
    }
  } else {
    const queue: string[] = [...roots];
    for (const r of roots) levels.set(r, 0);
    const visited = new Set<string>(roots);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curLevel = levels.get(cur) || 0;
      for (const child of childrenMap.get(cur) || []) {
        if (!visited.has(child)) {
          visited.add(child);
          levels.set(child, curLevel + 1);
          queue.push(child);
        } else {
          levels.set(child, Math.max(levels.get(child) || 0, curLevel + 1));
        }
      }
    }

    for (const id of allNodeIds) {
      if (!levels.has(id)) {
        levels.set(id, 0);
        roots.push(id);
      }
    }
  }

  return { roots, childrenMap, parentMap, levels };
}

function isHubSpoke(roots: string[], childrenMap: Map<string, string[]>): boolean {
  if (roots.length !== 1) return false;
  const root = roots[0];
  const children = childrenMap.get(root) || [];
  if (children.length <= 3) return false;
  let leafCount = 0;
  for (const c of children) {
    const cc = childrenMap.get(c) || [];
    if (cc.length === 0) leafCount++;
  }
  return leafCount === children.length;
}

function layoutHubSpoke(
  graph: RecallGraphIR,
  preset: StylePreset,
  roots: string[],
  childrenMap: Map<string, string[]>
): LayoutResult {
  const rootId = roots[0];
  const rootNode = graph.nodes.find((n) => n.id === rootId)!;
  const rootSize = computeNodeSize(rootNode, preset);

  const positioned = new Map<string, PositionedNode>();
  const children = childrenMap.get(rootId) || [];

  const rootX = 0;
  const rootY = 0;
  positioned.set(rootId, {
    id: rootId,
    x: rootX - rootSize.width / 2,
    y: rootY - rootSize.height / 2,
    width: rootSize.width,
    height: rootSize.height,
    label: rootNode.label,
    body: rootNode.body,
    kind: rootNode.kind,
    level: 0,
    children,
  });

  const count = children.length;
  const startAngle = preset.hubSpokeAngleStart;
  const endAngle = preset.hubSpokeAngleStart + preset.hubSpokeAngleSpan;
  const angleSpan = Math.max(0.1, Math.abs(endAngle - startAngle));
  const isFullCircle = angleSpan >= Math.PI * 2 - 0.001;
  const childSizes = new Map<string, { width: number; height: number }>();
  let averageChildWidth = 0;
  for (const cid of children) {
    const cnode = graph.nodes.find((n) => n.id === cid)!;
    const csize = computeNodeSize(cnode, preset);
    childSizes.set(cid, csize);
    averageChildWidth += csize.width;
  }
  averageChildWidth = count > 0 ? averageChildWidth / count : preset.nodeWidth;
  const requiredArcRadius = count > 1
    ? ((averageChildWidth + preset.siblingSpacing * 1.5) * (isFullCircle ? count : count - 1)) / angleSpan
    : preset.hubRadius;
  const hubRadius = Math.max(preset.hubRadius, requiredArcRadius);
  const angleStep = count > 1 ? (endAngle - startAngle) / (isFullCircle ? count : count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const cid = children[i];
    const cnode = graph.nodes.find((n) => n.id === cid)!;
    const csize = childSizes.get(cid)!;
    const angle = count === 1 ? (startAngle + endAngle) / 2 : startAngle + i * angleStep;
    const cx = rootX + Math.cos(angle) * hubRadius;
    const cy = rootY - Math.sin(angle) * hubRadius;
    positioned.set(cid, {
      id: cid,
      x: cx - csize.width / 2,
      y: cy - csize.height / 2,
      width: csize.width,
      height: csize.height,
      label: cnode.label,
      body: cnode.body,
      kind: cnode.kind,
      level: 1,
      children: childrenMap.get(cid) || [],
      parent: rootId,
    });
  }

  for (const cid of children) {
    const cpos = positioned.get(cid)!;
    const gchildren = childrenMap.get(cid) || [];
    if (gchildren.length === 0) continue;
    let gx = cpos.x;
    let gy = cpos.y + cpos.height + preset.verticalSpacing;
    for (const gcid of gchildren) {
      const gcnode = graph.nodes.find((n) => n.id === gcid)!;
      const gcsize = computeNodeSize(gcnode, preset);
      positioned.set(gcid, {
        id: gcid,
        x: gx,
        y: gy,
        width: gcsize.width,
        height: gcsize.height,
        label: gcnode.label,
        body: gcnode.body,
        kind: gcnode.kind,
        level: 2,
        children: childrenMap.get(gcid) || [],
        parent: cid,
      });
      gx += gcsize.width + preset.siblingSpacing;
    }
  }

  const direction = graph.layout.direction || "TD";
  return finalizeLayout(graph, positioned, childrenMap, preset.siblingSpacing, direction);
}

function edgeListFromGraph(graph: RecallGraphIR): PositionedEdge[] {
  return [...graph.edges]
    .sort((a, b) => {
      const oa = a.order ?? Infinity;
      const ob = b.order ?? Infinity;
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    })
    .map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label,
      kind: e.relation,
    }));
}

function layoutTimeline(graph: RecallGraphIR, preset: StylePreset, childrenMap: Map<string, string[]>): LayoutResult {
  const positioned = new Map<string, PositionedNode>();
  const sorted = [...graph.nodes].sort((a, b) => {
    const oa = a.order ?? Infinity;
    const ob = b.order ?? Infinity;
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  });

  let x = 0;
  const y = 0;
  for (const node of sorted) {
    const size = computeNodeSize(node, preset);
    positioned.set(node.id, {
      id: node.id,
      x,
      y,
      width: Math.max(size.width, preset.nodeMinWidth),
      height: size.height,
      label: node.label,
      body: node.body,
      kind: node.kind,
      level: 0,
      children: childrenMap.get(node.id) || [],
    });
    x += Math.max(size.width, preset.nodeMinWidth) + preset.horizontalSpacing;
  }

  return finalizeManualLayout(graph, positioned, childrenMap, graph.layout.direction || "LR");
}

function layoutMatrix(graph: RecallGraphIR, preset: StylePreset, childrenMap: Map<string, string[]>): LayoutResult {
  const positioned = new Map<string, PositionedNode>();
  const sorted = [...graph.nodes].sort((a, b) => {
    const oa = a.order ?? Infinity;
    const ob = b.order ?? Infinity;
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  });

  const entries = sorted.map((node, index) => {
    const hint = parseLayoutHint(node.layout_hint);
    const fallbackColumnCount = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
    const row = Number.isFinite(Number(hint.row)) ? Number(hint.row) : Math.floor(index / fallbackColumnCount);
    const column = Number.isFinite(Number(hint.column)) ? Number(hint.column) : index % fallbackColumnCount;
    const size = computeNodeSize(node, preset);
    return { node, row, column, size };
  });

  const colWidths = new Map<number, number>();
  const rowHeights = new Map<number, number>();
  for (const entry of entries) {
    colWidths.set(entry.column, Math.max(colWidths.get(entry.column) || 0, entry.size.width));
    rowHeights.set(entry.row, Math.max(rowHeights.get(entry.row) || 0, entry.size.height));
  }
  const columns = [...colWidths.keys()].sort((a, b) => a - b);
  const rows = [...rowHeights.keys()].sort((a, b) => a - b);
  const xByColumn = new Map<number, number>();
  const yByRow = new Map<number, number>();
  let x = 0;
  for (const column of columns) {
    xByColumn.set(column, x);
    x += (colWidths.get(column) || preset.nodeWidth) + preset.horizontalSpacing;
  }
  let y = 0;
  for (const row of rows) {
    yByRow.set(row, y);
    y += (rowHeights.get(row) || preset.nodeHeight) + preset.verticalSpacing * 0.65;
  }

  for (const entry of entries) {
    const cellX = xByColumn.get(entry.column) || 0;
    const cellY = yByRow.get(entry.row) || 0;
    const cellW = colWidths.get(entry.column) || entry.size.width;
    const cellH = rowHeights.get(entry.row) || entry.size.height;
    positioned.set(entry.node.id, {
      id: entry.node.id,
      x: cellX + (cellW - entry.size.width) / 2,
      y: cellY + (cellH - entry.size.height) / 2,
      width: entry.size.width,
      height: entry.size.height,
      label: entry.node.label,
      body: entry.node.body,
      kind: entry.node.kind,
      level: entry.row,
      children: childrenMap.get(entry.node.id) || [],
    });
  }

  return finalizeManualLayout(graph, positioned, childrenMap, graph.layout.direction || "TD");
}

function layoutCycle(graph: RecallGraphIR, preset: StylePreset, childrenMap: Map<string, string[]>): LayoutResult {
  const positioned = new Map<string, PositionedNode>();
  const sorted = [...graph.nodes].sort((a, b) => {
    const oa = a.order ?? Infinity;
    const ob = b.order ?? Infinity;
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  });
  const count = sorted.length;
  const sizes = sorted.map((node) => computeNodeSize(node, preset));
  const avgWidth = sizes.reduce((sum, size) => sum + size.width, 0) / Math.max(1, sizes.length);
  const radius = Math.max(preset.hubRadius, (count * (avgWidth + preset.siblingSpacing)) / (Math.PI * 2));
  const cx = radius + preset.nodeMaxWidth;
  const cy = radius + preset.nodeMaxWidth;

  sorted.forEach((node, index) => {
    const size = sizes[index];
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
    const nx = cx + Math.cos(angle) * radius - size.width / 2;
    const ny = cy + Math.sin(angle) * radius - size.height / 2;
    positioned.set(node.id, {
      id: node.id,
      x: nx,
      y: ny,
      width: size.width,
      height: size.height,
      label: node.label,
      body: node.body,
      kind: node.kind,
      level: 0,
      children: childrenMap.get(node.id) || [],
    });
  });

  return finalizeManualLayout(graph, positioned, childrenMap, graph.layout.direction || "TD");
}

function rankdirFromDirection(direction: "TD" | "LR" | "BT" | "RL"): string {
  switch (direction) {
    case "LR": return "LR";
    case "RL": return "RL";
    case "BT": return "BT";
    default: return "TB";
  }
}

function layoutDagre(
  graph: RecallGraphIR,
  preset: StylePreset,
  _roots: string[],
  childrenMap: Map<string, string[]>,
  parentMap: Map<string, string>,
  levels: Map<string, number>
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  const dir = graph.layout.direction || "TD";
  const rankdir = rankdirFromDirection(dir);

  g.setGraph({
    rankdir,
    ranksep: preset.verticalSpacing + 20,
    nodesep: Math.max(10, preset.siblingSpacing * 0.5),
    edgesep: 8,
    marginx: preset.subtreeSpacing,
    marginy: preset.subtreeSpacing,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeSizes = new Map<string, { width: number; height: number }>();
  for (const n of graph.nodes) {
    const size = computeNodeSize(n, preset);
    nodeSizes.set(n.id, size);
    g.setNode(n.id, {
      width: size.width,
      height: size.height,
      label: n.label,
    });
  }

  for (const e of graph.edges) {
    g.setEdge(e.from, e.to, { weight: e.order ?? 1 });
  }

  dagre.layout(g);

  const positioned = new Map<string, PositionedNode>();
  for (const n of graph.nodes) {
    const dagreNode = g.node(n.id);
    const size = nodeSizes.get(n.id)!;
    positioned.set(n.id, {
      id: n.id,
      x: dagreNode.x - size.width / 2,
      y: dagreNode.y - size.height / 2,
      width: size.width,
      height: size.height,
      label: n.label,
      body: n.body,
      kind: n.kind,
      level: levels.get(n.id) || 0,
      children: childrenMap.get(n.id) || [],
      parent: parentMap.get(n.id),
    });
  }

  const edgeOrder = new Map<string, number>();
  for (const e of graph.edges) {
    edgeOrder.set(e.id, e.order ?? Infinity);
  }

  const edges: PositionedEdge[] = graph.edges
    .map((e) => {
      const dagreEdge = g.edge(e.from, e.to);
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        label: e.label,
        kind: e.relation,
        points: dagreEdge?.points || undefined,
      };
    })
    .sort((a, b) => {
      const oa = edgeOrder.get(a.id) ?? Infinity;
      const ob = edgeOrder.get(b.id) ?? Infinity;
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    });

  const nodes = Array.from(positioned.values());

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    nodes,
    edges,
    bounds: { minX, minY, maxX, maxY },
    strategy: graph.layout.strategy,
    direction: dir,
    childrenMap,
  };
}

function shiftSubtree(
  nodeId: string,
  shiftX: number,
  childrenMap: Map<string, string[]>,
  positioned: Map<string, PositionedNode>
) {
  const node = positioned.get(nodeId);
  if (!node) return;
  node.x += shiftX;
  for (const childId of childrenMap.get(nodeId) || []) {
    shiftSubtree(childId, shiftX, childrenMap, positioned);
  }
}

function resolveOverlaps(
  positioned: Map<string, PositionedNode>,
  childrenMap: Map<string, string[]>,
  minGap: number
) {
  const nodes = Array.from(positioned.values());
  const yTolerance = 2;

  let changed = true;
  let iterations = 0;
  const maxIterations = 200;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    const yGroups = new Map<number, PositionedNode[]>();
    for (const n of nodes) {
      const yKey = Math.round(n.y / yTolerance) * yTolerance;
      if (!yGroups.has(yKey)) yGroups.set(yKey, []);
      yGroups.get(yKey)!.push(n);
    }

    for (const [, group] of yGroups) {
      group.sort((a, b) => a.x - b.x);
      for (let i = 1; i < group.length; i++) {
        const left = group[i - 1];
        const right = group[i];
        const needed = left.x + left.width + minGap;
        if (right.x < needed) {
          const shift = needed - right.x;
          shiftSubtree(right.id, shift, childrenMap, positioned);
          changed = true;
        }
      }
    }
  }
}

function applyDirection(
  positioned: Map<string, PositionedNode>,
  direction: "TD" | "LR" | "BT" | "RL"
) {
  if (direction === "TD") return;

  const nodes = Array.from(positioned.values());
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  if (direction === "BT") {
    for (const n of nodes) {
      const bottom = n.y + n.height;
      const distFromTop = bottom - minY;
      n.y = maxY - distFromTop;
    }
  } else if (direction === "LR") {
    for (const n of nodes) {
      const oldX = n.x, oldY = n.y, oldW = n.width, oldH = n.height;
      n.x = oldY;
      n.y = oldX;
      n.width = oldH;
      n.height = oldW;
    }
  } else if (direction === "RL") {
    for (const n of nodes) {
      const oldX = n.x, oldY = n.y, oldW = n.width, oldH = n.height;
      const tx = oldY;
      const ty = oldX;
      const tw = oldH;
      const th = oldW;
      const tMaxX = maxY - minY + minX;
      n.x = tMaxX - (tx + tw) + minX;
      n.y = ty;
      n.width = tw;
      n.height = th;
    }
    let newMinX = Infinity;
    for (const n of nodes) newMinX = Math.min(newMinX, n.x);
    if (isFinite(newMinX) && newMinX !== 0) {
      for (const n of nodes) n.x -= newMinX;
    }
  }
}

function finalizeLayout(
  graph: RecallGraphIR,
  positioned: Map<string, PositionedNode>,
  childrenMap: Map<string, string[]>,
  minGap: number,
  direction: "TD" | "LR" | "BT" | "RL"
): LayoutResult {
  resolveOverlaps(positioned, childrenMap, minGap);
  applyDirection(positioned, direction);

  const nodes = Array.from(positioned.values());

  const edgeOrder = new Map<string, number>();
  for (const e of graph.edges) {
    edgeOrder.set(e.id, e.order ?? Infinity);
  }
  const edges: PositionedEdge[] = graph.edges
    .map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label,
      kind: e.relation,
    }))
    .sort((a, b) => {
      const oa = edgeOrder.get(a.id) ?? Infinity;
      const ob = edgeOrder.get(b.id) ?? Infinity;
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    });

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    nodes,
    edges,
    bounds: { minX, minY, maxX, maxY },
    strategy: graph.layout.strategy,
    direction: graph.layout.direction || "TD",
    childrenMap,
  };
}

function finalizeManualLayout(
  graph: RecallGraphIR,
  positioned: Map<string, PositionedNode>,
  childrenMap: Map<string, string[]>,
  direction: "TD" | "LR" | "BT" | "RL"
): LayoutResult {
  const nodes = Array.from(positioned.values());
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  return {
    nodes,
    edges: edgeListFromGraph(graph),
    bounds: { minX, minY, maxX, maxY },
    strategy: graph.layout.strategy,
    direction,
    childrenMap,
  };
}

function addDecorations(graph: RecallGraphIR, preset: StylePreset, result: LayoutResult): LayoutResult {
  const nodesById = new Map(result.nodes.map((node) => [node.id, node]));
  const padding = 24;
  const groups = (graph.groups || [])
    .map((group: RecallGraphGroup): PositionedGroup | null => {
      const members = group.node_ids.map((id) => nodesById.get(id)).filter((node): node is PositionedNode => Boolean(node));
      if (members.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of members) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      }
      return {
        id: group.id,
        label: group.label,
        nodeIds: group.node_ids,
        x: minX - padding,
        y: minY - padding - (group.label ? 24 : 0),
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + (group.label ? 24 : 0),
      };
    })
    .filter((group): group is PositionedGroup => Boolean(group))
    .sort((a, b) => a.id.localeCompare(b.id));

  const annotations = (graph.annotations || [])
    .slice()
    .sort((a, b) => {
      const oa = a.order ?? Infinity;
      const ob = b.order ?? Infinity;
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    })
    .map((annotation: RecallGraphAnnotation, index): PositionedAnnotation => {
      const width = Math.min(760, Math.max(260, estimateTextWidth(annotation.text, Math.max(13, preset.fontSize - 1)) + 32));
      const lines = estimateLines(annotation.text, width - 32, Math.max(13, preset.fontSize - 1));
      const height = Math.max(34, lines * Math.max(13, preset.fontSize - 1) * preset.lineHeight + 18);
      return {
        id: annotation.id,
        text: annotation.text,
        kind: annotation.kind,
        targetIds: annotation.target_ids || [],
        x: result.bounds.minX,
        y: result.bounds.maxY + preset.verticalSpacing * 0.45 + index * (height + 10),
        width,
        height,
      };
    });

  let minX = result.bounds.minX;
  let minY = result.bounds.minY;
  let maxX = result.bounds.maxX;
  let maxY = result.bounds.maxY;
  for (const group of groups) {
    minX = Math.min(minX, group.x);
    minY = Math.min(minY, group.y);
    maxX = Math.max(maxX, group.x + group.width);
    maxY = Math.max(maxY, group.y + group.height);
  }
  for (const annotation of annotations) {
    minX = Math.min(minX, annotation.x);
    minY = Math.min(minY, annotation.y);
    maxX = Math.max(maxX, annotation.x + annotation.width);
    maxY = Math.max(maxY, annotation.y + annotation.height);
  }

  return {
    ...result,
    ...(groups.length > 0 ? { groups } : {}),
    ...(annotations.length > 0 ? { annotations } : {}),
    bounds: { minX, minY, maxX, maxY },
  };
}

export function computeLayout(graph: RecallGraphIR, preset: StylePreset): LayoutResult {
  const { roots, childrenMap, parentMap, levels } = buildTree(graph);
  const strategy = graph.layout.strategy || "mixed";

  let result: LayoutResult;
  if (strategy === "timeline") {
    result = layoutTimeline(graph, preset, childrenMap);
  } else if (strategy === "matrix") {
    result = layoutMatrix(graph, preset, childrenMap);
  } else if (strategy === "cycle") {
    result = layoutCycle(graph, preset, childrenMap);
  } else if (strategy === "hub_spoke" || strategy === "radial" || isHubSpoke(roots, childrenMap)) {
    result = layoutHubSpoke(graph, preset, roots, childrenMap);
  } else {
    result = layoutDagre(graph, preset, roots, childrenMap, parentMap, levels);
  }

  return addDecorations(graph, preset, result);
}
