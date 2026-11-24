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
assert.equal(sidecarJson.has_web_ui, true, 'sidecar.json must declare has_web_ui for Aux Pane compatibility');
assert.equal(
  sidecarJson.ui_config?.views?.[0]?.entrypoint,
  'SIDECAR_UI_ENTRYPOINT_AUX_PANE',
  'sidecar.json must expose Aux Pane UI view'
);
assert.ok(existsSync(resolve(dirname(sidecarPath), sidecarJson.args[0])), 'sidecar target script must exist');
for (const asset of ['ui-server.js', 'index.html', 'styles.css', 'app.js']) {
  assert.ok(existsSync(join(dirname(sidecarPath), asset)), `missing sidecar UI asset: ${asset}`);
}
execFileSync(process.execPath, ['--check', join(dirname(sidecarPath), 'ui-server.js')], { stdio: 'inherit' });

// 2. Run all 20 unit test suites inside plugins/antigravity-context-viewer
const pkg = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'package.json'), 'utf-8'));
const testFiles = [
  'meter-core.test.js',
  'meter-renderer.test.js',
  'meter-quota.test.js',
  'meter-storage-proxy.test.js',
  'meter-subscription.test.js',
  'meter-integration.test.js',
  'meter-security-update.test.js',
  'meter-context-unlock.test.js',
  'meter-enhance.test.js',
  'meter-update-delivery.test.js',
  'meter-cli-launcher.test.js',
  'meter-v083-fixes.test.js',
  'meter-model-context-isolation.test.js',
  'meter-v085-fixes.test.js',
  'meter-hotload.test.js',
  'meter-macos-watch.test.js',
  'meter-v089-usage.test.js',
  'meter-elv91-speed.test.js',
  'meter-accounts.test.js',
  'meter-cli-adapter.test.js',
  'meter-cli-monitor.test.js',
  'meter-cli-ui.test.js',
  'meter-rehydrate.test.js',
  'meter-v234-compat.test.js',
  'meter-i18n-upstream.test.js',
  'meter-elv98-99.test.js',
  'meter-elv103-mixed-session.test.js',
  'meter-first-install-recovery.test.js',
  'meter-v090-cockpit-subscription.test.js',
  'meter-v090-decoupled-dock.test.js',
  'autostart.test.js',
  'meter-v091-appearance-prefs.test.js',
  'meter-v091-dashboard-gesture.test.js',
  'meter-v091-skyline-layout.test.js',
  'meter-v091-gap-closure.test.js',
  'sidecar-live.test.js',
];

for (const tf of testFiles) {
  assert.ok(existsSync(join(PLUGIN_ROOT, tf)), `Missing test file: ${tf}`);
}

execFileSync(process.execPath, ['--test', '--test-concurrency=1', ...testFiles], {
  cwd: PLUGIN_ROOT,
  stdio: 'inherit',
});

console.log(`CONTEXT VIEWER PLUGIN TESTS PASSED (v${pkg.version}, ${testFiles.length} suites)`);
