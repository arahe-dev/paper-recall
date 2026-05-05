import { useRef, useCallback, useState, useEffect } from "react";
import { Excalidraw, exportToCanvas, restoreElements, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import "./App.css";
import HomeScreen from "./components/HomeScreen";
import BacklinksPanel from "./components/BacklinksPanel";
import ContextMenu from "./components/ContextMenu";
import GraphView from "./components/GraphView";
import QuickSearch from "./components/QuickSearch";
import SubpageBadge from "./components/SubpageBadge";
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
  listBoards,
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
import {
  getBacklinks,
  getAllLinks,
  getElementLinkTarget,
  rebuildLinksFromBoards,
  removeLinksForBoard,
  syncBoardLinksFromElements,
  withBoardLink,
  type LinkableElement,
  type LinkEntry,
} from "./utils/linkEngine";
import {
  getSearchIndexStats,
  indexBoard,
  rebuildIndex,
  removeBoard as removeIndexedBoard,
  search as searchBoards,
  type SearchResult,
} from "./utils/searchIndex";
import {
  createSubpage,
  deleteSubpage,
  getElementSubpageId,
  getSubpageBreadcrumbs,
  navigateToSubpage,
  saveSubpage,
  withSubpageReference,
  withoutSubpageReference,
  type SubpageData,
  type SubpageElement,
} from "./utils/subpageEngine";

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
      rebuildSearchIndex?: () => Promise<unknown>;
      getSearchIndexStats?: () => unknown;
      searchBoards?: (query: string) => SearchResult[];
      createBoardLink?: (targetBoardId: string, sourceElementId?: string) => Promise<boolean>;
      getLinks?: () => LinkEntry[];
      getBacklinks?: (boardId: string) => LinkEntry[];
      openBoardById?: (boardId: string, path?: string) => Promise<boolean>;
      saveCurrentBoard?: () => Promise<BoardMeta | null>;
      createSubpageForElement?: (elementId?: string) => Promise<string | null>;
      openSubpage?: (subpageId: string) => Promise<boolean>;
      getSubpageStack?: () => SubpageData[];
    };
  }
}

type SidebarTab = "graph" | "backlinks";
type ContextMenuState = {
  x: number;
  y: number;
  elementId: string;
  subpageId: string | null;
};

