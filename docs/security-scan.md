# Security Scan Notes

Date: 2026-05-05

## Commands Run

```powershell
npm audit --omit=dev
npm audit
npm audit fix
corepack pnpm audit --prod
corepack pnpm audit
cargo check --locked
cargo install cargo-audit --locked
cargo audit
git grep -n -I -E "(ghp_|gho_|github_pat_|sk-|AIza|BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY)"
```

## JavaScript Dependency Audit

`npm audit` reported 11 vulnerabilities before the repo was standardized on pnpm lockfile usage:

- 1 high severity issue.
- 10 moderate severity issues.

`corepack pnpm audit` reports 6 advisories in the pnpm dependency graph:

- 1 high severity advisory for `lodash-es`.
- 5 moderate severity advisories for `lodash-es`, `nanoid`, and `uuid`.

The affected path is transitive through:

```text
@excalidraw/excalidraw
@excalidraw/mermaid-to-excalidraw
@mermaid-js/parser
mermaid
langium
chevrotain
```

## Mitigation Decision

`npm audit fix` did not resolve the remaining advisories.

`npm audit fix --force` indicated it would install `@excalidraw/excalidraw@0.17.6`, which is a breaking downgrade from the current `0.18.1` dependency. That forced downgrade was not applied because Excalidraw is the app's core editor dependency.

Current mitigation:

- Keep the app local-first.
- Avoid treating Mermaid import paths as trusted input.
- Track upstream Excalidraw releases for a patched dependency chain.
- Re-run audits before each release.

## Rust Dependency Audit

`cargo check --locked` passed.

`cargo audit` completed and reported warnings through Tauri's cross-platform dependency tree:

- Unmaintained GTK3 binding crates used by the Linux/WebKit stack.
- `glib` unsoundness warning through the same cross-platform stack.
- Unmaintained `unic-*` crates through `tauri-utils`.

These warnings come from transitive Tauri/wry dependencies. The current packaged release is Windows x64, but the warnings should be tracked before advertising Linux support.

## Secret Scan

A tracked-file pattern scan for common GitHub, OpenAI, Google API, and private-key formats found no matching committed secrets.

## Release Security Notes

- The Windows installer is unsigned.
- Windows SmartScreen may warn users about an unknown publisher.
- The app does not currently use a remote backend.
- Board files may contain sensitive user content, so users should treat exported JSON files as private unless intentionally shared.
