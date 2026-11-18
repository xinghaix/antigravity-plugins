---
name: context-viewer
description: "Inspect and manage the modified Antigravity Context Viewer & Token Dashboard plugin (Aux Pane Sidecar UI for Antigravity 2.33+, CDP auto-loader, live status check, and optional modules)."
---

# Antigravity Context Viewer (`antigravity-context-viewer`)

This plugin is a modified edition of upstream [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer), packaged as a native Antigravity plugin with the `live-loader` background Sidecar.

## How It Works

- **Native Aux Pane Web UI (Antigravity 2.33+ default)**: Antigravity 2.33+ disables `DevToolsActivePort` (CDP) by default unless launched with `--remote-debugging-port`. The bundled `sidecars/live-loader` Sidecar now serves a native Aux Pane panel (`[Context Viewer](sidecar://antigravity-context-viewer/live-loader/)`) powered by `sidecar_sdk`, connecting directly to the local Language Server via `main.log` discovery without patching `app.asar` or needing CDP.
- **Topbar Overlay via CDP or `app.asar`**: If CDP is active (or after running `node cli.js launch --restart`), `sidecars/live-loader` automatically hot-injects the compact topbar gauge into the main window (skipping auxiliary HUD windows and handling 2.33 aux-pane selectors). Users can also run `node cli.js install` inside `~/.gemini/config/plugins/antigravity-context-viewer` for persistent `app.asar` patching.
- To check live status, inspect modules, or manage optional enhancements (`sidecar:status`, `status`, `check`, `launch --restart`, `unlock-status`), run `node cli.js <command>` inside `~/.gemini/config/plugins/antigravity-context-viewer`.
- To open the Aux Pane UI directly, provide the clickable pill `[Context Viewer](sidecar://antigravity-context-viewer/live-loader/)`, or link `[antigravity-context-viewer](customization://antigravity-context-viewer)` for plugin settings.
