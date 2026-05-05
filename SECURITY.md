# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.1.x | Test build support only |

Recall Board is currently an early prototype. Security issues should be reported, but this repository does not yet have a formal SLA.

## Reporting a Vulnerability

Open a GitHub issue with enough detail to reproduce the issue. Do not include private keys, credentials, personal files, or sensitive board content in a public issue.

If a report requires private data, first open a minimal issue asking for a private reporting path.

## Current Security Notes

The current dependency scan is documented in `docs/security-scan.md`.

Known status:

- JavaScript audit reports transitive advisories through Excalidraw's Mermaid parser dependency chain.
- Rust audit reports unmaintained GTK3-related dependency warnings through Tauri's cross-platform Linux/WebKit stack.
- The Windows installer is not code signed.
- The app is local-first and does not currently require a backend service.
