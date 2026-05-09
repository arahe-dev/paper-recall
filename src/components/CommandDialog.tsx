import { useEffect, useMemo, useState } from "react";
import { filterCommands, type AppCommand } from "../utils/commandRegistry";

export default function CommandDialog({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: AppCommand[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Enter" && results[0]) {
        event.preventDefault();
        void results[0].run();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, results]);

  if (!open) return null;

  return (
    <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Command menu">
      <div className="command-panel glass-panel">
        <div className="command-input-row">
          <span className="command-symbol">CMD</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search commands"
          />
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="command-results">
          {results.length === 0 ? (
            <div className="command-empty">No commands</div>
          ) : (
            results.map((command) => (
              <button
                type="button"
                key={command.id}
                className="command-result"
                onClick={() => {
                  void command.run();
                  onClose();
                }}
              >
                <span>
                  <strong>{command.title}</strong>
                  {command.description && <small>{command.description}</small>}
                </span>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
