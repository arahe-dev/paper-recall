import type { LayoutResult } from "./layoutEngine";
import type { StylePreset } from "./stylePresets";

// Local compatible skeleton type since ExcalidrawElementSkeleton is not publicly exported
type Skeleton = Record<string, unknown> & { type: string; id?: string };

export function layoutToExcalidrawSkeleton(
  layout: LayoutResult,
  preset: StylePreset
): Skeleton[] {
  const elements: Skeleton[] = [];

  // Subtree background rectangles (behind nodes/arrows)
  if (preset.subtreeBackgroundOpacity > 0 && layout.childrenMap) {
    const allChildren = new Set<string>();
    for (const [, children] of layout.childrenMap) {
      for (const c of children) allChildren.add(c);
    }
    const roots = layout.nodes.filter((n) => !allChildren.has(n.id));
    const padding = 16;

    function collectSubtree(nodeId: string, set: Set<string>) {
      if (set.has(nodeId)) return;
      set.add(nodeId);
      for (const child of layout.childrenMap!.get(nodeId) || []) {
        collectSubtree(child, set);
      }
    }

    for (const root of roots) {
      const subtree = new Set<string>();
      collectSubtree(root.id, subtree);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of layout.nodes) {
        if (subtree.has(node.id)) {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x + node.width);
          maxY = Math.max(maxY, node.y + node.height);
        }
      }
      if (isFinite(minX)) {
        const bg: Skeleton = {
          type: "rectangle",
          id: `bg-subtree-${root.id}`,
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
          strokeColor: "transparent",
          backgroundColor: preset.subtreeBackgroundColor,
          fillStyle: "solid",
          strokeWidth: 0,
          roughness: 0,
          opacity: preset.subtreeBackgroundOpacity,
          roundness: { type: 1, value: preset.cornerRadius * 1.5 },
        };
        elements.push(bg);
      }
    }
  }

  // Create rectangles for nodes
  for (const node of layout.nodes) {
    const rect: Skeleton = {
      type: "rectangle",
      id: `rect-${node.id}`,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      strokeColor: preset.nodeStrokeColor,
      backgroundColor: preset.nodeBackgroundColor,
      fillStyle: preset.nodeFillStyle,
      strokeWidth: preset.nodeStrokeWidth,
      roughness: preset.nodeRoughness,
      opacity: preset.nodeOpacity,
      roundness: { type: 1, value: preset.cornerRadius },
      customData: {
        recallNodeId: node.id,
        recallLabel: node.label,
        ...(node.body ? { recallBody: node.body } : {}),
      },
      label: {
        text: node.body ? `${node.label}\n${node.body}` : node.label,
        fontSize: preset.fontSize,
        fontFamily: preset.fontFamily,
        textAlign: "center",
        verticalAlign: "middle",
      },
    };
    elements.push(rect);
  }

  const strategy = layout.strategy || "mixed";
  const useBusRouting = strategy === "tree" || strategy === "mixed";

  // Create arrows for edges
  for (const edge of layout.edges) {
    const fromNode = layout.nodes.find((n) => n.id === edge.from);
    const toNode = layout.nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) continue;

    let sourceX: number;
    let sourceY: number;
    let targetX: number;
    let targetY: number;
    let points: [number, number][];
    let width: number;
    let height: number;

    const isLeftReturningEdge =
      layout.direction === "LR" &&
      fromNode.x > toNode.x &&
      Math.abs((fromNode.y + fromNode.height / 2) - (toNode.y + toNode.height / 2)) < preset.verticalSpacing;

    if (isLeftReturningEdge) {
      sourceX = fromNode.x;
      sourceY = fromNode.y + fromNode.height / 2;
      targetX = toNode.x + toNode.width;
      targetY = toNode.y + toNode.height / 2;
      const laneY = Math.max(fromNode.y + fromNode.height, toNode.y + toNode.height) + preset.verticalSpacing * 0.75;
      const px = targetX - sourceX;
      const py = targetY - sourceY;
      const laneDy = laneY - sourceY;
      width = Math.abs(px);
      height = Math.abs(Math.max(py, laneDy) - Math.min(0, py, laneDy));
      points = [
        [0, 0],
        [0, laneDy],
        [px, laneDy],
        [px, py],
      ];
    } else if (edge.points && edge.points.length >= 2) {
      // Use dagre-computed edge points
      const pts = edge.points;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      sourceX = minX;
      sourceY = minY;
      width = maxX - minX;
      height = maxY - minY;
      points = pts.map((p) => [p.x - sourceX, p.y - sourceY] as [number, number]);
    } else {
      // Compute anchor points based on relative node positions
      const scx = fromNode.x + fromNode.width / 2;
      const scy = fromNode.y + fromNode.height / 2;
      const tcx = toNode.x + toNode.width / 2;
      const tcy = toNode.y + toNode.height / 2;
      const dx = tcx - scx;
      const dy = tcy - scy;

      if (Math.abs(dy) >= Math.abs(dx)) {
        if (dy >= 0) {
          sourceX = scx;
          sourceY = fromNode.y + fromNode.height;
          targetX = tcx;
          targetY = toNode.y;
        } else {
          sourceX = scx;
          sourceY = fromNode.y;
          targetX = tcx;
          targetY = toNode.y + toNode.height;
        }
      } else {
        if (dx >= 0) {
          sourceX = fromNode.x + fromNode.width;
          sourceY = scy;
          targetX = toNode.x;
          targetY = tcy;
        } else {
          sourceX = fromNode.x;
          sourceY = scy;
          targetX = toNode.x + toNode.width;
          targetY = tcy;
        }
      }

      const px = targetX - sourceX;
      const py = targetY - sourceY;
      width = Math.abs(px);
      height = Math.abs(py);

      if (useBusRouting && Math.abs(py) >= Math.abs(px) * 0.5) {
        const busOffset = preset.verticalSpacing * 0.4;
        const busY = py >= 0 ? busOffset : -busOffset;
        points = [
          [0, 0],
          [0, busY],
          [px, busY],
          [px, py],
        ];
      } else if (useBusRouting && Math.abs(px) >= Math.abs(py) * 0.5) {
        const busOffset = preset.horizontalSpacing * 0.4;
        const busX = px >= 0 ? busOffset : -busOffset;
        points = [
          [0, 0],
          [busX, 0],
          [busX, py],
          [px, py],
        ];
      } else {
        points = [[0, 0], [px, py]];
      }
    }

    const arrow: Skeleton = {
      type: "arrow",
      id: `arrow-${edge.id}`,
      x: sourceX,
      y: sourceY,
      width,
      height,
      strokeColor: preset.arrowColor,
      strokeWidth: preset.arrowStrokeWidth,
      points,
      start: {
        id: `rect-${fromNode.id}`,
        type: "rectangle",
      },
      end: {
        id: `rect-${toNode.id}`,
        type: "rectangle",
      },
      startBinding: {
        elementId: `rect-${fromNode.id}`,
        focus: 0,
        gap: preset.arrowStartGap,
      },
      endBinding: {
        elementId: `rect-${toNode.id}`,
        focus: 0,
        gap: preset.arrowEndGap,
      },
      endArrowhead: "arrow",
    };

    if (edge.label && edge.label.trim()) {
      (arrow as any).label = {
        text: edge.label,
        fontSize: Math.max(12, preset.fontSize - 2),
        fontFamily: preset.fontFamily,
      };
    }

    elements.push(arrow);
  }

  return elements;
}
