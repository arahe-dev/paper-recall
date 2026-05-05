import GlassCard from "./GlassCard";
import type { RecallTemplate } from "../utils/templateEngine";

export default function TemplateGallery({
  templates,
  onUseTemplate,
  onClose,
}: {
  templates: RecallTemplate[];
  onUseTemplate: (template: RecallTemplate) => void;
  onClose?: () => void;
}) {
  return (
    <section className="template-gallery" aria-label="Templates">
      <div className="section-heading">
        <div>
          <h2>Templates</h2>
          <p>Start with an editable board structure.</p>
        </div>
        {onClose && (
          <button type="button" className="subtle-button" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <GlassCard key={template.id} className="template-card">
            <div className="template-icon" aria-hidden="true">{template.icon}</div>
            <div className="template-content">
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <span>{template.category}</span>
            </div>
            <button type="button" onClick={() => onUseTemplate(template)}>
              Use Template
            </button>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
