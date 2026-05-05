import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

type CustomTitleBarProps = {
  boardName?: string;
  saveStatus: string;
};

export default function CustomTitleBar({ boardName, saveStatus }: CustomTitleBarProps) {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const [isMaximized, setIsMaximized] = useState(false);

  const refreshMaximizedState = useCallback(async () => {
    try {
      setIsMaximized(await appWindow.isMaximized());
    } catch {
      setIsMaximized(false);
    }
  }, [appWindow]);

  useEffect(() => {
    const unlistenResize = appWindow.onResized(() => {
      void refreshMaximizedState();
    });
    return () => {
      void unlistenResize.then((unlisten) => unlisten());
    };
  }, [appWindow, refreshMaximizedState]);

  const handleDrag = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    void appWindow.startDragging();
  }, [appWindow]);

  const handleToggleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
    await refreshMaximizedState();
  }, [appWindow, refreshMaximizedState]);

  return (
    <div className="custom-titlebar">
      <div className="window-controls" aria-label="Window controls">
        <button
          type="button"
          className="window-control close"
          aria-label="Close window"
          title="Close"
          onClick={() => void appWindow.close()}
        />
        <button
          type="button"
          className="window-control minimize"
          aria-label="Minimize window"
          title="Minimize"
          onClick={() => void appWindow.minimize()}
        />
        <button
          type="button"
          className="window-control maximize"
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={() => void handleToggleMaximize()}
        />
      </div>
      <div
        className="window-drag-region"
        data-tauri-drag-region
        onMouseDown={handleDrag}
        onDoubleClick={() => void handleToggleMaximize()}
      >
        <span className="custom-titlebar-title">Recall Board</span>
        {boardName && <span className="custom-titlebar-board">{boardName}</span>}
        <span className={`custom-titlebar-status ${saveStatus}`}>{saveStatus}</span>
      </div>
      <div className="window-title-spacer" aria-hidden="true" />
    </div>
  );
}
