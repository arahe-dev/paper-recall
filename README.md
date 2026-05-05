# Recall Board

Recall Board is a local-first desktop and browser app for building editable Excalidraw boards, saving them locally, and exporting compact AI-readable board context without screenshots.

The current build is an early Windows desktop release of the Recall board prototype. It is useful for testing diagram capture, board persistence, templates, import/export, and text-graph parse-back.

## Download

Latest Windows test build:

- [Download Windows setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Setup-0.1.0-x64.exe)
- [Download Windows MSI](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-0.1.0-x64.msi)
- [Download portable app exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Portable-0.1.0-x64.exe)
- [Download frameless traffic-light setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Frameless-Setup-0.1.0-x64.exe)

Windows may show an unknown publisher warning because this test build is not code signed yet.

## What It Does

- Opens an editable Excalidraw canvas.
- Saves, opens, duplicates, renames, and deletes local boards.
- Shows recent boards.
- Provides templates for common board shapes.
- Imports Recall Graph IR JSON.
- Exports Excalidraw scene JSON, compact text graph JSON, AI context JSON, and prompt text.
- Parses build/session transcripts into structured summaries.
- Runs as a browser dev app or a native Tauri desktop app.
- Includes an optional frameless desktop shell with custom window controls for testing.

## Install From Source

Requirements:

- Node.js 24 or newer
- Corepack
- Rust stable toolchain
- Windows 10/11 for the current packaged desktop build

Install dependencies:

```powershell
cd C:\Users\arahe\recall-board-excalidraw
corepack enable
corepack pnpm install
```

Run in browser mode:

```powershell
corepack pnpm dev
```

Build the web app:

```powershell
corepack pnpm run build
```

Run the normal native desktop shell:

```powershell
corepack pnpm tauri:dev
```

Run the frameless custom-chrome shell:

```powershell
corepack pnpm tauri:dev:frameless
```

Build Windows installers:

```powershell
corepack pnpm tauri:build
corepack pnpm tauri:build:frameless
```

## Basic Use

1. Launch Recall Board.
2. Create a new board or open a recent board.
3. Draw with the Excalidraw tools.
4. Use **Save** or **Save As** to persist the board.
5. Use **Export** for AI context, text graph, Excalidraw scene, or prompt files.
6. Use **Load Recall Graph IR** to import a structured graph.
7. Use **Parse Transcript** to convert terminal or agent logs into a structured summary.

## AI Context and Parse-Back

Recall Board is designed so an AI can understand a board from structured text instead of a screenshot.

The compact text graph export:

- Groups text inside shapes into labeled nodes.
- Converts bound arrows into high-confidence relations.
- Converts loose arrows into lower-confidence inferred relations.
- Excludes deleted Excalidraw elements.
- Reports unresolved arrows and ungrouped text separately.
- Preserves visible labels instead of summarizing them.

This makes the board easier to pass back into an AI model as graph data.

## Documentation

- [User guide](docs/user-guide.md)
- [Developer guide](docs/developer-guide.md)
- [Security scan notes](docs/security-scan.md)
- [Release notes](CHANGELOG.md)
- [Universal diagram planner plan](docs/universal-diagram-planner-plan.md)

GitHub Wiki source pages are also kept in `docs/wiki/` so they can be mirrored to the repository wiki or reused for GitHub Pages.

## Security Status

The latest scan found known transitive advisories from Excalidraw's Mermaid parser dependency chain. A forced npm audit fix would downgrade Excalidraw and risk breaking the app, so it was not applied. See [Security scan notes](docs/security-scan.md) for details.

## Project Status

This is a prototype-quality release. The board editor and desktop packaging are usable, but the installer is unsigned and the custom frameless titlebar is still a separate feasibility build rather than the default production shell.

## License

No open-source license has been selected yet. Treat the code as source-available until a license is added.
