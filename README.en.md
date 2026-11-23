# Antigravity Plugins

[简体中文](README.md) · **English**

[![CI](https://github.com/xinghaix/antigravity-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/xinghaix/antigravity-plugins/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/xinghaix/antigravity-plugins)](https://github.com/xinghaix/antigravity-plugins/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A curated monorepo of native **Google Antigravity** plugins (Desktop & IDE). Every plugin is built with **zero external npm dependencies** (pure Node.js >= 20 standard library + `sidecar_sdk`), supports selective per-plugin installation, and adapts seamlessly to Antigravity's light/dark Sidecar Aux Pane themes.

---

## Plugin Catalog

| Plugin ID | Name | Origin & License | Summary | Components | Entry / Panel | Docs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mcp-manager` | **MCP Manager** | First-party · MIT | Multi-scope MCP manager, 2.34+ host `RefreshMcpServers` reload, MCP Apps (`ui://`) inspector, `tools/call` runner & hook prompts | 1 Skill · Hooks · 1 Sidecar UI | `sidecar://mcp-manager/mcp_manager/` | [Details](plugins/mcp-manager/README.en.md) |
| `mattpocock-skills` | **Mattpocock Skills** | Native port ([`mattpocock/skills`](https://github.com/mattpocock/skills)) · MIT | 39 skills, 4 leaf subagents, 2.34+ `run_workflow`/Swarm topological wave orchestrator & live Studio dispatch | 28 Default Skills · 4 Subagents · 1 Sidecar UI | `sidecar://mattpocock-skills/mp_studio/` | [Details](plugins/mattpocock-skills/README.en.md) |
| `antigravity-context-viewer` | **Context Viewer** | Modified edition (upstream: [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer)) · MIT | 2.34+ Aux Pane live context board, 4-row Bento workbench, Gemini 4 Neon & unified quota pool, heatmaps & low-overhead CDP auto-loader | 1 Skill · 1 Sidecar UI & Auto-Loader | `sidecar://antigravity-context-viewer/live-loader/` | [Details](plugins/antigravity-context-viewer/README.en.md) |

---

## Installation (Selective or All)

### Option 1: Remote One-Liner (No Full Clone)

```bash
# Install mcp-manager only
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- mcp-manager

# Install mattpocock-skills only
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- mattpocock-skills

# Install antigravity-context-viewer only
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- antigravity-context-viewer

# Install all plugins
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- --all
```

### Option 2: Unified Local CLI (Defaults to `--link`)

```bash
git clone https://github.com/xinghaix/antigravity-plugins.git
cd antigravity-plugins

node scripts/cli.mjs list
node scripts/cli.mjs install mcp-manager
node scripts/cli.mjs install --all              # Symlink all plugins (same as ./install.sh)
node scripts/cli.mjs install mattpocock-skills --copy
node scripts/cli.mjs uninstall mcp-manager
```

### Option 3: Official `agy` CLI

```bash
agy plugin install ./plugins/mcp-manager
agy plugin validate ./plugins/mattpocock-skills --strict --json
```

---

## Authoring & Testing

```bash
# Scaffold a new plugin (with optional Sidecar Aux Pane UI)
npm run new:plugin -- my-new-plugin --ui

# Validate all plugins, manifests, and registry.json
npm run check

# Run all root + plugin test suites
npm test

# Package per-plugin and bundle release archives into dist/release/
npm run pack:release
```

## License

Unified under the [MIT License](LICENSE). Third-party attributions are listed in [NOTICE](NOTICE).
