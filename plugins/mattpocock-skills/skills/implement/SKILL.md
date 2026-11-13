---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Read and follow [tdd](../tdd/SKILL.md) via `read_file` where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, read and follow [code-review](../code-review/SKILL.md) via `read_file` to review the work.

Commit your work to the current branch.
