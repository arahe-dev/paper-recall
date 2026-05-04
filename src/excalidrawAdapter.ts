import type { LayoutResult } from "./layoutEngine";
import type { StylePreset } from "./stylePresets";

// Local compatible skeleton type since ExcalidrawElementSkeleton is not publicly exported
type Skeleton = Record<string, unknown> & { type: string; id?: string };

export function layoutToExcalidrawSkeleton(
  layout: LayoutResult,
  preset: StylePreset
): Skeleton[] {
  const elements: Skeleton[] = [];

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
      label: {
        text: node.label,
        fontSize: preset.fontSize,
        fontFamily: preset.fontFamily,
        textAlign: "center",
        verticalAlign: "middle",
      },
    };
    elements.push(rect);
  }

  // Create arrows for edges
  for (const edge of layout.edges) {
    const fromNode = layout.nodes.find((n) => n.id === edge.from);
    const toNode = layout.nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) continue;

    // Compute anchor points based on relative node positions
    const scx = fromNode.x + fromNode.width / 2;
    const scy = fromNode.y + fromNode.height / 2;
    const tcx = toNode.x + toNode.width / 2;
    const tcy = toNode.y + toNode.height / 2;
    const dx = tcx - scx;
    const dy = tcy - scy;

    let sourceX: number;
    let sourceY: number;
    let targetX: number;
    let targetY: number;

    if (Math.abs(dy) >= Math.abs(dx)) {
      // Mostly vertical
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
      // Mostly horizontal
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
    const width = Math.abs(px);
    const height = Math.abs(py);

    const arrow: Skeleton = {
      type: "arrow",
      id: `arrow-${edge.id}`,
      x: sourceX,
      y: sourceY,
      width,
      height,
      strokeColor: preset.arrowColor,
      strokeWidth: preset.arrowStrokeWidth,
      points: [
        [0, 0],
        [px, py],
      ],
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
