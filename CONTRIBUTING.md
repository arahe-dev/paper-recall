# Contributing

Recall Board is currently an early prototype. Keep changes focused and easy to verify.

## Local Setup

```powershell
corepack enable
corepack pnpm install
```

## Before Opening a Pull Request

Run:

```powershell
corepack pnpm run lint
corepack pnpm run build
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

For desktop changes, also run the relevant Tauri command:

```powershell
corepack pnpm tauri:dev
corepack pnpm tauri:dev:frameless
```

## Scope Guidance

- Keep browser mode working.
- Keep save, open, recent board, import, export, template, and parse-back flows working.
- Do not make raw Excalidraw JSON the canonical AI format.
- Do not claim domain-specific correctness from the generic diagram export path.
- Document known limitations rather than hiding them.
