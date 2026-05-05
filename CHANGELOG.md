# Changelog

## v0.1.0 - Windows desktop test build

Initial public test release for Recall Board.

### Added

- Tauri Windows desktop packaging.
- NSIS setup exe, MSI installer, portable executable, and separate frameless test release artifacts.
- Browser development mode through Vite.
- Local board save, open, save-as, recent board, duplicate, rename, and delete flows.
- Excalidraw scene editing.
- Template gallery and saved templates.
- Recall Graph IR import.
- Export menu for scene, AI context, text graph, prompt, and related board formats.
- Transcript parser for turning terminal or agent logs into structured summaries.
- Optional frameless custom-chrome Tauri mode.
- Public README, wiki source docs, security notes, and CI workflow.

### Known Limitations

- Windows installer is unsigned and may trigger SmartScreen.
- The default desktop shell uses the normal OS titlebar. Frameless custom chrome is available as separate test artifacts.
- Security audit still reports transitive advisories in Excalidraw's Mermaid parser chain.
- GitHub Pages documentation is prepared in `docs/`, but Pages hosting is not enabled by this release.
