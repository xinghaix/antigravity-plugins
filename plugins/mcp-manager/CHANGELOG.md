# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-11-19

### Added
- **Per-MCP Custom Prompts & Native Lifecycle Hook Injection**:
  - Added `hooks/prompt_store.mjs` to store per-server system prompts (`~/.gemini/config/sidecar_data/mcp_manager/prompts.json`) independently from `mcp_config.json`, supporting Global, Workspace, and Plugin MCP servers plus automatic migration on server rename.
  - Added `hooks.json` and `hooks/mcp_prompt_hook.mjs` supporting three injection modes: `on_demand` (schema-read detection, incremental transcript fallback, optional user-input keywords, and tool-call fallback), `strict` (one-time `PreToolUse` gate before unbriefed calls), and `session_start` (active servers at `SessionStart` with catch-up).
  - Added Sidecar HTTP API endpoints (`/api/prompt/save`, `/api/prompt/delete`), status filter (`Has Prompt` / `仅含提示词`), searchable prompt text/keywords, clickable prompt badges, and the Per-MCP Prompt editor modal in the Aux Pane UI.
  - Updated `scripts/cli.mjs` standalone `--copy` runtime list to include `hooks.json` and `hooks/`.

## [1.0.0] - 2026-11-13

### Added
- **Sidecar Aux Pane UI (`MCP Manager`)**: Native light/dark theme integration, bilingual (`中文` / `EN`) UI switcher, scope tabs (`All`, `Global`, `Workspace`, `Plugins`), search, status filters, and keyboard shortcuts (`/`, `Cmd/Ctrl+K`, `Cmd/Ctrl+S`).
- **Multi-Scope Store (`mcp_store.mjs`)**: Manage `~/.gemini/config/mcp_config.json`, `<workspace>/.agents/mcp_config.json`, cross-scope server moves, conflict detection, atomic `0600` writes, and 15-slot automatic backups with one-click restore.
- **Live Protocol Probe (`mcp_probe.mjs`)**: Single and batch probing over Stdio (newline-delimited JSON and `Content-Length` framing, cross-platform executable & Windows `PATHEXT` resolution) and Streamable HTTP (`application/json` and `text/event-stream` SSE with `Mcp-Session-Id`).
- **Host Runtime Bridge**: Reads Antigravity Language Server `GetMcpServerStates` to surface `Host Ready` badges and instant tool inspection.
- **Standard Open-Source Tooling**: Cross-platform installer CLI (`scripts/cli.mjs`, `install.sh/.bat`, `uninstall.sh/.bat`), manifest/syntax checker (`scripts/check.mjs`), zero-dependency release packager (`scripts/package-release.mjs`), GitHub Actions CI & Release workflows, and automated unit tests.
