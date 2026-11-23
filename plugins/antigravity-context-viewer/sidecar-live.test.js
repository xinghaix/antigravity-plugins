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
  startSidecarDaemon,
  ACTIVE_POLL_MS
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

test('getSidecarPluginStatus resolves relative sidecar args against sidecarDir (Antigravity plugin layout)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-sidecar-rel-'));
  const configRoot = path.join(tmpDir, 'config');
  const appDataDir = path.join(tmpDir, 'appdata');
  const pluginDir = path.join(configRoot, 'plugins', 'antigravity-context-viewer');
  const sidecarDir = path.join(pluginDir, 'sidecars', 'live-loader');
  try {
    fs.mkdirSync(sidecarDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ name: 'antigravity-context-viewer' }), 'utf8');
    fs.writeFileSync(path.join(pluginDir, 'sidecar-live.js'), '// target\n', 'utf8');
    fs.writeFileSync(path.join(sidecarDir, 'sidecar.json'), JSON.stringify({
      command: 'node',
      args: ['../../sidecar-live.js'],
      has_web_ui: true
    }), 'utf8');

    const st = getSidecarPluginStatus({ configRoot, appDataDir });
    assert.equal(st.installed, true);
    assert.equal(st.scriptExists, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('tickSidecarLive handles running client without CDP (cdp_disabled) and invokes onInactive', async () => {
  let inactiveCalled = 0;
  let ensureCalled = 0;
  const logs = [];
  const { logStateChange } = require('./sidecar-live');

  const res = await tickSidecarLive({
    queryWindow: async () => ({
      running: true,
      cdpEnabled: false,
      cdpPort: null,
      pageFound: false,
      reason: 'cdp_disabled',
      origin: 'https://127.0.0.1:54007',
      origins: ['https://127.0.0.1:54007']
    }),
    onInactive: async () => { inactiveCalled++; },
    ensureBridge: async () => { ensureCalled++; }
  });

  assert.equal(res.action, 'waiting');
  assert.equal(res.reason, 'cdp_disabled');
  assert.equal(inactiveCalled, 1);
  assert.equal(ensureCalled, 0);

  const lastKeyRef = { current: null };
  logStateChange(lastKeyRef, res, line => logs.push(line));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /without CDP \(2\.33\+ default\)/);
});

