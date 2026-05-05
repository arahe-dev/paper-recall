import type { BoardMeta } from "../utils/boardStorage";
import type { RecallTemplate } from "../utils/templateEngine";
import RecentBoards from "./RecentBoards";
import TemplateGallery from "./TemplateGallery";

export default function HomeScreen({
  templates,
  recentBoards,
  onUseTemplate,
  onOpenRecent,
  onRenameRecent,
  onDeleteRecent,
  onDuplicateRecent,
  onNew,
  onOpen,
  onImport,
}: {
  templates: RecallTemplate[];
  recentBoards: BoardMeta[];
  onUseTemplate: (template: RecallTemplate) => void;
  onOpenRecent: (board: BoardMeta) => void;
  onRenameRecent?: (board: BoardMeta) => void;
  onDeleteRecent?: (board: BoardMeta) => void;
  onDuplicateRecent?: (board: BoardMeta) => void;
  onNew: () => void;
  onOpen: () => void;
  onImport: () => void;
}) {
  return (
    <div className="home-screen">
      <div className="home-inner">
        <section className="home-hero">
          <div>
            <h1>Recall Board</h1>
            <p>Create an editable visual workspace from a template, recent board, or imported graph.</p>
          </div>
          <div className="home-actions">
            <button type="button" onClick={onNew}>Blank Canvas</button>
            <button type="button" onClick={onOpen}>Open Board</button>
            <button type="button" onClick={onImport}>Import Graph</button>
          </div>
        </section>
        <TemplateGallery templates={templates} onUseTemplate={onUseTemplate} />
        <RecentBoards
          boards={recentBoards}
          onOpen={onOpenRecent}
          onRename={onRenameRecent}
          onDelete={onDeleteRecent}
          onDuplicate={onDuplicateRecent}
        />
      </div>
    </div>
  );
}
