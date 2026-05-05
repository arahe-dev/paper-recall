# Security

Recall Board is currently an unsigned local-first prototype.

## Current Scan Status

The current dependency scan reports known transitive advisories through Excalidraw's Mermaid parser dependency chain.

A forced audit fix would downgrade Excalidraw and risk breaking the editor, so that change has not been applied.

Rust audit warnings are currently transitive through Tauri's cross-platform dependency stack. The current release target is Windows x64.

## User Data

Board files, Excalidraw scene files, AI context exports, and text graph exports may contain sensitive user content. Share them intentionally.

## Installer Trust

The Windows installer is not code signed. Users should only install builds from the official repository release page.

Use the normal installer for the safest desktop shell. Use the frameless installer only when testing the custom traffic-light window controls.

## Network Model

The current app does not require a remote backend for board editing and local persistence.
