# Changelog

All notable changes to the `antigravity-plugins` monorepo will be documented in this file.

## [Unreleased]

### Changed
- Upgraded `antigravity-context-viewer` to `0.8.5-2`: fixed Google AI Ultra/Plus false-positive `no_permission` (`无权限`) quota status (`teamsTier` passthrough, tier-hierarchy `allowedTiers` matching, server-granted quota trust), filtered decorative tags (`New`, `Beta`, `Preview`, etc.) from unavailability reasons and notices, and added live renderer quota reconciliation plus Sidecar managed-bridge module reload on bundle update.
- Added single-plugin release packaging & workflow support (`<plugin-id>-v<version>` tags, `npm run pack:release -- --plugin <plugin-id>`) so only updated plugins are published individually.
- Upgraded `antigravity-context-viewer` from `0.8.2` to `0.8.5-1` (adopting `<upstream-version>-<rev>` versioning to track upstream `elviscjn-cjn/antigravity-context-viewer` `v0.8.5`), bringing model quota rings, per-model context budgets, System Enhancement Hub, Gemini 4 Hydrogen pricing, background ledger workers, and `v0.8.5` stability fixes while preserving native Sidecar CDP auto-loading, macOS `arm64` Mach-O context unlock (`codesign`), and custom top-bar UX.

## [1.0.0] - 2026-11-13

### Added
- Initial monorepo release consolidating `mcp-manager` (`v1.0.0`), `mattpocock-skills` (`v1.0.0`), and the modified `antigravity-context-viewer` (`v0.8.2`, derived from `elviscjn-cjn/antigravity-context-viewer`) under `plugins/` with unified MIT licensing.
- Root `AGENTS.md`, `registry.json` auto-sync (`scripts/sync-registry.mjs`), and bilingual storefront docs (`README.md`, `README.en.md`).
- Unified CLI (`scripts/cli.mjs`) supporting selective or full `--link` / `--copy` install, uninstall, `list`, `status`, and `doctor`, plus remote single-plugin `install.sh` (per-plugin release tarball or sparse git checkout).
- Plugin scaffolding generator (`scripts/new-plugin.mjs`) with optional Sidecar Aux Pane UI boilerplate (`--ui`).
- Unified quality & release pipeline (`scripts/check-all.mjs`, `scripts/test-all.mjs`, `scripts/package-release.mjs`) producing per-plugin archives (`<id>.tar.gz`, `<id>.zip`) and full monorepo bundles.
- Cross-platform GitHub Actions CI (`ubuntu-latest`, `macos-latest`, `windows-latest`), Release automation, and upstream `mattpocock/skills` sync workflow.
