'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  installSidecarPlugin,
  uninstallSidecarPlugin,
  getSidecarPluginStatus,
  tickSidecarLive,
  runOnceWithTimeout,
  startSidecarDaemon
} = require('./sidecar-live');

test('sidecar plugin install, status, log inspection, and clean uninstall in temp dirs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-sidecar-plugin-'));
  const configRoot = path.join(tmpDir, 'config');
  const appDataDir = path.join(tmpDir, 'appdata');
  try {
    const installed = installSidecarPlugin({ configRoot, appDataDir });
    assert.equal(installed.ok, true);
    assert.equal(fs.existsSync(installed.pluginManifestPath), true);
    assert.equal(fs.existsSync(installed.sidecarManifestPath), true);

    const pluginJson = JSON.parse(fs.readFileSync(installed.pluginManifestPath, 'utf8'));
    assert.deepEqual(Object.keys(pluginJson).sort(), ['description', 'displayName', 'name', 'version']);
    assert.equal(pluginJson.name, 'antigravity-context-viewer');

    const sidecarJson = JSON.parse(fs.readFileSync(installed.sidecarManifestPath, 'utf8'));
    assert.equal(sidecarJson.restart_policy, 'always');
    assert.equal(sidecarJson.args[0], path.resolve(__dirname, 'sidecar-live.js'));

    // Mock sidecar log output
    fs.mkdirSync(installed.logsDir, { recursive: true });
    fs.writeFileSync(path.join(installed.logsDir, 'sidecar.log'), 'line 1\nline 2\n', 'utf8');

    const st = getSidecarPluginStatus({ configRoot, appDataDir });
    assert.equal(st.installed, true);
    assert.equal(st.scriptExists, true);
    assert.deepEqual(st.runtimeLog.tail, ['line 1', 'line 2']);

    const uninstalled = uninstallSidecarPlugin({ configRoot, appDataDir });
    assert.equal(uninstalled.ok, true);
    assert.equal(fs.existsSync(installed.pluginDir), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('tickSidecarLive handles waiting, active, bridge refresh, ASAR noop, and cold injection', async () => {
  let ensureCount = 0;
  let injectCount = 0;

  // 1. Not running
  let res = await tickSidecarLive({
    queryWindow: async () => ({ running: false }),
    isBridgeAlive: () => false,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async () => { injectCount++; return true; }
  });
  assert.equal(res.action, 'waiting');
  assert.equal(ensureCount, 0);

  // 2. ASAR IPC already active & bundle stamp matches -> noop without spawning bridge
  let asarSaved = 'asar-v1';
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, hasIpcBridge: true, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => false,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async () => { injectCount++; return true; },
    getBundleStamp: () => 'asar-v1',
    readInjectedBundleStamp: () => asarSaved,
    writeInjectedBundleStamp: (_o, s) => { asarSaved = s; }
  });
  assert.equal(res.action, 'noop');
  assert.equal(res.reason, 'asar_ipc_active');
  assert.equal(ensureCount, 0);

  // 2b. ASAR IPC active but repo bundle updated -> syncs UI with skipLiveSession and zero redundant bridge
  let lastInjectOpts = null;
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, hasIpcBridge: true, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => false,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async opts => { lastInjectOpts = opts; injectCount++; return true; },
    getBundleStamp: () => 'asar-v2',
    readInjectedBundleStamp: () => asarSaved,
    writeInjectedBundleStamp: (_o, s) => { asarSaved = s; }
  });
  assert.equal(res.action, 'injected');
  assert.equal(res.reason, 'asar_bundle_synced');
  assert.deepEqual(lastInjectOpts, { skipLiveSession: true, bundleStamp: 'asar-v2', injectChinese: true });
  assert.equal(asarSaved, 'asar-v2');
  assert.equal(ensureCount, 0);
  assert.equal(injectCount, 1);

  // 2c. Old app.asar did-finish-load overwrites DOM (injectedStamp becomes null while disk stamp still matches) -> self-heals!
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, hasIpcBridge: true, injectedStamp: null, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => false,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async opts => { lastInjectOpts = opts; injectCount++; return true; },
    getBundleStamp: () => 'asar-v2',
    readInjectedBundleStamp: () => 'asar-v2',
    writeInjectedBundleStamp: () => {}
  });
  assert.equal(res.action, 'injected');
  assert.equal(res.reason, 'asar_bundle_synced');
  assert.equal(ensureCount, 0);
  assert.equal(injectCount, 2);

  // 3. Cold window -> injects once
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, active: false, hasIpcBridge: false, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => false,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async () => { injectCount++; return true; },
    getBundleStamp: () => null
  });
  assert.equal(res.action, 'injected');
  assert.equal(res.reason, 'injected');
  assert.equal(ensureCount, 1);
  assert.equal(injectCount, 3);

  // 4. Already active, bridge alive & matching bundle stamp -> noop
  let currentStamp = 'stamp-v1';
  let savedStamp = 'stamp-v1';
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, active: true, hasIpcBridge: false, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => true,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async () => { injectCount++; return true; },
    getBundleStamp: () => currentStamp,
    readInjectedBundleStamp: () => savedStamp,
    writeInjectedBundleStamp: (_o, s) => { savedStamp = s; }
  });
  assert.equal(res.action, 'noop');
  assert.equal(res.reason, 'already_active');
  assert.equal(ensureCount, 1);

  // 4b. Bundle changed on disk (e.g. after git pull / rebuild) -> hot-reloads UI cleanly
  currentStamp = 'stamp-v2';
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, active: true, hasIpcBridge: false, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => true,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async () => { injectCount++; return true; },
    getBundleStamp: () => currentStamp,
    readInjectedBundleStamp: () => savedStamp,
    writeInjectedBundleStamp: (_o, s) => { savedStamp = s; }
  });
  assert.equal(res.action, 'injected');
  assert.equal(res.reason, 'bundle_updated');
  assert.equal(savedStamp, 'stamp-v2');
  assert.equal(ensureCount, 2);
  assert.equal(injectCount, 4);

  // 5. Window active but bridge died -> refreshes bridge & updates token
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, active: true, hasIpcBridge: false, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => false,
    ensureBridge: async () => { ensureCount++; },
    hotInject: async () => { injectCount++; return true; },
    getBundleStamp: () => currentStamp,
    readInjectedBundleStamp: () => savedStamp,
    writeInjectedBundleStamp: (_o, s) => { savedStamp = s; }
  });
  assert.equal(res.action, 'injected');
  assert.equal(res.reason, 'bridge_refreshed');
  assert.equal(ensureCount, 3);
  assert.equal(injectCount, 5);
});

