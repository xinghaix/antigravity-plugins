---
name: mp-studio
description: Open the visual Mattpocock Skills panel in the auxiliary pane to browse, toggle, preview, sync skills, deliver skills to .agents/skills/, or visually configure repository setup and inspect .scratch ticket frontiers.
---

# Mattpocock Skills (`mp-studio`)

This plugin provides the **Mattpocock Skills** visual UI panel in the auxiliary pane (`sidecar://mattpocock-skills/mp_studio/`).

## When to Surface the Studio Panel

Whenever the user asks to:
- open the Mattpocock Skills / dashboard / UI panel,
- browse, enable, disable, preview, or sync Matt Pocock's skills,
- deliver skills into a project's `.agents/skills/` directory,
- visually initialize a repository (`setup-matt-pocock-skills`), or
- inspect `.scratch/` tracer-bullet tickets, `GLOSSARY.md`, or ADRs visually,

surface the clickable sidecar pill link in your response:

[Mattpocock Skills](sidecar://mattpocock-skills/mp_studio/)

## Antigravity-Specific Usage Notes

- **Slash command disambiguation (`/grill-me`)**: Antigravity ships a built-in `/grill-me` slash command. Inside a code repository, prefer `/grill-with-docs` (which has no name collision and maintains `GLOSSARY.md` and `docs/adr/`). For non-code sessions using Matt Pocock's `grill-me`, read `../grill-me/SKILL.md` directly or refer to it explicitly by plugin name (`mattpocock-skills:grill-me`).
- **Context hygiene**: Upstream instructions referencing `/clear` map to starting a **New Conversation** in Antigravity; `/compact` works natively.
