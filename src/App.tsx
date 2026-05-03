import { useRef, useCallback, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./App.css";
import TranscriptPanel from "./TranscriptPanel";
import { buildBoardTextGraph } from "./boardTextGraph";

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
  isDeleted?: boolean;
  boundElements?: readonly { id: string; type: string }[] | null;
  containerId?: string | null;
  points?: readonly (readonly [number, number])[];
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
  const total_element_count_in_scene = elements.length;
  const activeElements = elements.filter((el) => !el.isDeleted);
  const deletedElements = elements.filter((el) => el.isDeleted);

  const activeIds = new Set(activeElements.map((el) => el.id));

  const shapes = activeElements.filter(
    (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
  );
  const texts = activeElements.filter((el) => el.type === "text");
  const arrows = activeElements.filter((el) => el.type === "arrow");

  const nodes = activeElements.map((el) => {
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

  const brokenBindingIds: string[] = [];

  const arrowRelations = arrows.map((arrow) => {
    const sb = arrow.startBinding;
    const eb = arrow.endBinding;
    const sbValid = sb ? activeIds.has(sb.elementId) : false;
    const ebValid = eb ? activeIds.has(eb.elementId) : false;

    if (sb && !sbValid) brokenBindingIds.push(arrow.id);
    if (eb && !ebValid) brokenBindingIds.push(arrow.id);

    let semantic_status: string;
    if ((sb && !sbValid) || (eb && !ebValid)) {
      semantic_status = "broken_visual_relation";
    } else if (sbValid || ebValid) {
      semantic_status = "bound_visual_relation";
    } else {
      semantic_status = "loose_visual_arrow";
    }

    return {
      id: arrow.id,
      startBinding: sb ?? null,
      endBinding: eb ?? null,
      semantic_status,
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
    total_element_count_in_scene,
    active_element_count: activeElements.length,
    deleted_element_count: deletedElements.length,
    text_count: texts.length,
    arrow_count: arrows.length,
    rectangle_count: activeElements.filter((el) => el.type === "rectangle").length,
    ellipse_count: activeElements.filter((el) => el.type === "ellipse").length,
    diamond_count: activeElements.filter((el) => el.type === "diamond").length,
  };

  const diagnostics: Array<Record<string, unknown>> = [];
  if (brokenBindingIds.length > 0) {
    diagnostics.push({
      code: "binding_target_deleted",
      severity: "warning",
      message: "An active arrow is bound to a deleted/tombstoned element.",
      object_ids: Array.from(new Set(brokenBindingIds)),
    });
  }

  const context = {
    schema: "recall-ai-context-excalidraw-v0",
    screenshot_required: false,
    summary,
    policy: {
      deleted_elements: "excluded_from_ai_context_by_default",
      bound_arrow: "visual relation attached to elements",
      loose_arrow: "candidate relation only",
      text_and_shape: "candidate grouping only unless explicitly promoted",
    },
    excluded: {
      deleted_element_count: deletedElements.length,
      reason: "Deleted/tombstoned elements are ignored for AI understanding.",
    },
    nodes,
    arrow_relations: arrowRelations,
    candidate_groupings: candidateGroupings,
    diagnostics,
    instructions_for_ai: [
      "This context is a structured representation of an Excalidraw board.",
      "Deleted/tombstoned elements are excluded from AI context by default.",
      "Bound arrows indicate visual attachment, not confirmed semantic edges.",
      "Loose arrows are candidate relations requiring confirmation.",
      "Shape + text proximity groupings are candidate semantic cards.",
      "No screenshot is required; all spatial and structural data is included.",
    ],
  };

  downloadJSON("recall-ai-context.json", context);
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportTextGraph(elements: readonly LooseElement[]) {
  const graph = buildBoardTextGraph(elements);
  downloadJSON("recall-board-text-graph.json", graph);
}

function exportTextGraphPrompt(elements: readonly LooseElement[]) {
  const graph = buildBoardTextGraph(elements);
  const pretty = JSON.stringify(graph, null, 2);
  const prompt = `You are reading a compact board text graph.

Explain the board using only this graph.
Do not ask for a screenshot.
Each node is text found inside a shape.
Each edge means one node is connected to another by an arrow.

Return:
1. One-sentence summary
2. Central/root node if identifiable
3. Main branches
4. Sub-branches
5. Important relationships
6. Unclear/unresolved arrows
7. Suggested cleanup

Here is the graph:

${pretty}
`;
  downloadText("recall-board-text-graph-prompt.txt", prompt);
}

function App() {
  const elementsRef = useRef<readonly LooseElement[]>([]);
  const appStateRef = useRef<LooseAppState>({});
  const filesRef = useRef<LooseFiles>({});
  const [showTranscript, setShowTranscript] = useState(false);

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

  const handleExportTextGraph = useCallback(() => {
    exportTextGraph(elementsRef.current);
  }, []);

  const handleExportTextGraphPrompt = useCallback(() => {
    exportTextGraphPrompt(elementsRef.current);
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-title">Recall Board</div>
        <div className="top-bar-actions">
          <button onClick={handleExportScene}>Export Scene JSON</button>
          <button onClick={handleExportAiContext}>Export AI Context</button>
          <button onClick={handleExportTextGraph}>Export Text Graph</button>
          <button onClick={handleExportTextGraphPrompt}>Export Text Graph Prompt</button>
          <button onClick={() => setShowTranscript(true)}>Parse Transcript</button>
        </div>
      </header>
      <main className="board">
        <Excalidraw onChange={handleChange} />
      </main>
      {showTranscript && (
        <TranscriptPanel onClose={() => setShowTranscript(false)} />
      )}
    </div>
  );
}

export default App;
