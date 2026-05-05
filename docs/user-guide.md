# User Guide

## Installing Recall Board

Download the current Windows test build:

- [Windows setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Setup-0.1.0-x64.exe)
- [Windows MSI](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-0.1.0-x64.msi)
- [Portable app exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Portable-0.1.0-x64.exe)
- [Frameless traffic-light setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Frameless-Setup-0.1.0-x64.exe)

The setup exe is the recommended option for most testers. The portable exe is useful when you want to run the app without an installer.

## Launching the App

After installation, open Recall Board from the Start menu or from the installed shortcut.

The app opens to a home screen with template options, recent boards, and quick access to a new board.

## Creating a Board

1. Select **New**.
2. Use the Excalidraw tools to draw shapes, arrows, text, and diagrams.
3. Use templates when you want a fast starting point.
4. Save the board when you want it to appear in recent boards.

## Saving and Opening Boards

Use the top toolbar:

- **Save** updates the current board.
- **Save As** stores the board under a new name.
- **Open** loads an existing board file.
- **Recent** lists boards you opened or saved recently.
- **Duplicate** creates a copy of the current board.
- **Rename** changes the board name.
- **Delete** removes the current board entry.

## Using Templates

Templates give you a structured starting point. Open the template gallery, choose a template, and then edit the board normally.

Saved templates can be reused in later sessions.

## Importing Graph Data

Use **Load Recall Graph IR** to import structured Recall graph JSON. The app renders that graph as an editable board.

## Exporting Board Context

Use **Export** to download machine-readable files from the current board.

Common exports:

- Excalidraw scene JSON for full visual scene fidelity.
- AI context JSON for screenshot-free AI understanding.
- Text graph JSON for compact node-edge parse-back.
- Text graph prompt for asking an AI to explain the board.

## Text Graph Parse-Back

The text graph export converts visible board structure into compact graph data.

It handles:

- Text inside shapes as node labels.
- Bound arrows as strong visual relations.
- Loose arrows as lower-confidence inferred relations.
- Deleted elements by filtering them out.
- Ungrouped text and unresolved arrows as separate diagnostics.

This is the preferred format when an AI should understand a board without seeing an image.

## Transcript Parser

Use **Parse Transcript** when you have a terminal log, build log, or agent session transcript.

The parser extracts:

- Commands.
- File changes.
- Errors and warnings.
- Verification checks.
- Commits.
- Next steps.

You can export the parsed result as JSON or Markdown.

## Normal and Frameless Windows

The default desktop app uses the normal operating system titlebar.

The frameless custom-chrome build is available as a separate download for testing a softer desktop shell with custom window controls. It is not the default production path yet.

## Troubleshooting

If Windows blocks the installer, choose **More info** and then **Run anyway** only if you trust the build source.

If the app does not launch, install or repair Microsoft Edge WebView2 Runtime. Most Windows 10/11 systems already include it.

If a frameless build has window-control issues, use the default decorated app build instead.
