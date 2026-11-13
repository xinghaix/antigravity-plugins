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
import { scanPlugins } from './sync-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(__dirname, '..');

const COPY_EXCLUDE = new Set(['.DS_Store', 'node_modules', 'dist', 'tests', '.git']);

export function pluginsHomeDir(home = homedir()) {
  return join(home, '.gemini', 'config', 'plugins');
}

function inspectInstalledState(target, sourceDir) {
  try {
    const st = lstatSync(target);
    if (st.isSymbolicLink()) {
      const dest = readlinkSync(target);
      let resolvedDest = resolve(dirname(target), dest);
      try {
        resolvedDest = realpathSync(target);
      } catch {
        // broken symlink
      }
      let resolvedSrc = sourceDir;
      try {
        resolvedSrc = realpathSync(sourceDir);
      } catch {
        // ignore
      }
      return {
        installMode: resolvedDest === resolvedSrc ? 'linked-monorepo' : 'linked-other',
        target,
        linkedTo: dest,
      };
    }
    if (st.isDirectory()) {
      return { installMode: 'copy', target, linkedTo: null };
    }
  } catch {
    // not installed
  }
  return { installMode: 'not_installed', target, linkedTo: null };
}

export function listPlugins({ rootDir = MONOREPO_ROOT, home = homedir() } = {}) {
  const plugins = scanPlugins(rootDir);
  const destRoot = pluginsHomeDir(home);
  return plugins.map((p) => {
    const sourceDir = join(rootDir, p.path);
    const target = join(destRoot, p.id);
    return {
      ...p,
      sourceDir,
      ...inspectInstalledState(target, sourceDir),
    };
  });
}

function copyFilteredPlugin(srcDir, dstDir) {
  mkdirSync(dstDir, { recursive: true });
  cpSync(srcDir, dstDir, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(srcDir.length).replace(/^[/\\]+/, '');
      if (!rel) return true;
      const firstSeg = rel.split(/[/\\]/)[0];
      if (COPY_EXCLUDE.has(firstSeg)) return false;
      const base = rel.split(/[/\\]/).pop();
      if (base === '.DS_Store' || base === 'node_modules') return false;
      return true;
    },
  });
}

export function installPlugins(
  pluginIds,
  { all = false, link = true, rootDir = MONOREPO_ROOT, home = homedir() } = {},
) {
  const catalog = scanPlugins(rootDir);
  const byId = new Map(catalog.map((p) => [p.id, p]));

  const chosen = all ? catalog.map((p) => p.id) : [...new Set(pluginIds)];
  if (chosen.length === 0) {
    throw new Error(`Specify one or more plugin IDs (${catalog.map((p) => p.id).join(', ')}) or pass --all.`);
  }
  for (const id of chosen) {
    if (!byId.has(id)) {
      throw new Error(`Unknown plugin "${id}". Available: ${catalog.map((p) => p.id).join(', ')}`);
    }
  }

  const destRoot = pluginsHomeDir(home);
  mkdirSync(destRoot, { recursive: true });

  const results = [];
  for (const id of chosen) {
    const meta = byId.get(id);
    const sourceDir = realpathSync(join(rootDir, meta.path));
    const target = join(destRoot, id);

    let existingStat = null;
    try {
      existingStat = lstatSync(target);
    } catch {
      existingStat = null;
    }

    if (existingStat) {
      if (existingStat.isSymbolicLink() && link) {
        try {
          if (realpathSync(target) === sourceDir) {
            results.push({ id, mode: 'link', unchanged: true, target, sourceDir });
            continue;
          }
        } catch {
          // broken symlink, replace
        }
      }
      rmSync(target, { recursive: true, force: true });
    }

    if (link) {
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      symlinkSync(sourceDir, target, linkType);
      results.push({ id, mode: 'link', unchanged: false, target, sourceDir });
    } else {
      copyFilteredPlugin(sourceDir, target);
      results.push({ id, mode: 'copy', unchanged: false, target, sourceDir });
    }
  }

  return results;
}

export function uninstallPlugins(
  pluginIds,
  { all = false, rootDir = MONOREPO_ROOT, home = homedir() } = {},
) {
  const catalog = scanPlugins(rootDir);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const chosen = all ? catalog.map((p) => p.id) : [...new Set(pluginIds)];

  if (chosen.length === 0) {
    throw new Error(`Specify one or more plugin IDs (${catalog.map((p) => p.id).join(', ')}) or pass --all.`);
  }
  for (const id of chosen) {
    if (!byId.has(id)) {
      throw new Error(`Unknown plugin "${id}". Available: ${catalog.map((p) => p.id).join(', ')}`);
    }
  }

  const destRoot = pluginsHomeDir(home);
  const results = [];
  for (const id of chosen) {
    const target = join(destRoot, id);
    let exists = false;
    try {
      lstatSync(target);
      exists = true;
    } catch {
      exists = false;
    }
    if (!exists) {
      results.push({ id, removed: false, target });
      continue;
    }
    rmSync(target, { recursive: true, force: true });
    results.push({ id, removed: true, target });
  }
  return results;
}

