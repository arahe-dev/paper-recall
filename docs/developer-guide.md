# Developer Guide

## Requirements

- Node.js 24 or newer.
- Corepack.
- pnpm 10.33.3 through Corepack.
- Rust stable toolchain.
- Tauri prerequisites for your platform.

## Install

```powershell
corepack enable
corepack pnpm install
```

## Browser Development

```powershell
corepack pnpm dev
```

## Web Build

```powershell
corepack pnpm run build
```

## Lint

```powershell
corepack pnpm run lint
```

## Tauri Desktop Development

Normal OS titlebar:

```powershell
corepack pnpm tauri:dev
```

Frameless custom chrome:

```powershell
corepack pnpm tauri:dev:frameless
```

## Tauri Packaging

Normal package:

```powershell
corepack pnpm tauri:build
```

Frameless package:

```powershell
corepack pnpm tauri:build:frameless
```

Windows artifacts are written under:

```text
src-tauri/target/release/app.exe
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

## Security Commands

JavaScript dependencies:

```powershell
corepack pnpm audit
```

Rust dependencies:

```powershell
cargo audit --manifest-path src-tauri/Cargo.toml
```

Rust compile check:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Release Process

1. Update `CHANGELOG.md`.
2. Run lint, build, Tauri build, JavaScript audit, and Rust audit.
3. Build the installer artifacts.
4. Copy artifacts to stable release names.
5. Create or update the GitHub release.
6. Upload the setup exe, MSI, and portable exe.
7. Confirm the direct download links work.

Current release asset names:

```text
Recall-Board-Setup-0.1.0-x64.exe
Recall-Board-0.1.0-x64.msi
Recall-Board-Portable-0.1.0-x64.exe
Recall-Board-Frameless-Setup-0.1.0-x64.exe
Recall-Board-Frameless-0.1.0-x64.msi
Recall-Board-Frameless-Portable-0.1.0-x64.exe
```
