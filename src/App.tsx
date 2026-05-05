import { useRef, useCallback, useState, useEffect } from "react";
import { Excalidraw, exportToBlob, restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import "./App.css";
import TranscriptPanel from "./TranscriptPanel";
import { buildBoardTextGraph } from "./boardTextGraph";
import { renderRecallGraphIR } from "./recallGraphRenderer";
import type { RecallGraphIR } from "./recallGraphIR";
import {
  normalizeRecallDiagramSpec,
  recallDiagramSpecToGraphIR,
  type RecallDiagramSpecV0,
} from "./recallDiagramSpec";
import {
  type BoardMeta,
  type SceneData,
  createBoard,
  saveBoard,
  saveBoardWithDialog,
  openBoardWithDialog,
  loadBoard,
  deleteBoard,
  getRecentBoards,
  isTauriEnv,
} from "./utils/boardStorage";

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

function downloadBlob(filename: string, blob: Blob) {
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
    type: "excalidraw",
    version: 2,
    source: "recall-board",
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

Do not ask for a screenshot.
Use only the nodes, edges, graph insights, unresolved arrows, and ungrouped text below.

Each node is text found inside a shape or clear standalone text.
Each edge means one node is connected to another by an arrow.
Graph insights are deterministic structural summaries generated from the graph.

Rules:
- Preserve original wording.
- Do not invent missing labels or relationships.
- Say "unclear" when a relation is ambiguous.
- Separate visible graph facts from likely interpretation.
- Domain interpretations are allowed, but mark them as inference.
- Treat bound_visual_relation as stronger than loose_inferred_relation.
- Treat loose_inferred_relation as plausible but worth checking.

Return:
1. One-sentence summary
2. Visible graph facts
3. Likely interpretation
4. Central/root node if identifiable
5. Main branches
6. Sub-branches
7. Important relationships
8. Unclear/unresolved arrows
9. Ungrouped/disconnected text
10. Suggested cleanup
11. What this board seems to communicate

GRAPH:

${graph.plain_text_graph}

## Full JSON
\`\`\`json
${pretty}
\`\`\`
`;
  downloadText("recall-board-text-graph-prompt.md", prompt);
}

// Extend window for automation
declare global {
  interface Window {
    __RECALL_API__?: {
      loadGraph: (json: RecallGraphIR) => Promise<{ success: boolean; errors: string[] }>;
      loadDiagramSpec: (json: RecallDiagramSpecV0) => Promise<{ success: boolean; errors: string[]; warnings: string[]; graph?: RecallGraphIR }>;
      normalizeDiagramSpec: (json: unknown) => ReturnType<typeof normalizeRecallDiagramSpec>;
      exportPNG: (filename?: string) => Promise<void>;
      loadScene: (scene: { elements: unknown[] }) => void;
      getSceneSnapshot: () => { elements: unknown[]; appState: unknown };
      getTextGraph: () => unknown;
    };
  }
}

function App() {
  const elementsRef = useRef<readonly LooseElement[]>([]);
  const appStateRef = useRef<LooseAppState>({});
  const filesRef = useRef<LooseFiles>({});
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [lastLoadErrors, setLastLoadErrors] = useState<string[]>([]);

  // Phase 0: Board persistence state
  const [currentBoard, setCurrentBoard] = useState<BoardMeta | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [recentBoards, setRecentBoards] = useState<BoardMeta[]>(getRecentBoards);
  const [showRecent, setShowRecent] = useState(false);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      elementsRef.current = elements as readonly LooseElement[];
      appStateRef.current = appState as LooseAppState;
      filesRef.current = files as LooseFiles;
      setIsDirty(true);
    },
    []
  );

  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  const handleLoadGraph = useCallback(async (json: RecallGraphIR) => {
    const result = renderRecallGraphIR(json);
    if (!result.valid) {
      setLastLoadErrors(result.errors);
      return { success: false, errors: result.errors };
    }
    setLastLoadErrors([]);

    const appState = apiRef.current?.getAppState();
    apiRef.current?.updateScene({
      elements: result.elements,
      appState: {
        viewBackgroundColor: json.layout.style === "readable_radial"
          ? "#ffffff"
          : appState?.viewBackgroundColor || "#ffffff",
      },
      captureUpdate: "NEVER" as any,
    });

    // Scroll to fit content
    setTimeout(() => {
      (apiRef.current as any)?.scrollToContent?.(undefined, { fitToViewport: true, animate: false });
    }, 50);

    return { success: true, errors: [] };
  }, []);

  const handleLoadDiagramSpec = useCallback(async (json: RecallDiagramSpecV0) => {
    const normalization = normalizeRecallDiagramSpec(json);
    if (!normalization.valid || !normalization.spec) {
      setLastLoadErrors(normalization.errors);
      return { success: false, errors: normalization.errors, warnings: normalization.warnings };
    }
    const graph = recallDiagramSpecToGraphIR(normalization.spec);
    const loaded = await handleLoadGraph(graph);
    return {
      ...loaded,
      warnings: normalization.warnings,
      graph,
    };
  }, [handleLoadGraph]);

  const handleExportPNG = useCallback(async (filename?: string) => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const blob = await exportToBlob({
      elements: elements as any,
      appState: appState as any,
      files: null,
      mimeType: "image/png",
      exportPadding: 20,
    });
    downloadBlob(filename || "recall-board.png", blob);
  }, []);

  // Expose automation API on window
  useEffect(() => {
    window.__RECALL_API__ = {
      loadGraph: handleLoadGraph,
      loadDiagramSpec: handleLoadDiagramSpec,
      normalizeDiagramSpec: normalizeRecallDiagramSpec,
      exportPNG: handleExportPNG,
      loadScene: (scene: { elements: any[] }) => {
        const restored = restoreElements(scene.elements, null);
        apiRef.current?.updateScene({ elements: restored, captureUpdate: "NEVER" as any });

        requestAnimationFrame(() => {
          const els = apiRef.current?.getSceneElements() || restored;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const el of els as any[]) {
            if (el.isDeleted) continue;
            const w = el.width ?? 0;
            const h = el.height ?? 0;
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + w);
            maxY = Math.max(maxY, el.y + h);
          }
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const appState = apiRef.current?.getAppState();
          const vw = (appState as any)?.width || 1200;
          const vh = (appState as any)?.height || 700;
          const scrollX = vw / 2 - cx;
          const scrollY = vh / 2 - cy;
          apiRef.current?.updateScene({
            appState: { scrollX, scrollY, zoom: { value: 1 as any } },
            captureUpdate: "NEVER" as any,
          });
        });
      },
      getSceneSnapshot: () => ({
        elements: (
          (apiRef.current as any)?.getSceneElementsIncludingDeleted?.() ||
          apiRef.current?.getSceneElements() ||
          elementsRef.current
        ) as unknown[],
        appState: (apiRef.current?.getAppState() || appStateRef.current) as unknown,
      }),
      getTextGraph: () => buildBoardTextGraph(
        (
          (apiRef.current as any)?.getSceneElementsIncludingDeleted?.() ||
          apiRef.current?.getSceneElements() ||
          elementsRef.current
        ) as readonly LooseElement[]
      ),
    };
    return () => {
      delete window.__RECALL_API__;
    };
  }, [handleLoadGraph, handleLoadDiagramSpec, handleExportPNG]);

  // Phase 0: Board persistence handlers

  const getCurrentScene = useCallback((): SceneData => ({
    elements: elementsRef.current as unknown[],
    appState: appStateRef.current as Record<string, unknown>,
    files: filesRef.current as Record<string, unknown>,
  }), []);

  const handleNewBoard = useCallback(() => {
    apiRef.current?.resetScene();
    setCurrentBoard(null);
    setIsDirty(false);
    setLastLoadErrors([]);
  }, []);

  const handleSaveAs = useCallback(async () => {
    const scene = getCurrentScene();
    if (isTauriEnv()) {
      const meta = await saveBoardWithDialog(scene, currentBoard?.name || "board.excalidraw");
      if (meta) {
        setCurrentBoard(meta);
        setIsDirty(false);
        setRecentBoards(getRecentBoards());
      }
    } else {
      const name = window.prompt("Board name", currentBoard?.name || "Untitled");
      if (!name) return;
      const meta = await createBoard(name.replace(/\.excalidraw$/i, ""), scene);
      setCurrentBoard(meta);
      setIsDirty(false);
      setRecentBoards(getRecentBoards());
    }
  }, [currentBoard, getCurrentScene]);

  const handleSaveBoard = useCallback(async () => {
    const scene = getCurrentScene();
    if (currentBoard) {
      await saveBoard(currentBoard, scene);
      setIsDirty(false);
      setRecentBoards(getRecentBoards());
    } else {
      await handleSaveAs();
    }
  }, [currentBoard, getCurrentScene, handleSaveAs]);

  const handleOpenBoard = useCallback(async () => {
    if (isTauriEnv()) {
      const result = await openBoardWithDialog();
      if (result) {
        apiRef.current?.updateScene({
          elements: result.scene.elements as any,
          appState: result.scene.appState as any,
          captureUpdate: "NEVER" as any,
        });
        setCurrentBoard(result.meta);
        setIsDirty(false);
        setRecentBoards(getRecentBoards());
        setLastLoadErrors([]);
      }
    } else {
      // Browser fallback: trigger hidden file input
      document.getElementById("browser-file-input")?.click();
    }
  }, []);

  const handleOpenRecent = useCallback(async (meta: BoardMeta) => {
    const scene = await loadBoard(meta);
    if (scene) {
      apiRef.current?.updateScene({
        elements: scene.elements as any,
        appState: scene.appState as any,
        captureUpdate: "NEVER" as any,
      });
      setCurrentBoard(meta);
      setIsDirty(false);
      setShowRecent(false);
      setLastLoadErrors([]);
    } else {
      setLastLoadErrors([`Failed to load board: ${meta.name}`]);
    }
  }, []);

  const handleDeleteRecent = useCallback(async (meta: BoardMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${meta.name}"?`)) {
      await deleteBoard(meta);
      setRecentBoards(getRecentBoards());
      if (currentBoard?.path === meta.path) {
        setCurrentBoard(null);
        setIsDirty(false);
      }
    }
  }, [currentBoard]);

  const handleBrowserFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.elements)) {
          setLastLoadErrors(["Invalid board file: missing elements array"]);
          return;
        }
        apiRef.current?.updateScene({
          elements: parsed.elements,
          appState: parsed.appState ?? {},
          captureUpdate: "NEVER" as any,
        });
        setCurrentBoard(null);
        setIsDirty(false);
        setLastLoadErrors([]);
      } catch (err) {
        setLastLoadErrors([`Failed to parse board file: ${err}`]);
      }
      e.target.value = "";
    },
    []
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const json = JSON.parse(text) as RecallGraphIR | RecallDiagramSpecV0;
        if ((json as { schema?: string }).schema === "recall-diagram-spec-v0") {
          await handleLoadDiagramSpec(json as RecallDiagramSpecV0);
        } else {
          await handleLoadGraph(json as RecallGraphIR);
        }
      } catch (err) {
        setLastLoadErrors([`Failed to parse JSON: ${err}`]);
      }
      e.target.value = "";
    },
    [handleLoadGraph, handleLoadDiagramSpec]
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
        <div className="top-bar-title">
          Recall Board
          {currentBoard && (
            <span className="board-name">
              {" - "}{currentBoard.name}
              {isDirty && <span className="dirty-indicator">*</span>}
            </span>
          )}
        </div>
        <div className="top-bar-actions">
          {/* Phase 0: Board persistence actions */}
          <button onClick={handleNewBoard}>New</button>
          <button onClick={handleOpenBoard}>Open...</button>
          <button onClick={handleSaveBoard}>Save</button>
          <button onClick={handleSaveAs}>Save As...</button>

          {/* Recent boards dropdown */}
          <div className="recent-dropdown">
            <button onClick={() => setShowRecent(!showRecent)}>
              Recent v
            </button>
            {showRecent && (
              <div className="recent-menu">
                {recentBoards.length === 0 ? (
                  <div className="recent-item empty">No recent boards</div>
                ) : (
                  recentBoards.map((board) => (
                    <div
                      key={board.path}
                      className="recent-item"
                      onClick={() => handleOpenRecent(board)}
                    >
                      <span className="recent-name">{board.name}</span>
                      <span className="recent-meta">
                        {new Date(board.lastModified).toLocaleDateString()}
                      </span>
                      <button
                        className="recent-delete"
                        onClick={(e) => handleDeleteRecent(board, e)}
                        title="Delete"
                      >
                        x
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <span className="action-separator" />

          {/* Legacy export actions */}
          <label className="file-input-label">
            <input
              type="file"
              accept=".json"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            Load Recall Graph IR
          </label>
          <button onClick={() => handleExportPNG()}>Export PNG</button>
          <button onClick={handleExportScene}>Export Scene JSON</button>
          <button onClick={handleExportAiContext}>Export AI Context</button>
          <button onClick={handleExportTextGraph}>Export Text Graph</button>
          <button onClick={handleExportTextGraphPrompt}>Export Text Graph Prompt</button>
          <button onClick={() => setShowTranscript(true)}>Parse Transcript</button>
        </div>
      </header>

      {/* Hidden file input for browser fallback open */}
      <input
        id="browser-file-input"
        type="file"
        accept=".excalidraw,.json"
        onChange={handleBrowserFileInput}
        style={{ display: "none" }}
      />

      {lastLoadErrors.length > 0 && (
        <div className="load-errors">
          {lastLoadErrors.map((err, i) => (
            <div key={i} className="load-error">{err}</div>
          ))}
          <button className="dismiss-errors" onClick={() => setLastLoadErrors([])}>
            Dismiss
          </button>
        </div>
      )}
      <main className="board">
        <Excalidraw onChange={handleChange} excalidrawAPI={handleExcalidrawAPI} />
      </main>
      {showTranscript && (
        <TranscriptPanel onClose={() => setShowTranscript(false)} />
      )}
    </div>
  );
}

export default App;
