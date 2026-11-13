---
name: context-viewer
description: "Inspect and manage the modified Antigravity Context Viewer & Token Dashboard plugin (Sidecar CDP auto-loader, live status check, and optional modules)."
---

# Antigravity Context Viewer (`antigravity-context-viewer`)

This plugin is a modified edition of upstream [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer), packaged as a native Antigravity plugin with the `live-loader` background Sidecar.

## How It Works

- The bundled `sidecars/live-loader` daemon starts automatically with Antigravity, watches `DevToolsActivePort`, and hot-injects the top-bar context window gauge and token usage dashboard via CDP without requiring `app.asar` patching.
- To check live status, inspect modules, or manage optional enhancements (`sidecar:status`, `status`, `check`, `unlock-status`), run `node cli.js <command>` inside the installed plugin directory (`~/.gemini/config/plugins/antigravity-context-viewer`).
- To enable, disable, or inspect the plugin manifest in Antigravity, link the user to `[antigravity-context-viewer](customization://antigravity-context-viewer)`.
