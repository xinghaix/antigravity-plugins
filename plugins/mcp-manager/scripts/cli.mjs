#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..');

const RUNTIME_ITEMS = [
  'plugin.json',
  'README.md',
  'LICENSE',
  'assets',
  'skills',
  'sidecars',
];

export function defaultPluginTarget(home = homedir()) {
  return join(home, '.gemini', 'config', 'plugins', 'mcp-manager');
}

export function defaultMcpConfigPath(home = homedir()) {
  return join(home, '.gemini', 'config', 'mcp_config.json');
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] && !args[0].startsWith('-') ? args[0] : 'help';
  let link = false;
  let target = '';
  let home = homedir();
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--link' || a === '-l') link = true;
    else if (a === '--copy' || a === '-c') link = false;
    else if (a === '--target' && args[i + 1]) target = args[++i];
    else if (a === '--home' && args[i + 1]) home = args[++i];
    else if (a === '--help' || a === '-h') return { cmd: 'help', link, target, home };
  }
  return { cmd, link, target: target ? resolve(target) : defaultPluginTarget(home), home };
}

export function installPlugin({ link = false, target = defaultPluginTarget(), sourceRoot = REPO_ROOT } = {}) {
  const resolvedSource = realpathSync(sourceRoot);
  mkdirSync(dirname(target), { recursive: true });

  let existingStat = null;
  try {
    existingStat = lstatSync(target);
  } catch {
    existingStat = null;
  }

  if (existingStat) {
    if (existingStat.isSymbolicLink()) {
      const currentDest = resolve(dirname(target), readlinkSync(target));
      if (link && currentDest === resolvedSource) {
        return { ok: true, mode: 'link', unchanged: true, target, source: resolvedSource };
      }
    }
    rmSync(target, { recursive: true, force: true });
  }

  if (link) {
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    symlinkSync(resolvedSource, target, linkType);
    return { ok: true, mode: 'link', unchanged: false, target, source: resolvedSource };
  }

  mkdirSync(target, { recursive: true });
  for (const item of RUNTIME_ITEMS) {
    const src = join(resolvedSource, item);
    if (!existsSync(src)) continue;
    cpSync(src, join(target, item), { recursive: true });
  }
  return { ok: true, mode: 'copy', unchanged: false, target, source: resolvedSource };
}

export function uninstallPlugin({ target = defaultPluginTarget() } = {}) {
  let exists = false;
  try {
    lstatSync(target);
    exists = true;
  } catch {
    exists = false;
  }
  if (!exists) {
    return { ok: true, removed: false, target };
  }
  rmSync(target, { recursive: true, force: true });
  return { ok: true, removed: true, target };
}

export function getStatus({ target = defaultPluginTarget(), home = homedir() } = {}) {
  let installMode = 'not_installed';
  let linkedTo = null;
  try {
    const st = lstatSync(target);
    if (st.isSymbolicLink()) {
      installMode = 'symlink';
      linkedTo = readlinkSync(target);
    } else if (st.isDirectory()) {
      installMode = 'copy';
    }
  } catch {
    installMode = 'not_installed';
  }

  const mcpPath = defaultMcpConfigPath(home);
  let serverCount = 0;
  if (existsSync(mcpPath)) {
    try {
      const parsed = JSON.parse(readFileSync(mcpPath, 'utf-8'));
      serverCount = Object.keys(parsed?.mcpServers || {}).length;
    } catch {
      serverCount = -1;
    }
  }

  return {
    nodeVersion: process.version,
    platform: process.platform,
    installMode,
    target,
    linkedTo,
    mcpConfigPath: mcpPath,
    globalServers: serverCount,
  };
}

function printHelp() {
  console.log(`antigravity-mcp-manager CLI

Usage:
  node scripts/cli.mjs install [--link] [--target <dir>]
  node scripts/cli.mjs uninstall [--target <dir>]
  node scripts/cli.mjs status [--target <dir>]
`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseCliArgs(process.argv);
  if (opts.cmd === 'install') {
    const res = installPlugin({ link: opts.link, target: opts.target });
    console.log(`Installed MCP Manager (${res.mode}) -> ${res.target}`);
    console.log('Restart Antigravity (or toggle the plugin) and open sidecar://mcp-manager/mcp_manager/');
  } else if (opts.cmd === 'uninstall') {
    const res = uninstallPlugin({ target: opts.target });
    console.log(res.removed ? `Removed plugin from ${res.target}` : `Plugin not found at ${res.target}`);
  } else if (opts.cmd === 'status') {
    console.log(JSON.stringify(getStatus({ target: opts.target, home: opts.home }), null, 2));
  } else {
    printHelp();
  }
}
