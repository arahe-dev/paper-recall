import type { LinkEntry } from "../utils/linkEngine";

type BacklinksPanelProps = {
  backlinks: LinkEntry[];
  onOpenBoard: (boardId: string, path?: string) => void;
};

export default function BacklinksPanel({ backlinks, onOpenBoard }: BacklinksPanelProps) {
  if (backlinks.length === 0) {
    return (
      <div className="backlinks-empty">
        <strong>No backlinks</strong>
        <span>Boards that link here will appear in this panel.</span>
      </div>
    );
  }

  return (
    <div className="backlinks-list">
      {backlinks.map((entry) => (
        <button
          type="button"
          className="backlink-item"
          key={entry.id}
          onClick={() => onOpenBoard(entry.sourceBoardId, entry.sourceBoardPath)}
        >
          <strong>{entry.sourceBoardName || entry.sourceBoardId}</strong>
          <span>{entry.relation || "links to this board"}</span>
        </button>
      ))}
    </div>
  );
}
