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
  thumbnail?: string;
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
const SCENE_VERSION = 2;
const INVALID_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  type TauriWindow = Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  const tauriWindow = window as TauriWindow;
  return (
    tauriWindow.__TAURI__ !== undefined || tauriWindow.__TAURI_INTERNALS__ !== undefined
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

function serializeScene(scene: SceneData): string {
  return JSON.stringify({
    type: "excalidraw",
    version: SCENE_VERSION,
    source: "recall-board",
    elements: scene.elements,
    appState: sanitizeAppState(scene.appState),
    files: scene.files ?? {},
  }, null, 2);
}

function sanitizeAppState(appState: Record<string, unknown> = {}): Record<string, unknown> {
  const allowedKeys = [
    "viewBackgroundColor",
    "currentItemStrokeColor",
    "currentItemBackgroundColor",
    "currentItemFillStyle",
    "currentItemStrokeWidth",
    "currentItemStrokeStyle",
    "currentItemRoughness",
    "currentItemOpacity",
    "currentItemFontFamily",
    "currentItemFontSize",
    "currentItemTextAlign",
    "currentItemStartArrowhead",
    "currentItemEndArrowhead",
    "gridSize",
    "theme",
  ];
  const sanitized: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    const value = appState[key];
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function normalizeBoardName(name: string): string {
  const trimmed = name.trim().replace(/\.excalidraw$/i, "");
  const safe = Array.from(trimmed)
    .map((char) => char.charCodeAt(0) < 32 || INVALID_FILENAME_CHARS.has(char) ? "-" : char)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return safe || "Untitled";
}

function fallbackIdFromPath(path: string): string {
  return path.replace("fallback://", "");
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
  const normalizedName = await uniqueBoardName(name);
  const content = serializeScene(scene);

  if (isTauri()) {
    const boardDir = await ensureBoardDir();
    const path = `${boardDir}/${normalizedName}.excalidraw`;
    await invoke("save_board", { path, content });
    const meta: BoardMeta = {
      id: boardIdFromPath(path),
      name: normalizedName,
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
      name: normalizedName,
      path: `fallback://${id}`,
      lastModified: Date.now(),
      elementCount: scene.elements.length,
    };
    addRecentBoard(meta);
    return meta;
  }
}

export async function saveBoard(meta: BoardMeta, scene: SceneData): Promise<BoardMeta> {
  const content = serializeScene(scene);
  const updated: BoardMeta = {
    ...meta,
    lastModified: Date.now(),
    elementCount: scene.elements.length,
  };

  if (isTauri()) {
    await invoke("save_board", { path: meta.path, content });
  } else {
    const fallbackId = fallbackIdFromPath(meta.path);
    fallbackSaveBoard(fallbackId, content);
  }

  updateRecentBoard(meta.path, updated, true);
  return updated;
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
    const content = serializeScene(scene);

    const boardDir = await ensureBoardDir();
    const fileName = ensureExcalidrawExtension(defaultName || "board.excalidraw");
    const path = await save({
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
      defaultPath: `${boardDir}/${fileName}`,
    });

    if (!path) return null;

    await invoke("save_board", { path, content });
    const meta: BoardMeta = {
      id: boardIdFromPath(path),
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
    const fallbackId = fallbackIdFromPath(meta.path);
    const content = fallbackLoadBoard(fallbackId);
    return content ? parseScene(content) : null;
  }
}

export async function deleteBoard(meta: BoardMeta): Promise<void> {
  if (isTauri()) {
    await invoke("delete_board", { path: meta.path });
  } else {
    const fallbackId = fallbackIdFromPath(meta.path);
    fallbackDeleteBoard(fallbackId);
  }
  removeRecentBoard(meta.path);
}

export async function renameBoard(meta: BoardMeta, newName: string): Promise<BoardMeta> {
  const normalizedName = await uniqueBoardName(newName, meta.path);
  if (isTauri()) {
    const newPath = meta.path.replace(/[^\\/]+$/, `${normalizedName}.excalidraw`);
    await invoke("rename_board", { oldPath: meta.path, newPath });
    const updated: BoardMeta = { ...meta, name: normalizedName, path: newPath, lastModified: Date.now() };
    updateRecentBoard(meta.path, updated, true);
    return updated;
  }
  const updated: BoardMeta = { ...meta, name: normalizedName, lastModified: Date.now() };
  updateRecentBoard(meta.path, updated, true);
  return updated;
}

export async function duplicateBoard(meta: BoardMeta): Promise<BoardMeta | null> {
  const scene = await loadBoard(meta);
  if (!scene) return null;
  return createBoard(`${meta.name}-copy`, scene);
}

export async function listBoards(): Promise<BoardMeta[]> {
  if (isTauri()) {
    const boards = await invoke<Array<{ name: string; path: string; last_modified: number; element_count: number }>>("list_boards");
    return boards.map((b) => ({
      id: boardIdFromPath(b.path),
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
    const boards = raw ? JSON.parse(raw) : [];
    return Array.isArray(boards)
      ? boards
        .filter((board): board is BoardMeta => Boolean(board?.path && board?.name))
        .sort((a, b) => b.lastModified - a.lastModified)
        .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function addRecentBoard(meta: BoardMeta): void {
  const existing = getRecentBoards();
  const filtered = existing.filter((b) => b.path !== meta.path);
  const updated = [meta, ...filtered]
    .sort((a, b) => b.lastModified - a.lastModified)
    .slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

function updateRecentBoard(oldPath: string, meta: BoardMeta, moveToFront = false): void {
  const existing = getRecentBoards();
  const idx = existing.findIndex((b) => b.path === oldPath);
  if (idx >= 0) {
    existing[idx] = meta;
  } else {
    existing.unshift(meta);
  }
  const updated = (moveToFront
    ? [meta, ...existing.filter((b) => b.path !== meta.path && b.path !== oldPath)]
    : existing.filter((b, index, items) => items.findIndex((item) => item.path === b.path) === index))
    .sort((a, b) => b.lastModified - a.lastModified)
    .slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
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
      appState: sanitizeAppState(parsed.appState ?? {}),
      files: parsed.files ?? {},
    };
  } catch {
    return null;
  }
}

function ensureExcalidrawExtension(name: string): string {
  return name.toLowerCase().endsWith(".excalidraw") ? name : `${name}.excalidraw`;
}

async function uniqueBoardName(name: string, ignorePath?: string): Promise<string> {
  const baseName = normalizeBoardName(name);
  const existing = await listBoards();
  const taken = new Set(
    existing
      .filter((board) => board.path !== ignorePath)
      .map((board) => board.name.toLowerCase())
  );
  if (!taken.has(baseName.toLowerCase())) return baseName;

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${baseName} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  return `${baseName} ${Date.now()}`;
}

function boardIdFromPath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    hash = ((hash << 5) - hash + path.charCodeAt(i)) | 0;
  }
  return `board_${Math.abs(hash)}`;
}

// Browser download fallback

export function downloadBoardAsJson(filename: string, scene: SceneData): void {
  const blob = new Blob(
    [JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "recall-board",
      elements: scene.elements,
      appState: sanitizeAppState(scene.appState),
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
