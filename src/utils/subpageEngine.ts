import type { LooseAppState, LooseElement } from "../exporters/types";

export type SubpageData = {
  id: string;
  parentElementId: string;
  parentBoardId: string;
  parentBoardName: string;
  parentPageId?: string;
  title: string;
  elements: LooseElement[];
  appState: LooseAppState;
  createdAt: number;
  updatedAt: number;
};

export type SubpageElement = LooseElement & {
  customData?: Record<string, unknown>;
};

const STORAGE_KEY = "recall_subpage_store_v1";

type SerializedSubpageStore = {
  version: 1;
  subpages: SubpageData[];
};

const subpages = new Map<string, SubpageData>();
let loaded = false;

function ensureLoaded(): void {
  if (loaded || typeof localStorage === "undefined") return;
  loaded = true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as SerializedSubpageStore;
    if (!Array.isArray(parsed.subpages)) return;
    for (const subpage of parsed.subpages) {
      if (subpage?.id && subpage.parentBoardId && subpage.parentElementId) {
        subpages.set(subpage.id, normalizeSubpage(subpage));
      }
    }
  } catch {
    subpages.clear();
  }
}

function persist(): void {
  if (typeof localStorage === "undefined") return;
  const payload: SerializedSubpageStore = {
    version: 1,
    subpages: Array.from(subpages.values()),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function normalizeSubpage(data: SubpageData): SubpageData {
  return {
    ...data,
    elements: Array.isArray(data.elements) ? data.elements : [],
    appState: sanitizeAppState(data.appState),
  };
}

function sanitizeAppState(appState: LooseAppState = {}): LooseAppState {
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
    "scrollX",
    "scrollY",
    "zoom",
  ];
  const sanitized: LooseAppState = {};
  for (const key of allowedKeys) {
    const value = appState[key];
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      (key === "zoom" && value && typeof value === "object")
    ) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function generateSubpageId(): string {
  return `page_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nestedRecallData(customData: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const recall = customData?.recall;
  return recall && typeof recall === "object" && !Array.isArray(recall)
    ? recall as Record<string, unknown>
    : undefined;
}

export function getElementSubpageId(element: SubpageElement | null | undefined): string | null {
  if (!element) return null;
  const recall = nestedRecallData(element.customData);
  const nestedSubpageId = recall?.subpageId;
  if (typeof nestedSubpageId === "string" && nestedSubpageId.trim()) return nestedSubpageId.trim();

  const legacySubpageId = element.customData?.recallSubpageId;
  if (typeof legacySubpageId === "string" && legacySubpageId.trim()) return legacySubpageId.trim();
  return null;
}

export function getElementSubpageTitle(element: SubpageElement | null | undefined): string | null {
  if (!element) return null;
  const recall = nestedRecallData(element.customData);
  const title = recall?.subpageTitle;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

export function withSubpageReference(
  element: SubpageElement,
  subpageId: string,
  title: string
): SubpageElement {
  const recall = {
    ...(nestedRecallData(element.customData) || {}),
    subpageId,
    subpageTitle: title,
  };
  return {
    ...element,
    customData: {
      ...(element.customData || {}),
      recall,
    },
  };
}

export function withoutSubpageReference(element: SubpageElement): SubpageElement {
  const recall = { ...(nestedRecallData(element.customData) || {}) };
  delete recall.subpageId;
  delete recall.subpageTitle;
  return {
    ...element,
    customData: {
      ...(element.customData || {}),
      recall,
    },
  };
}

export function createSubpage(
  element: SubpageElement,
  parentBoardId: string,
  parentBoardName: string,
  parentPageId?: string,
  title?: string
): SubpageData {
  ensureLoaded();
  const id = generateSubpageId();
  const now = Date.now();
  const label = typeof element.customData?.recallLabel === "string"
    ? element.customData.recallLabel
    : element.text || element.id;
  const subpage: SubpageData = {
    id,
    parentElementId: element.id,
    parentBoardId,
    parentBoardName,
    ...(parentPageId ? { parentPageId } : {}),
    title: title?.trim() || `Details: ${String(label).slice(0, 48)}`,
    elements: [],
    appState: {},
    createdAt: now,
    updatedAt: now,
  };
  subpages.set(id, subpage);
  persist();
  return subpage;
}

export function navigateToSubpage(subpageId: string): SubpageData | null {
  ensureLoaded();
  const subpage = subpages.get(subpageId);
  return subpage ? normalizeSubpage(subpage) : null;
}

export function saveSubpage(
  subpageId: string,
  elements: readonly LooseElement[],
  appState: LooseAppState,
  title?: string
): SubpageData | null {
  ensureLoaded();
  const existing = subpages.get(subpageId);
  if (!existing) return null;
  const updated: SubpageData = {
    ...existing,
    ...(title?.trim() ? { title: title.trim() } : {}),
    elements: elements.filter((element) => !element.isDeleted) as LooseElement[],
    appState: sanitizeAppState(appState),
    updatedAt: Date.now(),
  };
  subpages.set(subpageId, updated);
  persist();
  return updated;
}

export function deleteSubpage(subpageId: string): void {
  ensureLoaded();
  for (const subpage of Array.from(subpages.values())) {
    if (subpage.id === subpageId || subpage.parentPageId === subpageId) {
      subpages.delete(subpage.id);
    }
  }
  persist();
}

export function getSubpagesForBoard(boardId: string): SubpageData[] {
  ensureLoaded();
  return Array.from(subpages.values())
    .filter((subpage) => subpage.parentBoardId === boardId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getChildSubpages(parentPageId: string): SubpageData[] {
  ensureLoaded();
  return Array.from(subpages.values())
    .filter((subpage) => subpage.parentPageId === parentPageId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getSubpageBreadcrumbs(subpageId: string): SubpageData[] {
  ensureLoaded();
  const chain: SubpageData[] = [];
  let current = subpages.get(subpageId);
  while (current) {
    chain.unshift(normalizeSubpage(current));
    current = current.parentPageId ? subpages.get(current.parentPageId) : undefined;
  }
  return chain;
}

export function serializeSubpages(): string {
  ensureLoaded();
  return JSON.stringify({
    version: 1,
    subpages: Array.from(subpages.values()),
  } satisfies SerializedSubpageStore);
}
