/**
 * Board Storage - Tauri-native file persistence with browser fallback.
 *
 * When running inside Tauri, boards are saved to the user's
 * Documents/RecallBoard/boards/ directory as .excalidraw files.
 *
 * When running in a browser (pnpm dev), boards fall back to localStorage
 * so the app remains functional without the Tauri shell.
 */

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface BoardMeta {
  id: string;
  name: string;
  path: string;
  lastModified: number;
  elementCount: number;
}

export interface SceneData {
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface OpenBoardResult {
  scene: SceneData;
  meta: BoardMeta;
}

const RECENT_KEY = "recall_recent_boards";
const FALLBACK_PREFIX = "recall_board_";

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined)
  );
}

// Browser fallback helpers

function getFallbackBoards(): BoardMeta[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function fallbackSaveBoard(id: string, content: string): void {
  localStorage.setItem(`${FALLBACK_PREFIX}${id}`, content);
}

function fallbackLoadBoard(id: string): string | null {
  return localStorage.getItem(`${FALLBACK_PREFIX}${id}`);
}

function fallbackDeleteBoard(id: string): void {
  localStorage.removeItem(`${FALLBACK_PREFIX}${id}`);
}

// Public API

export async function ensureBoardDir(): Promise<string> {
  if (isTauri()) {
    return invoke<string>("ensure_board_dir");
  }
  return "";
}

export async function createBoard(name: string, scene: SceneData): Promise<BoardMeta> {
  const id = generateId();
  const content = JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "recall-board",
    elements: scene.elements,
    appState: scene.appState,
    files: scene.files ?? {},
  }, null, 2);

  if (isTauri()) {
    const boardDir = await ensureBoardDir();
    const path = `${boardDir}\\${name}.excalidraw`;
    await invoke("save_board", { path, content });
    const meta: BoardMeta = {
      id,
      name,
      path,
      lastModified: Date.now(),
      elementCount: scene.elements.length,
    };
    addRecentBoard(meta);
    return meta;
  } else {
    fallbackSaveBoard(id, content);
    const meta: BoardMeta = {
      id,
      name,
      path: `fallback://${id}`,
      lastModified: Date.now(),
      elementCount: scene.elements.length,
    };
    addRecentBoard(meta);
    return meta;
  }
}

export async function saveBoard(meta: BoardMeta, scene: SceneData): Promise<void> {
  const content = JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "recall-board",
    elements: scene.elements,
    appState: scene.appState,
    files: scene.files ?? {},
  }, null, 2);

  if (isTauri()) {
    await invoke("save_board", { path: meta.path, content });
  } else {
    const fallbackId = meta.path.replace("fallback://", "");
    fallbackSaveBoard(fallbackId, content);
  }

  // Update recent list timestamp
  updateRecentBoardTimestamp(meta.path);
}

export async function openBoardWithDialog(): Promise<OpenBoardResult | null> {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        { name: "Excalidraw Files", extensions: ["excalidraw"] },
        { name: "JSON Files", extensions: ["json"] },
      ],
    });
    if (!selected || Array.isArray(selected)) return null;

    const content = await invoke<string>("load_board", { path: selected });
    const scene = parseScene(content);
    if (!scene) return null;

    const meta: BoardMeta = {
      id: generateId(),
      name: selected.split(/[\\/]/).pop()?.replace(/\.excalidraw$/, "") || "Untitled",
      path: selected,
      lastModified: Date.now(),
      elementCount: scene.elements.length,
    };
    addRecentBoard(meta);
    return { scene, meta };
  } else {
    // Browser fallback: use native file input (handled separately in UI)
    return null;
  }
}

