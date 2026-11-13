import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..');

// 1. Validate portable Antigravity plugin & sidecar manifest
const pluginJson = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'plugin.json'), 'utf-8'));
assert.equal(pluginJson.name, 'antigravity-context-viewer');
assert.ok(existsSync(join(PLUGIN_ROOT, pluginJson.logo)), 'plugin logo must exist');
assert.ok(existsSync(join(PLUGIN_ROOT, 'skills', 'context-viewer', 'SKILL.md')), 'context-viewer SKILL.md must exist');

const sidecarPath = join(PLUGIN_ROOT, 'sidecars', 'live-loader', 'sidecar.json');
assert.ok(existsSync(sidecarPath), 'sidecars/live-loader/sidecar.json must exist');
const sidecarRaw = readFileSync(sidecarPath, 'utf-8');
assert.equal(sidecarRaw.includes('/Users/'), false, 'sidecar.json must be portable without hardcoded home paths');
const sidecarJson = JSON.parse(sidecarRaw);
assert.equal(sidecarJson.args[0], '../../sidecar-live.js');
assert.ok(existsSync(resolve(dirname(sidecarPath), sidecarJson.args[0])), 'sidecar target script must exist');

// 2. Run all 10 unit test suites inside plugins/antigravity-context-viewer
const pkg = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'package.json'), 'utf-8'));
const testFiles = [
  'meter-core.test.js',
  'meter-renderer.test.js',
  'meter-storage-proxy.test.js',
  'meter-subscription.test.js',
  'meter-integration.test.js',
  'meter-security-update.test.js',
  'meter-context-unlock.test.js',
  'meter-update-delivery.test.js',
  'meter-cli-launcher.test.js',
  'sidecar-live.test.js',
];

for (const tf of testFiles) {
  assert.ok(existsSync(join(PLUGIN_ROOT, tf)), `Missing test file: ${tf}`);
}

execFileSync(process.execPath, ['--test', ...testFiles], {
  cwd: PLUGIN_ROOT,
  stdio: 'inherit',
});

console.log(`CONTEXT VIEWER PLUGIN TESTS PASSED (v${pkg.version}, ${testFiles.length} suites)`);
