import type { BoardMeta } from "../utils/boardStorage";
import GlassCard from "./GlassCard";

export default function RecentBoards({
  boards,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
}: {
  boards: BoardMeta[];
  onOpen: (board: BoardMeta) => void;
  onRename?: (board: BoardMeta) => void;
  onDelete?: (board: BoardMeta) => void;
  onDuplicate?: (board: BoardMeta) => void;
}) {
  return (
    <section className="recent-boards" aria-label="Recent boards">
      <div className="section-heading">
        <div>
          <h2>Recent Boards</h2>
          <p>Open a saved board from this workspace.</p>
        </div>
      </div>
      {boards.length === 0 ? (
        <div className="empty-recent">No recent boards yet.</div>
      ) : (
        <div className="recent-card-grid">
          {boards.map((board) => (
            <GlassCard key={board.path} className="recent-card">
              <button
                type="button"
                className="recent-card-open"
                onClick={() => onOpen(board)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onRename?.(board);
                }}
              >
                <div className="recent-thumb">
                  {board.thumbnail ? (
                    <img src={board.thumbnail} alt="" />
                  ) : (
                    <span>{board.elementCount}</span>
                  )}
                </div>
                <div className="recent-card-text">
                  <strong>{board.name}</strong>
                  <span>{new Date(board.lastModified).toLocaleDateString()} · {board.elementCount} elements</span>
                </div>
              </button>
              <div className="recent-card-actions">
                {onRename && <button type="button" onClick={() => onRename(board)}>Rename</button>}
                {onDuplicate && <button type="button" onClick={() => onDuplicate(board)}>Duplicate</button>}
                {onDelete && <button type="button" onClick={() => onDelete(board)}>Delete</button>}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  );
}
