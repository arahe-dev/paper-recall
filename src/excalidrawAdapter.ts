import type { LayoutResult } from "./layoutEngine";
import type { StylePreset } from "./stylePresets";

// Local compatible skeleton type since ExcalidrawElementSkeleton is not publicly exported
type Skeleton = Record<string, unknown> & { type: string; id?: string };

export function layoutToExcalidrawSkeleton(
  layout: LayoutResult,
  preset: StylePreset
): Skeleton[] {
  const elements: Skeleton[] = [];
  const strategy = layout.strategy || "mixed";

  function nodeShapeType(node: { kind?: string }): "rectangle" | "diamond" {
    return node.kind === "decision" ? "diamond" : "rectangle";
  }

  function nodeVisualLabel(node: { label: string; body?: string }): string {
    if (strategy === "matrix" && node.body && node.body.includes(":")) {
      const separator = node.body.indexOf(":");
      return node.body.slice(separator + 1).trim();
    }
    return node.body ? `${node.label}\n${node.body}` : node.label;
  }

  // Group backgrounds are parse-back metadata carriers, not semantic nodes.
  for (const group of layout.groups || []) {
    elements.push({
      type: "rectangle",
      id: `group-${group.id}`,
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      strokeColor: "#8a8f98",
      backgroundColor: "#f3f5f7",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      opacity: 35,
      roundness: { type: 1, value: Math.max(6, preset.cornerRadius * 1.25) },
      customData: {
        recallEntityType: "group",
        recallGroupId: group.id,
        recallLabel: group.label || group.id,
        recallNodeIds: group.nodeIds,
        recallIgnoreInTextGraph: true,
      },
      ...(group.label ? {
        label: {
          text: group.label,
          fontSize: Math.max(12, preset.fontSize - 2),
          fontFamily: preset.fontFamily,
          textAlign: "left",
          verticalAlign: "top",
        },
      } : {}),
    });
  }

  for (const decoration of layout.decorations || []) {
    if (decoration.kind === "timeline_baseline" || decoration.kind === "timeline_tick") {
      elements.push({
        type: "rectangle",
        id: `decoration-${decoration.id}`,
        x: decoration.x,
        y: decoration.y,
        width: Math.max(1, decoration.width),
        height: Math.max(1, decoration.height),
        strokeColor: "#8a8f98",
        backgroundColor: "#8a8f98",
        fillStyle: "solid",
        strokeWidth: 0,
        roughness: 0,
        opacity: decoration.kind === "timeline_baseline" ? 45 : 65,
        customData: {
          recallEntityType: decoration.kind,
          recallIgnoreInTextGraph: true,
        },
      });
    } else if (decoration.kind === "matrix_grid") {
      elements.push({
        type: "rectangle",
        id: `decoration-${decoration.id}`,
        x: decoration.x,
        y: decoration.y,
        width: decoration.width,
        height: decoration.height,
        strokeColor: "#a8b0bb",
        backgroundColor: "#f8fafc",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        opacity: 30,
        roundness: { type: 1, value: Math.max(8, preset.cornerRadius) },
        customData: {
          recallEntityType: "matrix_grid",
          recallIgnoreInTextGraph: true,
        },
      });
    } else if (decoration.kind === "matrix_grid_line") {
      elements.push({
        type: "rectangle",
        id: `decoration-${decoration.id}`,
        x: decoration.x,
        y: decoration.y,
        width: Math.max(1, decoration.width),
        height: Math.max(1, decoration.height),
        strokeColor: "#c2c8d0",
        backgroundColor: "#c2c8d0",
        fillStyle: "solid",
        strokeWidth: 0,
        roughness: 0,
        opacity: 35,
        customData: {
          recallEntityType: "matrix_grid_line",
          recallIgnoreInTextGraph: true,
        },
      });
    } else {
      elements.push({
        type: "text",
        id: `decoration-${decoration.id}`,
        x: decoration.x,
        y: decoration.y,
        width: decoration.width,
        height: decoration.height,
        text: decoration.text || "",
        fontSize: Math.max(13, preset.fontSize - 1),
        fontFamily: preset.fontFamily,
        textAlign: decoration.kind === "matrix_row_header" ? "right" : "center",
        verticalAlign: "middle",
        strokeColor: "#4b5563",
        backgroundColor: "transparent",
        customData: {
          recallEntityType: decoration.kind,
          recallIgnoreInTextGraph: true,
        },
      });
    }
  }

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
          customData: {
            recallEntityType: "layout_background",
            recallIgnoreInTextGraph: true,
          },
        };
        elements.push(bg);
      }
    }
  }

  // Create shapes for nodes
  for (const node of layout.nodes) {
    const shapeType = nodeShapeType(node);
    const rect: Skeleton = {
      type: shapeType,
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
        recallEntityType: "node",
        recallNodeId: node.id,
        recallLabel: node.label,
        recallKind: node.kind || "node",
        ...(node.body ? { recallBody: node.body } : {}),
        ...(strategy === "matrix" ? { recallVisualLabel: nodeVisualLabel(node) } : {}),
      },
      label: {
        text: nodeVisualLabel(node),
        fontSize: preset.fontSize,
        fontFamily: preset.fontFamily,
        textAlign: "center",
        verticalAlign: "middle",
      },
    };
    elements.push(rect);
  }

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
    const isTopReturningEdge =
      layout.direction === "TD" &&
      strategy !== "hub_spoke" &&
      strategy !== "cycle" &&
      fromNode.y > toNode.y + toNode.height * 0.5;
    const isMatrixRowWrap =
      strategy === "matrix" &&
      fromNode.x > toNode.x + toNode.width * 0.5 &&
      Math.abs((fromNode.y + fromNode.height / 2) - (toNode.y + toNode.height / 2)) > preset.verticalSpacing * 0.35;

    if (isTopReturningEdge) {
      sourceX = fromNode.x + fromNode.width;
      sourceY = fromNode.y + fromNode.height / 2;
      targetX = toNode.x + toNode.width;
      targetY = toNode.y + toNode.height / 2;
      const laneX = Math.max(...layout.nodes.map((node) => node.x + node.width)) + preset.horizontalSpacing * 0.65;
      const px = targetX - sourceX;
      const py = targetY - sourceY;
      const laneDx = laneX - sourceX;
      width = Math.abs(Math.max(px, laneDx) - Math.min(0, px, laneDx));
      height = Math.abs(py);
      points = [
        [0, 0],
        [laneDx, 0],
        [laneDx, py],
        [px, py],
      ];
    } else if (isMatrixRowWrap) {
      sourceX = fromNode.x + fromNode.width / 2;
      sourceY = fromNode.y + fromNode.height;
      targetX = toNode.x + toNode.width / 2;
      targetY = toNode.y;
      const laneY = (sourceY + targetY) / 2;
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
    } else if (isLeftReturningEdge) {
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
        type: nodeShapeType(fromNode),
      },
      end: {
        id: `rect-${toNode.id}`,
        type: nodeShapeType(toNode),
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
      customData: {
        recallEntityType: "edge",
        recallEdgeId: edge.id,
        recallFromNodeId: edge.from,
        recallToNodeId: edge.to,
        recallLabel: edge.label || "",
        recallRelation: edge.kind || "related",
      },
    };

    if (edge.label && edge.label.trim()) {
      const labelledArrow = arrow as Skeleton & {
        label?: { text: string; fontSize: number; fontFamily: number };
      };
      labelledArrow.label = {
        text: edge.label,
        fontSize: Math.max(12, preset.fontSize - 2),
        fontFamily: preset.fontFamily,
      };
    }

    elements.push(arrow);
  }

  for (const annotation of layout.annotations || []) {
    elements.push({
      type: "text",
      id: `annotation-${annotation.id}`,
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
      text: annotation.text,
      fontSize: Math.max(13, preset.fontSize - 1),
      fontFamily: preset.fontFamily,
      textAlign: "left",
      verticalAlign: "top",
      strokeColor: "#2f3a45",
      backgroundColor: "transparent",
      customData: {
        recallEntityType: "annotation",
        recallAnnotationId: annotation.id,
        recallLabel: annotation.text,
        recallKind: annotation.kind || "note",
        recallTargetIds: annotation.targetIds,
        recallIgnoreInTextGraph: true,
      },
    });
  }

  return elements;
}
