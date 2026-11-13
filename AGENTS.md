# Agent Instructions (`antigravity-plugins`)

This repository is a **monorepo of standalone Google Antigravity plugins** under `plugins/<plugin-id>/`. Each subdirectory inside `plugins/` is an independent, self-contained Antigravity plugin (own `plugin.json`, `skills/`, `agents/`, `sidecars/`, `tests/`) with zero external npm dependencies (Node.js >= 20 standard library + `sidecar_sdk` only).

## Available Plugins

See `registry.json` or run `node scripts/cli.mjs list --json` for the live inventory:

- `mcp-manager` (`plugins/mcp-manager/`): Visual MCP server manager in the Aux Pane (`sidecar://mcp-manager/mcp_manager/`).
- `mattpocock-skills` (`plugins/mattpocock-skills/`): Native Antigravity migration of `mattpocock/skills` (39 skills, 4 leaf subagents, Sidecar Studio at `sidecar://mattpocock-skills/mp_studio/`).

## Installing Plugins for the User

When the user asks you to install one or all plugins from this repository:

1. **Install a specific plugin** (default `--link` mode when cloned locally; use `--copy` for standalone copy):
   ```bash
   node scripts/cli.mjs install mcp-manager
   node scripts/cli.mjs install mattpocock-skills
   ```
2. **Install all plugins**:
   ```bash
   node scripts/cli.mjs install --all --link
   ```
3. **Validate installed plugins**:
   ```bash
   agy plugin validate ~/.gemini/config/plugins/<plugin-id> --strict --json
   ```
4. Surface the relevant Sidecar pill link (`sidecar://...`) or plugin settings link (`customization://<plugin-id>`) in your response.

## Authoring a New Plugin

1. Scaffold a new plugin (pass `--ui` to include a Sidecar Aux Pane web UI template):
   ```bash
   npm run new:plugin -- <plugin-id> --ui
   ```
2. **Never place `AGENTS.md` or `CLAUDE.md` inside `plugins/<plugin-id>/`** — `agy plugin validate --strict` flags root-level `AGENTS.md` inside a plugin folder as a warning.
3. Run the monorepo gates before committing:
   ```bash
   npm run sync:registry
   npm run check
   npm test
   npm run pack:release
   ```
