# Contributing to Antigravity Plugins

Thank you for contributing!

## Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/xinghaix/antigravity-plugins.git
   cd antigravity-plugins
   ```
2. Symlink one or all plugins into Antigravity's global plugin directory:
   ```bash
   node scripts/cli.mjs install --all --link
   ```
3. Keep external runtime npm dependencies at **zero** — use Node.js >= 20 standard library modules and `sidecar_sdk` only.

## Adding a New Plugin

```bash
npm run new:plugin -- <plugin-id> --ui
```

> **Important**: Never place `AGENTS.md` or `CLAUDE.md` inside `plugins/<plugin-id>/` — `agy plugin validate --strict` flags root-level `AGENTS.md` inside a plugin folder as a warning. Root-level `AGENTS.md` at the monorepo root is valid and encouraged.

## Checks Before Opening a Pull Request

```bash
npm run sync:registry
npm run check
npm test
npm run pack:release
```

Direct pushes to `main` are protected. Open a feature branch, ensure all 3 OS matrix CI checks (`ubuntu-latest`, `macos-latest`, `windows-latest`) pass, and submit a Pull Request.
