# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-11-23

### Added
- **Antigravity 2.34.0 Host Integration & Live Reload**:
  - Added `RefreshMcpServers` LS RPC integration (`POST /api/host/refresh` plus automatic background reload after saving, toggling, deleting, importing, restoring backups, or exporting plugins), and read-only `ListMcpResources` / `ListMcpPrompts` / `ListPluginAuthProviders` host discovery.
  - Subscribed to `window.sidecar.getWorkspaceUris()` & `onWorkspaceChange` (`POST /api/state/query`) for live workspace synchronization in Antigravity 2.34+ where `app.config.workspaceUris` is no longer populated.
  - Integrated `window.sidecar.ui.toggleAuxPane`, `window.sidecar.auth.requestCredentialRefresh`, and `window.sidecar.agent.sendMessage` for one-click config file viewing, credential refresh, and diagnostic escalation.
- **MCP Apps (`ui://`) Inspector & `tools/call` Sandbox Runner**:
  - Extended `mcp_probe.mjs` to query `resources/list` and `prompts/list` alongside `tools/list`, parse SEP-1865 `_meta.ui` (`ui://` resources, `visibility: ["app"]`) and `com.google.antigravity/ui` (`aux_pane` / `global` entrypoints), run `diagnoseMcpAppTools` compliance checks, and expose an inline `callServerTool` runner (`POST /api/probe/call-tool`) checking the 1 MiB trajectory cap.
  - Added `MCP App (2.34+)` status filter, badges, warnings against disabling `App-Only` tools, and quick editor template.
- **Plugin Variable Expansion & Namespacing**:
  - Added `expandPluginVariables` (`${PLUGIN_ROOT}`, `${PLUGIN_DATA}`) in `mcp_store.mjs` and `mcp_probe.mjs`, warning when used outside plugin `mcp_config.json`.
  - Resolved `<pluginName>_<serverName>` namespaced servers and `mcp_<plugin>_<server>_<tool>` calls in `getState` and `hooks/mcp_prompt_hook.mjs`, and added `grep_search` to `hooks.json` `PostToolUse` matcher.
  - Enhanced `exportAsPlugin` with clean server keys, `suggestedPrompts`, and optional `rules/AGENTS.md` bundling for saved server prompts.

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
