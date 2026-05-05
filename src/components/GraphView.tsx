import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { BoardMeta } from "../utils/boardStorage";
import type { LinkEntry } from "../utils/linkEngine";

type GraphViewProps = {
  boards: BoardMeta[];
  links: LinkEntry[];
  currentBoardId?: string;
  onOpenBoard: (boardId: string, path?: string) => void;
};

type GraphNode = SimulationNodeDatum & {
  id: string;
  name: string;
  path?: string;
};

type GraphLink = SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
};

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 420;
const NODE_RADIUS = 24;

export default function GraphView({ boards, links, currentBoardId, onOpenBoard }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const graph = useMemo(() => {
    const boardById = new Map<string, BoardMeta>();
    for (const board of boards) boardById.set(board.id, board);

    for (const link of links) {
      if (!boardById.has(link.sourceBoardId)) {
        boardById.set(link.sourceBoardId, {
          id: link.sourceBoardId,
          name: link.sourceBoardName || link.sourceBoardId,
          path: link.sourceBoardPath,
          lastModified: 0,
          elementCount: 0,
        });
      }
      if (!boardById.has(link.targetBoardId)) {
        boardById.set(link.targetBoardId, {
          id: link.targetBoardId,
          name: link.targetBoardName || link.targetBoardId,
          path: link.targetBoardPath,
          lastModified: 0,
          elementCount: 0,
        });
      }
    }

    const nodes: GraphNode[] = Array.from(boardById.values()).map((board, index) => ({
      id: board.id,
      name: board.name,
      path: board.path,
      x: CANVAS_WIDTH / 2 + Math.cos(index) * 80,
      y: CANVAS_HEIGHT / 2 + Math.sin(index) * 80,
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const graphLinks: GraphLink[] = links
      .filter((link) => nodeIds.has(link.sourceBoardId) && nodeIds.has(link.targetBoardId))
      .map((link) => ({
        source: link.sourceBoardId,
        target: link.targetBoardId,
      }));

    const simulation = forceSimulation(nodes)
      .force("link", forceLink<GraphNode, GraphLink>(graphLinks).id((node) => node.id).distance(118).strength(0.6))
      .force("charge", forceManyBody().strength(-280))
      .force("collide", forceCollide<GraphNode>().radius(48))
      .force("center", forceCenter(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2))
      .stop();

    for (let i = 0; i < 180; i++) simulation.tick();
    return { nodes, links: graphLinks };
  }, [boards, links]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const style = getComputedStyle(document.documentElement);
    const panel = style.getPropertyValue("--bg-panel").trim();
    const border = style.getPropertyValue("--border-panel").trim();
    const text = style.getPropertyValue("--text-primary").trim();
    const muted = style.getPropertyValue("--text-muted").trim();
    const accent = style.getPropertyValue("--color-accent").trim();
    const active = style.getPropertyValue("--bg-panel-active").trim();

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.save();
    context.lineWidth = 2;

    for (const link of graph.links) {
      const source = typeof link.source === "string" ? null : link.source;
      const target = typeof link.target === "string" ? null : link.target;
      if (!source || !target) continue;
      context.strokeStyle = border;
      context.beginPath();
      context.moveTo(source.x || 0, source.y || 0);
      context.lineTo(target.x || 0, target.y || 0);
      context.stroke();

      const angle = Math.atan2((target.y || 0) - (source.y || 0), (target.x || 0) - (source.x || 0));
      const arrowX = (target.x || 0) - Math.cos(angle) * NODE_RADIUS;
      const arrowY = (target.y || 0) - Math.sin(angle) * NODE_RADIUS;
      context.fillStyle = border;
      context.beginPath();
      context.moveTo(arrowX, arrowY);
      context.lineTo(arrowX - Math.cos(angle - 0.45) * 10, arrowY - Math.sin(angle - 0.45) * 10);
      context.lineTo(arrowX - Math.cos(angle + 0.45) * 10, arrowY - Math.sin(angle + 0.45) * 10);
      context.closePath();
      context.fill();
    }

    for (const node of graph.nodes) {
      const isCurrent = node.id === currentBoardId;
      const isHovered = node.id === hoveredId;
      context.fillStyle = isCurrent || isHovered ? active : panel;
      context.strokeStyle = isCurrent || isHovered ? accent : border;
      context.lineWidth = isCurrent ? 3 : 2;
      context.beginPath();
      context.arc(node.x || 0, node.y || 0, NODE_RADIUS, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = isCurrent ? accent : text;
      context.font = "600 12px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      const shortName = node.name.length > 18 ? `${node.name.slice(0, 17)}...` : node.name;
      context.fillText(shortName, node.x || 0, (node.y || 0) + NODE_RADIUS + 18);
      context.fillStyle = muted;
      context.font = "10px system-ui, sans-serif";
      context.fillText(node.id === currentBoardId ? "current" : "board", node.x || 0, node.y || 0);
    }

    context.restore();
  }, [currentBoardId, graph, hoveredId]);

  function nodeFromEvent(event: React.MouseEvent<HTMLCanvasElement>): GraphNode | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return graph.nodes.find((node) => {
      const dx = x - (node.x || 0);
      const dy = y - (node.y || 0);
      return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS + 10;
    }) || null;
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty">
        <strong>No boards indexed</strong>
        <span>Save boards and add links to build the graph.</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="graph-canvas"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onMouseMove={(event) => setHoveredId(nodeFromEvent(event)?.id || null)}
      onMouseLeave={() => setHoveredId(null)}
      onClick={(event) => {
        const node = nodeFromEvent(event);
        if (node) onOpenBoard(node.id, node.path);
      }}
      aria-label="Board link graph"
    />
  );
}
