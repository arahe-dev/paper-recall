import { useRef, useCallback, useState, useEffect } from "react";
import { Excalidraw, exportToCanvas, restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import "./App.css";
import HomeScreen from "./components/HomeScreen";
import ThemeToggle from "./components/ThemeToggle";
import TemplateGallery from "./components/TemplateGallery";
import TranscriptPanel from "./TranscriptPanel";
import { buildBoardTextGraph } from "./boardTextGraph";
import type { LooseAppState, LooseElement, LooseFiles } from "./exporters/types";
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
  renameBoard,
  duplicateBoard,
  getRecentBoards,
  isTauriEnv,
} from "./utils/boardStorage";
import { exportAndSaveBoard, type ExportFormat } from "./utils/exportEngine";
import { useTheme } from "./hooks/useTheme";
import { getSettings, updateSettings } from "./utils/settingsStore";
import {
  getAllTemplates,
  saveAsTemplate,
  type RecallTemplate,
} from "./utils/templateEngine";

type RecallExcalidrawAPI = ExcalidrawImperativeAPI & {
  scrollToContent?: (elements?: unknown, options?: { fitToViewport?: boolean; animate?: boolean }) => void;
  getSceneElementsIncludingDeleted?: () => readonly LooseElement[];
};

const EXPORT_OPTIONS: Array<{ format: ExportFormat; label: string }> = [
  { format: "excalidraw", label: "Excalidraw JSON" },
  { format: "ai-json", label: "AI Context JSON" },
  { format: "text-graph-json", label: "Text Graph JSON" },
  { format: "text-graph-md", label: "Text Graph Markdown" },
  { format: "png", label: "PNG" },
  { format: "svg", label: "SVG" },
];

// Extend window for automation
declare global {
  interface Window {
    __RECALL_API__?: {
      loadGraph: (json: RecallGraphIR) => Promise<{ success: boolean; errors: string[] }>;
      loadDiagramSpec: (json: RecallDiagramSpecV0) => Promise<{ success: boolean; errors: string[]; warnings: string[]; graph?: RecallGraphIR }>;
      normalizeDiagramSpec: (json: unknown) => ReturnType<typeof normalizeRecallDiagramSpec>;
      exportPNG: (filename?: string) => Promise<void>;
      exportBoard: (format: ExportFormat, filename?: string) => Promise<void>;
      loadScene: (scene: { elements: unknown[] }) => void;
      getSceneSnapshot: () => { elements: unknown[]; appState: unknown };
      getTextGraph: () => unknown;
    };
  }
}

