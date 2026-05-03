# recall-board-excalidraw

A fast prototype to test whether Excalidraw can become the board foundation for Recall.

## What this prototype is

This is a minimal Vite + React + TypeScript app wrapping the `@excalidraw/excalidraw` editor. It explores:

- Infinite canvas
- Editable objects (rectangles, ellipses, diamonds, text, arrows)
- Arrows and bindings
- Scene JSON export
- Screenshot-free AI context export

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

1. Open the app in your browser.
2. Draw a rectangle and place a text box inside it.
3. Draw an arrow between two shapes.
4. Draw another rectangle + text.
5. Click **Export AI Context** in the top bar.
6. Open the downloaded `recall-ai-context.json`.
7. Paste the JSON into an AI chat without any screenshot.

The AI context includes:
- All elements with positions, sizes, colors, and text
- Arrow bindings (if Excalidraw provides them)
- Candidate groupings when text centers fall inside shape bounds
- `screenshot_required: false`

## Policy

- **Bound arrows** (attached to elements) are treated as **visual relations**, not confirmed semantic connectors.
- **Loose arrows** (no binding) are treated as **candidate relations only**.
- **Shape + text proximity** (text center inside shape bounds) is treated as a **candidate grouping only** unless explicitly promoted.
- No full semantic connectors are implemented yet. Do not treat candidates as confirmed graph edges.

## Next steps

- Define a semantic card convention (shape + text + metadata)
- Define a connector convention (explicit semantic edges beyond visual arrows)
- Local save/load ( IndexedDB or filesystem )
- Import/export cleanup and versioning
- Optional Rust core later for graph operations and persistence

## Tech stack

- Vite
- React + TypeScript
- `@excalidraw/excalidraw` (v0.18.1)
