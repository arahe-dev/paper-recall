type ContextMenuProps = {
  x: number;
  y: number;
  hasSubpage: boolean;
  onCreateSubpage: () => void;
  onNavigateSubpage: () => void;
  onDeleteSubpage: () => void;
  onLinkBoard: () => void;
  onClose: () => void;
};

export default function ContextMenu({
  x,
  y,
  hasSubpage,
  onCreateSubpage,
  onNavigateSubpage,
  onDeleteSubpage,
  onLinkBoard,
  onClose,
}: ContextMenuProps) {
  return (
    <div
      className="context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="recall-context-menu glass-panel"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={onCreateSubpage} disabled={hasSubpage}>
          Create Subpage
        </button>
        <button type="button" onClick={onNavigateSubpage} disabled={!hasSubpage}>
          Navigate to Subpage
        </button>
        <button type="button" onClick={onDeleteSubpage} disabled={!hasSubpage}>
          Delete Subpage
        </button>
        <button type="button" onClick={onLinkBoard}>
          Link to Board...
        </button>
      </div>
    </div>
  );
}