export async function saveBoardWithDialog(scene: SceneData, defaultName?: string): Promise<BoardMeta | null> {
  if (isTauri()) {
    const content = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "recall-board",
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files ?? {},
    }, null, 2);

    const boardDir = await ensureBoardDir();
    const fileName = ensureExcalidrawExtension(defaultName || "board.excalidraw");
    const path = await save({
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
      defaultPath: `${boardDir}\\${fileName}`,
    });

    if (!path) return null;

    await invoke("save_board", { path, content });
    const meta: BoardMeta = {
      id: generateId(),
      name: path.split(/[\\/]/).pop()?.replace(/\.excalidraw$/, "") || "Untitled",
      path,
      lastModified: Date.now(),
      elementCount: scene.elements.length,
    };
    addRecentBoard(meta);
    return meta;
  } else {
    // Browser fallback: use downloadJSON (handled separately in UI)
    return null;
  }
}

export async function loadBoard(meta: BoardMeta): Promise<SceneData | null> {
  if (isTauri()) {
    const content = await invoke<string>("load_board", { path: meta.path });
    return parseScene(content);
  } else {
    const fallbackId = meta.path.replace("fallback://", "");
    const content = fallbackLoadBoard(fallbackId);
    return content ? parseScene(content) : null;
  }
}

export async function deleteBoard(meta: BoardMeta): Promise<void> {
  if (isTauri()) {
    await invoke("delete_board", { path: meta.path });
  } else {
    const fallbackId = meta.path.replace("fallback://", "");
    fallbackDeleteBoard(fallbackId);
  }
  removeRecentBoard(meta.path);
}

export async function renameBoard(meta: BoardMeta, newName: string): Promise<BoardMeta> {
  if (isTauri()) {
    const newPath = meta.path.replace(/[^\\/]+$/, `${newName}.excalidraw`);
    await invoke("rename_board", { oldPath: meta.path, newPath });
    const updated: BoardMeta = { ...meta, name: newName, path: newPath };
    updateRecentBoard(meta.path, updated);
    return updated;
  }
  return meta;
}

export async function listBoards(): Promise<BoardMeta[]> {
  if (isTauri()) {
    const boards = await invoke<Array<{ name: string; path: string; last_modified: number; element_count: number }>>("list_boards");
    return boards.map((b) => ({
      id: generateId(),
      name: b.name,
      path: b.path,
      lastModified: b.last_modified * 1000,
      elementCount: b.element_count,
    }));
  } else {
    return getFallbackBoards();
  }
}

// Recent boards

export function getRecentBoards(): BoardMeta[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentBoard(meta: BoardMeta): void {
  const existing = getRecentBoards();
  const filtered = existing.filter((b) => b.path !== meta.path);
  const updated = [meta, ...filtered].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

function updateRecentBoardTimestamp(path: string): void {
  const existing = getRecentBoards();
  const idx = existing.findIndex((b) => b.path === path);
  if (idx >= 0) {
    existing[idx].lastModified = Date.now();
    localStorage.setItem(RECENT_KEY, JSON.stringify(existing));
  }
}

function updateRecentBoard(oldPath: string, meta: BoardMeta): void {
  const existing = getRecentBoards();
  const idx = existing.findIndex((b) => b.path === oldPath);
  if (idx >= 0) {
    existing[idx] = meta;
    localStorage.setItem(RECENT_KEY, JSON.stringify(existing));
  }
}

function removeRecentBoard(path: string): void {
  const existing = getRecentBoards();
  const filtered = existing.filter((b) => b.path !== path);
  localStorage.setItem(RECENT_KEY, JSON.stringify(filtered));
}

// Validation

function parseScene(content: string): SceneData | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;

    // Validate shape
    if (!Array.isArray(parsed.elements)) return null;

    return {
      elements: parsed.elements,
      appState: parsed.appState ?? {},
      files: parsed.files ?? {},
    };
  } catch {
    return null;
  }
}

function ensureExcalidrawExtension(name: string): string {
  return name.toLowerCase().endsWith(".excalidraw") ? name : `${name}.excalidraw`;
}

// Browser download fallback

export function downloadBoardAsJson(filename: string, scene: SceneData): void {
  const blob = new Blob(
    [JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "recall-board",
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files ?? {},
    }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function isTauriEnv(): boolean {
  return isTauri();
}
