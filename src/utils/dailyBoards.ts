import {
  type BoardMeta,
  type OpenBoardResult,
  createBoard,
  listBoards,
  loadBoard,
} from "./boardStorage";
import {
  getDocumentMetadata,
  removeDocumentMetadata,
  setDocumentMetadata,
} from "./documentMetadata";
import { createDailyBoardName, createDailyBoardScene } from "./dailyBoardScene";
import { getLocalTimezone, isLocalDateKey } from "./localDate";

export interface DailyBoardIndexEntry {
  dateKey: string;
  timezone: string;
  boardPath: string;
  boardId?: string;
  boardName: string;
  createdAt: number;
  updatedAt: number;
  missing?: boolean;
}

export interface EnsureDailyBoardResult extends OpenBoardResult {
  entry: DailyBoardIndexEntry;
  created: boolean;
  rebuiltFromExisting: boolean;
}

const DAILY_INDEX_KEY = "recall_daily_board_index_v1";

function readIndex(): DailyBoardIndexEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(DAILY_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is DailyBoardIndexEntry => (
        typeof entry?.dateKey === "string" &&
        typeof entry.boardPath === "string" &&
        typeof entry.boardName === "string"
      ))
      : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: DailyBoardIndexEntry[]): void {
  if (typeof localStorage === "undefined") return;
  const unique = new Map<string, DailyBoardIndexEntry>();
  for (const entry of entries) {
    unique.set(entry.dateKey, entry);
  }
  const sorted = [...unique.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  localStorage.setItem(DAILY_INDEX_KEY, JSON.stringify(sorted));
}

function boardMatchesEntry(board: BoardMeta, entry: DailyBoardIndexEntry): boolean {
  return board.path === entry.boardPath || Boolean(entry.boardId && board.id === entry.boardId);
}

function entryFromBoard(dateKey: string, board: BoardMeta, previous?: DailyBoardIndexEntry): DailyBoardIndexEntry {
  const now = Date.now();
  return {
    dateKey,
    timezone: previous?.timezone || getLocalTimezone(),
    boardPath: board.path,
    boardId: board.id,
    boardName: board.name,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
}

async function loadExistingBoard(meta: BoardMeta): Promise<OpenBoardResult | null> {
  try {
    const scene = await loadBoard(meta);
    return scene ? { scene, meta } : null;
  } catch {
    return null;
  }
}

async function findBoardForEntry(entry: DailyBoardIndexEntry): Promise<BoardMeta | null> {
  const boards = await listBoards();
  return boards.find((board) => boardMatchesEntry(board, entry)) || null;
}

async function findBoardByDailyName(dateKey: string): Promise<BoardMeta | null> {
  const name = createDailyBoardName(dateKey);
  const boards = await listBoards();
  return boards.find((board) => board.name === name) || null;
}

export function getDailyBoardIndex(): DailyBoardIndexEntry[] {
  return readIndex();
}

export function getDailyBoardIndexEntry(dateKey: string): DailyBoardIndexEntry | null {
  return readIndex().find((entry) => entry.dateKey === dateKey) || null;
}

export function recordDailyBoard(dateKey: string, board: BoardMeta): DailyBoardIndexEntry {
  if (!isLocalDateKey(dateKey)) {
    throw new Error(`Invalid daily board date key: ${dateKey}`);
  }
  const entries = readIndex();
  const previous = entries.find((entry) => entry.dateKey === dateKey);
  const next = entryFromBoard(dateKey, board, previous);
  writeIndex([...entries.filter((entry) => entry.dateKey !== dateKey), next]);
  setDocumentMetadata(board, {
    kind: "daily",
    dateKey,
    timezone: next.timezone,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  });
  return next;
}

export function touchDailyBoardReference(board: BoardMeta): void {
  const metadata = getDocumentMetadata(board);
  const entries = readIndex();
  const match = entries.find((entry) => boardMatchesEntry(board, entry));
  const dateKey = metadata?.kind === "daily" && metadata.dateKey
    ? metadata.dateKey
    : match?.dateKey;
  if (!dateKey) return;
  recordDailyBoard(dateKey, board);
}

export function moveDailyBoardReference(oldBoard: BoardMeta, newBoard: BoardMeta): void {
  const entries = readIndex();
  const index = entries.findIndex((entry) => boardMatchesEntry(oldBoard, entry));
  if (index < 0) return;
  const updated = entryFromBoard(entries[index].dateKey, newBoard, entries[index]);
  entries[index] = updated;
  writeIndex(entries);
  setDocumentMetadata(newBoard, {
    kind: "daily",
    dateKey: updated.dateKey,
    timezone: updated.timezone,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
  removeDocumentMetadata(oldBoard);
}

export function removeDailyBoardReference(board: BoardMeta): void {
  const entries = readIndex().filter((entry) => !boardMatchesEntry(board, entry));
  writeIndex(entries);
  removeDocumentMetadata(board);
}

export async function ensureDailyBoard(dateKey: string): Promise<EnsureDailyBoardResult> {
  if (!isLocalDateKey(dateKey)) {
    throw new Error(`Invalid daily board date key: ${dateKey}`);
  }

  const entries = readIndex();
  const existingEntry = entries.find((entry) => entry.dateKey === dateKey);
  if (existingEntry) {
    const meta = await findBoardForEntry(existingEntry);
    if (meta) {
      const existing = await loadExistingBoard(meta);
      if (existing) {
        const entry = recordDailyBoard(dateKey, meta);
        return { ...existing, entry, created: false, rebuiltFromExisting: false };
      }
    }
    writeIndex(entries.map((entry) => (
      entry.dateKey === dateKey ? { ...entry, missing: true, updatedAt: Date.now() } : entry
    )));
  }

  const boardByName = await findBoardByDailyName(dateKey);
  if (boardByName) {
    const existing = await loadExistingBoard(boardByName);
    if (existing) {
      const entry = recordDailyBoard(dateKey, boardByName);
      return { ...existing, entry, created: false, rebuiltFromExisting: true };
    }
  }

  const scene = createDailyBoardScene(dateKey);
  const meta = await createBoard(createDailyBoardName(dateKey), scene);
  const entry = recordDailyBoard(dateKey, meta);
  return { scene, meta, entry, created: true, rebuiltFromExisting: false };
}