test('local-api extractCandidateOriginsFromLog and connect fallback to main.log without DevToolsActivePort', async t => {
  const https = require('https');
  const { EventEmitter } = require('events');
  const { extractCandidateOriginsFromLog, connect } = require('./local-api');

  const origins = extractCandidateOriginsFromLog(
    '[info] started on https://127.0.0.1:51001/\n' +
    '[info] reloaded on https://127.0.0.1:54007/\n' +
    '[info] duplicate https://127.0.0.1:51001/\n'
  );
  assert.deepEqual(origins, ['https://127.0.0.1:51001', 'https://127.0.0.1:54007']);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-mainlog-'));
  const appDataDir = tmpDir;
  const logDir = path.join(appDataDir, 'Antigravity', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(path.join(logDir, 'main.log'), 'listening on https://127.0.0.1:54999/\n', 'utf8');

  t.mock.method(https, 'request', (url, opts, cb) => {
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.destroy = () => {};
    req.end = (body) => {
      const res = new EventEmitter();
      res.statusCode = 200;
      process.nextTick(() => {
        cb(res);
        if (String(url).endsWith('/')) {
          res.emit('data', '<script>window.__APP_CONFIG__ = {"csrfToken":"tok-mainlog"};</script>');
        } else {
          res.emit('data', JSON.stringify({ ok: true, echo: body ? JSON.parse(body) : null }));
        }
        res.emit('end');
      });
    };
    return req;
  });

  try {
    const api = await connect({ appDataDir });
    assert.equal(api.origin, 'https://127.0.0.1:54999');
    const pong = await api.call('Ping', { hello: '2.33' });
    assert.deepEqual(pong, { ok: true, echo: { hello: '2.33' } });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('meter-collector collect() uses cachedUserStatusByOrigin without ReferenceError', async t => {
  const https = require('https');
  const { EventEmitter } = require('events');
  const { collect, resetQuotaHostCacheForTest } = require('./meter-collector');

  resetQuotaHostCacheForTest();
  const origin = 'https://127.0.0.1:54988';
  const convId = '11111111-2222-4333-8444-555555555555';

  let getUserStatusCalls = 0;

  t.mock.method(https, 'request', (url, opts, cb) => {
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.destroy = () => {};
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = 200;
      process.nextTick(() => {
        cb(res);
        const u = String(url);
        const emitJson = obj => res.emit('data', Buffer.from(JSON.stringify(obj), 'utf8'));
        if (u === `${origin}/`) {
          res.emit('data', Buffer.from('<script>window.__APP_CONFIG__ = {"csrfToken":"tok-collect"};</script>', 'utf8'));
        } else if (u.includes('GetUserStatus')) {
          getUserStatusCalls++;
          emitJson({
            userStatus: {
              cascadeModelConfigData: {
                clientModelConfigs: [
                  {
                    modelOrAlias: { model: 'MODEL_PLACEHOLDER_M26' },
                    label: 'Test Model',
                    maxTokens: 200000
                  }
                ]
              }
            }
          });
        } else if (u.includes('GetAvailableModels')) {
          emitJson({ models: {} });
        } else if (u.includes('GetCascadeTrajectoryGeneratorMetadata')) {
          emitJson({
            generatorMetadata: [
              {
                chatModel: {
                  model: 'MODEL_PLACEHOLDER_M26',
                  usage: {
                    inputTokens: 1200,
                    cacheReadTokens: 300,
                    outputTokens: 150
                  },
                  chatStartMetadata: {
                    contextWindowMetadata: {
                      estimatedTokensUsed: 1500,
                      maxContextTokens: 200000
                    }
                  }
                }
              }
            ]
          });
        } else if (u.includes('GetCascadeTrajectory')) {
          emitJson({
            numTotalSteps: 1,
            numTotalGeneratorMetadata: 1,
            trajectory: {
              steps: [
                {
                  type: 'CORTEX_STEP_TYPE_USER_INPUT',
                  userInput: { userResponse: 'hello antigravity 2.33' }
                }
              ]
            }
          });
        } else {
          emitJson({});
        }
        res.emit('end');
      });
    };
    return req;
  });

  const out = await collect(origin, convId, { force: true });
  assert.equal(out.conversation, convId);
  assert.ok(getUserStatusCalls >= 1);
  assert.ok(out.latest);
  assert.equal(out.latest.budget, 200000);
  assert.equal(out.latest.actual, 1650);
  assert.equal(out.latest.output, 150);
});

test('cli detectRunningAntigravity, queryLiveWindow (cdp_disabled), resolveAntigravityLaunchTarget, and launchAntigravityWithCdp', async () => {
  const {
    queryLiveWindow,
    resolveAntigravityLaunchTarget,
    launchAntigravityWithCdp
  } = require('./cli');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-cli-launch-'));
  try {
    const fakeAsar = path.join(tmpDir, 'Antigravity.app', 'Contents', 'Resources', 'app.asar');
    const fakeExec = path.join(tmpDir, 'Antigravity.app', 'Contents', 'MacOS', 'Antigravity');
    fs.mkdirSync(path.dirname(fakeAsar), { recursive: true });
    fs.mkdirSync(path.dirname(fakeExec), { recursive: true });
    fs.writeFileSync(fakeAsar, 'asar', 'utf8');
    fs.writeFileSync(fakeExec, 'bin', 'utf8');

    const liveNoCdp = await queryLiveWindow({
      portFile: path.join(tmpDir, 'missing-DevToolsActivePort'),
      isProcessRunning: () => true,
      discoverOrigins: async () => [{ origin: 'https://127.0.0.1:54007' }]
    });
    assert.equal(liveNoCdp.running, true);
    assert.equal(liveNoCdp.cdpEnabled, false);
    assert.equal(liveNoCdp.reason, 'cdp_disabled');
    assert.equal(liveNoCdp.origin, 'https://127.0.0.1:54007');

    const target = resolveAntigravityLaunchTarget(fakeAsar, { platform: 'darwin' });
    assert.equal(target.appBundle, path.join(tmpDir, 'Antigravity.app'));
    assert.equal(target.executable, fakeExec);

    await assert.rejects(
      () => launchAntigravityWithCdp({
        customPath: fakeAsar,
        platform: 'darwin',
        queryLiveWindow: async () => ({ running: true, cdpEnabled: false }),
        restart: false
      }),
      /--restart/
    );

    let runningFlag = true;
    const quitCalls = [];
    const spawnCalls = [];
    const launched = await launchAntigravityWithCdp({
      customPath: fakeAsar,
      platform: 'darwin',
      port: 9229,
      restart: true,
      settleMs: 0,
      queryLiveWindow: async () => ({ running: true, cdpEnabled: false }),
      isAntigravityProcessRunning: () => runningFlag,
      execFileSync: (bin, args) => {
        quitCalls.push([bin, args]);
        runningFlag = false;
      },
      spawn: (cmd, args) => {
        spawnCalls.push([cmd, args]);
        return { unref() {} };
      },
      getDevToolsPort: () => 9229
    });

    assert.equal(launched.launched, true);
    assert.equal(launched.restarted, true);
    assert.equal(launched.cdpPort, 9229);
    assert.equal(quitCalls[0][0], 'osascript');
    assert.deepEqual(spawnCalls[0], ['open', ['-a', path.join(tmpDir, 'Antigravity.app'), '--args', '--remote-debugging-port=9229']]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('sidecar ui-server registers Aux Pane routes and serves /, assets, and /api/overview', async () => {
  const { startSidecarUiServer } = require('./sidecars/live-loader/ui-server');
  const pages = new Map();
  const gets = new Map();
  const posts = new Map();
  let runCalled = false;
  let closed = false;

  class MockResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.init = init;
    }
  }
  class MockSidecarApp {
    page(route, handler) { pages.set(route, handler); }
    api(route, handler, method = 'POST') {
      if (method === 'GET') gets.set(route, handler);
      else posts.set(route, handler);
    }
    run() {
      runCalled = true;
      return {
        port: 49999,
        async close() { closed = true; }
      };
    }
  }

  const tmpAg = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-ui-srv-'));
  fs.mkdirSync(path.join(tmpAg, 'conversations'), { recursive: true });
  const convId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  fs.writeFileSync(path.join(tmpAg, 'conversations', `${convId}.db`), 'db', 'utf8');

  try {
    const srv = await startSidecarUiServer({
      agDir: tmpAg,
      importSidecarSdk: async () => ({ SidecarApp: MockSidecarApp, Response: MockResponse }),
      deps: {
        localApi: {
          normalizeLoopbackOrigin: v => v,
          connect: async () => ({
            origin: 'https://127.0.0.1:54007',
            origins: ['https://127.0.0.1:54007'],
            call: async (method) => {
              if (method === 'GetAllCascadeTrajectories') {
                return {
                  trajectorySummaries: {
                    [convId]: { summary: 'Test 2.33 Session', lastModifiedTime: new Date().toISOString() }
                  }
                };
              }
              return {};
            }
          })
        },
        collector: {
          collect: async (origin, id) => ({
            conversation: id,
            latest: { model: 'Gemini Test', used: 1000, budget: 100000, percent: 1, input: 800, cached: 100, output: 100, speed: { tps: 88, ttft: 0.4, duration: 1.2 } },
            session: { steps: 2, groups: { user: { high: 500 }, assistant: { high: 500 } }, total: { high: 1000 }, attachmentTotal: { high: 0 }, attachments: [] },
            generatorCount: 1
          }),
          fetchQuotaSnapshotFromHost: async () => ({ ok: true, planTierSummary: { tierName: 'Pro' }, snapshot: { pools: [] } }),
          collectTokenHistoryAsync: async () => ({ version: '0.8.8-1', summary: { todayTokens: 123, monthTokens: 456, grandTotalTokens: 789 } }),
          getContextUnlockStatus: async () => ({ status: 'patched_loaded', mode: 'standalone language_server', configuredMode: 'fixed', configuredLimitTokens: 712000, arch: 'arm64' }),
          getPluginSettings: () => ({ sidecarChinese: true, showCliButton: false, panelLanguage: 'zh-CN' }),
          savePluginSettings: () => ({ ok: true })
        },
        cli: {
          queryLiveWindow: async () => ({
            running: true,
            cdpEnabled: false,
            cdpPort: null,
            pageFound: false,
            reason: 'cdp_disabled',
            origin: 'https://127.0.0.1:54007',
            origins: ['https://127.0.0.1:54007']
          })
        },
        sidecarLive: {
          getSidecarPluginStatus: () => ({ installed: true, scriptExists: true, runtimeLog: { tail: ['ok'] } }),
          tickSidecarLive: async () => ({ action: 'waiting', reason: 'cdp_disabled' })
        },
        asarEngine: { getStateDir: () => tmpAg }
      }
    });

    assert.equal(runCalled, true);
    assert.equal(srv.port, 49999);
    assert.equal(pages.has('/'), true);
    assert.match(pages.get('/')(), /Context Viewer/);
    assert.match(gets.get('/styles.css')().body, /--app-shell|\.app-shell/);
    assert.match(gets.get('/app.js')().body, /\/api\/overview/);

    const overview = await posts.get('/api/overview')({});
    assert.equal(overview.ok, true);
    assert.equal(overview.meta.cdpEnabled, false);
    assert.equal(overview.meta.cdpReason, 'cdp_disabled');
    assert.equal(overview.selectedConversationId, convId);
    assert.equal(overview.conversations[0].title, 'Test 2.33 Session');
    assert.equal(overview.session.latest.model, 'Gemini Test');
    assert.equal(overview.tokens.summary.todayTokens, 123);
    assert.equal(overview.unlock.status, 'patched_loaded');
    assert.equal(overview.unlock.mode, 'fixed');
    assert.equal(overview.unlock.limit, 712000);

    await srv.close();
    assert.equal(closed, true);
  } finally {
    fs.rmSync(tmpAg, { recursive: true, force: true });
  }
});

test('local-api connect discovers Antigravity 2.33+ Language Server via daemon hub_*.json without DevToolsActivePort or main.log', async t => {
  const https = require('https');
  const { EventEmitter } = require('events');
  const { connect, readDaemonEntries } = require('./local-api');

  const tmpAg = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-daemon-'));
  const daemonDir = path.join(tmpAg, 'daemon');
  fs.mkdirSync(daemonDir, { recursive: true });

  // Stale dead PID entry must be ignored
  fs.writeFileSync(
    path.join(daemonDir, 'hub_50908.json'),
    JSON.stringify({ pid: 9999999, httpsPort: 50907, httpPort: 50908, csrfToken: 'stale-tok' }),
    'utf8'
  );
  // Live PID entry (current process pid)
  fs.writeFileSync(
    path.join(daemonDir, 'hub_51185.json'),
    JSON.stringify({ pid: process.pid, httpsPort: 51184, httpPort: 51185, lsVersion: '2.33.0', csrfToken: 'daemon-tok' }),
    'utf8'
  );

  const entries = readDaemonEntries({ agDir: tmpAg });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].httpsPort, 51184);
  assert.equal(entries[0].csrfToken, 'daemon-tok');

  t.mock.method(https, 'request', (url, opts, cb) => {
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.destroy = () => {};
    req.end = (body) => {
      const res = new EventEmitter();
      res.statusCode = 200;
      process.nextTick(() => {
        cb(res);
        if (String(url).endsWith('/')) {
          res.emit('data', '<html><body>ok without inline config</body></html>');
        } else {
          assert.equal(opts.headers['x-codeium-csrf-token'], 'daemon-tok');
          res.emit('data', JSON.stringify({ ok: true, echo: body ? JSON.parse(body) : null }));
        }
        res.emit('end');
      });
    };
    return req;
  });

  try {
    const api = await connect({ agDir: tmpAg });
    assert.equal(api.origin, 'https://127.0.0.1:51184');
    const res = await api.call('GetUserStatus', { ping: 233 });
    assert.deepEqual(res, { ok: true, echo: { ping: 233 } });
  } finally {
    fs.rmSync(tmpAg, { recursive: true, force: true });
  }
});

test('startSidecarDaemon backs off to ACTIVE_POLL_MS in steady state without breaking custom idlePollMs', async () => {
  assert.equal(ACTIVE_POLL_MS, 20000);
  let ticks = 0;
  const daemon = startSidecarDaemon({
    fastPollMs: 10,
    idlePollMs: 15,
    activePollMs: 85,
    logger: () => {},
    deps: {
      queryWindow: async () => {
        ticks++;
        return { running: true, pageFound: true, active: true, hasIpcBridge: false, origin: 'https://127.0.0.1:50002' };
      },
      isBridgeAlive: () => true,
      ensureBridge: async () => {},
      hotInject: async () => true,
      getBundleStamp: () => 's1',
      readInjectedBundleStamp: () => 's1',
      isChineseEnabled: () => false
    }
  });
  try {
    await new Promise(r => setTimeout(r, 55));
    assert.equal(ticks, 1, 'steady-state noop must wait activePollMs (85ms), not idlePollMs (15ms)');
    await new Promise(r => setTimeout(r, 55));
    assert.equal(ticks >= 2, true, 'daemon should fire next poll after activePollMs elapses');
  } finally {
    await daemon.stop();
  }
});

test('tickSidecarLive preserves healthy bridge when CDP probe hits transient timeout (cdp_eval_timeout)', async () => {
  let inactiveCalled = 0;
  let injectCalled = 0;
  const logs = [];
  const { logStateChange } = require('./sidecar-live');

  const res = await tickSidecarLive({
    queryWindow: async () => ({
      running: true,
      cdpEnabled: true,
      cdpPort: 58321,
      pageFound: false,
      reason: 'cdp_eval_timeout',
      origin: 'https://127.0.0.1:51052'
    }),
    onInactive: async () => { inactiveCalled++; },
    hotInject: async () => { injectCalled++; return true; }
  });

  assert.equal(res.action, 'waiting');
  assert.equal(res.reason, 'cdp_busy');
  assert.equal(inactiveCalled, 0, 'transient CDP timeout must NOT tear down healthy live bridge');
  assert.equal(injectCalled, 0, 'transient CDP timeout must NOT trigger bundle re-injection');

  const lastKeyRef = { current: null };
  logStateChange(lastKeyRef, res, line => logs.push(line));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /keeping live bridge active/);
});

test('sidecar ui-server exposes full live-host bridge (/api/live), allowlisted /api/ls-rpc, bundle assets, and safe /api/open-external', async () => {
  const { startSidecarUiServer } = require('./sidecars/live-loader/ui-server');
  const pages = new Map();
  const gets = new Map();
  const posts = new Map();

  class MockResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.init = init;
    }
  }
  class MockSidecarApp {
    constructor() {
      this.config = { conversationId: '11111111-2222-4333-8444-555555555555' };
    }
    page(route, handler) { pages.set(route, handler); }
    api(route, handler, method = 'POST') {
      if (method === 'GET') gets.set(route, handler);
      else posts.set(route, handler);
    }
    run() { return { port: 49998, async close() {} }; }
  }

  const tmpAg = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-ui-full-'));
  fs.mkdirSync(path.join(tmpAg, 'conversations'), { recursive: true });
  let capturedLsRpc = null;
  let capturedLiveRoute = null;

  try {
    const srv = await startSidecarUiServer({
      agDir: tmpAg,
      importSidecarSdk: async () => ({ SidecarApp: MockSidecarApp, Response: MockResponse }),
      deps: {
        localApi: {
          normalizeLoopbackOrigin: v => v,
          connect: async () => ({
            origin: 'https://127.0.0.1:54111',
            origins: ['https://127.0.0.1:54111'],
            call: async (method, body) => {
              capturedLsRpc = { method, body };
              return { generatorMetadata: [{ stepIndex: 1 }] };
            }
          })
        },
        collector: {
          collect: async () => null,
          fetchQuotaSnapshotFromHost: async () => ({ ok: true, snapshot: { pools: [] } }),
          collectTokenHistoryAsync: async () => ({ summary: { grandTotalTokens: 100 } }),
          getContextUnlockStatus: async () => ({ status: 'unpatched' }),
          getPluginSettings: () => ({ sidecarChinese: true, showCliButton: false, panelLanguage: 'zh-CN' }),
          savePluginSettings: () => ({ ok: true })
        },
        cli: {
          queryLiveWindow: async () => ({ running: true, cdpEnabled: false, origins: ['https://127.0.0.1:54111'] })
        },
        sidecarLive: {
          getSidecarPluginStatus: () => ({ installed: true, scriptExists: true, runtimeLog: { tail: [] } })
        },
        asarEngine: { getStateDir: () => tmpAg },
        liveHost: {
          ALLOWED_ROUTES: ['/get-settings', '/runtime-info', '/quota', '/shutdown'],
          LIVE_CAPABILITIES: { quota: true, settings: true, accounts: true },
          createLiveRequestHandler: () => (req, res) => {
            let buf = '';
            req.on('data', c => { buf += c.toString('utf8'); });
            req.on('end', () => {
              capturedLiveRoute = { url: req.url, body: JSON.parse(buf || '{}') };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, route: req.url, settings: { panelLanguage: 'zh-CN' } }));
            });
          }
        }
      }
    });

    assert.equal(gets.has('/meter-core.js'), true);
    assert.equal(gets.has('/meter-renderer.js'), true);
    assert.match(gets.get('/meter-core.js')().body, /__AGContextMeterCore/);
    assert.match(gets.get('/meter-renderer.js')().body, /__AGContextMeter/);

    const overview = await posts.get('/api/overview')({});
    assert.equal(overview.selectedConversationId, '11111111-2222-4333-8444-555555555555');
    assert.deepEqual(overview.meta.capabilities, { quota: true, settings: true, accounts: true });

    const liveRes = await posts.get('/api/live')({ route: '/get-settings', body: { email: 'default' } });
    assert.equal(liveRes.ok, true);
    assert.equal(liveRes.route, '/get-settings');
    assert.deepEqual(capturedLiveRoute, { url: '/get-settings', body: { email: 'default' } });

    const shutResp = await posts.get('/api/live')({ route: '/shutdown' });
    assert.match(JSON.parse(shutResp.body).error, /不允许/);

    const badRouteResp = await posts.get('/api/live')({ route: '/not-allowed' });
    assert.match(JSON.parse(badRouteResp.body).error, /不允许/);

    const rpcRes = await posts.get('/api/ls-rpc')({ method: 'GetCascadeTrajectoryGeneratorMetadata', body: { cascadeId: 'abc' } });
    assert.equal(rpcRes.ok, true);
    assert.equal(capturedLsRpc.method, 'GetCascadeTrajectoryGeneratorMetadata');
    assert.deepEqual(capturedLsRpc.body, { cascadeId: 'abc' });

    const badRpcResp = await posts.get('/api/ls-rpc')({ method: 'DeleteAllChats' });
    assert.match(JSON.parse(badRpcResp.body).error, /不允许/);

    const badUrlResp = await posts.get('/api/open-external')({ url: 'javascript:alert(1)' });
    assert.match(JSON.parse(badUrlResp.body).error, /仅允许/);

    await srv.close();
  } finally {
    fs.rmSync(tmpAg, { recursive: true, force: true });
  }
});

