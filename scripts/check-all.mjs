#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from './sync-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(__dirname, '..');

const ALLOWED_PLUGIN_KEYS = new Set([
  'name',
  'displayName',
  'description',
  'version',
  'logo',
  'suggestedPrompts',
  'author',
  'homepage',
  'repository',
  'disabled',
]);

function collectFiles(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'dist') continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) collectFiles(full, exts, out);
    else if (exts.some((ext) => ent.name.endsWith(ext))) out.push(full);
  }
  return out;
}

export function runChecks(rootDir = MONOREPO_ROOT, { checkRegistry = true, runAgyValidate = true } = {}) {
  const jsFiles = [
    ...collectFiles(join(rootDir, 'scripts'), ['.mjs', '.js']),
    ...collectFiles(join(rootDir, 'tests'), ['.mjs', '.js']),
    ...collectFiles(join(rootDir, 'plugins'), ['.mjs', '.js']),
  ];
  assert.ok(jsFiles.length >= 6, 'Expected JS/MJS files to check');
  for (const file of jsFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }

  const pluginsDir = join(rootDir, 'plugins');
  assert.ok(existsSync(pluginsDir), 'Missing plugins/ directory');
  const pluginDirs = readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(pluginsDir, d.name, 'plugin.json')))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.ok(pluginDirs.length >= 1, 'Expected at least 1 plugin under plugins/');

  for (const dirEnt of pluginDirs) {
    const pluginId = dirEnt.name;
    const pRoot = join(pluginsDir, pluginId);
    const manifest = JSON.parse(readFileSync(join(pRoot, 'plugin.json'), 'utf-8'));

    assert.equal(manifest.name, pluginId, `plugin.json name must match folder name ${pluginId}`);
    for (const key of Object.keys(manifest)) {
      assert.ok(ALLOWED_PLUGIN_KEYS.has(key), `Disallowed key in ${pluginId}/plugin.json: ${key}`);
    }
    if (manifest.logo) {
      assert.ok(existsSync(join(pRoot, manifest.logo)), `Missing logo in ${pluginId}: ${manifest.logo}`);
    }

    assert.equal(existsSync(join(pRoot, 'AGENTS.md')), false, `${pluginId} must NOT contain AGENTS.md at plugin root`);
    assert.equal(existsSync(join(pRoot, 'CLAUDE.md')), false, `${pluginId} must NOT contain CLAUDE.md at plugin root`);

    const pkgPath = join(pRoot, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      assert.equal(pkg.version, manifest.version, `${pluginId}: package.json version must match plugin.json`);
    }

    const sidecarsDir = join(pRoot, 'sidecars');
    if (existsSync(sidecarsDir)) {
      for (const sd of readdirSync(sidecarsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        const scJsonPath = join(sidecarsDir, sd.name, 'sidecar.json');
        const scPkgPath = join(sidecarsDir, sd.name, 'package.json');
        assert.ok(existsSync(scJsonPath), `Missing sidecar.json in ${pluginId}/sidecars/${sd.name}`);
        const sc = JSON.parse(readFileSync(scJsonPath, 'utf-8'));
        if (sc.has_web_ui === true) {
          assert.equal(
            sc.ui_config?.views?.[0]?.entrypoint,
            'SIDECAR_UI_ENTRYPOINT_AUX_PANE',
            `${pluginId}/sidecars/${sd.name}: web UI sidecars must expose AUX_PANE entrypoint`,
          );
        }
        if (existsSync(scPkgPath)) {
          const scPkg = JSON.parse(readFileSync(scPkgPath, 'utf-8'));
          assert.equal(scPkg.version, manifest.version, `${pluginId}/sidecars/${sd.name}: package.json version mismatch`);
        }
      }
    }

    // Specific checks for catalog-based skill bundles (mattpocock-skills)
    const catalogIndex = join(pRoot, 'catalog', 'index.json');
    if (existsSync(catalogIndex)) {
      const idx = JSON.parse(readFileSync(catalogIndex, 'utf-8'));
      assert.ok(idx.skills.length >= 38, `${pluginId}: expected >= 38 catalog skills`);
      const yamlFiles = [
        ...collectFiles(join(pRoot, 'catalog', 'adapted'), ['.yaml']),
        ...collectFiles(join(pRoot, 'skills'), ['.yaml']),
      ];
      assert.equal(yamlFiles.length, 0, `${pluginId}: unexpected yaml files: ${yamlFiles.join(', ')}`);
      for (const f of collectFiles(join(pRoot, 'skills'), ['.md']).filter((p) => p.endsWith('SKILL.md'))) {
        const txt = readFileSync(f, 'utf-8');
        assert.equal(/\bSkill tool\b/.test(txt), false, `${pluginId}: unadapted Skill tool in ${f}`);
        for (const m of txt.matchAll(/\(\.\.\/([a-z0-9-]+)\/SKILL\.md\)/g)) {
          assert.ok(existsSync(join(pRoot, 'skills', m[1], 'SKILL.md')), `${pluginId}: broken relative link ../${m[1]}/SKILL.md`);
        }
      }
    }

    if (runAgyValidate) {
      try {
        const out = execFileSync('agy', ['plugin', 'validate', pRoot, '--strict', '--json'], {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
        const parsed = JSON.parse(out);
        assert.equal(parsed.findings.length, 0, `${pluginId}: agy validate findings: ${JSON.stringify(parsed.findings)}`);
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
      }
    }
  }

  if (checkRegistry) {
    const regPath = join(rootDir, 'registry.json');
    assert.ok(existsSync(regPath), 'Missing root registry.json (run npm run sync:registry)');
    const expected = `${JSON.stringify(buildRegistry(rootDir), null, 2)}\n`;
    const actual = readFileSync(regPath, 'utf-8').replace(/\r\n/g, '\n');
    assert.equal(actual, expected, 'registry.json is out of sync (run npm run sync:registry)');
  }

  return { jsFilesCount: jsFiles.length, pluginsCount: pluginDirs.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = runChecks(MONOREPO_ROOT);
  console.log(`CHECK ALL OK (${res.pluginsCount} plugins, ${res.jsFilesCount} JS/MJS files)`);
}