function isBoardInteractionTarget(element: LooseElement): boolean {
  if (element.isDeleted || element.type === "arrow" || element.type === "text") return false;
  const customData = element.customData || {};
  if (customData.recallIgnoreInTextGraph === true) return false;
  return customData.recallEntityType !== "layout_background";
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
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("graph");
  const [allLinks, setAllLinks] = useState<LinkEntry[]>(() => getAllLinks());
  const [subpageStack, setSubpageStack] = useState<SubpageData[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [canvasSnapshot, setCanvasSnapshot] = useState<{
    elements: readonly LooseElement[];
    appState: LooseAppState;
  }>({ elements: [], appState: {} });
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
      setCanvasSnapshot({
        elements: elements as readonly LooseElement[],
        appState: appState as LooseAppState,
      });
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
    elementsRef.current = result.elements as readonly LooseElement[];
    appStateRef.current = {
      ...(appStateRef.current || {}),
      viewBackgroundColor: json.layout.style === "readable_radial"
        ? canvasBackgroundColor
        : appState?.viewBackgroundColor || canvasBackgroundColor,
      theme: excalidrawTheme,
    };
    setCanvasSnapshot({
      elements: result.elements as readonly LooseElement[],
      appState: appStateRef.current,
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

  const refreshLinks = useCallback(() => {
    setAllLinks(getAllLinks());
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([rebuildIndex(), rebuildLinksFromBoards()])
      .then(() => {
        if (!cancelled) {
          refreshLinks();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLastLoadErrors([`Search/link index rebuild failed: ${err}`]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshLinks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        elementsRef.current = restored as readonly LooseElement[];
        setCanvasSnapshot({ elements: restored as readonly LooseElement[], appState: appStateRef.current });

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
    elementsRef.current = scene.elements as readonly LooseElement[];
    appStateRef.current = scene.appState as LooseAppState;
    setCanvasSnapshot({
      elements: scene.elements as readonly LooseElement[],
      appState: scene.appState as LooseAppState,
    });
    setActiveElementCount((scene.elements as LooseElement[]).filter((el) => !el.isDeleted).length);
    setHomeDismissed(true);
  }, []);

  const canDiscardDirty = useCallback(() => (
    !isDirty || window.confirm("Discard unsaved changes?")
  ), [isDirty]);

  const syncIndexesForBoard = useCallback(async (board: BoardMeta, scene: SceneData) => {
    const elements = scene.elements as LooseElement[];
    indexBoard(board, elements);
    const boards = await listBoards();
    syncBoardLinksFromElements(board, elements as LinkableElement[], boards);
    refreshLinks();
  }, [refreshLinks]);

  const refreshSearchIndexForCurrentBoard = useCallback(async () => {
    if (!currentBoard) return;
    const rootScene = await loadBoard(currentBoard);
    if (rootScene) {
      indexBoard(currentBoard, rootScene.elements as LooseElement[]);
    }
  }, [currentBoard]);

  const saveSceneToBoard = useCallback(async (board: BoardMeta, scene: SceneData) => {
    saveInFlightRef.current = true;
    setIsSaving(true);
    try {
      const thumbnail = await createCurrentThumbnail();
      const updated = await saveBoard(thumbnail ? { ...board, thumbnail } : board, scene);
      await syncIndexesForBoard(updated, scene);
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
  }, [createCurrentThumbnail, syncIndexesForBoard]);

  const handleNewBoard = useCallback(() => {
    if (!canDiscardDirty()) return;
    suppressDirtyUntilRef.current = Date.now() + 750;
    apiRef.current?.resetScene();
    elementsRef.current = [];
    setCanvasSnapshot({ elements: [], appState: appStateRef.current });
    setCurrentBoard(null);
    setSubpageStack([]);
    setContextMenu(null);
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

  const handleSaveAs = useCallback(async (): Promise<BoardMeta | null> => {
    if (subpageStack.length > 0) {
      setLastLoadErrors(["Use Save for subpages, or go back to the board before Save As."]);
      return null;
    }
    const scene = getCurrentScene();
    if (isTauriEnv()) {
      const meta = await saveBoardWithDialog(scene, currentBoard?.name || "board.excalidraw");
      if (meta) {
        const thumbnail = await createCurrentThumbnail();
        const updated = thumbnail ? await saveBoard({ ...meta, thumbnail }, scene) : meta;
        await syncIndexesForBoard(updated, scene);
        setCurrentBoard(updated);
        setIsDirty(false);
        setLastSavedAt(updated.lastModified);
        setRecentBoards(getRecentBoards());
        setHomeDismissed(true);
        return updated;
      }
      return null;
    } else {
      const name = window.prompt("Board name", currentBoard?.name || "Untitled");
      if (!name) return null;
      const meta = await createBoard(name.replace(/\.excalidraw$/i, ""), scene);
      const thumbnail = await createCurrentThumbnail();
      const updated = thumbnail ? await saveBoard({ ...meta, thumbnail }, scene) : meta;
      await syncIndexesForBoard(updated, scene);
      setCurrentBoard(updated);
      setIsDirty(false);
      setLastSavedAt(updated.lastModified);
      setRecentBoards(getRecentBoards());
      setHomeDismissed(true);
      return updated;
    }
  }, [createCurrentThumbnail, currentBoard, getCurrentScene, subpageStack.length, syncIndexesForBoard]);

  const handleSaveBoard = useCallback(async (): Promise<BoardMeta | null> => {
    const currentSubpage = subpageStack[subpageStack.length - 1];
    if (currentBoard && currentSubpage) {
      const updated = saveSubpage(
        currentSubpage.id,
        elementsRef.current,
        appStateRef.current,
        currentSubpage.title
      );
      if (updated) {
        setSubpageStack((prev) => prev.map((item) => item.id === updated.id ? updated : item));
        await refreshSearchIndexForCurrentBoard();
        setIsDirty(false);
        setLastSavedAt(updated.updatedAt);
        setLastLoadErrors([]);
        return currentBoard;
      }
      setLastLoadErrors([`Failed to save subpage: ${currentSubpage.title}`]);
      return null;
    }
    const scene = getCurrentScene();
    if (currentBoard) {
      return saveSceneToBoard(currentBoard, scene);
    }
    return handleSaveAs();
  }, [currentBoard, getCurrentScene, handleSaveAs, refreshSearchIndexForCurrentBoard, saveSceneToBoard, subpageStack]);

  const handleOpenBoard = useCallback(async () => {
    if (!canDiscardDirty()) return;
    if (isTauriEnv()) {
      const result = await openBoardWithDialog();
      if (result) {
        restoreScene(result.scene);
        setCurrentBoard(result.meta);
        setSubpageStack([]);
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
      setSubpageStack([]);
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
      removeIndexedBoard(meta.id);
      removeLinksForBoard(meta.id);
      refreshLinks();
      setRecentBoards(getRecentBoards());
      if (currentBoard?.path === meta.path) {
        setCurrentBoard(null);
        setIsDirty(false);
        setLastSavedAt(null);
        setActiveElementCount(0);
        setHomeDismissed(false);
      }
    }
  }, [currentBoard, refreshLinks]);

  const handleRenameBoard = useCallback(async () => {
    if (!currentBoard) {
      setLastLoadErrors(["Save the board before renaming it."]);
      return;
    }
    const name = window.prompt("Rename board", currentBoard.name);
    if (!name || name.trim() === currentBoard.name) return;
    try {
      const updated = await renameBoard(currentBoard, name);
      await syncIndexesForBoard(updated, getCurrentScene());
      setCurrentBoard(updated);
      setRecentBoards(getRecentBoards());
      setLastSavedAt(updated.lastModified);
      setLastLoadErrors([]);
    } catch (err) {
      setLastLoadErrors([`Failed to rename board: ${err}`]);
    }
  }, [currentBoard, getCurrentScene, syncIndexesForBoard]);

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
      removeIndexedBoard(currentBoard.id);
      removeLinksForBoard(currentBoard.id);
      refreshLinks();
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
  }, [currentBoard, refreshLinks]);

  const findBoardMeta = useCallback(async (boardId: string, path?: string): Promise<BoardMeta | null> => {
    const boards = [...recentBoards, ...(await listBoards())];
    const seen = new Set<string>();
    const unique = boards.filter((board) => {
      const key = `${board.id}|${board.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const found = unique.find((board) => board.id === boardId || (path && board.path === path));
    if (found) return found;
    if (path) {
      return {
        id: boardId,
        name: path.split(/[\\/]/).pop()?.replace(/\.excalidraw$/i, "") || boardId,
        path,
        lastModified: Date.now(),
        elementCount: 0,
      };
    }
    return null;
  }, [recentBoards]);

  const scrollToElement = useCallback((elementId: string | undefined, elements: unknown[]) => {
    window.setTimeout(() => {
      const api = apiRef.current as RecallExcalidrawAPI | null;
      if (!api?.scrollToContent) return;
      const activeElements = (elements as LooseElement[]).filter((element) => !element.isDeleted);
      const target = elementId
        ? activeElements.find((element) => element.id === elementId)
        : null;
      api.scrollToContent(target ? [target] : activeElements, {
        fitToViewport: true,
        animate: true,
      });
    }, 80);
  }, []);

  const loadSubpageScene = useCallback((subpage: SubpageData, stack: SubpageData[]) => {
    const appState = {
      ...subpage.appState,
      viewBackgroundColor: subpage.appState.viewBackgroundColor || canvasBackgroundColor,
      theme: excalidrawTheme,
    };
    suppressDirtyUntilRef.current = Date.now() + 750;
    apiRef.current?.updateScene({
      elements: subpage.elements as never,
      appState: appState as never,
      captureUpdate: "NEVER" as never,
    });
    elementsRef.current = subpage.elements;
    appStateRef.current = appState;
    setCanvasSnapshot({ elements: subpage.elements, appState });
    setActiveElementCount(subpage.elements.filter((element) => !element.isDeleted).length);
    setSubpageStack(stack);
    setIsDirty(false);
    setHomeDismissed(true);
    setContextMenu(null);
    setLastLoadErrors([]);
  }, [canvasBackgroundColor, excalidrawTheme]);

  const persistActiveSceneBeforeNavigation = useCallback(async () => {
    if (!currentBoard) return false;
    const currentSubpage = subpageStack[subpageStack.length - 1];
    if (currentSubpage) {
      const updated = saveSubpage(
        currentSubpage.id,
        elementsRef.current,
        appStateRef.current,
        currentSubpage.title
      );
      if (!updated) {
        setLastLoadErrors([`Failed to save subpage: ${currentSubpage.title}`]);
        return false;
      }
      setSubpageStack((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      await refreshSearchIndexForCurrentBoard();
      setIsDirty(false);
      setLastSavedAt(updated.updatedAt);
      return true;
    }
    await saveSceneToBoard(currentBoard, getCurrentScene());
    return true;
  }, [currentBoard, getCurrentScene, refreshSearchIndexForCurrentBoard, saveSceneToBoard, subpageStack]);

  const openSubpageById = useCallback(async (subpageId: string): Promise<boolean> => {
    const target = navigateToSubpage(subpageId);
    if (!target) {
      setLastLoadErrors([`Subpage not found: ${subpageId}`]);
      return false;
    }
    if (currentBoard && !(await persistActiveSceneBeforeNavigation())) return false;
    const stack = getSubpageBreadcrumbs(subpageId);
    loadSubpageScene(target, stack.length > 0 ? stack : [target]);
    return true;
  }, [currentBoard, loadSubpageScene, persistActiveSceneBeforeNavigation]);

  const navigateToBreadcrumb = useCallback(async (index: number) => {
    if (!currentBoard) return;
    if (!(await persistActiveSceneBeforeNavigation())) return;
    if (index <= 0) {
      const rootScene = await loadBoard(currentBoard);
      if (!rootScene) {
        setLastLoadErrors([`Failed to load board: ${currentBoard.name}`]);
        return;
      }
      restoreScene(rootScene);
      setSubpageStack([]);
      setIsDirty(false);
      setLastLoadErrors([]);
      return;
    }
    const nextStack = subpageStack.slice(0, index);
    const target = nextStack[nextStack.length - 1];
    if (target) loadSubpageScene(target, nextStack);
  }, [currentBoard, loadSubpageScene, persistActiveSceneBeforeNavigation, restoreScene, subpageStack]);

  const scenePointFromClient = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const appState = apiRef.current?.getAppState() as LooseAppState | undefined;
    const zoom = appState?.zoom;
    if (
      !zoom ||
      typeof zoom !== "object" ||
      typeof appState?.offsetLeft !== "number" ||
      typeof appState.offsetTop !== "number" ||
      typeof appState.scrollX !== "number" ||
      typeof appState.scrollY !== "number"
    ) {
      return null;
    }
    return viewportCoordsToSceneCoords(
      { clientX, clientY },
      {
        zoom: zoom as never,
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      }
    );
  }, []);

  const elementAtClientPoint = useCallback((clientX: number, clientY: number): SubpageElement | null => {
    const point = scenePointFromClient(clientX, clientY);
    if (!point) return null;
    const elements = (
      (apiRef.current as RecallExcalidrawAPI | null)?.getSceneElementsIncludingDeleted?.() ||
      apiRef.current?.getSceneElements() ||
      elementsRef.current
    ) as readonly SubpageElement[];
    const hitPadding = 6;
    for (const element of [...elements].reverse()) {
      if (!isBoardInteractionTarget(element)) continue;
      const minX = Math.min(element.x, element.x + element.width) - hitPadding;
      const maxX = Math.max(element.x, element.x + element.width) + hitPadding;
      const minY = Math.min(element.y, element.y + element.height) - hitPadding;
      const maxY = Math.max(element.y, element.y + element.height) + hitPadding;
      if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
        return element;
      }
    }
    return null;
  }, [scenePointFromClient]);

  const updateElementInScene = useCallback((
    elementId: string,
    updater: (element: SubpageElement) => SubpageElement
  ): readonly SubpageElement[] => {
    const currentElements = (
      (apiRef.current as RecallExcalidrawAPI | null)?.getSceneElementsIncludingDeleted?.() ||
      apiRef.current?.getSceneElements() ||
      elementsRef.current
    ) as readonly SubpageElement[];
    const updatedElements = currentElements.map((element) => (
      element.id === elementId ? updater(element) : element
    ));
    apiRef.current?.updateScene({
      elements: updatedElements as never,
      captureUpdate: "IMMEDIATELY" as never,
    });
    elementsRef.current = updatedElements as readonly LooseElement[];
    setCanvasSnapshot({ elements: updatedElements as readonly LooseElement[], appState: appStateRef.current });
    setIsDirty(true);
    return updatedElements;
  }, []);

  const handleOpenBoardById = useCallback(async (boardId: string, path?: string): Promise<boolean> => {
    if (!canDiscardDirty()) return false;
    const meta = await findBoardMeta(boardId, path);
    if (!meta) {
      setLastLoadErrors([`Board not found: ${boardId}`]);
      return false;
    }
    const scene = await loadBoard(meta);
    if (!scene) {
      setLastLoadErrors([`Failed to load board: ${meta.name}`]);
      return false;
    }
    restoreScene(scene);
    setCurrentBoard(meta);
    setSubpageStack([]);
    setIsDirty(false);
    setLastSavedAt(meta.lastModified);
    setRecentBoards(getRecentBoards());
    setShowRecent(false);
    setHomeDismissed(true);
    setLastLoadErrors([]);
    scrollToElement(undefined, scene.elements);
    return true;
  }, [canDiscardDirty, findBoardMeta, restoreScene, scrollToElement]);

  const handleOpenSearchResult = useCallback(async (result: SearchResult) => {
    if (!canDiscardDirty()) return;
    const meta: BoardMeta = {
      id: result.boardId,
      name: result.boardName,
      path: result.boardPath,
      lastModified: result.boardLastModified,
      elementCount: result.boardElementCount,
    };
    const scene = await loadBoard(meta);
    if (!scene) {
      setLastLoadErrors([`Failed to load board: ${result.boardName}`]);
      return;
    }
    restoreScene(scene);
    setCurrentBoard(meta);
    setSubpageStack([]);
    setIsDirty(false);
    setLastSavedAt(meta.lastModified);
    setRecentBoards(getRecentBoards());
    setQuickSearchOpen(false);
    setHomeDismissed(true);
    setLastLoadErrors([]);
    if (result.subpageId) {
      const subpage = navigateToSubpage(result.subpageId);
      if (subpage) {
        const stack = getSubpageBreadcrumbs(result.subpageId);
        loadSubpageScene(subpage, stack.length > 0 ? stack : [subpage]);
        scrollToElement(result.elementId, subpage.elements);
        return;
      }
    }
    scrollToElement(result.elementId, scene.elements);
  }, [canDiscardDirty, loadSubpageScene, restoreScene, scrollToElement]);

  const selectBoardLinkTarget = useCallback(async (targetBoardId?: string): Promise<BoardMeta | null> => {
    const boards = await listBoards();
    const candidates = boards.filter((board) => board.id !== currentBoard?.id);
    if (targetBoardId) {
      return candidates.find((board) => board.id === targetBoardId || board.path === targetBoardId) || null;
    }
    if (candidates.length === 0) return null;
    const options = candidates
      .map((board, index) => `${index + 1}. ${board.name}`)
      .join("\n");
    const answer = window.prompt(`Link selected element to board:\n${options}`, "1");
    if (!answer) return null;
    const numeric = Number.parseInt(answer, 10);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= candidates.length) {
      return candidates[numeric - 1];
    }
    return candidates.find((board) => (
      board.name.toLowerCase() === answer.trim().toLowerCase() ||
      board.id === answer.trim()
    )) || null;
  }, [currentBoard]);

  const firstLinkableElementId = useCallback((sourceElementId?: string): string | null => {
    const elements = (
      (apiRef.current as RecallExcalidrawAPI | null)?.getSceneElementsIncludingDeleted?.() ||
      apiRef.current?.getSceneElements() ||
      elementsRef.current
    ) as readonly LooseElement[];
    if (sourceElementId && elements.some((element) => element.id === sourceElementId && isBoardInteractionTarget(element))) {
      return sourceElementId;
    }
    const selectedElementIds = apiRef.current?.getAppState().selectedElementIds as Record<string, boolean> | undefined;
    const selectedId = Object.entries(selectedElementIds || {})
      .find(([id, selected]) => selected && elements.some((element) => element.id === id && isBoardInteractionTarget(element)))?.[0];
    if (selectedId) return selectedId;
    return elements.find(isBoardInteractionTarget)?.id || null;
  }, []);

  const handleCreateBoardLink = useCallback(async (
    targetBoardId?: string,
    sourceElementId?: string
  ): Promise<boolean> => {
    if (!currentBoard) {
      setLastLoadErrors(["Save the current board before linking it to another board."]);
      return false;
    }
    const target = await selectBoardLinkTarget(targetBoardId);
    if (!target) {
      setLastLoadErrors(["No target board selected for link."]);
      return false;
    }
    const elementId = firstLinkableElementId(sourceElementId);
    if (!elementId) {
      setLastLoadErrors(["Select or create an element before adding a board link."]);
      return false;
    }

    const currentElements = (
      (apiRef.current as RecallExcalidrawAPI | null)?.getSceneElementsIncludingDeleted?.() ||
      apiRef.current?.getSceneElements() ||
      elementsRef.current
    ) as readonly LinkableElement[];
    const updatedElements = currentElements.map((element) => (
      element.id === elementId
        ? withBoardLink(element, target, "board-link")
        : element
    ));
    apiRef.current?.updateScene({
      elements: updatedElements as never,
      captureUpdate: "IMMEDIATELY" as never,
    });
    elementsRef.current = updatedElements as readonly LooseElement[];
    syncBoardLinksFromElements(currentBoard, updatedElements, await listBoards());
    refreshLinks();
    setIsDirty(true);
    setSidebarTab("backlinks");
    setLastLoadErrors([]);
    return true;
  }, [currentBoard, firstLinkableElementId, refreshLinks, selectBoardLinkTarget]);

  const handleLinkOpen = useCallback((element: unknown, event: CustomEvent) => {
    const targetId = getElementLinkTarget(element as LinkableElement);
    if (!targetId) return;
    event.preventDefault();
    void handleOpenBoardById(targetId);
  }, [handleOpenBoardById]);

  const findElementById = useCallback((elementId: string | undefined): SubpageElement | null => {
    const elements = (
      (apiRef.current as RecallExcalidrawAPI | null)?.getSceneElementsIncludingDeleted?.() ||
      apiRef.current?.getSceneElements() ||
      elementsRef.current
    ) as readonly SubpageElement[];
    if (!elementId) {
      return elements.find(isBoardInteractionTarget) || null;
    }
    const element = elements.find((candidate) => candidate.id === elementId && !candidate.isDeleted) || null;
    return element && isBoardInteractionTarget(element) ? element : null;
  }, []);

  const handleCreateSubpageForElement = useCallback(async (elementId?: string): Promise<string | null> => {
    if (!currentBoard) {
      setLastLoadErrors(["Save the current board before creating a subpage."]);
      return null;
    }
    const element = findElementById(elementId || contextMenu?.elementId);
    if (!element) {
      setLastLoadErrors(["Right-click or select an element before creating a subpage."]);
      return null;
    }
    const existingSubpageId = getElementSubpageId(element);
    if (existingSubpageId) {
      await openSubpageById(existingSubpageId);
      return existingSubpageId;
    }
    const currentSubpage = subpageStack[subpageStack.length - 1];
    const subpage = createSubpage(
      element,
      currentBoard.id,
      currentBoard.name,
      currentSubpage?.id
    );
    updateElementInScene(element.id, (nextElement) => withSubpageReference(nextElement, subpage.id, subpage.title));
    setContextMenu(null);
    await openSubpageById(subpage.id);
    return subpage.id;
  }, [contextMenu, currentBoard, findElementById, openSubpageById, subpageStack, updateElementInScene]);

  const handleDeleteSubpageForElement = useCallback(async (elementId?: string) => {
    const element = findElementById(elementId || contextMenu?.elementId);
    const subpageId = getElementSubpageId(element);
    if (!element || !subpageId) return;
    if (!window.confirm("Delete this subpage and its nested subpages?")) return;
    deleteSubpage(subpageId);
    updateElementInScene(element.id, withoutSubpageReference);
    setContextMenu(null);
    await refreshSearchIndexForCurrentBoard();
  }, [contextMenu, findElementById, refreshSearchIndexForCurrentBoard, updateElementInScene]);

  const handleNavigateSubpageForElement = useCallback(async (elementId?: string) => {
    const element = findElementById(elementId || contextMenu?.elementId);
    const subpageId = getElementSubpageId(element);
    setContextMenu(null);
    if (subpageId) {
      await openSubpageById(subpageId);
    }
  }, [contextMenu, findElementById, openSubpageById]);

  const handleBoardContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".top-bar, .board-side-panel, .quick-search-panel, .template-overlay, .home-screen")) {
      return;
    }
    const element = elementAtClientPoint(event.clientX, event.clientY);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      elementId: element.id,
      subpageId: getElementSubpageId(element),
    });
  }, [elementAtClientPoint]);

  const handleBoardDoubleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".top-bar, .board-side-panel, .template-overlay, .home-screen")) {
      return;
    }
    const element = elementAtClientPoint(event.clientX, event.clientY);
    const subpageId = getElementSubpageId(element);
    if (subpageId) {
      event.preventDefault();
      void openSubpageById(subpageId);
    }
  }, [elementAtClientPoint, openSubpageById]);

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
        await syncIndexesForBoard(meta, scene);
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
    [restoreScene, syncIndexesForBoard]
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
        const scene = getCurrentScene();
        const meta = await createBoard(name, scene);
        await syncIndexesForBoard(meta, scene);
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
  }, [autoSaveEnabled, currentBoard, getCurrentScene, isDirty, saveSceneToBoard, syncIndexesForBoard]);

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
      setSubpageStack([]);
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
    removeIndexedBoard(meta.id);
    removeLinksForBoard(meta.id);
    refreshLinks();
    setRecentBoards(getRecentBoards());
    if (currentBoard?.path === meta.path) {
      apiRef.current?.resetScene();
      setCurrentBoard(null);
      setIsDirty(false);
      setLastSavedAt(null);
      setActiveElementCount(0);
      setHomeDismissed(false);
    }
  }, [currentBoard, refreshLinks]);

  useEffect(() => {
    window.__RECALL_API__ = {
      ...(window.__RECALL_API__ || {}),
      rebuildSearchIndex: rebuildIndex,
      getSearchIndexStats,
      searchBoards: (query: string) => searchBoards(query),
      createBoardLink: handleCreateBoardLink,
      getLinks: getAllLinks,
      getBacklinks: (boardId: string) => getBacklinks(boardId),
      openBoardById: handleOpenBoardById,
      saveCurrentBoard: handleSaveBoard,
      createSubpageForElement: handleCreateSubpageForElement,
      openSubpage: openSubpageById,
      getSubpageStack: () => subpageStack,
    } as Window["__RECALL_API__"];
  }, [handleCreateBoardLink, handleCreateSubpageForElement, handleOpenBoardById, handleSaveBoard, openSubpageById, subpageStack]);

  const saveStatus = isSaving
    ? "saving"
    : isDirty
      ? "unsaved"
      : lastSavedAt
        ? "saved"
        : "new";
  const currentBacklinks = currentBoard
    ? allLinks.filter((entry) => entry.targetBoardId === currentBoard.id)
    : [];
  const showSidePanel = homeDismissed || Boolean(currentBoard) || recentBoards.length > 0 || allLinks.length > 0;

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
          <button onClick={() => setQuickSearchOpen(true)}>Search</button>
          <button onClick={() => void handleCreateBoardLink()}>Link Board</button>
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

      {currentBoard && subpageStack.length > 0 && (
        <nav className="breadcrumb-bar" aria-label="Subpage breadcrumbs">
          <button type="button" onClick={() => void navigateToBreadcrumb(0)}>
            Board: {currentBoard.name}
          </button>
          {subpageStack.map((subpage, index) => (
            <button
              type="button"
              key={subpage.id}
              onClick={() => void navigateToBreadcrumb(index + 1)}
            >
              Subpage: {subpage.title}
            </button>
          ))}
          <button
            type="button"
            className="breadcrumb-back"
            onClick={() => void navigateToBreadcrumb(subpageStack.length - 1)}
          >
            Go Back
          </button>
        </nav>
      )}

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
      <main
        className="board"
        onContextMenuCapture={handleBoardContextMenu}
        onDoubleClickCapture={handleBoardDoubleClick}
      >
        <Excalidraw
          onChange={handleChange}
          excalidrawAPI={handleExcalidrawAPI}
          onLinkOpen={handleLinkOpen}
          theme={excalidrawTheme}
        />
        <SubpageBadge
          elements={canvasSnapshot.elements}
          appState={canvasSnapshot.appState}
          onOpen={(subpageId) => void openSubpageById(subpageId)}
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
        {showSidePanel && (
          <aside className="board-side-panel glass-panel">
            <div className="side-panel-header">
              <button
                type="button"
                className={sidebarTab === "graph" ? "active" : ""}
                onClick={() => setSidebarTab("graph")}
              >
                Graph
              </button>
              <button
                type="button"
                className={sidebarTab === "backlinks" ? "active" : ""}
                onClick={() => setSidebarTab("backlinks")}
              >
                Backlinks
              </button>
            </div>
            <div className="side-panel-body">
              {sidebarTab === "graph" ? (
                <GraphView
                  boards={recentBoards}
                  links={allLinks}
                  currentBoardId={currentBoard?.id}
                  onOpenBoard={(boardId, path) => void handleOpenBoardById(boardId, path)}
                />
              ) : currentBoard ? (
                <BacklinksPanel
                  backlinks={currentBacklinks}
                  onOpenBoard={(boardId, path) => void handleOpenBoardById(boardId, path)}
                />
              ) : (
                <div className="backlinks-empty">
                  <strong>No board selected</strong>
                  <span>Open a saved board to inspect backlinks.</span>
                </div>
              )}
            </div>
          </aside>
        )}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasSubpage={Boolean(contextMenu.subpageId)}
            onCreateSubpage={() => void handleCreateSubpageForElement(contextMenu.elementId)}
            onNavigateSubpage={() => void handleNavigateSubpageForElement(contextMenu.elementId)}
            onDeleteSubpage={() => void handleDeleteSubpageForElement(contextMenu.elementId)}
            onLinkBoard={() => {
              setContextMenu(null);
              void handleCreateBoardLink(undefined, contextMenu.elementId);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}
      </main>
      <QuickSearch
        open={quickSearchOpen}
        onClose={() => setQuickSearchOpen(false)}
        onOpenResult={(result) => void handleOpenSearchResult(result)}
      />
      {showTranscript && (
        <TranscriptPanel onClose={() => setShowTranscript(false)} />
      )}
    </div>
  );
}

export default App;
