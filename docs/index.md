# Recall Board Documentation

Recall Board is a local-first Excalidraw-based board app for editable diagrams and screenshot-free AI context export.

## Quick Links

- [Download Windows setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Setup-0.1.0-x64.exe)
- [Download frameless traffic-light setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Frameless-Setup-0.1.0-x64.exe)
- [User guide](user-guide.md)
- [Developer guide](developer-guide.md)
- [Security scan notes](security-scan.md)
- [Release notes](../CHANGELOG.md)

## What Recall Board Is For

Recall Board helps a user create a board, keep it editable, and send compact graph/context exports back to an AI assistant without relying on screenshots.

It currently supports:

- Excalidraw canvas editing.
- Local board persistence.
- Recent boards.
- Templates.
- Import and export tools.
- AI context and text graph exports.
- Transcript parsing.
- Native Windows desktop packaging through Tauri.

## Documentation Structure

- `user-guide.md` explains day-to-day use.
- `developer-guide.md` explains local development, build, Tauri packaging, and release commands.
- `security-scan.md` records the latest dependency and secret scan findings.
- `wiki/` contains GitHub Wiki source pages that can also be adapted into a GitHub Pages site.
