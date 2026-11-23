---
name: context-viewer
description: "Inspect and manage the modified Antigravity Context Viewer & Token Dashboard plugin (v0.9.0-1: Aux Pane Sidecar UI for Antigravity 2.33+/2.34+, CDP auto-loader, live status check, and optional modules)."
---

# Antigravity Context Viewer (`antigravity-context-viewer`)

This plugin is a modified edition (`v0.9.0-1`, synced to upstream `v0.9.0`) of upstream [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer), packaged as a native Antigravity plugin with the `live-loader` background Sidecar.

## How It Works

- **Native Aux Pane Web UI (Antigravity 2.33+ / 2.34+ default)**: Antigravity 2.33+ / 2.34+ disables `DevToolsActivePort` (CDP) by default, and macOS `2.34.0` enforces `ElectronAsarIntegrity` in `Info.plist`. The bundled `sidecars/live-loader` Sidecar serves a native Aux Pane panel (`[Context Viewer](sidecar://antigravity-context-viewer/live-loader/)`) powered by `sidecar_sdk`, connecting directly to the local Language Server via `authBootstrap`, `daemon/hub_*.json`, and `main.log` discovery without patching `app.asar` or needing CDP.
- **Topbar Overlay via CDP (`watch` / `launch`) or `app.asar`**: If CDP is active (e.g. via `node cli.js watch` or `node cli.js launch --restart`), `sidecars/live-loader` automatically hot-injects the compact topbar gauge into the main window (skipping auxiliary HUD windows and handling 2.33+/2.34+ selectors). On systems without `ElectronAsarIntegrity` blocking disk patching, users can also run `node cli.js install`; on macOS `2.34.0+`, NEVER modify `app.asar` in-place unless intentionally re-signing with `--force-mac-asar` — use the Sidecar UI or `watch`.
- To check live status, inspect modules, or manage optional enhancements (`sidecar:status`, `status`, `check`, `launch --restart`, `unlock-status`), run `node cli.js <command>` inside `~/.gemini/config/plugins/antigravity-context-viewer`.
- To open the Aux Pane UI directly, provide the clickable pill `[Context Viewer](sidecar://antigravity-context-viewer/live-loader/)`, or link `[antigravity-context-viewer](customization://antigravity-context-viewer)` for plugin settings.
