import { useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./App.css";

// Minimal local types to avoid strict import issues for this prototype
type LooseElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  boundElements?: readonly { id: string; type: string }[] | null;
  text?: string;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
};

type LooseAppState = {
  viewBackgroundColor?: string;
  currentItemStrokeColor?: string;
  currentItemBackgroundColor?: string;
  currentItemFillStyle?: string;
  currentItemStrokeWidth?: number;
  currentItemRoughness?: number;
  [key: string]: unknown;
};

type LooseFiles = Record<string, unknown>;

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportScene(
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: LooseFiles
) {
  const scene = {
    type: "recall-excalidraw-scene",
    version: 1,
    elements: elements.map((el) => ({ ...el })),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      currentItemStrokeColor: appState.currentItemStrokeColor,
      currentItemBackgroundColor: appState.currentItemBackgroundColor,
      currentItemFillStyle: appState.currentItemFillStyle,
      currentItemStrokeWidth: appState.currentItemStrokeWidth,
      currentItemRoughness: appState.currentItemRoughness,
    },
    files,
  };
  downloadJSON("recall-board-scene.json", scene);
}

function exportAiContext(
  elements: readonly LooseElement[],
  _appState: LooseAppState,
  _files: LooseFiles
) {
  const shapes = elements.filter(
    (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
  );
  const texts = elements.filter((el) => el.type === "text");
  const arrows = elements.filter((el) => el.type === "arrow");

  const nodes = elements.map((el) => {
    const node: Record<string, unknown> = {
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
    };
    if (el.text !== undefined) {
      node.text = el.text;
    }
    if (el.boundElements !== undefined && el.boundElements !== null) {
      node.boundElements = el.boundElements;
    }
    if (el.startBinding !== undefined) {
      node.startBinding = el.startBinding;
    }
    if (el.endBinding !== undefined) {
      node.endBinding = el.endBinding;
    }
    return node;
  });

  const arrowRelations = arrows.map((arrow) => {
    const hasBinding = arrow.startBinding || arrow.endBinding;
    return {
      id: arrow.id,
      startBinding: arrow.startBinding ?? null,
      endBinding: arrow.endBinding ?? null,
      semantic_status: hasBinding
        ? "bound_visual_relation"
        : "loose_visual_arrow",
    };
  });

  const candidateGroupings: Array<Record<string, unknown>> = [];
  for (const text of texts) {
    const cx = text.x + text.width / 2;
    const cy = text.y + text.height / 2;
    for (const shape of shapes) {
      const left = shape.x;
      const right = shape.x + shape.width;
      const top = shape.y;
      const bottom = shape.y + shape.height;
      if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
        candidateGroupings.push({
          shape_id: shape.id,
          text_id: text.id,
          text_preview:
            (text.text ?? "").slice(0, 80) +
            ((text.text ?? "").length > 80 ? "..." : ""),
          confidence: 0.8,
          status: "candidate_grouping",
          recommended_action: "promote_to_semantic_card",
        });
      }
    }
  }

  const summary = {
    element_count: elements.length,
    text_count: texts.length,
    arrow_count: arrows.length,
    rectangle_count: elements.filter((el) => el.type === "rectangle").length,
    ellipse_count: elements.filter((el) => el.type === "ellipse").length,
  };

  const context = {
    schema: "recall-ai-context-excalidraw-v0",
    screenshot_required: false,
    summary,
    policy: {
      explicit_connector_edge: "not implemented yet",
      bound_arrow: "visual relation attached to elements",
      loose_arrow: "candidate relation only",
      text_and_shape: "candidate grouping only unless explicitly promoted",
    },
    nodes,
    arrow_relations: arrowRelations,
    candidate_groupings: candidateGroupings,
    instructions_for_ai: [
      "This context is a structured representation of an Excalidraw board.",
      "Bound arrows indicate visual attachment, not confirmed semantic edges.",
      "Loose arrows are candidate relations requiring confirmation.",
      "Shape + text proximity groupings are candidate semantic cards.",
      "No screenshot is required; all spatial and structural data is included.",
    ],
  };

  downloadJSON("recall-ai-context.json", context);
}

function App() {
  const elementsRef = useRef<readonly LooseElement[]>([]);
  const appStateRef = useRef<LooseAppState>({});
  const filesRef = useRef<LooseFiles>({});

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      elementsRef.current = elements as readonly LooseElement[];
      appStateRef.current = appState as LooseAppState;
      filesRef.current = files as LooseFiles;
    },
    []
  );

  const handleExportScene = useCallback(() => {
    exportScene(elementsRef.current, appStateRef.current, filesRef.current);
  }, []);

  const handleExportAiContext = useCallback(() => {
    exportAiContext(
      elementsRef.current,
      appStateRef.current,
      filesRef.current
    );
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-title">Recall Board</div>
        <div className="top-bar-actions">
          <button onClick={handleExportScene}>Export Scene JSON</button>
          <button onClick={handleExportAiContext}>Export AI Context</button>
        </div>
      </header>
      <main className="board">
        <Excalidraw onChange={handleChange} />
      </main>
    </div>
  );
}

export default App;
