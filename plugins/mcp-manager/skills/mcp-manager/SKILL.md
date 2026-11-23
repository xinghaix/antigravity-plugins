---
name: mcp-manager
description: Manage Antigravity MCP servers visually via the MCP Manager sidecar panel or assist with MCP configuration, probing, and troubleshooting.
---

# MCP Manager (`mcp-manager`)

This plugin provides the **MCP Manager** (`v1.2.0`) visual UI panel in the auxiliary pane for managing global (`~/.gemini/config/mcp_config.json`), workspace (`.agents/mcp_config.json`), and plugin MCP servers on Google Antigravity `2.34+`.

When the user wants to open or use the visual MCP manager, surface the sidecar pill link:

[MCP Manager](sidecar://mcp-manager/mcp_manager/)

You can also help the user:
- Inspect, add, edit, toggle, or troubleshoot MCP server entries (including `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` plugin variables and `<plugin>_<server>` namespacing).
- Trigger live host reloads (`RefreshMcpServers`), inspect MCP Apps (`ui://` resources, `aux_pane` / `global` entrypoints, `visibility: ["app"]`), and test `tools/call` payloads inside the 1 MiB trajectory cap.
- Configure per-MCP custom system prompts (`~/.gemini/config/sidecar_data/mcp_manager/prompts.json`) injected automatically via native lifecycle hooks (`hooks.json`).
