import type { LooseElement } from "../exporters/types";
import {
  listBoards,
  loadBoard,
  type BoardMeta,
} from "./boardStorage";

export type LinkEntry = {
  id: string;
  sourceBoardId: string;
  sourceBoardName: string;
  sourceBoardPath: string;
  targetBoardId: string;
  targetBoardName: string;
  targetBoardPath: string;
  sourceElementId?: string;
  relation?: string;
  createdAt: number;
  updatedAt: number;
};

export type LinkIndexStats = {
  linkCount: number;
  boardCount: number;
  skippedBoardCount: number;
  updatedAt: number;
};

export type LinkableElement = LooseElement & {
  link?: string | null;
  customData?: Record<string, unknown>;
};

const STORAGE_KEY = "recall_link_index";
const BOARD_LINK_PROTOCOL = "recall-board://";
const links = new Map<string, LinkEntry>();

let loaded = false;
let lastStats: LinkIndexStats = {
  linkCount: 0,
  boardCount: 0,
  skippedBoardCount: 0,
  updatedAt: 0,
};

function ensureLoaded(): void {
  if (loaded || typeof localStorage === "undefined") return;
  loaded = true;
  deserialize(localStorage.getItem(STORAGE_KEY) || "");
}

function persist(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, serialize());
}

function linkId(sourceBoardId: string, targetBoardId: string, sourceElementId?: string): string {
  return `${sourceBoardId}::${sourceElementId || "board"}::${targetBoardId}`;
}

function nestedRecallData(customData: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const recall = customData?.recall;
  return recall && typeof recall === "object" && !Array.isArray(recall)
    ? recall as Record<string, unknown>
    : undefined;
}

export function boardLinkUrl(boardId: string): string {
  return `${BOARD_LINK_PROTOCOL}${boardId}`;
}

export function boardIdFromLink(link: string | null | undefined): string | null {
  if (!link || !link.startsWith(BOARD_LINK_PROTOCOL)) return null;
  const id = link.slice(BOARD_LINK_PROTOCOL.length).trim();
  return id || null;
}

export function getElementLinkTarget(element: LinkableElement): string | null {
  const recall = nestedRecallData(element.customData);
  const nestedTarget = recall?.linkTarget;
  if (typeof nestedTarget === "string" && nestedTarget.trim()) return nestedTarget.trim();

  const legacyTarget = element.customData?.recallLinkTarget;
  if (typeof legacyTarget === "string" && legacyTarget.trim()) return legacyTarget.trim();

  return boardIdFromLink(element.link);
}

export function withBoardLink(element: LinkableElement, target: BoardMeta, relation?: string): LinkableElement {
  const recall = {
    ...(nestedRecallData(element.customData) || {}),
    linkTarget: target.id,
    linkTargetName: target.name,
    ...(relation ? { relation } : {}),
  };

  return {
    ...element,
    link: boardLinkUrl(target.id),
    customData: {
      ...(element.customData || {}),
      recall,
    },
  };
}

export function createLink(
  sourceBoard: BoardMeta | string,
  targetBoard: BoardMeta | string,
  relation?: string,
  sourceElementId?: string
): string {
  ensureLoaded();
  const source = typeof sourceBoard === "string"
    ? { id: sourceBoard, name: sourceBoard, path: "" }
    : sourceBoard;
  const target = typeof targetBoard === "string"
    ? { id: targetBoard, name: targetBoard, path: "" }
    : targetBoard;
  const id = linkId(source.id, target.id, sourceElementId);
  const existing = links.get(id);
  const now = Date.now();
  links.set(id, {
    id,
    sourceBoardId: source.id,
    sourceBoardName: source.name,
    sourceBoardPath: source.path,
    targetBoardId: target.id,
    targetBoardName: target.name,
    targetBoardPath: target.path,
    ...(sourceElementId ? { sourceElementId } : {}),
    ...(relation ? { relation } : {}),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  persist();
  return id;
}

export function removeLinksForSourceBoard(sourceBoardId: string): void {
  ensureLoaded();
  for (const [id, entry] of links.entries()) {
    if (entry.sourceBoardId === sourceBoardId) {
      links.delete(id);
    }
  }
  persist();
}

export function removeLinksForBoard(boardId: string): void {
  ensureLoaded();
  for (const [id, entry] of links.entries()) {
    if (entry.sourceBoardId === boardId || entry.targetBoardId === boardId) {
      links.delete(id);
    }
  }
  persist();
}

export function syncBoardLinksFromElements(
  sourceBoard: BoardMeta,
  elements: readonly LinkableElement[],
  knownBoards: readonly BoardMeta[] = []
): LinkIndexStats {
  ensureLoaded();
  removeLinksForSourceBoard(sourceBoard.id);
  const byId = new Map(knownBoards.map((board) => [board.id, board]));

  for (const element of elements) {
    if (element.isDeleted) continue;
    const targetId = getElementLinkTarget(element);
    if (!targetId || targetId === sourceBoard.id) continue;
    const target = byId.get(targetId) || {
      id: targetId,
      name: targetId,
      path: "",
      lastModified: 0,
      elementCount: 0,
    };
    const recall = nestedRecallData(element.customData);
    const relation = typeof recall?.relation === "string" ? recall.relation : undefined;
    createLink(sourceBoard, target, relation, element.id);
  }

  lastStats = {
    ...lastStats,
    linkCount: links.size,
    updatedAt: Date.now(),
  };
  persist();
  return lastStats;
}

export async function rebuildLinksFromBoards(): Promise<LinkIndexStats> {
  ensureLoaded();
  links.clear();
  const boards = await listBoards();
  let skippedBoardCount = 0;

  for (const board of boards) {
    try {
      const scene = await loadBoard(board);
      if (!scene) {
        skippedBoardCount++;
        continue;
      }
      syncBoardLinksFromElements(board, scene.elements as LinkableElement[], boards);
    } catch {
      skippedBoardCount++;
    }
  }

  lastStats = {
    linkCount: links.size,
    boardCount: boards.length,
    skippedBoardCount,
    updatedAt: Date.now(),
  };
  persist();
  return lastStats;
}

export function getBacklinks(boardId: string): LinkEntry[] {
  ensureLoaded();
  return Array.from(links.values())
    .filter((entry) => entry.targetBoardId === boardId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getLinksFrom(boardId: string): LinkEntry[] {
  ensureLoaded();
  return Array.from(links.values())
    .filter((entry) => entry.sourceBoardId === boardId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getAllLinks(): LinkEntry[] {
  ensureLoaded();
  return Array.from(links.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function serialize(): string {
  return JSON.stringify({ version: 1, links: Array.from(links.values()) });
}

export function deserialize(data: string): void {
  links.clear();
  if (!data.trim()) return;
  try {
    const parsed = JSON.parse(data);
    const entries = Array.isArray(parsed) ? parsed : parsed.links;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (
        entry &&
        typeof entry.id === "string" &&
        typeof entry.sourceBoardId === "string" &&
        typeof entry.targetBoardId === "string"
      ) {
        links.set(entry.id, entry as LinkEntry);
      }
    }
  } catch {
    links.clear();
  }
}

export function getLinkIndexStats(): LinkIndexStats {
  ensureLoaded();
  return lastStats;
}
