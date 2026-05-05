import {
  getAllLinks,
  getBacklinks,
  getLinksFrom,
  type LinkEntry,
} from "./linkEngine";

export type BacklinkSummary = {
  boardId: string;
  inbound: LinkEntry[];
  outbound: LinkEntry[];
};

export function getBacklinkSummary(boardId: string): BacklinkSummary {
  return {
    boardId,
    inbound: getBacklinks(boardId),
    outbound: getLinksFrom(boardId),
  };
}

export function getLinkedBoardIds(): string[] {
  const ids = new Set<string>();
  for (const link of getAllLinks()) {
    ids.add(link.sourceBoardId);
    ids.add(link.targetBoardId);
  }
  return Array.from(ids);
}
