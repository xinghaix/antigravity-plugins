---
name: grill-with-docs
description: "A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go."
---

Read and follow both [grilling](../grilling/SKILL.md) and [domain-modeling](../domain-modeling/SKILL.md) via `read_file`.

## Antigravity Native Runtime Notes

- **Plan Mode handoff**: If Antigravity Plan Mode is active while interviewing or exploring, stay read-only during questioning and call `exit_plan_mode` with the concrete file edits when ready to write `GLOSSARY.md`, `docs/adr/`, `docs/agents/`, or `.scratch/` artifacts.
