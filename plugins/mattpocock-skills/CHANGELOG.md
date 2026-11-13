# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-11-13

### Added
- Native Google Antigravity migration of `mattpocock/skills` (`v1.3.2`, 39 total skills across `engineering`, `productivity`, `in-progress`, and `misc`; 27 promoted skills + `mp-studio` active by default).
- Deterministic upstream compiler (`sidecars/mp_studio/upstream_sync.mjs`) flattening nested buckets, stripping `agents/openai.yaml`, rewriting `Skill tool` calls to relative `read_file` pointers, and adding Plan Mode / Generative UI / shared-workspace adaptations.
- Four dedicated leaf subagents under `agents/`: `mp-standards-reviewer`, `mp-spec-reviewer`, `mp-researcher`, and `mp-explorer`.
- Visual **Mattpocock Skills** Sidecar Aux Pane UI (`sidecar://mattpocock-skills/mp_studio/`) featuring:
  - 2×2 skill bucket cards, preset profiles, search (`/` / `Cmd+K`), invocation/status/scenario filters, and inline adapted vs upstream instruction preview.
  - Interactive **Workflow** spine navigator and Phase Boundaries cheat-sheet.
  - **Workspace Hub** with `.agents/skills/` delivery, visual Repo Setup wizard with `0600` backups, `.scratch` Frontier DAG Kanban, and `GLOSSARY.md` editor.
  - **Sync & Settings** tab for online upstream sync, `--link` / `--copy` mode switching, and snapshot restore.
- Cross-platform CLI (`scripts/cli.mjs`, `install.sh`, `install.bat`, `uninstall.sh`, `uninstall.bat`) defaulting to `--link` with full `--copy` support.
- CI, Release, and Upstream Sync GitHub Actions workflows plus strict validation (`npm run check`) and unit test suite (`npm test`).
