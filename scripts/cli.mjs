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
  statSync,
  symlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanPlugins } from './sync-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(__dirname, '..');

const COPY_EXCLUDE = new Set(['.DS_Store', 'node_modules', 'dist', 'tests', '.git', '__pycache__']);

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
      if (base === '.DS_Store' || base === 'node_modules' || base === '__pycache__' || base.endsWith('.pyc')) return false;
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

export function detectAntigravityClient({ platform = process.platform, home = homedir(), appPath = '' } = {}) {
  const candidates = appPath
    ? [appPath]
    : platform === 'darwin'
      ? ['/Applications/Antigravity.app', join(home, 'Applications', 'Antigravity.app')]
      : [];

  for (const cand of candidates) {
    if (!cand || !existsSync(cand)) continue;
    let version = null;
    const plistPath = join(cand, 'Contents', 'Info.plist');
    if (existsSync(plistPath)) {
      try {
        const plistRaw = readFileSync(plistPath, 'utf-8');
        const m = /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/i.exec(plistRaw);
        if (m) version = m[1].trim();
      } catch {
        // ignore unreadable Info.plist
      }
    }
    return { found: true, version, appPath: cand };
  }
  return { found: false, version: null, appPath: null };
}

export function readPluginConfigStates(home = homedir()) {
  const configPath = join(home, '.gemini', 'config', 'config.json');
  if (!existsSync(configPath)) {
    return { exists: false, path: configPath, plugins: {}, parseError: false };
  }
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
    const rawPlugins = parsed && typeof parsed.plugins === 'object' && parsed.plugins !== null ? parsed.plugins : {};
    const plugins = {};
    for (const [id, val] of Object.entries(rawPlugins)) {
      if (val && typeof val === 'object') {
        plugins[id] = { ...val };
      }
    }
    return { exists: true, path: configPath, plugins, parseError: false };
  } catch {
    return { exists: true, path: configPath, plugins: {}, parseError: true };
  }
}

export function detectAgyCli({ envPath = process.env.PATH || '', home = homedir(), platform = process.platform } = {}) {
  const sep = platform === 'win32' ? ';' : ':';
  const searchDirs = [
    ...String(envPath || '').split(sep).filter(Boolean),
    join(home, '.gemini', 'bin'),
    join(home, '.gemini', 'antigravity', 'bin'),
  ];
  const exeNames = platform === 'win32' ? ['agy.exe', 'agy.cmd', 'agy.bat', 'agy'] : ['agy'];

  for (const dir of [...new Set(searchDirs)]) {
    for (const exe of exeNames) {
      const candidate = join(dir, exe);
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return { found: true, path: candidate };
        }
      } catch {
        // ignore stat errors
      }
    }
  }
  return { found: false, path: null };
}

export function runDoctor({
  rootDir = MONOREPO_ROOT,
  home = homedir(),
  platform = process.platform,
  appPath = '',
  envPath = process.env.PATH || '',
} = {}) {
  const major = Number(process.versions.node.split('.')[0]);
  const nodeOk = Number.isFinite(major) && major >= 20;
  const antigravity = detectAntigravityClient({ platform, home, appPath });
  const configState = readPluginConfigStates(home);
  const agyCli = detectAgyCli({ envPath, home, platform });

  const warnings = [];
  const hints = [];
  if (configState.parseError) {
    warnings.push({
      code: 'config_parse_error',
      pluginId: null,
      message: `Unable to parse ${configState.path}`,
    });
  }

  const plugins = listPlugins({ rootDir, home }).map((p) => {
    const cfgEntry = configState.plugins[p.id];
    const enabled = typeof cfgEntry?.enabled === 'boolean' ? cfgEntry.enabled : true;
    if (p.installMode === 'linked-other') {
      warnings.push({
        code: 'linked_other',
        pluginId: p.id,
        message: `${p.id}: symlink points outside monorepo (${p.linkedTo})`,
      });
    } else if (p.installMode !== 'not_installed' && !enabled) {
      warnings.push({
        code: 'plugin_disabled',
        pluginId: p.id,
        message: `${p.id}: installed (${p.installMode}) but disabled in config.json`,
      });
    }
    return { ...p, enabled };
  });

  if (!agyCli.found) {
    hints.push({
      code: 'agy_not_in_path',
      message: '`agy` CLI not found in PATH or ~/.gemini/bin (optional; scripts/cli.mjs works standalone)',
    });
  }
  if (platform === 'darwin' && !antigravity.found) {
    hints.push({
      code: 'antigravity_app_not_found',
      message: 'Antigravity.app not detected in /Applications or ~/Applications',
    });
  }

  return {
    ok: nodeOk,
    nodeVersion: process.version,
    nodeOk,
    antigravity,
    agyCli,
    configPath: configState.path,
    configExists: configState.exists,
    plugins,
    warnings,
    hints,
  };
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
  node scripts/cli.mjs doctor [--json]

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
    const report = runDoctor({ home: opts.home });
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      if (!report.nodeOk) process.exit(1);
    } else {
      if (!report.nodeOk) {
        console.error(`Node.js >= 20 required (found ${report.nodeVersion})`);
        process.exit(1);
      }
      console.log(`OK   Node.js: ${report.nodeVersion}`);
      if (report.antigravity.found) {
        const verStr = report.antigravity.version ? `v${report.antigravity.version}` : 'unknown version';
        console.log(`OK   Antigravity client: ${verStr} (${report.antigravity.appPath})`);
      }
      if (report.agyCli.found) {
        console.log(`OK   agy CLI: ${report.agyCli.path}`);
      }
      for (const p of report.plugins) {
        const stateTag = p.installMode === 'not_installed' ? '' : (p.enabled ? ' [enabled]' : ' [disabled in config.json]');
        if (p.installMode === 'linked-other') {
          console.warn(`WARN ${p.id}: symlink points outside monorepo (${p.linkedTo})`);
        } else if (p.installMode !== 'not_installed' && !p.enabled) {
          console.warn(`WARN ${p.id}: ${p.installMode}${stateTag}`);
        } else {
          console.log(`OK   ${p.id}: ${p.installMode}${stateTag}`);
        }
      }
      for (const w of report.warnings.filter((x) => !x.pluginId)) {
        console.warn(`WARN ${w.message}`);
      }
      for (const h of report.hints) {
        console.log(`INFO ${h.message}`);
      }
      console.log(
        report.warnings.length === 0
          ? 'Doctor check passed.'
          : `Doctor finished with ${report.warnings.length} warning(s).`,
      );
    }
  } else {
    printHelp();
  }
}
