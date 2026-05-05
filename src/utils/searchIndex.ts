import MiniSearch from "minisearch";
import { buildBoardTextGraph } from "../boardTextGraph";
import type { LooseElement } from "../exporters/types";
import {
  listBoards,
  loadBoard,
  type BoardMeta,
} from "./boardStorage";
import { getSubpagesForBoard, type SubpageData } from "./subpageEngine";

export type SearchDocument = {
  id: string;
  boardId: string;
  boardPath: string;
  boardName: string;
  boardLastModified: number;
  boardElementCount: number;
  title: string;
  text: string;
  labels: string;
  snippet: string;
  elementId?: string;
  elementType?: string;
  subpageId?: string;
  subpageTitle?: string;
};

export type SearchResult = SearchDocument & {
  score: number;
  terms: string[];
  queryTerms: string[];
};

export type SearchIndexStats = {
  boardCount: number;
  documentCount: number;
  skippedBoardCount: number;
  updatedAt: number;
};

const MAX_SNIPPET_LENGTH = 180;

let index = createIndex();
const documentsById = new Map<string, SearchDocument>();
let lastStats: SearchIndexStats = {
  boardCount: 0,
  documentCount: 0,
  skippedBoardCount: 0,
  updatedAt: 0,
};

function createIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ["title", "text", "labels"],
    storeFields: [
      "id",
      "boardId",
      "boardPath",
      "boardName",
      "boardLastModified",
      "boardElementCount",
      "title",
      "text",
      "labels",
      "snippet",
      "elementId",
      "elementType",
      "subpageId",
      "subpageTitle",
    ],
    searchOptions: {
      boost: { title: 3, labels: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
}

function compactText(value: string | undefined, fallback = ""): string {
  return (value || fallback).replace(/\s+/g, " ").trim();
}

function snippetFor(...parts: Array<string | undefined>): string {
  const text = compactText(parts.filter(Boolean).join(" "));
  if (text.length <= MAX_SNIPPET_LENGTH) return text;
  return `${text.slice(0, MAX_SNIPPET_LENGTH - 1).trim()}...`;
}

function makeDocumentId(boardId: string, scope: string, id: string): string {
  return `${boardId}::${scope}::${id}`;
}

function textElementLookup(elements: readonly LooseElement[]): Map<string, LooseElement> {
  const byId = new Map<string, LooseElement>();
  for (const element of elements) {
    byId.set(element.id, element);
  }
  return byId;
}

function documentsForBoard(board: BoardMeta, elements: readonly LooseElement[]): SearchDocument[] {
  const graph = buildBoardTextGraph(elements);
  const elementById = textElementLookup(elements);
  const docs: SearchDocument[] = [];

  docs.push({
    id: makeDocumentId(board.id, "board", board.id),
    boardId: board.id,
    boardPath: board.path,
    boardName: board.name,
    boardLastModified: board.lastModified,
    boardElementCount: board.elementCount,
    title: board.name,
    text: graph.plain_text_graph,
    labels: graph.nodes.map((node) => node.label).join(" "),
    snippet: snippetFor(graph.nodes.map((node) => node.label).join(", "), graph.plain_text_graph),
  });

  for (const node of graph.nodes) {
    docs.push({
      id: makeDocumentId(board.id, "node", node.id),
      boardId: board.id,
      boardPath: board.path,
      boardName: board.name,
      boardLastModified: board.lastModified,
      boardElementCount: board.elementCount,
      title: node.label,
      text: compactText(node.body, node.label),
      labels: [node.label, node.shape_type].filter(Boolean).join(" "),
      snippet: snippetFor(node.label, node.body),
      elementId: node.source_shape_id || node.source_text_ids[0],
      elementType: node.shape_type || "text",
    });
  }

  for (const edge of graph.edges) {
    docs.push({
      id: makeDocumentId(board.id, "edge", edge.id),
      boardId: board.id,
      boardPath: board.path,
      boardName: board.name,
      boardLastModified: board.lastModified,
      boardElementCount: board.elementCount,
      title: edge.label || edge.semantic_relation || "Connection",
      text: edge.plain_text,
      labels: `${edge.from_label} ${edge.to_label} ${edge.label || ""}`,
      snippet: snippetFor(edge.plain_text),
      elementId: edge.source_arrow_id,
      elementType: "arrow",
    });
  }

  for (const annotation of graph.annotations) {
    docs.push({
      id: makeDocumentId(board.id, "annotation", annotation.id),
      boardId: board.id,
      boardPath: board.path,
      boardName: board.name,
      boardLastModified: board.lastModified,
      boardElementCount: board.elementCount,
      title: annotation.kind || "Annotation",
      text: annotation.text,
      labels: annotation.target_ids.join(" "),
      snippet: snippetFor(annotation.text),
      elementId: annotation.source_element_id,
      elementType: "annotation",
    });
  }

  for (const group of graph.groups) {
    docs.push({
      id: makeDocumentId(board.id, "group", group.id),
      boardId: board.id,
      boardPath: board.path,
      boardName: board.name,
      boardLastModified: board.lastModified,
      boardElementCount: board.elementCount,
      title: group.label,
      text: group.node_ids.join(" "),
      labels: group.label,
      snippet: snippetFor(group.label, group.node_ids.join(", ")),
      elementId: group.source_element_id,
      elementType: "group",
    });
  }

  for (const text of graph.ungrouped_text) {
    const element = elementById.get(text.id);
    docs.push({
      id: makeDocumentId(board.id, "text", text.id),
      boardId: board.id,
      boardPath: board.path,
      boardName: board.name,
      boardLastModified: board.lastModified,
      boardElementCount: board.elementCount,
      title: text.text,
      text: text.text,
      labels: "text",
      snippet: snippetFor(text.text),
      elementId: element?.id || text.id,
      elementType: "text",
    });
  }

  for (const subpage of getSubpagesForBoard(board.id)) {
    docs.push(...documentsForSubpage(board, subpage));
  }

  return docs.filter((doc) => doc.title || doc.text || doc.labels);
}

function documentsForSubpage(board: BoardMeta, subpage: SubpageData): SearchDocument[] {
  const graph = buildBoardTextGraph(subpage.elements);
  const docs: SearchDocument[] = [];
  const scope = `subpage-${subpage.id}`;

  docs.push({
    id: makeDocumentId(board.id, scope, subpage.id),
    boardId: board.id,
    boardPath: board.path,
    boardName: board.name,
    boardLastModified: board.lastModified,
    boardElementCount: board.elementCount,
    title: subpage.title,
    text: graph.plain_text_graph,
    labels: graph.nodes.map((node) => node.label).join(" "),
    snippet: snippetFor(subpage.title, graph.nodes.map((node) => node.label).join(", ")),
    subpageId: subpage.id,
    subpageTitle: subpage.title,
  });

  for (const node of graph.nodes) {
    docs.push({
      id: makeDocumentId(board.id, `${scope}-node`, node.id),
      boardId: board.id,
      boardPath: board.path,
      boardName: board.name,
      boardLastModified: board.lastModified,
      boardElementCount: board.elementCount,
      title: node.label,
      text: compactText(node.body, node.label),
      labels: [subpage.title, node.label, node.shape_type].filter(Boolean).join(" "),
      snippet: snippetFor(subpage.title, node.label, node.body),
      elementId: node.source_shape_id || node.source_text_ids[0],
      elementType: node.shape_type || "text",
      subpageId: subpage.id,
      subpageTitle: subpage.title,
    });
  }

  for (const edge of graph.edges) {
    docs.push({
      id: makeDocumentId(board.id, `${scope}-edge`, edge.id),
      boardId: board.id,
      boardPath: board.path,
      boardName: board.name,
      boardLastModified: board.lastModified,
      boardElementCount: board.elementCount,
      title: edge.label || edge.semantic_relation || "Connection",
      text: edge.plain_text,
      labels: `${subpage.title} ${edge.from_label} ${edge.to_label} ${edge.label || ""}`,
      snippet: snippetFor(subpage.title, edge.plain_text),
      elementId: edge.source_arrow_id,
      elementType: "arrow",
      subpageId: subpage.id,
      subpageTitle: subpage.title,
    });
  }

  return docs;
}

export async function rebuildIndex(): Promise<SearchIndexStats> {
  index = createIndex();
  documentsById.clear();

  const boards = await listBoards();
  let skippedBoardCount = 0;

  for (const board of boards) {
    try {
      const scene = await loadBoard(board);
      if (!scene) {
        skippedBoardCount++;
        continue;
      }
      indexBoard(board, scene.elements as LooseElement[]);
    } catch {
      skippedBoardCount++;
    }
  }

  lastStats = {
    boardCount: boards.length,
    documentCount: documentsById.size,
    skippedBoardCount,
    updatedAt: Date.now(),
  };
  return lastStats;
}

export function indexBoard(board: BoardMeta, elements: readonly LooseElement[]): SearchIndexStats {
  removeBoard(board.id);
  const docs = documentsForBoard(board, elements);
  if (docs.length > 0) {
    index.addAll(docs);
    for (const doc of docs) {
      documentsById.set(doc.id, doc);
    }
  }

  lastStats = {
    ...lastStats,
    documentCount: documentsById.size,
    updatedAt: Date.now(),
  };
  return lastStats;
}

export function removeBoard(boardId: string): void {
  const docs = Array.from(documentsById.values()).filter((doc) => doc.boardId === boardId);
  for (const doc of docs) {
    try {
      index.discard(doc.id);
    } catch {
      // MiniSearch discard is intentionally best-effort for stale index entries.
    }
    documentsById.delete(doc.id);
  }
  lastStats = {
    ...lastStats,
    documentCount: documentsById.size,
    updatedAt: Date.now(),
  };
}

export function search(query: string, limit = 20): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return index
    .search(trimmed, {
      boost: { title: 3, labels: 2 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: "OR",
    })
    .slice(0, limit)
    .map((result) => {
      const doc = documentsById.get(String(result.id)) || (result as unknown as SearchDocument);
      return {
        ...doc,
        score: result.score,
        terms: result.terms || [],
        queryTerms: result.queryTerms || [],
      };
    });
}

export function getSearchIndexStats(): SearchIndexStats {
  return lastStats;
}
