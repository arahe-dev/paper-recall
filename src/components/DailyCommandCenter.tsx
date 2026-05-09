import { useMemo, useState } from "react";
import type { BoardMeta } from "../utils/boardStorage";
import type { AppCommand } from "../utils/commandRegistry";
import type { DailyBoardIndexEntry } from "../utils/dailyBoards";
import {
  formatClockTime,
  formatDisplayDate,
  getLocalDateKey,
} from "../utils/localDate";
import { useClock } from "../hooks/useClock";
import commandPlusIcon from "../assets/command-plus.svg";
import folderIcon from "../assets/folder.svg";
import panelCloseIcon from "../assets/panel-close.svg";
import recallMark from "../assets/recall-mark.svg";
import DotMatrixText from "./DotMatrixText";
import ThemeToggle from "./ThemeToggle";

function statusText(entry: DailyBoardIndexEntry | null): string {
  if (!entry) return "No daily board yet";
  if (entry.missing) return "Daily board needs recovery";
  return `Daily board ready: ${entry.boardName}`;
}

export default function DailyCommandCenter({
  todayEntry,
  recentBoards,
  commands,
  onOpenToday,
  onOpenRecent,
  onRenameRecent,
  onDeleteRecent,
  onDuplicateRecent,
}: {
  todayEntry: DailyBoardIndexEntry | null;
  recentBoards: BoardMeta[];
  commands: AppCommand[];
  onOpenToday: () => void;
  onOpenRecent: (board: BoardMeta) => void;
  onRenameRecent?: (board: BoardMeta) => void;
  onDeleteRecent?: (board: BoardMeta) => void;
  onDuplicateRecent?: (board: BoardMeta) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const now = useClock();
  const dateKey = getLocalDateKey(now);
  const clockTime = formatClockTime(now);
  const sidebarCommands = useMemo(() => (
    commands.filter((command) => command.id !== "daily.openToday")
  ), [commands]);

  return (
    <main className="daily-command-center">
      <section className="daily-hero" aria-label="Today">
        <div className="daily-brand-lockup">
          <img className="daily-brand-icon" src={recallMark} alt="" />
          <div>
            <h1>Recall.</h1>
            <p>Today, local first.</p>
          </div>
        </div>
        <div className="daily-clock-card">
          <DotMatrixText value={clockTime} label={`Current time ${clockTime}`} />
          <span>{formatDisplayDate(now)}</span>
        </div>
        <div className="daily-primary-actions">
          <button type="button" className="daily-primary-action" onClick={onOpenToday} aria-label="Open Today">
            <img src={commandPlusIcon} alt="" />
          </button>
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Browse">
            <img src={folderIcon} alt="" />
          </button>
        </div>
      </section>

      <aside className={`daily-sidebar glass-panel${sidebarOpen ? " open" : ""}`} aria-label="Command center sidebar">
        <div className="daily-sidebar-header">
          <div>
            <strong>Today</strong>
            <span>{dateKey}</span>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <img src={panelCloseIcon} alt="" />
          </button>
        </div>

        <div className="daily-sidebar-section">
          <span>Status</span>
          <p>{statusText(todayEntry)}</p>
        </div>

        <div className="daily-sidebar-section">
          <span>Actions</span>
          <div className="daily-sidebar-actions">
            <button type="button" onClick={onOpenToday}>Open Today</button>
            {sidebarCommands.map((command) => (
              <button type="button" key={command.id} onClick={() => void command.run()}>
                <strong>{command.title}</strong>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </button>
            ))}
          </div>
        </div>

        <div className="daily-sidebar-section">
          <span>Theme</span>
          <ThemeToggle compact />
        </div>

        <div className="daily-sidebar-section">
          <span>Recent</span>
          {recentBoards.length === 0 ? (
            <p>No recent boards yet.</p>
          ) : (
            <div className="daily-sidebar-recents">
              {recentBoards.map((board) => (
                <div className="daily-sidebar-recent" key={board.path}>
                  <button type="button" onClick={() => onOpenRecent(board)}>
                    <strong>{board.name}</strong>
                    <small>{new Date(board.lastModified).toLocaleDateString()} · {board.elementCount} elements</small>
                  </button>
                  <div>
                    {onRenameRecent && <button type="button" onClick={() => onRenameRecent(board)}>Rename</button>}
                    {onDuplicateRecent && <button type="button" onClick={() => onDuplicateRecent(board)}>Duplicate</button>}
                    {onDeleteRecent && <button type="button" onClick={() => onDeleteRecent(board)}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
