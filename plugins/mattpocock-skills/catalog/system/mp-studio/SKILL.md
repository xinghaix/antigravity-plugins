---
name: mp-studio
description: Open the visual Mattpocock Skills panel in the auxiliary pane to browse, toggle, preview, sync skills, orchestrate .scratch ticket waves with 2.34+ run_workflow/swarm, or dispatch tasks directly into conversations.
---

# Mattpocock Skills (`mp-studio`)

This plugin provides the **Mattpocock Skills** (`v1.2.0`) visual UI panel in the auxiliary pane (`sidecar://mattpocock-skills/mp_studio/`).

## When to Surface the Studio Panel

Whenever the user asks to:
- open the Mattpocock Skills / dashboard / UI panel,
- browse, enable, disable, preview, or sync Matt Pocock's skills with upstream,
- deliver skills into a project's `.agents/skills/` directory or manage `.agents/skills.json` manifests (`Antigravity 2.35+`),
- track or dispatch `mp-studio` conversations via `ConversationService`,
- visually initialize a repository (`setup-matt-pocock-skills`),
- inspect `.scratch/` tracer-bullet ticket waves, `GLOSSARY.md`, or ADRs in Aux Pane tabs, or
- generate Antigravity `2.34+` `run_workflow` Python scripts or native `swarm` briefs from a `.scratch/` feature board,

surface the clickable sidecar pill link in your response:

[Mattpocock Skills](sidecar://mattpocock-skills/mp_studio/)

## Antigravity-Specific Usage Notes

- **Slash command disambiguation (`/grill-me`)**: Antigravity ships a built-in `/grill-me` slash command. Inside a code repository, prefer `/grill-with-docs` (which has no name collision and maintains `GLOSSARY.md` and `docs/adr/`). For non-code sessions using Matt Pocock's `grill-me`, read `../grill-me/SKILL.md` directly or refer to it explicitly by plugin name (`mattpocock-skills:grill-me`).
- **Context hygiene**: Upstream instructions referencing `/clear` map to starting a **New Conversation** in Antigravity; `/compact` works natively.
