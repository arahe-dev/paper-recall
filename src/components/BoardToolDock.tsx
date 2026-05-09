import type { ReactNode } from "react";
import type { ToolType } from "@excalidraw/excalidraw/types";

export type BoardDockTool = Extract<
  ToolType,
  "selection" | "hand" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "image" | "eraser"
>;

type BoardToolDockProps = {
  activeTool: string;
  onSelectTool: (tool: BoardDockTool) => void;
};

const TOOLS: Array<{ tool: BoardDockTool; label: string; icon: ReactNode }> = [
  {
    tool: "selection",
    label: "Select",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3l10.5 9.3-5.2.9 2.7 5.6-2.7 1.3-2.6-5.5-3.5 3.8L6 3z" />
      </svg>
    ),
  },
  {
    tool: "hand",
    label: "Pan",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 11V6.8a1.4 1.4 0 0 1 2.8 0V11h.2V5.6a1.4 1.4 0 0 1 2.8 0V11h.2V7a1.4 1.4 0 0 1 2.8 0v5.9l.5-.7a1.5 1.5 0 0 1 2.4 1.7l-3.2 4.4A5.3 5.3 0 0 1 12.2 20H11a5 5 0 0 1-5-5v-2.7a1.4 1.4 0 0 1 2 0V11z" />
      </svg>
    ),
  },
  {
    tool: "rectangle",
    label: "Rectangle",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="6" width="14" height="12" rx="2" />
      </svg>
    ),
  },
  {
    tool: "diamond",
    label: "Diamond",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4l8 8-8 8-8-8 8-8z" />
      </svg>
    ),
  },
  {
    tool: "ellipse",
    label: "Ellipse",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="7" ry="6" />
      </svg>
    ),
  },
  {
    tool: "arrow",
    label: "Arrow",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h13" />
        <path d="M13 7l5 5-5 5" />
      </svg>
    ),
  },
  {
    tool: "line",
    label: "Line",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17L19 7" />
      </svg>
    ),
  },
  {
    tool: "freedraw",
    label: "Draw",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 16c2.5-5 5.1-5 7.8-.2 1.7 3 3.6 3.2 5.7.7" />
      </svg>
    ),
  },
  {
    tool: "text",
    label: "Text",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6h12" />
        <path d="M12 6v12" />
        <path d="M9 18h6" />
      </svg>
    ),
  },
  {
    tool: "image",
    label: "Image",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="6" width="14" height="12" rx="2" />
        <path d="M8 15l2.7-3 2 2.2 1.4-1.5L17 16H7" />
        <circle cx="15.8" cy="9.3" r="1" />
      </svg>
    ),
  },
  {
    tool: "eraser",
    label: "Erase",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 14.5l7.8-7.8a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8l-7.8 7.8" />
        <path d="M6.5 14.5l3 3H18" />
      </svg>
    ),
  },
];

export default function BoardToolDock({ activeTool, onSelectTool }: BoardToolDockProps) {
  return (
    <div className="board-tool-dock" role="toolbar" aria-label="Board tools">
      {TOOLS.map((item) => (
        <button
          type="button"
          key={item.tool}
          className={activeTool === item.tool ? "active" : ""}
          aria-label={item.label}
          title={item.label}
          onClick={() => onSelectTool(item.tool)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
