#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export function scanPlugins(rootDir = MONOREPO_ROOT) {
  const pluginsDir = join(rootDir, 'plugins');
  if (!existsSync(pluginsDir)) return [];

  const entries = [];
  for (const ent of readdirSync(pluginsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!ent.isDirectory()) continue;
    const pluginDir = join(pluginsDir, ent.name);
    const manifestPath = join(pluginDir, 'plugin.json');
    if (!existsSync(manifestPath)) continue;

    const manifest = readJson(manifestPath);
    const pluginId = manifest.name || ent.name;

    const skillsDir = join(pluginDir, 'skills');
    const skills = existsSync(skillsDir)
      ? readdirSync(skillsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory() && existsSync(join(skillsDir, d.name, 'SKILL.md')))
          .map((d) => d.name)
          .sort()
      : [];

    const agentsDir = join(pluginDir, 'agents');
    const agents = existsSync(agentsDir)
      ? readdirSync(agentsDir, { withFileTypes: true })
          .filter((f) => f.isFile() && f.name.endsWith('.md'))
          .map((f) => f.name.replace(/\.md$/, ''))
          .sort()
      : [];

    const sidecarsDir = join(pluginDir, 'sidecars');
    const sidecars = [];
    const sidecarLinks = [];
    if (existsSync(sidecarsDir)) {
      for (const sd of readdirSync(sidecarsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!sd.isDirectory()) continue;
        const scPath = join(sidecarsDir, sd.name, 'sidecar.json');
        if (!existsSync(scPath)) continue;
        const sc = readJson(scPath);
        sidecars.push(sd.name);
        const views = sc.ui_config?.views || [];
        for (const v of views) {
          if (v.entrypoint === 'SIDECAR_UI_ENTRYPOINT_AUX_PANE') {
            const viewPath = v.path === '/' ? '/' : (v.path || '/');
            sidecarLinks.push(`sidecar://${pluginId}/${sd.name}${viewPath}`);
          }
        }
      }
    }

    const rulesDir = join(pluginDir, 'rules');
    const rulesCount = existsSync(rulesDir)
      ? readdirSync(rulesDir, { withFileTypes: true }).filter((f) => f.isFile() && f.name.endsWith('.md')).length
      : 0;

    entries.push({
      id: pluginId,
      dirName: ent.name,
      path: `plugins/${ent.name}`,
      displayName: manifest.displayName || pluginId,
      version: manifest.version || '1.0.0',
      description: manifest.description || '',
      logo: manifest.logo || '',
      components: {
        skills: skills.length,
        agents: agents.length,
        sidecars: sidecars.length,
        rules: rulesCount,
        mcp: existsSync(join(pluginDir, 'mcp_config.json')),
        hooks: existsSync(join(pluginDir, 'hooks.json')),
      },
      sidecarLinks,
      suggestedPrompts: Array.isArray(manifest.suggestedPrompts) ? manifest.suggestedPrompts : [],
    });
  }
  return entries;
}

export function buildRegistry(rootDir = MONOREPO_ROOT) {
  const pkg = readJson(join(rootDir, 'package.json'));
  const plugins = scanPlugins(rootDir);
  return {
    schemaVersion: 1,
    repository: 'https://github.com/xinghaix/antigravity-plugins',
    version: pkg.version,
    plugins,
  };
}

export function writeRegistry(rootDir = MONOREPO_ROOT) {
  const registry = buildRegistry(rootDir);
  writeFileSync(join(rootDir, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
  return registry;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reg = writeRegistry(MONOREPO_ROOT);
  console.log(`Synced registry.json (${reg.plugins.length} plugins: ${reg.plugins.map((p) => p.id).join(', ')})`);
}
