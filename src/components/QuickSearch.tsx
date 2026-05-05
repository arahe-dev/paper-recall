import { useEffect, useMemo, useRef, useState } from "react";
import { search, type SearchResult } from "../utils/searchIndex";

type QuickSearchProps = {
  open: boolean;
  onClose: () => void;
  onOpenResult: (result: SearchResult) => void;
};

function resultIcon(result: SearchResult): string {
  if (result.elementType === "arrow") return "->";
  if (result.elementType === "group") return "[]";
  if (result.elementType === "annotation") return "*";
  if (result.elementType === "text") return "T";
  return "#";
}

export default function QuickSearch({ open, onClose, onOpenResult }: QuickSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const results = useMemo(() => search(query, 16), [query]);

  if (!open) return null;

  return (
    <div className="quick-search-overlay" role="dialog" aria-modal="true">
      <div className="quick-search-panel glass-panel">
        <div className="quick-search-input-row">
          <span className="quick-search-symbol">Ctrl K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search boards, labels, arrows, and notes"
            aria-label="Search boards"
          />
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="quick-search-results">
          {query.trim() && results.length === 0 ? (
            <div className="quick-search-empty">No matching board text</div>
          ) : null}
          {!query.trim() ? (
            <div className="quick-search-empty">Type to search every saved board</div>
          ) : null}
          {results.map((result) => (
            <button
              type="button"
              key={result.id}
              className="quick-search-result"
              onClick={() => onOpenResult(result)}
            >
              <span className="quick-search-result-icon">{resultIcon(result)}</span>
              <span className="quick-search-result-text">
                <strong>{result.title || result.boardName}</strong>
                <span>{result.snippet || result.text || result.labels}</span>
              </span>
              <span className="quick-search-result-board">{result.boardName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
