# recall-board-excalidraw

A fast prototype to test whether Excalidraw can become the board foundation for Recall.

## What this prototype is

This is a minimal Vite + React + TypeScript app wrapping the `@excalidraw/excalidraw` editor. It explores:

- Infinite canvas
- Editable objects (rectangles, ellipses, diamonds, text, arrows)
- Arrows and bindings
- Scene JSON export
- Screenshot-free AI context export with deleted-element filtering
- Compact board text graph export (nodes + edges for fast AI reading)
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

### Board Text Graph

1. Draw a rectangle with text (e.g. "hello").
2. Draw another rectangle with text (e.g. "world").
3. Draw an arrow from "hello" to "world".
4. Click **Export Text Graph** in the top bar.
5. Open `recall-board-text-graph.json`.
6. Confirm it contains nodes with labels "hello" and "world" with an edge between them.
7. Click **Export Text Graph Prompt** to download a `.txt` file with instructions for an AI to explain the board from the graph.

The text graph:
- Converts "text inside shape + arrows" into nodes and edges
- Groups text into shapes (via `containerId`, `boundElements`, or geometry)
- Labels nodes from contained text; extra text becomes body
- Excludes deleted elements
- Resolves bound arrows (confidence 1.0) and loose arrows via geometry (confidence ~0.7)
- Flags unresolved arrows and ungrouped text separately
- Preserves original labels exactly — no summarization, no typos fixed
- Never infers meaning beyond visible text and arrows

The export includes **graph_insights**:
- **Root detection**: finds nodes with highest outgoing edge count and no incoming edges
- **Leaf detection**: finds nodes with incoming edges but no outgoing edges
- **Direct branch count**: outgoing edges from the top root node
- **Max depth estimate**: longest directed path from root using BFS
- **Relation status counts**: bound vs loose inferred edges
- **Lowest-confidence edge**: identifies the edge most likely needing verification

This helps AI explain boards quickly without screenshots. Models should separate visible graph facts from likely interpretation.

Example of exported insights for an ESP32-to-five-IMUs board:
- Root: `esp 32` (5 outgoing, 0 incoming)
- Direct branches: 5
- Leaves: `imu 0 thumb`, `imu 1 index finger`, `imu 2 middle finger`, `imu 3 back of hand`, `imu 4 wrist relative`
- Max depth: 1
- Relation statuses: 4 bound, 1 loose inferred
- Lowest confidence edge: `esp 32 connects to imu 2 middle finger` (0.75, loose_inferred_relation)

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
