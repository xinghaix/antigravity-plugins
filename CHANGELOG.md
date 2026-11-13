# Changelog

All notable changes to the `antigravity-plugins` monorepo will be documented in this file.

## [1.0.0] - 2026-11-13

### Added
- Initial monorepo release consolidating `mcp-manager` (`v1.0.0`), `mattpocock-skills` (`v1.0.0`), and the modified `antigravity-context-viewer` (`v0.8.2`, derived from `elviscjn-cjn/antigravity-context-viewer`) under `plugins/` with unified MIT licensing.
- Root `AGENTS.md`, `registry.json` auto-sync (`scripts/sync-registry.mjs`), and bilingual storefront docs (`README.md`, `README.en.md`).
- Unified CLI (`scripts/cli.mjs`) supporting selective or full `--link` / `--copy` install, uninstall, `list`, `status`, and `doctor`, plus remote single-plugin `install.sh` (per-plugin release tarball or sparse git checkout).
- Plugin scaffolding generator (`scripts/new-plugin.mjs`) with optional Sidecar Aux Pane UI boilerplate (`--ui`).
- Unified quality & release pipeline (`scripts/check-all.mjs`, `scripts/test-all.mjs`, `scripts/package-release.mjs`) producing per-plugin archives (`<id>.tar.gz`, `<id>.zip`) and full monorepo bundles.
- Cross-platform GitHub Actions CI (`ubuntu-latest`, `macos-latest`, `windows-latest`), Release automation, and upstream `mattpocock/skills` sync workflow.
