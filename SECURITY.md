# Security Policy

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities (such as path traversal, arbitrary command injection, or credential exposure).

Instead, report security issues privately via **GitHub Security Advisories** on this repository (`https://github.com/xinghaix/antigravity-plugins/security/advisories/new`) or contact the maintainer (`xinghaix`) directly.

## Security Design Notes

- **Zero External Dependencies**: All plugins and tooling run purely on Node.js >= 20 built-ins and `sidecar_sdk`.
- **Atomic File Writes & `0600` Permissions**: Sensitive configs (`mcp_config.json`, `state.json`, backups) are written atomically with `0600` permissions.
- **Strict Path Validation**: Backup restoration and plugin/workspace operations reject path traversal inputs.
- **Secret Masking**: Environment variables and HTTP headers in MCP Manager are masked in the UI by default.
