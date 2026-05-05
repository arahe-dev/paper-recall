# Installation

## Windows

Use the setup exe for the simplest install:

[Download Recall Board setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Setup-0.1.0-x64.exe)

Alternative downloads:

- [MSI installer](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-0.1.0-x64.msi)
- [Portable executable](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Portable-0.1.0-x64.exe)
- [Frameless traffic-light setup exe](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Frameless-Setup-0.1.0-x64.exe)
- [Frameless portable executable](https://github.com/arahe-dev/paper-recall/releases/download/v0.1.0/Recall-Board-Frameless-Portable-0.1.0-x64.exe)

## SmartScreen Warning

The current build is unsigned. Windows may warn that the publisher is unknown. This is expected for the test release.

## WebView2

Recall Board uses Tauri on Windows, which depends on Microsoft Edge WebView2. Most Windows 10/11 machines already include it.

If the app does not launch, install or repair WebView2 Runtime from Microsoft.

## Source Install

```powershell
git clone https://github.com/arahe-dev/paper-recall.git
cd paper-recall
corepack enable
corepack pnpm install
corepack pnpm dev
```
