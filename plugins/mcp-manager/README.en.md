# Antigravity MCP Manager

[简体中文](README.md) · **English**

[![CI](https://github.com/xinghaix/antigravity-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/xinghaix/antigravity-plugins/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/xinghaix/antigravity-plugins)](https://github.com/xinghaix/antigravity-plugins/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A zero-dependency visual **MCP (Model Context Protocol)** server manager plugin for **Google Antigravity** (Desktop & IDE). Runs natively inside Antigravity's auxiliary side pane (`Aux Pane`) with automatic light/dark theme synchronization.

![MCP Manager Preview](assets/preview.svg)

---

## Features

- **Unified Multi-Scope Management**: View and manage Global (`~/.gemini/config/mcp_config.json`), Workspace (`<project>/.agents/mcp_config.json`), and Plugin-bundled MCP servers in one place, with cross-scope migration and duplicate-name conflict detection.
- **Host Runtime Integration & Live Reload (Antigravity 2.34+)**: Reads Language Server `GetMcpServerStates`, `ListMcpResources`, `ListMcpPrompts`, and `ListPluginAuthProviders`, with one-click `RefreshMcpServers` reload globally or per server (plus auto-refresh after config edits/toggles/imports).
- **Dynamic Workspaces & Native Host Actions**: Subscribes to `sidecar.getWorkspaceUris()` / `onWorkspaceChange`, opens config files directly in Aux Pane via `sidecar.ui.toggleAuxPane`, triggers `sidecar.auth.requestCredentialRefresh`, and dispatches diagnostic prompts via `sidecar.agent.sendMessage`.
- **Live Protocol Probe & MCP Apps (`ui://`) Inspector**: Handshakes with Stdio and Streamable HTTP servers across `tools/list`, `resources/list`, and `prompts/list`, surfacing `ui://` resources, `aux_pane`/`global` entrypoints, `visibility: ["app"]` badges, and `2.34+` compliance warnings (required args on zero-arg entrypoints, invalid UI scheme or MIME type).
- **Inline `tools/call` Sandbox Runner**: Test any probed tool directly inside the drawer with editable JSON args (default `{}`), showing execution latency and checking the `1 MiB` trajectory payload cap.
- **`${PLUGIN_ROOT}` / `${PLUGIN_DATA}` & Plugin Namespacing**: Expands plugin MCP variables without false path warnings, resolves `<pluginName>_<serverName>` host/tool namespaces across `getState` and `hooks/mcp_prompt_hook.mjs`, and optionally bundles saved server prompts into `rules/AGENTS.md` on export.
- **Visual Tool Filtering**: Toggle tool checkboxes inside the probe drawer and save back cleanly as `enabledTools` (allowlist) or `disabledTools` (denylist).
- **Per-MCP Custom Prompts & Native Hook Injection**: Attach custom system instructions to any Global, Workspace, or Plugin MCP server without polluting `mcp_config.json` (stored in `~/.gemini/config/sidecar_data/mcp_manager/prompts.json`). Powered by Antigravity native `hooks.json` with three injection modes:
  - **On-Demand (`on_demand`, default)**: Zero idle token overhead; automatically injects once when the agent reads the MCP schema, matches optional keywords, or calls the server.
  - **Strict Gate (`strict`)**: Uses on-demand signals first; if the model skips schema reading (e.g. `eager` tools) and invokes the server unbriefed, blocks the 1st call once with the instructions in `reason` so it immediately retries cleanly.
  - **Session Start (`session_start`)**: Injects at `SessionStart` for enabled servers.
- **Dual-Mode Editor & Snippet Importer**: Built-in templates (`Filesystem`, `Fetch`, `GitHub`, `SQLite`, `Remote HTTP`, `SSE Bridge`), one-click command splitter, secret masking, Form/JSON two-way sync, server cloning, and snippet import compatible with Antigravity, Claude Desktop, Cursor, and VS Code (`servers` / `serverUrl`).
- **Atomic Writes & Backup Restore**: Every write uses atomic temp-file replacement (`0600`) and retains up to 15 automatic backups that can be restored in one click from the `Raw / Backups` modal.
- **One-Click Plugin Packaging**: Export any MCP server into a standalone `~/.gemini/config/plugins/<slug>/` plugin bundle for independent toggling.
- **Bilingual UI & Shortcuts**: Instant `EN / 中` toggle in the header, `/` or `Cmd/Ctrl+K` to search, and `Cmd/Ctrl+S` to save open modals.

---

## Installation

### Prerequisites
- **Google Antigravity** (with plugin & Sidecar Aux Pane support)
- **Node.js >= 20.0.0** (zero external npm dependencies)

### Option 1: Single-Plugin Remote Install (No Full Clone)
```bash
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- mcp-manager
```

### Option 2: Install via AI Agent
Ask Antigravity directly:
> "Read `AGENTS.md` in `https://github.com/xinghaix/antigravity-plugins` and install the `mcp-manager` plugin."

### Option 3: Install from Monorepo Source

```bash
git clone https://github.com/xinghaix/antigravity-plugins.git
cd antigravity-plugins

# Symlink install (default, follows git updates):
node scripts/cli.mjs install mcp-manager

# Or standalone copy:
# node scripts/cli.mjs install mcp-manager --copy
```

Restart Antigravity (or toggle the plugin in Customizations), then open `[MCP Manager](sidecar://mcp-manager/mcp_manager/)`.

### Uninstall
```bash
./uninstall.sh          # macOS / Linux
# uninstall.bat         # Windows
# or: node scripts/cli.mjs uninstall
```
> Uninstalling removes only the plugin folder and keeps your `~/.gemini/config/mcp_config.json` intact.

---

## Development & Testing

```bash
# Run syntax, manifest, and strict layout checks
npm run check

# Run unit tests
npm test

# Validate with Antigravity CLI
agy plugin validate ~/.gemini/config/plugins/mcp-manager --strict --json

# Build release archives (.zip, .tar.gz, SHA256SUMS.txt)
npm run pack:release
```

---

## License

Licensed under the [MIT License](LICENSE).
