# Developer Guide

## Stack

- React
- TypeScript
- Vite
- Excalidraw
- Tauri
- Rust

## Install

```powershell
corepack enable
corepack pnpm install
```

## Run Browser Mode

```powershell
corepack pnpm dev
```

## Run Native Desktop Mode

```powershell
corepack pnpm tauri:dev
```

## Run Frameless Native Mode

```powershell
corepack pnpm tauri:dev:frameless
```

## Build

```powershell
corepack pnpm run build
corepack pnpm tauri:build
```

## Build Frameless Package

```powershell
corepack pnpm tauri:build:frameless
```

## Verify

```powershell
corepack pnpm run lint
corepack pnpm run build
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Security Scan

```powershell
corepack pnpm audit
cargo audit --manifest-path src-tauri/Cargo.toml
```