export function getMonorepoStatus({ rootDir = MONOREPO_ROOT, home = homedir() } = {}) {
  const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  return {
    nodeVersion: process.version,
    platform: process.platform,
    monorepoRoot: rootDir,
    monorepoVersion: rootPkg.version,
    pluginsHome: pluginsHomeDir(home),
    plugins: listPlugins({ rootDir, home }),
  };
}

function parseArgs(argv) {
  const raw = argv.slice(2);
  const cmd = raw[0] && !raw[0].startsWith('-') ? raw[0] : 'help';
  const ids = [];
  let all = false;
  let link = true;
  let json = false;
  let home = homedir();

  for (let i = 1; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--all' || a === '-a') all = true;
    else if (a === '--link' || a === '-l') link = true;
    else if (a === '--copy' || a === '-c') link = false;
    else if (a === '--json') json = true;
    else if (a === '--home' && raw[i + 1]) home = raw[++i];
    else if (a === '--help' || a === '-h') return { cmd: 'help', ids, all, link, json, home };
    else if (!a.startsWith('-')) ids.push(a);
  }
  return { cmd, ids, all, link, json, home };
}

function printHelp(rootDir = MONOREPO_ROOT) {
  const available = scanPlugins(rootDir).map((p) => p.id).join(', ');
  console.log(`antigravity-plugins CLI

Usage:
  node scripts/cli.mjs list [--json]
  node scripts/cli.mjs status [--json]
  node scripts/cli.mjs install [<plugin-id>... | --all] [--link | --copy]
  node scripts/cli.mjs uninstall [<plugin-id>... | --all]
  node scripts/cli.mjs doctor

Available plugins: ${available || '(none)'}

Options:
  --all, -a    Apply to all plugins in plugins/
  --link, -l   Symlink plugin into ~/.gemini/config/plugins/ (default)
  --copy, -c   Copy runtime files into ~/.gemini/config/plugins/
  --json       Output machine-readable JSON
`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv);
  if (opts.cmd === 'list') {
    const items = listPlugins({ home: opts.home });
    if (opts.json) {
      console.log(JSON.stringify(items, null, 2));
    } else {
      for (const p of items) {
        console.log(
          `${p.id.padEnd(20)} v${p.version.padEnd(8)} [${p.installMode.padEnd(15)}] skills:${p.components.skills} agents:${p.components.agents} sidecars:${p.components.sidecars}`,
        );
      }
    }
  } else if (opts.cmd === 'status') {
    const st = getMonorepoStatus({ home: opts.home });
    if (opts.json) {
      console.log(JSON.stringify(st, null, 2));
    } else {
      console.log(`antigravity-plugins v${st.monorepoVersion} (${st.platform}, Node ${st.nodeVersion})`);
      console.log(`Plugins dir: ${st.pluginsHome}`);
      for (const p of st.plugins) {
        console.log(`- ${p.id} (v${p.version}): ${p.installMode}${p.linkedTo ? ` -> ${p.linkedTo}` : ''}`);
      }
    }
  } else if (opts.cmd === 'install') {
    const res = installPlugins(opts.ids, { all: opts.all, link: opts.link, home: opts.home });
    for (const r of res) {
      console.log(`Installed ${r.id} (${r.mode}${r.unchanged ? ', unchanged' : ''}) -> ${r.target}`);
    }
    console.log('Restart Antigravity (or toggle the plugin in Customizations) to activate changes.');
  } else if (opts.cmd === 'uninstall') {
    const res = uninstallPlugins(opts.ids, { all: opts.all, home: opts.home });
    for (const r of res) {
      console.log(r.removed ? `Removed ${r.id} from ${r.target}` : `${r.id} not found at ${r.target}`);
    }
  } else if (opts.cmd === 'doctor') {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 20) {
      console.error(`Node.js >= 20 required (found ${process.version})`);
      process.exit(1);
    }
    const items = listPlugins({ home: opts.home });
    let issues = 0;
    for (const p of items) {
      if (p.installMode === 'linked-other') {
        console.warn(`WARN ${p.id}: symlink points outside monorepo (${p.linkedTo})`);
        issues += 1;
      } else {
        console.log(`OK   ${p.id}: ${p.installMode}`);
      }
    }
    console.log(issues === 0 ? 'Doctor check passed.' : `Doctor finished with ${issues} warning(s).`);
  } else {
    printHelp();
  }
}