function App() {
  const { excalidrawTheme, canvasBackgroundColor } = useTheme();
  const elementsRef = useRef<readonly LooseElement[]>([]);
  const appStateRef = useRef<LooseAppState>({});
  const filesRef = useRef<LooseFiles>({});
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const lastChangeAtRef = useRef(0);
  const suppressDirtyUntilRef = useRef(0);
  const autoSavePromptedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [lastLoadErrors, setLastLoadErrors] = useState<string[]>([]);

  const [currentBoard, setCurrentBoard] = useState<BoardMeta | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [recentBoards, setRecentBoards] = useState<BoardMeta[]>(getRecentBoards);
  const [showRecent, setShowRecent] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [homeDismissed, setHomeDismissed] = useState(false);
  const [activeElementCount, setActiveElementCount] = useState(0);
  const [templates, setTemplates] = useState<RecallTemplate[]>(getAllTemplates);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => getSettings().autoSaveEnabled);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      elementsRef.current = elements as readonly LooseElement[];
      appStateRef.current = appState as LooseAppState;
      filesRef.current = files as LooseFiles;
      const nextActiveCount = (elements as readonly LooseElement[]).filter((el) => !el.isDeleted).length;
      setActiveElementCount(nextActiveCount);
      if (nextActiveCount > 0) {
        setHomeDismissed(true);
      }
      if (Date.now() > suppressDirtyUntilRef.current) {
        lastChangeAtRef.current = Date.now();
        setIsDirty(true);
      }
    },
    []
  );

  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    suppressDirtyUntilRef.current = Date.now() + 1500;
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
          ? canvasBackgroundColor
          : appState?.viewBackgroundColor || canvasBackgroundColor,
        theme: excalidrawTheme,
      },
      captureUpdate: "NEVER" as never,
    });
    setActiveElementCount(result.elements.filter((el) => !el.isDeleted).length);
    setHomeDismissed(true);

    // Scroll to fit content
    setTimeout(() => {
      (apiRef.current as RecallExcalidrawAPI | null)?.scrollToContent?.(undefined, { fitToViewport: true, animate: false });
    }, 50);

    return { success: true, errors: [] };
  }, [canvasBackgroundColor, excalidrawTheme]);

  useEffect(() => {
    apiRef.current?.updateScene({
      appState: {
        theme: excalidrawTheme,
        viewBackgroundColor: canvasBackgroundColor,
      },
      captureUpdate: "NEVER" as never,
    });
  }, [canvasBackgroundColor, excalidrawTheme]);

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

  const getImageElements = useCallback((): readonly LooseElement[] => (
    (apiRef.current?.getSceneElements() as readonly LooseElement[] | undefined) ||
    elementsRef.current
  ), []);

  const handleExport = useCallback(async (format: ExportFormat, filename?: string) => {
    try {
      const result = await exportAndSaveBoard(
        format,
        elementsRef.current,
        appStateRef.current,
        filesRef.current,
        {
          baseName: currentBoard?.name || "recall-board",
          filename,
          imageElements: getImageElements(),
        }
      );
      if (!result.cancelled) {
        updateSettings({ defaultExportFormat: format });
        setLastLoadErrors([]);
      }
    } catch (err) {
      setLastLoadErrors([`Export failed: ${err}`]);
    } finally {
      setShowExport(false);
    }
  }, [currentBoard, getImageElements]);

  const handleExportPNG = useCallback(async (filename?: string) => {
    const api = apiRef.current;
    if (!api) return;
    await handleExport("png", filename);
  }, [handleExport]);

  // Expose automation API on window
  useEffect(() => {
    window.__RECALL_API__ = {
      loadGraph: handleLoadGraph,
      loadDiagramSpec: handleLoadDiagramSpec,
      normalizeDiagramSpec: normalizeRecallDiagramSpec,
      exportPNG: handleExportPNG,
      exportBoard: handleExport,
      loadScene: (scene: { elements: unknown[] }) => {
        const restored = restoreElements(scene.elements as never, null);
        apiRef.current?.updateScene({ elements: restored, captureUpdate: "NEVER" as never });

        requestAnimationFrame(() => {
          const els = apiRef.current?.getSceneElements() || restored;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const el of els as readonly LooseElement[]) {
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
          const vw = appState?.width || 1200;
          const vh = appState?.height || 700;
          const scrollX = vw / 2 - cx;
          const scrollY = vh / 2 - cy;
          apiRef.current?.updateScene({
            appState: { scrollX, scrollY, zoom: { value: 1 as never } },
            captureUpdate: "NEVER" as never,
          });
        });
      },
      getSceneSnapshot: () => ({
        elements: (
          (apiRef.current as RecallExcalidrawAPI | null)?.getSceneElementsIncludingDeleted?.() ||
          apiRef.current?.getSceneElements() ||
          elementsRef.current
        ) as unknown[],
        appState: (apiRef.current?.getAppState() || appStateRef.current) as unknown,
      }),
      getTextGraph: () => buildBoardTextGraph(
        (
          (apiRef.current as RecallExcalidrawAPI | null)?.getSceneElementsIncludingDeleted?.() ||
          apiRef.current?.getSceneElements() ||
          elementsRef.current
        ) as readonly LooseElement[]
      ),
    };
    return () => {
      delete window.__RECALL_API__;
    };
  }, [handleLoadGraph, handleLoadDiagramSpec, handleExportPNG, handleExport]);

  // Phase 0: Board persistence handlers

  const getCurrentScene = useCallback((): SceneData => ({
    elements: elementsRef.current as unknown[],
    appState: appStateRef.current as Record<string, unknown>,
    files: filesRef.current as Record<string, unknown>,
  }), []);

  const createCurrentThumbnail = useCallback(async (): Promise<string | undefined> => {
    const api = apiRef.current;
    const elements = (api?.getSceneElements() as readonly LooseElement[] | undefined) || elementsRef.current;
    const activeElements = elements.filter((el) => !el.isDeleted);
    if (activeElements.length === 0) return undefined;
    try {
      const canvas = await exportToCanvas({
        elements: activeElements as never,
        appState: {
          ...(api?.getAppState() || appStateRef.current),
          viewBackgroundColor: canvasBackgroundColor,
        } as never,
        files: filesRef.current as never,
        exportPadding: 16,
        maxWidthOrHeight: 360,
      });
      return canvas.toDataURL("image/png", 0.78);
    } catch {
      return undefined;
    }
  }, [canvasBackgroundColor]);

  const restoreScene = useCallback((scene: SceneData) => {
    suppressDirtyUntilRef.current = Date.now() + 750;
    apiRef.current?.updateScene({
      elements: scene.elements as never,
      appState: scene.appState as never,
      captureUpdate: "NEVER" as never,
    });
    setActiveElementCount((scene.elements as LooseElement[]).filter((el) => !el.isDeleted).length);
    setHomeDismissed(true);
  }, []);

  const canDiscardDirty = useCallback(() => (
    !isDirty || window.confirm("Discard unsaved changes?")
  ), [isDirty]);

  const saveSceneToBoard = useCallback(async (board: BoardMeta, scene: SceneData) => {
    saveInFlightRef.current = true;
    setIsSaving(true);
    try {
      const thumbnail = await createCurrentThumbnail();
      const updated = await saveBoard(thumbnail ? { ...board, thumbnail } : board, scene);
      setCurrentBoard(updated);
      setRecentBoards(getRecentBoards());
      setIsDirty(false);
      setLastSavedAt(updated.lastModified);
      setLastLoadErrors([]);
      return updated;
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }, [createCurrentThumbnail]);

  const handleNewBoard = useCallback(() => {
    if (!canDiscardDirty()) return;
    suppressDirtyUntilRef.current = Date.now() + 750;
    apiRef.current?.resetScene();
    setCurrentBoard(null);
    setIsDirty(false);
    setLastSavedAt(null);
    setActiveElementCount(0);
    setHomeDismissed(false);
    autoSavePromptedRef.current = false;
    setLastLoadErrors([]);
  }, [canDiscardDirty]);

  const handleBlankCanvas = useCallback(() => {
    handleNewBoard();
    setHomeDismissed(true);
  }, [handleNewBoard]);

  const handleSaveAs = useCallback(async () => {
    const scene = getCurrentScene();
    if (isTauriEnv()) {
      const meta = await saveBoardWithDialog(scene, currentBoard?.name || "board.excalidraw");
      if (meta) {
        const thumbnail = await createCurrentThumbnail();
        const updated = thumbnail ? await saveBoard({ ...meta, thumbnail }, scene) : meta;
        setCurrentBoard(updated);
        setIsDirty(false);
        setLastSavedAt(updated.lastModified);
        setRecentBoards(getRecentBoards());
        setHomeDismissed(true);
      }
    } else {
      const name = window.prompt("Board name", currentBoard?.name || "Untitled");
      if (!name) return;
      const meta = await createBoard(name.replace(/\.excalidraw$/i, ""), scene);
      const thumbnail = await createCurrentThumbnail();
      const updated = thumbnail ? await saveBoard({ ...meta, thumbnail }, scene) : meta;
      setCurrentBoard(updated);
      setIsDirty(false);
      setLastSavedAt(updated.lastModified);
      setRecentBoards(getRecentBoards());
      setHomeDismissed(true);
    }
  }, [createCurrentThumbnail, currentBoard, getCurrentScene]);

  const handleSaveBoard = useCallback(async () => {
    const scene = getCurrentScene();
    if (currentBoard) {
      await saveSceneToBoard(currentBoard, scene);
    } else {
      await handleSaveAs();
    }
  }, [currentBoard, getCurrentScene, handleSaveAs, saveSceneToBoard]);

  const handleOpenBoard = useCallback(async () => {
    if (!canDiscardDirty()) return;
    if (isTauriEnv()) {
      const result = await openBoardWithDialog();
      if (result) {
        restoreScene(result.scene);
        setCurrentBoard(result.meta);
        setIsDirty(false);
        setLastSavedAt(result.meta.lastModified);
        setRecentBoards(getRecentBoards());
        setLastLoadErrors([]);
        setHomeDismissed(true);
      }
    } else {
      // Browser fallback: trigger hidden file input
      document.getElementById("browser-file-input")?.click();
    }
  }, [canDiscardDirty, restoreScene]);

  const handleOpenRecent = useCallback(async (meta: BoardMeta) => {
    if (!canDiscardDirty()) return;
    const scene = await loadBoard(meta);
    if (scene) {
      restoreScene(scene);
      setCurrentBoard(meta);
      setIsDirty(false);
      setLastSavedAt(meta.lastModified);
      setShowRecent(false);
      setHomeDismissed(true);
      setLastLoadErrors([]);
    } else {
      setLastLoadErrors([`Failed to load board: ${meta.name}`]);
    }
  }, [canDiscardDirty, restoreScene]);

  const handleDeleteRecent = useCallback(async (meta: BoardMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${meta.name}"?`)) {
      await deleteBoard(meta);
      setRecentBoards(getRecentBoards());
      if (currentBoard?.path === meta.path) {
        setCurrentBoard(null);
        setIsDirty(false);
        setLastSavedAt(null);
        setActiveElementCount(0);
        setHomeDismissed(false);
      }
    }
  }, [currentBoard]);

  const handleRenameBoard = useCallback(async () => {
    if (!currentBoard) {
      setLastLoadErrors(["Save the board before renaming it."]);
      return;
    }
    const name = window.prompt("Rename board", currentBoard.name);
    if (!name || name.trim() === currentBoard.name) return;
    try {
      const updated = await renameBoard(currentBoard, name);
      setCurrentBoard(updated);
      setRecentBoards(getRecentBoards());
      setLastSavedAt(updated.lastModified);
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to rename board: ${err}`]);
    }
  }, [currentBoard]);

  const handleDuplicateBoard = useCallback(async () => {
    if (!currentBoard) {
      setLastLoadErrors(["Save the board before duplicating it."]);
      return;
    }
    try {
      let source = currentBoard;
      if (isDirty) {
        source = await saveSceneToBoard(currentBoard, getCurrentScene());
      }
      const duplicate = await duplicateBoard(source);
      if (!duplicate) {
        setLastLoadErrors([`Failed to duplicate board: ${source.name}`]);
        return;
      }
      const scene = await loadBoard(duplicate);
      if (scene) restoreScene(scene);
      setCurrentBoard(duplicate);
      setIsDirty(false);
      setLastSavedAt(duplicate.lastModified);
      setRecentBoards(getRecentBoards());
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to duplicate board: ${err}`]);
    }
  }, [currentBoard, getCurrentScene, isDirty, restoreScene, saveSceneToBoard]);

  const handleDeleteCurrentBoard = useCallback(async () => {
    if (!currentBoard) {
      setLastLoadErrors(["No saved board is selected."]);
      return;
    }
    if (!window.confirm(`Delete "${currentBoard.name}"?`)) return;
    try {
      await deleteBoard(currentBoard);
      apiRef.current?.resetScene();
      setCurrentBoard(null);
      setIsDirty(false);
      setLastSavedAt(null);
      setActiveElementCount(0);
      setHomeDismissed(false);
      setRecentBoards(getRecentBoards());
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to delete board: ${err}`]);
    }
  }, [currentBoard]);

  const handleAutoSaveToggle = useCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    updateSettings({ autoSaveEnabled: enabled });
  }, []);

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
        const scene = {
          elements: parsed.elements,
          appState: parsed.appState ?? {},
          files: parsed.files ?? {},
        };
        restoreScene(scene);
        const name = file.name.replace(/\.excalidraw$|\.json$/i, "") || "Imported";
        const meta = await createBoard(name, scene);
        setCurrentBoard(meta);
        setIsDirty(false);
        setLastSavedAt(meta.lastModified);
        setRecentBoards(getRecentBoards());
        setHomeDismissed(true);
        setLastLoadErrors([]);
      } catch (err) {
        setLastLoadErrors([`Failed to parse board file: ${err}`]);
      }
      e.target.value = "";
    },
    [restoreScene]
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!autoSaveEnabled) return;

    const timer = window.setInterval(async () => {
      if (!isDirty || saveInFlightRef.current) return;
      if (Date.now() - lastChangeAtRef.current < 2000) return;

      try {
        if (currentBoard) {
          await saveSceneToBoard(currentBoard, getCurrentScene());
          return;
        }

        if (autoSavePromptedRef.current) return;
        autoSavePromptedRef.current = true;
        const name = window.prompt("Name this board for auto-save", "Untitled");
        if (!name) return;
        const meta = await createBoard(name, getCurrentScene());
        setCurrentBoard(meta);
        setIsDirty(false);
        setLastSavedAt(meta.lastModified);
        setRecentBoards(getRecentBoards());
        setHomeDismissed(true);
        setLastLoadErrors([]);
      } catch (err) {
        setLastLoadErrors([`Auto-save failed: ${err}`]);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [autoSaveEnabled, currentBoard, getCurrentScene, isDirty, saveSceneToBoard]);

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

  const handleUseTemplate = useCallback(async (template: RecallTemplate) => {
    if (!canDiscardDirty()) return;
    try {
      const loaded = await handleLoadGraph(template.ir);
      if (!loaded.success) return;
      setCurrentBoard(null);
      setIsDirty(true);
      setLastSavedAt(null);
      setShowTemplateGallery(false);
      setHomeDismissed(true);
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to apply template: ${err}`]);
    }
  }, [canDiscardDirty, handleLoadGraph]);

  const handleSaveAsTemplate = useCallback(() => {
    const activeElements = elementsRef.current.filter((el) => !el.isDeleted);
    if (activeElements.length === 0) {
      setLastLoadErrors(["Add content before saving a template."]);
      return;
    }
    const name = window.prompt("Template name", currentBoard?.name || "Custom Template");
    if (!name) return;
    try {
      saveAsTemplate(elementsRef.current, appStateRef.current, {
        name,
        description: "Saved from the current board.",
      });
      setTemplates(getAllTemplates());
      setShowTemplateGallery(true);
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to save template: ${err}`]);
    }
  }, [currentBoard]);

  const handleRenameRecent = useCallback(async (meta: BoardMeta) => {
    const name = window.prompt("Rename board", meta.name);
    if (!name || name.trim() === meta.name) return;
    try {
      const updated = await renameBoard(meta, name);
      if (currentBoard?.path === meta.path) setCurrentBoard(updated);
      setRecentBoards(getRecentBoards());
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to rename board: ${err}`]);
    }
  }, [currentBoard]);

  const handleDuplicateRecent = useCallback(async (meta: BoardMeta) => {
    try {
      const duplicate = await duplicateBoard(meta);
      if (!duplicate) {
        setLastLoadErrors([`Failed to duplicate board: ${meta.name}`]);
        return;
      }
      setRecentBoards(getRecentBoards());
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to duplicate board: ${err}`]);
    }
  }, []);

  const handleDeleteRecentCard = useCallback(async (meta: BoardMeta) => {
    if (!window.confirm(`Delete "${meta.name}"?`)) return;
    await deleteBoard(meta);
    setRecentBoards(getRecentBoards());
    if (currentBoard?.path === meta.path) {
      apiRef.current?.resetScene();
      setCurrentBoard(null);
      setIsDirty(false);
      setLastSavedAt(null);
      setActiveElementCount(0);
      setHomeDismissed(false);
    }
  }, [currentBoard]);

  const saveStatus = isSaving
    ? "saving"
    : isDirty
      ? "unsaved"
      : lastSavedAt
        ? "saved"
        : "new";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-title">
          Recall Board
          {currentBoard && (
            <span className="board-name">
              {" - "}{currentBoard.name}
            </span>
          )}
          <span className={`save-status ${saveStatus}`}>{saveStatus}</span>
        </div>
        <div className="top-bar-actions">
          {/* Board persistence actions */}
          <button onClick={handleNewBoard}>New</button>
          <button onClick={handleOpenBoard}>Open...</button>
          <button onClick={handleSaveBoard}>Save</button>
          <button onClick={handleSaveAs}>Save As...</button>
          <button onClick={handleRenameBoard}>Rename</button>
          <button onClick={handleDuplicateBoard}>Duplicate</button>
          <button onClick={handleDeleteCurrentBoard}>Delete</button>
          <button onClick={() => {
            setShowTemplateGallery(!showTemplateGallery);
            setShowRecent(false);
            setShowExport(false);
          }}>
            Templates
          </button>
          <button onClick={handleSaveAsTemplate}>Save Template</button>
          <label className="auto-save-toggle">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(event) => handleAutoSaveToggle(event.currentTarget.checked)}
            />
            Auto-save
          </label>
          <ThemeToggle compact />

          {/* Recent boards dropdown */}
          <div className="recent-dropdown">
            <button onClick={() => {
              setShowRecent(!showRecent);
              setShowExport(false);
            }}>
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

          <label className="file-input-label">
            <input
              id="recall-graph-input"
              type="file"
              accept=".json"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            Load Recall Graph IR
          </label>
          <div className="export-dropdown">
            <button onClick={() => {
              setShowExport(!showExport);
              setShowRecent(false);
            }}>
              Export v
            </button>
            {showExport && (
              <div className="export-menu">
                {EXPORT_OPTIONS.map((option) => (
                  <button
                    key={option.format}
                    className="export-item"
                    onClick={() => handleExport(option.format)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        <Excalidraw
          onChange={handleChange}
          excalidrawAPI={handleExcalidrawAPI}
          theme={excalidrawTheme}
        />
        {!homeDismissed && !currentBoard && activeElementCount === 0 && (
          <HomeScreen
            templates={templates}
            recentBoards={recentBoards}
            onUseTemplate={handleUseTemplate}
            onOpenRecent={handleOpenRecent}
            onRenameRecent={handleRenameRecent}
            onDeleteRecent={handleDeleteRecentCard}
            onDuplicateRecent={handleDuplicateRecent}
            onNew={handleBlankCanvas}
            onOpen={handleOpenBoard}
            onImport={() => document.getElementById("recall-graph-input")?.click()}
          />
        )}
        {showTemplateGallery && (
          <div className="template-overlay">
            <div className="template-overlay-panel">
              <TemplateGallery
                templates={templates}
                onUseTemplate={handleUseTemplate}
                onClose={() => setShowTemplateGallery(false)}
              />
            </div>
          </div>
        )}
      </main>
      {showTranscript && (
        <TranscriptPanel onClose={() => setShowTranscript(false)} />
      )}
    </div>
  );
}

export default App;
