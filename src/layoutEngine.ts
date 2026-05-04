import type { RecallGraphIR, RecallGraphNode } from "./recallGraphIR";
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
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
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
  const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const cid = children[i];
    const cnode = graph.nodes.find((n) => n.id === cid)!;
    const csize = computeNodeSize(cnode, preset);
    const angle = count === 1 ? (startAngle + endAngle) / 2 : startAngle + i * angleStep;
    const cx = rootX + Math.cos(angle) * preset.hubRadius;
    const cy = rootY - Math.sin(angle) * preset.hubRadius;
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

function layoutHierarchical(
  graph: RecallGraphIR,
  preset: StylePreset,
  roots: string[],
  childrenMap: Map<string, string[]>,
  parentMap: Map<string, string>,
  levels: Map<string, number>
): LayoutResult {
  const positioned = new Map<string, PositionedNode>();
  const nodeSizes = new Map<string, { width: number; height: number }>();

  for (const n of graph.nodes) {
    nodeSizes.set(n.id, computeNodeSize(n, preset));
  }

  const subtreeWidth = new Map<string, number>();

  function computeSubtreeWidth(nodeId: string): number {
    if (subtreeWidth.has(nodeId)) return subtreeWidth.get(nodeId)!;
    const size = nodeSizes.get(nodeId)!;
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) {
      subtreeWidth.set(nodeId, size.width);
      return size.width;
    }
    let childrenWidth = 0;
    const maxPerRow = preset.maxChildrenPerRow;
    if (maxPerRow > 0 && children.length > maxPerRow) {
      const rows = Math.ceil(children.length / maxPerRow);
      let maxRowWidth = 0;
      for (let r = 0; r < rows; r++) {
        let rowWidth = 0;
        const start = r * maxPerRow;
        const end = Math.min(start + maxPerRow, children.length);
        for (let i = start; i < end; i++) {
          rowWidth += computeSubtreeWidth(children[i]);
          if (i < end - 1) rowWidth += preset.siblingSpacing;
        }
        if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
      }
      childrenWidth = maxRowWidth;
    } else {
      for (let i = 0; i < children.length; i++) {
        childrenWidth += computeSubtreeWidth(children[i]);
        if (i < children.length - 1) childrenWidth += preset.siblingSpacing;
      }
    }
    const width = Math.max(size.width, childrenWidth);
    subtreeWidth.set(nodeId, width);
    return width;
  }

  for (const root of roots) {
    computeSubtreeWidth(root);
  }

  function assignPositions(nodeId: string, x: number, y: number) {
    const size = nodeSizes.get(nodeId)!;
    const children = childrenMap.get(nodeId) || [];
    const stw = subtreeWidth.get(nodeId)!;

    const nodeX = x + (stw - size.width) / 2;
    const nodeY = y;

    positioned.set(nodeId, {
      id: nodeId,
      x: nodeX,
      y: nodeY,
      width: size.width,
      height: size.height,
      label: graph.nodes.find((n) => n.id === nodeId)!.label,
      body: graph.nodes.find((n) => n.id === nodeId)!.body,
      kind: graph.nodes.find((n) => n.id === nodeId)!.kind,
      level: levels.get(nodeId) || 0,
      children,
      parent: parentMap.get(nodeId),
    });

    if (children.length > 0) {
      const maxPerRow = preset.maxChildrenPerRow;
      if (maxPerRow > 0 && children.length > maxPerRow) {
        const rows = Math.ceil(children.length / maxPerRow);
        let currentY = y + size.height + preset.verticalSpacing;
        for (let r = 0; r < rows; r++) {
          const start = r * maxPerRow;
          const end = Math.min(start + maxPerRow, children.length);
          let rowWidth = 0;
          for (let i = start; i < end; i++) {
            rowWidth += subtreeWidth.get(children[i])!;
            if (i < end - 1) rowWidth += preset.siblingSpacing;
          }
          let childX = x + (stw - rowWidth) / 2;
          let maxRowHeight = 0;
          for (let i = start; i < end; i++) {
            const child = children[i];
            const cw = subtreeWidth.get(child)!;
            assignPositions(child, childX, currentY);
            childX += cw + preset.siblingSpacing;
            const ch = nodeSizes.get(child)!.height;
            if (ch > maxRowHeight) maxRowHeight = ch;
          }
          currentY += maxRowHeight + preset.verticalSpacing;
        }
      } else {
        let childX = x;
        const childY = y + size.height + preset.verticalSpacing;
        for (const child of children) {
          const cw = subtreeWidth.get(child)!;
          assignPositions(child, childX, childY);
          childX += cw + preset.siblingSpacing;
        }
      }
    }
  }

  let currentX = preset.subtreeSpacing;
  for (const root of roots) {
    const rootY = preset.subtreeSpacing;
    assignPositions(root, currentX, rootY);
    currentX += subtreeWidth.get(root)! + preset.horizontalSpacing + preset.subtreeSpacing;
  }

  const direction = graph.layout.direction || "TD";
  return finalizeLayout(graph, positioned, childrenMap, preset.siblingSpacing, direction);
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
      // Transpose then mirror horizontally
      const tx = oldY;
      const ty = oldX;
      const tw = oldH;
      const th = oldW;
      // Mirror horizontally around the transposed bounds
      const tMaxX = maxY - minY + minX; // approximate
      n.x = tMaxX - (tx + tw) + minX;
      n.y = ty;
      n.width = tw;
      n.height = th;
    }
    // After RL, shift everything to start near 0
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

  // Sort edges by explicit order if present
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
  };
}

export function computeLayout(graph: RecallGraphIR, preset: StylePreset): LayoutResult {
  const { roots, childrenMap, parentMap, levels } = buildTree(graph);

  if (isHubSpoke(roots, childrenMap)) {
    return layoutHubSpoke(graph, preset, roots, childrenMap);
  }

  return layoutHierarchical(graph, preset, roots, childrenMap, parentMap, levels);
}
