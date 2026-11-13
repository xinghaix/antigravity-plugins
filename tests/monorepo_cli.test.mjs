import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMonorepoStatus, installPlugins, listPlugins, uninstallPlugins } from '../scripts/cli.mjs';
import { runChecks } from '../scripts/check-all.mjs';
import { scaffoldPlugin } from '../scripts/new-plugin.mjs';
import { packageRelease } from '../scripts/package-release.mjs';
import { buildRegistry } from '../scripts/sync-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'ag-plugins-monorepo-test-'));

try {
  // 1. Registry scan verification
  const reg = buildRegistry(MONOREPO_ROOT);
  assert.ok(reg.plugins.some((p) => p.id === 'mcp-manager'));
  assert.ok(reg.plugins.some((p) => p.id === 'mattpocock-skills'));

  // 2. Selective install (--link and --copy) + third-party preservation + uninstall
  const fakeHome = join(tempRoot, 'home');
  const thirdPartyDir = join(fakeHome, '.gemini', 'config', 'plugins', 'antigravity-context-viewer');
  mkdirSync(thirdPartyDir, { recursive: true });

  // Selective install mcp-manager (--link)
  const linkRes = installPlugins(['mcp-manager'], { link: true, rootDir: MONOREPO_ROOT, home: fakeHome });
  assert.equal(linkRes.length, 1);
  assert.equal(linkRes[0].mode, 'link');
  assert.equal(lstatSync(linkRes[0].target).isSymbolicLink(), true);
  assert.equal(realpathSync(linkRes[0].target), realpathSync(join(MONOREPO_ROOT, 'plugins', 'mcp-manager')));
  assert.equal(existsSync(join(fakeHome, '.gemini', 'config', 'plugins', 'mattpocock-skills')), false);

  // Selective install mattpocock-skills (--copy, excluding tests/)
  const copyRes = installPlugins(['mattpocock-skills'], { link: false, rootDir: MONOREPO_ROOT, home: fakeHome });
  assert.equal(copyRes[0].mode, 'copy');
  assert.ok(existsSync(join(copyRes[0].target, 'plugin.json')));
  assert.equal(existsSync(join(copyRes[0].target, 'tests')), false);

  const listed = listPlugins({ rootDir: MONOREPO_ROOT, home: fakeHome });
  assert.equal(listed.find((p) => p.id === 'mcp-manager')?.installMode, 'linked-monorepo');
  assert.equal(listed.find((p) => p.id === 'mattpocock-skills')?.installMode, 'copy');

  const status = getMonorepoStatus({ rootDir: MONOREPO_ROOT, home: fakeHome });
  assert.equal(status.plugins.length >= 2, true);

  // Install all (--link)
  const allRes = installPlugins([], { all: true, link: true, rootDir: MONOREPO_ROOT, home: fakeHome });
  assert.equal(allRes.length >= 2, true);

  // Uninstall all monorepo plugins (must preserve third-party plugins!)
  const unRes = uninstallPlugins([], { all: true, rootDir: MONOREPO_ROOT, home: fakeHome });
  assert.equal(unRes.every((r) => r.removed), true);
  assert.equal(existsSync(thirdPartyDir), true, 'Third-party plugin dir must NOT be removed');

  // 3. New plugin scaffolding (--ui) + check-all verification in isolated copy
  const mockRepo = join(tempRoot, 'mock-monorepo');
  cpSync(join(MONOREPO_ROOT, 'package.json'), join(mockRepo, 'package.json'));
  cpSync(join(MONOREPO_ROOT, 'scripts'), join(mockRepo, 'scripts'), { recursive: true });
  cpSync(join(MONOREPO_ROOT, 'tests'), join(mockRepo, 'tests'), { recursive: true });
  mkdirSync(join(mockRepo, 'plugins'), { recursive: true });
  cpSync(join(MONOREPO_ROOT, 'plugins', 'mcp-manager'), join(mockRepo, 'plugins', 'mcp-manager'), { recursive: true });

  const scaff = scaffoldPlugin({
    pluginId: 'prompt-vault',
    displayName: 'Prompt Vault',
    description: 'Manage reusable prompts visually.',
    withUi: true,
    rootDir: mockRepo,
  });
  assert.ok(existsSync(join(scaff.pluginDir, 'plugin.json')));
  assert.ok(existsSync(join(scaff.pluginDir, 'sidecars', 'prompt_vault', 'sidecar.json')));
  const checkRes = runChecks(mockRepo, { checkRegistry: true, runAgyValidate: false });
  assert.equal(checkRes.pluginsCount, 2);

  // 4. Release packaging verification
  const packRes = packageRelease(mockRepo);
  assert.ok(packRes.archives.includes('mcp-manager.tar.gz'));
  assert.ok(packRes.archives.includes('prompt-vault.zip'));
  assert.ok(existsSync(join(packRes.outDir, 'SHA256SUMS.txt')));
  assert.ok(existsSync(join(packRes.outDir, 'RELEASE_BODY.md')));

  console.log('MONOREPO CLI & SCAFFOLD TESTS PASSED');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
