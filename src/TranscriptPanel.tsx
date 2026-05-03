import { useState } from "react";
import { parseTranscript } from "./transcriptParser";
import { exportTranscriptJSON, exportTranscriptMarkdown } from "./transcriptExport";
import type { TranscriptContext } from "./transcriptTypes";

interface TranscriptPanelProps {
  onClose: () => void;
}

export default function TranscriptPanel({ onClose }: TranscriptPanelProps) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<TranscriptContext | null>(null);

  const handleParse = () => {
    if (!raw.trim()) return;
    const result = parseTranscript(raw);
    setParsed(result);
  };

  return (
    <div className="transcript-overlay" onClick={onClose}>
      <div className="transcript-panel" onClick={(e) => e.stopPropagation()}>
        <div className="transcript-header">
          <h3>Parse Transcript</h3>
          <button className="transcript-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="transcript-body">
          <textarea
            className="transcript-textarea"
            placeholder="Paste terminal/agent log here..."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={12}
          />
          <button className="transcript-parse-btn" onClick={handleParse}>
            Parse
          </button>

          {parsed && (
            <div className="transcript-results">
              <div className="transcript-summary-cards">
                <div className="transcript-card">
                  <div className="transcript-card-value">{parsed.summary.command_count}</div>
                  <div className="transcript-card-label">Commands</div>
                </div>
                <div className="transcript-card">
                  <div className="transcript-card-value">{parsed.summary.file_change_count}</div>
                  <div className="transcript-card-label">Files</div>
                </div>
                <div className="transcript-card">
                  <div className="transcript-card-value">{parsed.summary.error_count}</div>
                  <div className="transcript-card-label">Errors</div>
                </div>
                <div className="transcript-card">
                  <div className="transcript-card-value">{parsed.summary.warning_count}</div>
                  <div className="transcript-card-label">Warnings</div>
                </div>
                <div className="transcript-card">
                  <div className="transcript-card-value">{parsed.summary.verification_count}</div>
                  <div className="transcript-card-label">Checks</div>
                </div>
                <div className="transcript-card">
                  <div className="transcript-card-value">{parsed.summary.commit_count}</div>
                  <div className="transcript-card-label">Commits</div>
                </div>
              </div>

              {parsed.commands.length > 0 && (
                <div className="transcript-section">
                  <h4>Commands</h4>
                  <ul>
                    {parsed.commands.map((c) => (
                      <li key={c.id}>
                        <code>{c.command}</code>{" "}
                        <span className={`transcript-badge ${c.status}`}>{c.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parsed.errors.length > 0 && (
                <div className="transcript-section">
                  <h4>Errors</h4>
                  <ul>
                    {parsed.errors.map((e, i) => (
                      <li key={i} className="transcript-error-item">
                        <strong>{e.code}</strong>: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parsed.commits.length > 0 && (
                <div className="transcript-section">
                  <h4>Commits</h4>
                  <ul>
                    {parsed.commits.map((c, i) => (
                      <li key={i}>
                        <code>{c.hash.slice(0, 8)}</code> {c.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parsed.next_steps.length > 0 && (
                <div className="transcript-section">
                  <h4>Next Steps</h4>
                  <ul>
                    {parsed.next_steps.map((ns, i) => (
                      <li key={i}>{ns}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="transcript-actions">
                <button
                  className="transcript-export-btn"
                  onClick={() => exportTranscriptJSON(parsed)}
                >
                  Export Transcript JSON
                </button>
                <button
                  className="transcript-export-btn"
                  onClick={() => exportTranscriptMarkdown(parsed)}
                >
                  Export Transcript Markdown
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
