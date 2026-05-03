# recall-board-excalidraw

A fast prototype to test whether Excalidraw can become the board foundation for Recall.

## What this prototype is

This is a minimal Vite + React + TypeScript app wrapping the `@excalidraw/excalidraw` editor. It explores:

- Infinite canvas
- Editable objects (rectangles, ellipses, diamonds, text, arrows)
- Arrows and bindings
- Scene JSON export
- Screenshot-free AI context export with deleted-element filtering
- Transcript/log parser for importing build/session logs into structured notes

This is **not** the final Recall app. It is a stable, simple wrapper to validate the approach.

## Install and run

```bash
cd C:\Users\arahe\recall-board-excalidraw
npm install
npm run dev
```

Then open the printed localhost URL (e.g. `http://localhost:5173/`).

## Build

```bash
npm run build
```

## How to test

### Board AI Context

1. Open the app in your browser.
2. Draw a rectangle and place a text box inside it.
3. Draw an arrow between two shapes.
4. Draw another rectangle + text.
5. **Delete** at least one element.
6. Click **Export AI Context** in the top bar.
7. Open the downloaded `recall-ai-context.json`.
8. Paste the JSON into an AI chat without any screenshot.

The AI context includes:
- All **active** elements with positions, sizes, colors, and text
- Deleted/tombstoned elements are **excluded** by default
- Arrow bindings (if Excalidraw provides them)
- Broken bindings detected when an active arrow points to a deleted element
- Candidate groupings when text centers fall inside shape bounds
- `screenshot_required: false`

### Transcript Parser

1. Click **Parse Transcript** in the top bar.
2. Paste a terminal or agent log into the textarea.
3. Click **Parse**.
4. Review the summary cards and extracted sections.
5. Click **Export Transcript JSON** or **Export Transcript Markdown**.

The parser extracts:
- Commands (npm, cargo, git, etc.)
- File changes (created/modified/deleted)
- Errors and warnings
- Verification checks (build/test results)
- Commits
- Next steps / TODOs

## Policy

### Board Context

- **Deleted/tombstoned elements** are excluded from AI context by default. Scene JSON may still include raw scene data for fidelity.
- **Bound arrows** (attached to elements) are treated as **visual relations**, not confirmed semantic connectors.
- **Loose arrows** (no binding) are treated as **candidate relations only**.
- **Broken arrows** (active arrow bound to deleted element) are flagged as `broken_visual_relation` with a diagnostic warning.
- **Shape + text proximity** (text center inside shape bounds) is treated as a **candidate grouping only** unless explicitly promoted.
- No full semantic connectors are implemented yet. Do not treat candidates as confirmed graph edges.

### Transcript Context

- The transcript parser is **heuristic v0** and deterministic. It does not use AI.
- It is **separate** from board/scene understanding.
- It turns pasted terminal/agent logs into structured session summaries.

## Next steps

- Define a semantic card convention (shape + text + metadata)
- Define a connector convention (explicit semantic edges beyond visual arrows)
- Local save/load (IndexedDB or filesystem)
- Import/export cleanup and versioning
- Optional Rust core later for graph operations and persistence

## Tech stack

- Vite
- React + TypeScript
- `@excalidraw/excalidraw` (v0.18.1)