test('runOnceWithTimeout retries until Antigravity window becomes ready', async () => {
  let polls = 0;
  const res = await runOnceWithTimeout({
    timeoutMs: 1000,
    pollMs: 10,
    logger: () => {},
    deps: {
      queryWindow: async () => {
        polls++;
        if (polls < 3) return { running: true, pageFound: false };
        return { running: true, pageFound: true, active: false, hasIpcBridge: false, origin: 'https://127.0.0.1:1234' };
      },
      isBridgeAlive: () => false,
      ensureBridge: async () => {},
      hotInject: async () => true
    }
  });
  assert.equal(res.action, 'injected');
  assert.equal(polls, 3);
});

test('startSidecarDaemon polls cleanly, binds bridge lifecycle 1:1 with client, and closes on stop', async () => {
  let ticks = 0;
  let running = true;
  let activeOrigins = new Set();
  let startCount = 0;
  let closeCount = 0;

  const daemon = startSidecarDaemon({
    fastPollMs: 10,
    idlePollMs: 15,
    logger: () => {},
    deps: {
      queryWindow: async () => {
        ticks++;
        if (!running) return { running: false };
        return { running: true, pageFound: true, active: false, hasIpcBridge: false, origin: 'https://127.0.0.1:50001' };
      },
      isBridgeAlive: () => false,
      startManagedBridge: async ({ origin }) => {
        startCount++;
        activeOrigins.add(origin);
        return {
          origin,
          async close() {
            closeCount++;
            activeOrigins.delete(origin);
          }
        };
      },
      hotInject: async () => true,
      getBundleStamp: () => null
    }
  });

  await new Promise(r => setTimeout(r, 35));
  assert.equal(startCount, 1);
  assert.equal(activeOrigins.has('https://127.0.0.1:50001'), true);

  // 客户端关闭 -> Sidecar 托管桥接立即自动关闭
  running = false;
  await new Promise(r => setTimeout(r, 35));
  assert.equal(closeCount, 1);
  assert.equal(activeOrigins.size, 0);

  await daemon.stop();
  const countAtStop = ticks;
  await new Promise(r => setTimeout(r, 30));
  assert.equal(ticks, countAtStop);
});

test('tickSidecarLive injects Chinese by default when i18nActive is false and respects disabled setting', async () => {
  let injectCalls = [];
  let chinesePref = true;

  // 1. UI 已就绪且汉化默认开启但页面尚未加载词库 (i18nActive: false) -> 仅补注汉化
  let res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, active: true, hasIpcBridge: false, i18nActive: false, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => true,
    ensureBridge: async () => { throw new Error('should not restart healthy bridge'); },
    hotInject: async opts => { injectCalls.push(opts); return true; },
    getBundleStamp: () => 'stamp-v1',
    readInjectedBundleStamp: () => 'stamp-v1',
    isChineseEnabled: () => chinesePref
  });
  assert.equal(res.action, 'injected');
  assert.equal(res.reason, 'chinese_synced');
  assert.deepEqual(injectCalls, [{ onlyChinese: true, injectChinese: true }]);

  // 2. 在插件设置中关闭汉化后 (isChineseEnabled: false) -> 即使页面未汉化也不触发注入
  chinesePref = false;
  injectCalls = [];
  res = await tickSidecarLive({
    queryWindow: async () => ({ running: true, pageFound: true, active: true, hasIpcBridge: false, i18nActive: false, origin: 'https://127.0.0.1:9000' }),
    isBridgeAlive: () => true,
    ensureBridge: async () => {},
    hotInject: async opts => { injectCalls.push(opts); return true; },
    getBundleStamp: () => 'stamp-v1',
    readInjectedBundleStamp: () => 'stamp-v1',
    isChineseEnabled: () => chinesePref
  });
  assert.equal(res.action, 'noop');
  assert.equal(res.reason, 'already_active');
  assert.equal(injectCalls.length, 0);
});
