# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-11-24

### Added & Changed
- **Antigravity 2.35.0 Hierarchical Manifests (`.agents/skills.json` & `.agents/rules.json`)**:
  - Added `inspectSkillsManifests()` in `sidecars/mp_studio/studio_store.mjs` walking upward from the workspace to `.git` root to inspect ancestor `.agents/skills.json` / `rules.json`, `inherits` chains, `include_only`, and `exclude` filters.
  - Added `saveWorkspaceSkillsJson()`, `POST /api/workspace/skills-json`, and zero-copy `"manifest"` delivery mode in `deliverToWorkspace()` & **Deliver to Repo** modal (with automatic `0600` config backup snapshots).
- **Antigravity 2.35.0 Native `ConversationService` Integration**:
  - Added `sidecars/mp_studio/conversations_client.mjs` (`http://$ANTIGRAVITY_LS_ADDRESS/product.v1.ConversationService/*` with `Connect-Protocol-Version: 1` & `x-antigravity-csrf-token`) plus `/api/conversations`, `/api/conversations/query`, `/api/conversations/create`, and `/api/conversations/update`.
  - Upgraded Studio **New Session** actions to dispatch tagged sessions (`tags: ["mp-studio"]`) via `CreateConversation` (falling back gracefully to `sidecar.agent.startConversation` or clipboard) and added a live **2.35+ Conversation Tracker** card in Workspace Hub with focus, pin, and archive controls.

## [1.1.0] - 2026-11-23

### Added & Changed
- **Synced Upstream `mattpocock/skills` (`v1.3.2` @ `abeeaf95`)**: Pulled upstream PR #1453/#1455 frontmatter hardening (`software-factory` quoted description) and added `validateFrontmatter` in `sidecars/mp_studio/upstream_sync.mjs`.
- **Antigravity 2.34.0 Multi-Agent Orchestration (`run_workflow` + `swarm` + `schedule`)**:
  - Added 7 `ORCHESTRATION_RECIPES` in `overrides/metadata.mjs` and upgraded compiler runtime notes for `implement-spec`, `code-review`, `wayfinder`, `codebase-design`, `triage`, `diagnosing-bugs`, `loop-me`, `chief-of-staff`, and `software-factory`.
  - Upgraded `parseScratchTickets` in `sidecars/mp_studio/studio_store.mjs` with topological `waves` calculation and dependency `cycles` detection, plus `workflows/*.md` inspection.
  - Added `buildOrchestrationPlan()` & `POST /api/orchestrate/plan` generating runnable `run_workflow` Python wave scripts, `swarm` `.system_generated/swarm/plan.json` prompts, and sparse-pointer per-ticket prompts.
- **MP Studio Live Host Integration**:
  - Subscribed to Antigravity 2.34+ `window.sidecar.getWorkspaceUris()` and `onWorkspaceChange` (`POST /api/state/query`).
  - Added one-click **Send to Chat** (`sidecar.agent.sendMessage`), **New Session** (`sidecar.agent.startConversation` + `sidecar.ui.toggleConversation`), **Aux Pane File Viewer** (`sidecar.ui.toggleAuxPane`) for tickets/specs/maps/GLOSSARY/ADRs, topological Wave lanes, an Orchestration Preview modal, and a Workflow **Orchestration Blueprints** grid.

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
