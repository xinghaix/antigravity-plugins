# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-11-13

### Added
- **Sidecar Aux Pane UI (`MCP Manager`)**: Native light/dark theme integration, bilingual (`中文` / `EN`) UI switcher, scope tabs (`All`, `Global`, `Workspace`, `Plugins`), search, status filters, and keyboard shortcuts (`/`, `Cmd/Ctrl+K`, `Cmd/Ctrl+S`).
- **Multi-Scope Store (`mcp_store.mjs`)**: Manage `~/.gemini/config/mcp_config.json`, `<workspace>/.agents/mcp_config.json`, cross-scope server moves, conflict detection, atomic `0600` writes, and 15-slot automatic backups with one-click restore.
- **Live Protocol Probe (`mcp_probe.mjs`)**: Single and batch probing over Stdio (newline-delimited JSON and `Content-Length` framing, cross-platform executable & Windows `PATHEXT` resolution) and Streamable HTTP (`application/json` and `text/event-stream` SSE with `Mcp-Session-Id`).
- **Host Runtime Bridge**: Reads Antigravity Language Server `GetMcpServerStates` to surface `Host Ready` badges and instant tool inspection.
- **Standard Open-Source Tooling**: Cross-platform installer CLI (`scripts/cli.mjs`, `install.sh/.bat`, `uninstall.sh/.bat`), manifest/syntax checker (`scripts/check.mjs`), zero-dependency release packager (`scripts/package-release.mjs`), GitHub Actions CI & Release workflows, and automated unit tests.
