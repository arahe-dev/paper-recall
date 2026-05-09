import type { BoardMeta } from "./boardStorage";

export type DocumentKind = "daily" | "board" | "imported";

export interface DocumentMetadata {
  kind: DocumentKind;
  dateKey?: string;
  timezone?: string;
  createdAt: number;
  updatedAt: number;
}

const DOCUMENT_METADATA_KEY = "recall_document_metadata_v1";

export function documentMetadataKey(meta: Pick<BoardMeta, "id" | "path">): string {
  return meta.path || meta.id;
}

function readMetadataMap(): Record<string, DocumentMetadata> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(DOCUMENT_METADATA_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, DocumentMetadata>
      : {};
  } catch {
    return {};
  }
}

function writeMetadataMap(map: Record<string, DocumentMetadata>): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DOCUMENT_METADATA_KEY, JSON.stringify(map));
}

export function getDocumentMetadata(meta: Pick<BoardMeta, "id" | "path">): DocumentMetadata | null {
  return readMetadataMap()[documentMetadataKey(meta)] || null;
}

export function setDocumentMetadata(
  meta: Pick<BoardMeta, "id" | "path">,
  metadata: DocumentMetadata
): void {
  const map = readMetadataMap();
  map[documentMetadataKey(meta)] = metadata;
  writeMetadataMap(map);
}

export function removeDocumentMetadata(meta: Pick<BoardMeta, "id" | "path">): void {
  const map = readMetadataMap();
  delete map[documentMetadataKey(meta)];
  writeMetadataMap(map);
}

export function moveDocumentMetadata(
  oldMeta: Pick<BoardMeta, "id" | "path">,
  newMeta: Pick<BoardMeta, "id" | "path">
): void {
  const map = readMetadataMap();
  const oldKey = documentMetadataKey(oldMeta);
  const metadata = map[oldKey];
  if (!metadata) return;
  delete map[oldKey];
  map[documentMetadataKey(newMeta)] = {
    ...metadata,
    updatedAt: Date.now(),
  };
  writeMetadataMap(map);
}