test('sidecar ui-server lightweight overview skips heavy collectors and caches queryLiveWindow across non-force polls', async () => {
  const { startSidecarUiServer } = require('./sidecars/live-loader/ui-server');
  const posts = new Map();

  class MockResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.init = init;
    }
  }
  class MockSidecarApp {
    constructor() {
      this.config = { conversationId: 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb' };
    }
    page() {}
    api(route, handler, method = 'POST') {
      if (method !== 'GET') posts.set(route, handler);
    }
    run() { return { port: 49997, async close() {} }; }
  }

  const tmpAg = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-ui-lw-'));
  fs.mkdirSync(path.join(tmpAg, 'conversations'), { recursive: true });

  let queryCalls = 0;
  let collectCalls = 0;
  let quotaCalls = 0;
  let tokensCalls = 0;
  let unlockCalls = 0;

  try {
    const srv = await startSidecarUiServer({
      agDir: tmpAg,
      importSidecarSdk: async () => ({ SidecarApp: MockSidecarApp, Response: MockResponse }),
      deps: {
        localApi: {
          normalizeLoopbackOrigin: v => v,
          connect: async () => ({
            origin: 'https://127.0.0.1:54112',
            origins: ['https://127.0.0.1:54112'],
            call: async () => ({ trajectorySummaries: {} })
          })
        },
        collector: {
          collect: async () => { collectCalls++; return null; },
          fetchQuotaSnapshotFromHost: async () => { quotaCalls++; return { ok: true, snapshot: { pools: [] } }; },
          collectTokenHistoryAsync: async () => { tokensCalls++; return { summary: { grandTotalTokens: 100 } }; },
          getContextUnlockStatus: async () => { unlockCalls++; return { status: 'unpatched' }; },
          getPluginSettings: () => ({ sidecarChinese: true, showCliButton: false, panelLanguage: 'zh-CN' }),
          savePluginSettings: () => ({ ok: true })
        },
        cli: {
          queryLiveWindow: async () => {
            queryCalls++;
            return { running: true, cdpEnabled: true, cdpPort: 58321, active: true, origins: ['https://127.0.0.1:54112'] };
          }
        },
        sidecarLive: {
          getSidecarPluginStatus: () => ({ installed: true, scriptExists: true, runtimeLog: { tail: [] } })
        },
        asarEngine: { getStateDir: () => tmpAg },
        liveHost: { LIVE_CAPABILITIES: { quota: true }, createLiveRequestHandler: () => () => {} }
      }
    });

    // 1. 首次非 force lightweight overview：应执行 1 次 queryLiveWindow，但跳过 4 个重型采集
    const lw1 = await posts.get('/api/overview')({ lightweight: true });
    assert.equal(lw1.ok, true);
    assert.equal(lw1.lightweight, true);
    assert.equal(lw1.meta.cdpPort, 58321);
    assert.equal(queryCalls, 1);
    assert.equal(collectCalls, 0);
    assert.equal(quotaCalls, 0);
    assert.equal(tokensCalls, 0);
    assert.equal(unlockCalls, 0);

    // 2. 15s TTL 内第二次非 force overview：复用 queryLiveWindow 缓存，并正常返回完整概览
    const fullNonForce = await posts.get('/api/overview')({ lightweight: false });
    assert.equal(fullNonForce.ok, true);
    assert.equal(Boolean(fullNonForce.lightweight), false);
    assert.equal(queryCalls, 1, '15s 内非 force overview 应复用 queryLiveWindow 缓存');
    assert.equal(quotaCalls, 1);
    assert.equal(tokensCalls, 1);
    assert.equal(unlockCalls, 1);

    // 3. /api/refresh (force: true) 必须绕过 TTL 缓存并忽略 lightweight
    const forced = await posts.get('/api/refresh')({ lightweight: true });
    assert.equal(forced.ok, true);
    assert.equal(Boolean(forced.lightweight), false);
    assert.equal(queryCalls, 2, '/api/refresh 必须绕过 queryLiveWindow 缓存');
    assert.equal(quotaCalls, 2);

    await srv.close();
  } finally {
    fs.rmSync(tmpAg, { recursive: true, force: true });
  }
});
