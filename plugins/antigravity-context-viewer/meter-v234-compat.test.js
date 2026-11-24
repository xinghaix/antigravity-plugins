'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const vm = require('node:vm');

const isolatedAppData = path.join(os.tmpdir(), 'ag-meter-v234-test-appdata');
fs.mkdirSync(isolatedAppData, { recursive: true });
process.env.APPDATA = isolatedAppData;
process.env.AG_METER_TEST_MODE = '1';

const { builtinAsar } = require('./asar-engine');
const { install } = require('./install');
const { restore } = require('./restore');
const {
  TAGS,
  cleanUtilsSource,
  findWindowLoadHookTarget,
  injectWindowLoadHook,
  verifyCleanStructure,
  validateSyntax
} = require('./modular-installer');
const localApi = require('./local-api');
const collector = require('./meter-collector');

test('PR #67: preserve awaited, qualified and multiline host loader calls', () => {
  for (const call of [
    '    await loadHubWindowUrl(win, url, options);',
    '    void hub.loadHubWindowUrl(win, url);',
    '    await (0, hub.loadHubWindowUrl)(win, url, {\r\n        skipBootstrapMint\r\n    });'
  ]) {
    assert.equal(injectWindowLoadHook(call, '    hook();\n'), '    hook();\n' + call);
    assert.equal(findWindowLoadHookTarget(call + '\n' + call), null);
  }
});

const SAMPLE_V234_UTILS = `"use strict";
exports.loadHubWindowUrl = loadHubWindowUrl;
async function loadHubWindowUrl(win, targetUrl, options) {
    await win.loadURL(targetUrl);
}
function setupNodeWrapper(env) {
    return env;
}
function createWindow(url, storageManager, options) {
    const windowOptions = {
        titleBarStyle: 'hidden',
    };
    const skipBootstrapMint = Boolean(options?.partition || options?.navigationPolicy);
    void loadHubWindowUrl(win, url, { skipBootstrapMint });
    return win;
}
`;

async function createMockAsar(dir, version, utilsSource) {
  const rand = Math.random().toString(36).slice(2, 8);
  const src = path.join(dir, `src-${version}-${rand}`);
  fs.mkdirSync(path.join(src, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(src, 'package.json'), JSON.stringify({ name: 'antigravity', version }), 'utf8');
  fs.writeFileSync(path.join(src, 'dist', 'utils.js'), utilsSource, 'utf8');
  fs.writeFileSync(path.join(src, 'dist', 'preload.js'), '"use strict";\nconst electron_1 = require("electron");\n', 'utf8');
  const out = path.join(dir, `app-${version}-${rand}.asar`);
  await builtinAsar.createPackageWithOptions(src, out, {});
  fs.rmSync(src, { recursive: true, force: true });
  return out;
}

// ============================================================================
// 1. Antigravity 2.34.0 窗口加载锚点识别、安装、升级与原位卸载
// ============================================================================

test('modular-installer 兼容 2.34.0 loadHubWindowUrl 锚点并拒绝缺失或歧义结构', () => {
  const target234 = findWindowLoadHookTarget(SAMPLE_V234_UTILS);
  assert.ok(target234);
  assert.equal(target234.kind, 'hub_loader_v234');
  assert.equal(verifyCleanStructure(SAMPLE_V234_UTILS), true);

  // 兼容 CRLF 换行
  const crlfUtils = SAMPLE_V234_UTILS.replace(/\n/g, '\r\n');
  assert.equal(verifyCleanStructure(crlfUtils), true);

  // 注入必须完整保留 loadHubWindowUrl(..., { skipBootstrapMint }) 原文
  const hook = `${TAGS.METER_UTILS_START}\n    require("./meter-main").installContextMeter(win);\n${TAGS.METER_UTILS_END}\n`;
  const injected = injectWindowLoadHook(SAMPLE_V234_UTILS, hook);
  assert.ok(injected.includes('void loadHubWindowUrl(win, url, { skipBootstrapMint });'));
  assert.ok(injected.includes('installContextMeter(win)'));
  assert.equal(validateSyntax(injected, 'dist/utils.js'), true);

  // 清洗后应完全恢复结构且校验通过
  const cleaned = cleanUtilsSource(injected);
  assert.equal(verifyCleanStructure(cleaned), true);
  assert.ok(!cleaned.includes('installContextMeter'));
  assert.ok(cleaned.includes('void loadHubWindowUrl(win, url, { skipBootstrapMint });'));

  // 歧义拒绝：同时包含旧版与新版锚点
  const bothMarkers = SAMPLE_V234_UTILS.replace(
    'return win;',
    '    void win.loadURL(url);\n    return win;'
  );
  assert.equal(findWindowLoadHookTarget(bothMarkers), null);
  assert.equal(verifyCleanStructure(bothMarkers), false);

  // 歧义拒绝：重复出现两次 loadHubWindowUrl(win, url, ...)
  const dupHub = SAMPLE_V234_UTILS.replace(
    'return win;',
    '    void loadHubWindowUrl(win, url, { skipBootstrapMint });\n    return win;'
  );
  assert.equal(findWindowLoadHookTarget(dupHub), null);
  assert.equal(verifyCleanStructure(dupHub), false);
});

test('Antigravity 2.34.0 ASAR 端到端安装、原位重装与无损原位还原全闭环', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-v234-install-'));
  const prevStateDir = process.env.AG_METER_STATE_DIR;
  process.env.AG_METER_STATE_DIR = path.join(tmpDir, 'state');
  t.after(() => {
    if (prevStateDir === undefined) delete process.env.AG_METER_STATE_DIR;
    else process.env.AG_METER_STATE_DIR = prevStateDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const asarPath = await createMockAsar(tmpDir, '2.34.0', SAMPLE_V234_UTILS);

  // 1. 首次安装
  const manifest1 = await install({ path: asarPath, pureMeterOnly: true });
  assert.equal(manifest1.version, '2.34.0');
  const patchedUtils1 = builtinAsar.extractFile(asarPath, 'dist/utils.js').toString('utf8');
  assert.ok(patchedUtils1.includes('installContextMeter(win)'));
  assert.ok(patchedUtils1.includes('void loadHubWindowUrl(win, url, { skipBootstrapMint });'));
  new vm.Script(patchedUtils1, { filename: 'dist/utils.js' });

  // 2. 再次安装（走原位清洗重装路径）
  const manifest2 = await install({ path: asarPath, pureMeterOnly: true });
  assert.equal(manifest2.version, '2.34.0');
  const patchedUtils2 = builtinAsar.extractFile(asarPath, 'dist/utils.js').toString('utf8');
  assert.equal(patchedUtils2.split('installContextMeter(win)').length, 2, '重装不得重复堆叠挂载点');
  assert.ok(patchedUtils2.includes('void loadHubWindowUrl(win, url, { skipBootstrapMint });'));
  new vm.Script(patchedUtils2, { filename: 'dist/utils.js' });

  // 3. 原位卸载还原
  const resRestore = await restore({ path: asarPath, inPlace: true });
  assert.equal(resRestore.inPlaceCleaned, true);
  const restoredUtils = builtinAsar.extractFile(asarPath, 'dist/utils.js').toString('utf8');
  assert.equal(verifyCleanStructure(restoredUtils), true);
  assert.ok(!restoredUtils.includes('installContextMeter'));
  assert.ok(restoredUtils.includes('void loadHubWindowUrl(win, url, { skipBootstrapMint });'));
});

// ============================================================================
// 2. Antigravity 2.34.0 空 HTML csrfToken 下的鉴权解析与安全边界
// ============================================================================

test('local-api 在 2.34.0 空 HTML csrfToken 下通过同源 authBootstrap 鉴权并严格隔离不同端口/非回环地址', async (t) => {
  let activeToken = 'ls-admin-token-v1';
  let rpcCount = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<script>window.__APP_CONFIG__ = {"productName":"antigravity","csrfToken":"","appVersion":"2.34.0"};</script>');
      return;
    }
    if (req.url.includes('/GetUserStatus')) {
      rpcCount++;
      const got = req.headers['x-codeium-csrf-token'];
      if (got !== activeToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ userStatus: { email: 'v234@example.com' } }));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  // 2.1 精确同源 authBootstrap 解析成功
  const mockAuthBootstrap = {
    getActiveLsBaseUrl: () => origin,
    getActiveLsCsrfToken: () => activeToken
  };
  const api = await localApi.connect({ origin, authBootstrap: mockAuthBootstrap, allowDaemonFallback: false });
  const r1 = await api.call('GetUserStatus', {});
  assert.equal(r1.userStatus.email, 'v234@example.com');

  // 2.2 令牌轮换导致 401 时自动刷新重试一次
  activeToken = 'ls-admin-token-v2';
  const r2 = await api.call('GetUserStatus', {});
  assert.equal(r2.userStatus.email, 'v234@example.com');
  assert.equal(rpcCount, 3, '应触发 1 次 401 刷新重试并成功');

  // 2.3 端口不匹配时严禁泄露主进程令牌
  const wrongPortAuth = {
    getActiveLsBaseUrl: () => `http://127.0.0.1:${port + 1}`,
    getActiveLsCsrfToken: () => activeToken
  };
  assert.equal(localApi.resolveAuthBootstrapForOrigin(origin, { authBootstrap: wrongPortAuth }), null);
  await assert.rejects(
    () => localApi.connect({ origin, authBootstrap: wrongPortAuth, allowDaemonFallback: false }),
    /本地鉴权信息尚未就绪/
  );

  // 2.4 非回环地址严禁解析
  assert.equal(localApi.resolveAuthBootstrapForOrigin('https://example.com', { authBootstrap: mockAuthBootstrap }), null);
  await assert.rejects(
    () => localApi.connect({ origin: 'https://example.com', authBootstrap: mockAuthBootstrap }),
    /非法的本机回环页面地址/
  );

  // 2.5 无凭证来源时保留原有鉴权错误语义
  await assert.rejects(
    () => localApi.connect({ origin, authBootstrap: null, allowDaemonFallback: false }),
    /本地鉴权信息尚未就绪/
  );
});

test('local-api 在无 CDP 时回退至 authBootstrap 与存活 daemon/hub_*.json（忽略死进程）', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-v234-daemon-'));
  const daemonDir = path.join(tmpDir, 'daemon');
  const appDataDir = path.join(tmpDir, 'appdata');
  fs.mkdirSync(daemonDir, { recursive: true });
  fs.mkdirSync(path.join(appDataDir, 'Antigravity'), { recursive: true });
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<script>window.__APP_CONFIG__ = {"csrfToken":""};</script>');
      return;
    }
    if (req.headers['x-codeium-csrf-token'] === 'live-daemon-csrf') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(401);
    res.end('unauthorized');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const port = server.address().port;

  // 写入一个死进程 hub（应忽略）与一个存活进程 hub（应命中）
  fs.writeFileSync(
    path.join(daemonDir, 'hub_dead.json'),
    JSON.stringify({ pid: 999991, httpPort: port, csrfToken: 'dead-csrf' })
  );
  fs.writeFileSync(
    path.join(daemonDir, 'hub_live.json'),
    JSON.stringify({ pid: 424242, httpPort: port, csrfToken: 'live-daemon-csrf' })
  );

  const api = await localApi.connect({
    appDataDir,
    daemonDir,
    authBootstrap: null,
    isPidAlive: pid => pid === 424242
  });
  assert.equal(api.origin, `http://127.0.0.1:${port}`);
  const rpcRes = await api.call('GetUserStatus', {});
  assert.equal(rpcRes.ok, true);
});

test('local-api 在 CDP 模式下即使 HTML csrfToken 为空仍调用 CDP 提取已鉴权页面的会话令牌', async (t) => {
  let cdpPort = 0;
  let hubPort = 0;

  const hubServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<script>window.__APP_CONFIG__ = {"csrfToken":""};</script>');
      return;
    }
    if (req.headers['x-codeium-csrf-token'] === 'cdp-bootstrapped-session-token') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(401);
    res.end('unauthorized');
  });
  await new Promise(r => hubServer.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => hubServer.close(r)));
  hubPort = hubServer.address().port;

  // 构造最小 RFC 6455 CDP 服务器，模拟 2.34.0 页面完成 bootstrap 后的 window.__APP_CONFIG__ / localStorage
  const openSockets = new Set();
  const cdpServer = http.createServer((req, res) => {
    if (req.url === '/json/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{
        type: 'page',
        url: `http://127.0.0.1:${hubPort}/`,
        webSocketDebuggerUrl: `ws://127.0.0.1:${cdpPort}/devtools/page/1`
      }]));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  cdpServer.on('upgrade', (req, socket) => {
    openSockets.add(socket);
    socket.on('close', () => openSockets.delete(socket));
    const key = req.headers['sec-websocket-key'];
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    let buf = Buffer.alloc(0);
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length < 6) return;
      const opcode = buf[0] & 0x0f;
      if (opcode === 0x8) {
        try { socket.end(); } catch {}
        return;
      }
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      }
      const maskLen = masked ? 4 : 0;
      if (buf.length < off + maskLen + len) return;
      const payload = Buffer.from(buf.subarray(off + maskLen, off + maskLen + len));
      if (masked) {
        const mask = buf.subarray(off, off + 4);
        for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
      }
      buf = buf.subarray(off + maskLen + len);
      const msg = JSON.parse(payload.toString('utf8'));
      const reply = Buffer.from(JSON.stringify({
        id: msg.id,
        result: { result: { value: { hasConfig: true, csrfToken: 'cdp-bootstrapped-session-token' } } }
      }), 'utf8');
      const header = reply.length < 126
        ? Buffer.from([0x81, reply.length])
        : Buffer.from([0x81, 126, (reply.length >> 8) & 0xff, reply.length & 0xff]);
      socket.write(Buffer.concat([header, reply]));
    });
  });
  await new Promise(r => cdpServer.listen(0, '127.0.0.1', r));
  t.after(() => {
    for (const s of openSockets) { try { s.destroy(); } catch {} }
    return new Promise(r => cdpServer.close(r));
  });
  cdpPort = cdpServer.address().port;

  const api = await localApi.connect({ port: cdpPort, strictPort: true, authBootstrap: null, allowDaemonFallback: false });
  assert.equal(api.origin, `http://127.0.0.1:${hubPort}`);
  const out = await api.call('GetUserStatus', {});
  assert.equal(out.ok, true);
});

// ============================================================================
// 3. meter-collector 在 2.34.0 空 HTML csrfToken 下完成会话扫描与额度获取
// ============================================================================

test('meter-collector.collect 与 fetchQuotaSnapshotFromHost 在 2.34.0 下通过 authBootstrap 正常完成扫描与 401 自愈', async (t) => {
  let currentToken = 'collect-tok-1';
  let trajectoryCalls = 0;
  let unauthorized401Count = 0;
  const cascadeId = '11111111-2222-3333-4444-555555555555';

  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<script>window.__APP_CONFIG__ = {"productName":"antigravity","csrfToken":"","appVersion":"2.34.0"};</script>');
      return;
    }
    const got = req.headers['x-codeium-csrf-token'];
    if (got !== currentToken) {
      unauthorized401Count++;
      res.writeHead(401);
      res.end('unauthorized');
      return;
    }
    if (req.url.endsWith('/GetCascadeTrajectory')) {
      trajectoryCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        numTotalSteps: 1,
        trajectory: {
          steps: [{
            type: 'CORTEX_STEP_TYPE_USER_INPUT',
            userInput: { items: [{ text: 'hello v2.34.0' }] }
          }]
        }
      }));
      return;
    }
    if (req.url.endsWith('/GetCascadeTrajectoryGeneratorMetadata')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ generatorMetadata: [] }));
      return;
    }
    if (req.url.includes('/GetUserStatus')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        userStatus: {
          email: 'quota234@example.com',
          userTier: { id: 'g1-pro-tier', name: 'Google AI Pro', description: 'Google AI Pro' },
          planStatus: { planInfo: { planName: 'Pro', teamsTier: 'TEAMS_TIER_PRO' } },
          cascadeModelConfigData: {
            clientModelConfigs: [{
              label: 'Gemini 4 Carbon (High)',
              modelOrAlias: { model: 'MODEL_PLACEHOLDER_M427' },
              quotaInfo: { remainingFraction: 0.88, resetTime: '2026-11-22T00:00:00Z' }
            }]
          }
        }
      }));
      return;
    }
    if (req.url.includes('/RetrieveUserQuotaSummary')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const mockAuthBootstrap = {
    getActiveLsBaseUrl: () => origin,
    getActiveLsCsrfToken: () => currentToken
  };

  // 3.1 collect 首次扫描成功
  const scan1 = await collector.collect(origin, cascadeId, {
    force: true,
    authBootstrap: mockAuthBootstrap,
    allowDaemonFallback: false
  });
  assert.equal(scan1.conversation, cascadeId);
  assert.ok(scan1.session);

  // 3.2 令牌轮换后再次 collect（复用旧缓存触发 401 -> 自动从 authBootstrap 刷新并重试成功）
  currentToken = 'collect-tok-2';
  const scan2 = await collector.collect(origin, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', {
    authBootstrap: mockAuthBootstrap,
    allowDaemonFallback: false
  });
  assert.equal(scan2.conversation, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(trajectoryCalls, 2);
  assert.equal(unauthorized401Count, 1, '令牌轮换后应仅触发 1 次 401 并自愈成功');

  // 3.3 fetchQuotaSnapshotFromHost 在 2.34.0 空 HTML 下正常返回额度
  const quotaRes = await collector.fetchQuotaSnapshotFromHost({
    force: true,
    origin,
    authBootstrap: mockAuthBootstrap,
    allowDaemonFallback: false
  });
  assert.equal(quotaRes.ok, true);
  assert.equal(quotaRes.error, null);
  assert.equal(quotaRes._raw?.planStatus?.email, 'quota234@example.com');
  assert.equal(quotaRes.planTierSummary?.planName, 'Pro');
  assert.ok(Array.isArray(quotaRes.cascadeModelConfigs) && quotaRes.cascadeModelConfigs.length === 1);
});

// ============================================================================
// 4. 渲染层在 window.__APP_CONFIG__.csrfToken 为空时回退 localStorage 会话令牌
// ============================================================================

test('渲染层在 2.34.0 空 __APP_CONFIG__.csrfToken 时自动回退 agy_session_csrf_token', () => {
  const rendererSrc = fs.readFileSync(path.join(__dirname, 'src', 'renderer', 'main.js'), 'utf8');
  assert.ok(rendererSrc.includes('function getRendererCsrfToken()'), 'src/renderer/main.js 应包含 getRendererCsrfToken');
  assert.ok(rendererSrc.includes("agy_session_csrf_token"), '应兼容 Antigravity 2.34.0 的 localStorage 会话令牌回退');
  const builtSrc = fs.readFileSync(path.join(__dirname, 'meter-renderer.js'), 'utf8');
  assert.ok(builtSrc.includes('function getRendererCsrfToken()'), '构建产物 meter-renderer.js 必须已同步更新');
});

test('PR #67 回归：2.34.0 标准备份逐字节还原及 2.33.0 升级 2.34.0 重装', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-v234-upgrade-'));
  const prevStateDir = process.env.AG_METER_STATE_DIR;
  process.env.AG_METER_STATE_DIR = path.join(tmpDir, 'state');
  t.after(() => {
    if (prevStateDir === undefined) delete process.env.AG_METER_STATE_DIR;
    else process.env.AG_METER_STATE_DIR = prevStateDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
  const SAMPLE_V233_LEGACY_UTILS = `"use strict";
function setupNodeWrapper(env) {
    return env;
}
function createWindow(url, storageManager, options) {
    void win.loadURL(url);
    return win;
}
`;

  const targetAsar = path.join(tmpDir, 'app.asar');
  const clean234 = await createMockAsar(tmpDir, '2.34.0', SAMPLE_V234_UTILS);
  const clean233 = await createMockAsar(tmpDir, '2.33.0', SAMPLE_V233_LEGACY_UTILS);

  // 1. 2.34.0 安装后执行标准备份还原，验证逐字节 SHA-256 完全一致
  fs.copyFileSync(clean234, targetAsar);
  const orig234Sha = sha256(fs.readFileSync(targetAsar));
  const m234 = await install({ path: targetAsar, pureMeterOnly: true });
  assert.equal(m234.version, '2.34.0');
  const restoreRes = await restore({ path: targetAsar });
  assert.equal(restoreRes.restored, targetAsar);
  assert.equal(sha256(fs.readFileSync(targetAsar)), orig234Sha, '标准备份还原应逐字节恢复原版 2.34.0 ASAR');

  // 2. 模拟宿主从 2.33.0 升级至 2.34.0 后重新安装
  fs.copyFileSync(clean233, targetAsar);
  const mLegacy = await install({ path: targetAsar, pureMeterOnly: true });
  assert.equal(mLegacy.version, '2.33.0');
  const patchedLegacy = builtinAsar.extractFile(targetAsar, 'dist/utils.js').toString('utf8');
  assert.ok(patchedLegacy.includes('installContextMeter(win)'));

  fs.copyFileSync(clean234, targetAsar);
  const mUpgrade = await install({ path: targetAsar, pureMeterOnly: true });
  assert.equal(mUpgrade.version, '2.34.0', '宿主升级至 2.34.0 后重装应识别新版并写入新钩子');
  const patchedUpgrade = builtinAsar.extractFile(targetAsar, 'dist/utils.js').toString('utf8');
  assert.equal(patchedUpgrade.split('installContextMeter(win)').length, 2, '升级重装不得重复注入');
  assert.ok(patchedUpgrade.includes('void loadHubWindowUrl(win, url, { skipBootstrapMint });'));
});

test('Issue #80: macOS ElectronAsarIntegrity 与签名预检及 install 完整性保护门禁', async (t) => {
  const { inspectMacAsarIntegrity } = require('./macos-binary-utils');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-mac-integrity-'));
  const prevStateDir = process.env.AG_METER_STATE_DIR;
  process.env.AG_METER_STATE_DIR = path.join(tmpDir, 'state');
  t.after(() => {
    if (prevStateDir === undefined) delete process.env.AG_METER_STATE_DIR;
    else process.env.AG_METER_STATE_DIR = prevStateDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 1. 构建模拟 macOS Antigravity.app 目录及含 ElectronAsarIntegrity 的 Info.plist
  const appDir = path.join(tmpDir, 'Antigravity.app');
  const contentsDir = path.join(appDir, 'Contents');
  const resDir = path.join(contentsDir, 'Resources');
  fs.mkdirSync(resDir, { recursive: true });
  const plistPath = path.join(contentsDir, 'Info.plist');
  fs.writeFileSync(plistPath, `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>Antigravity</string>
  <key>ElectronAsarIntegrity</key>
  <dict><key>Resources/app.asar</key><dict><key>algorithm</key><string>SHA256</string><key>hash</key><string>deadbeef</string></dict></dict>
</dict></plist>`, 'utf8');

  const clean234 = await createMockAsar(tmpDir, '2.34.0', SAMPLE_V234_UTILS);
  const macAsarPath = path.join(resDir, 'app.asar');
  fs.copyFileSync(clean234, macAsarPath);

  // 1a. 启用 ElectronAsarIntegrity + codesign 签名：识别 blocked_integrity 与 TeamIdentifier
  const infoBlocked = inspectMacAsarIntegrity(macAsarPath, {
    _platform: 'darwin',
    _execFileSync: () => 'Signature=signed\nTeamIdentifier=EQHXZ8M8AV\nflags=0x10000(runtime)\nSealed Resources version=2'
  });
  assert.equal(infoBlocked.isMacAppBundle, true);
  assert.equal(infoBlocked.hasAsarIntegrity, true);
  assert.equal(infoBlocked.integrityAlgorithm, 'SHA256');
  assert.equal(infoBlocked.signatureStatus, 'signed');
  assert.equal(infoBlocked.teamIdentifier, 'EQHXZ8M8AV');
  assert.equal(infoBlocked.hardenedRuntime, true);
  assert.equal(infoBlocked.patchRisk, 'blocked_integrity');
  assert.equal(infoBlocked.recommendedEntry, 'node cli.js watch');

  // 1b. macOS 上默认 install 必须拒改带 ElectronAsarIntegrity 的 app.asar，推荐使用 watch
  await assert.rejects(
    () => install({ path: macAsarPath, pureMeterOnly: true, _platform: 'darwin' }),
    /ElectronAsarIntegrity.*node cli\.js watch/s
  );

  // 1c. 显式 allowIntegrityOverride (--force-mac-asar) 可在自签场景放行并完成 2.34.0 注入
  const forcedManifest = await install({
    path: macAsarPath,
    pureMeterOnly: true,
    _platform: 'darwin',
    allowIntegrityOverride: true,
    silent: true
  });
  assert.equal(forcedManifest.version, '2.34.0');
  assert.equal(forcedManifest.macAsarIntegrity?.hasAsarIntegrity, true);

  // 2. 移除 ElectronAsarIntegrity 且无签名的 .app 可标记 safe 并允许安装
  fs.writeFileSync(plistPath, `<plist version="1.0"><dict><key>CFBundleExecutable</key><string>Antigravity</string></dict></plist>`, 'utf8');
  const infoSafe = inspectMacAsarIntegrity(macAsarPath, {
    _platform: 'darwin',
    _execFileSync: () => { throw new Error('code object is not signed at all'); }
  });
  assert.equal(infoSafe.hasAsarIntegrity, false);
  assert.equal(infoSafe.signatureStatus, 'unsigned');
  assert.equal(infoSafe.patchRisk, 'safe');
  assert.equal(infoSafe.recommendedEntry, 'node cli.js install');

  // 3. Info.plist 缺失 / 无法读取：标记 unknown_signature 并建议优先 watch
  fs.unlinkSync(plistPath);
  const infoUnknown = inspectMacAsarIntegrity(macAsarPath, {
    _platform: 'darwin',
    _execFileSync: () => ''
  });
  assert.equal(infoUnknown.plistExists, false);
  assert.equal(infoUnknown.hasAsarIntegrity, null);
  assert.equal(infoUnknown.patchRisk, 'unknown_signature');
  assert.equal(infoUnknown.recommendedEntry, 'node cli.js watch');
});

// ============================================================================
// 5. Antigravity 2.35.0: ANTIGRAVITY_LS_ADDRESS 直连快路径 + 磁盘静态缓存与隔离
// ============================================================================

test('2.35.0 local-api 支持 ANTIGRAVITY_LS_ADDRESS / ANTIGRAVITY_CSRF_TOKEN 严格回环直连与测试隔离', async (t) => {
  // 5.1 normalizeEnvLsOrigin 只接受合法回环地址
  assert.equal(localApi.normalizeEnvLsOrigin('localhost:56266'), 'http://127.0.0.1:56266');
  assert.equal(localApi.normalizeEnvLsOrigin('127.0.0.1:56266'), 'http://127.0.0.1:56266');
  assert.equal(localApi.normalizeEnvLsOrigin('[::1]:56266'), 'http://127.0.0.1:56266');
  assert.equal(localApi.normalizeEnvLsOrigin('https://localhost:56265'), 'https://127.0.0.1:56265');
  assert.equal(localApi.normalizeEnvLsOrigin('192.168.1.10:56266'), null);
  assert.equal(localApi.normalizeEnvLsOrigin('https://evil.example:443'), null);
  assert.equal(localApi.normalizeEnvLsOrigin('not-a-host'), null);

  // 5.2 在 NODE_TEST_CONTEXT 下未显式传入 options.env / allowEnvLsFallback 时必须返回 null 防止宿主机环境泄漏
  assert.equal(localApi.resolveEnvLsAuth(), null);
  assert.equal(localApi.resolveEnvLsAuth({
    env: { ANTIGRAVITY_LS_ADDRESS: 'localhost:56266', ANTIGRAVITY_CSRF_TOKEN: 'env-tok-1' }
  })?.origin, 'http://127.0.0.1:56266');
  assert.equal(localApi.resolveEnvLsAuthForOrigin('http://127.0.0.1:56266', {
    env: { ANTIGRAVITY_LS_ADDRESS: 'localhost:56266', ANTIGRAVITY_CSRF_TOKEN: 'env-tok-1' }
  }), 'env-tok-1');
  assert.equal(localApi.resolveEnvLsAuthForOrigin('http://127.0.0.1:59999', {
    env: { ANTIGRAVITY_LS_ADDRESS: 'localhost:56266', ANTIGRAVITY_CSRF_TOKEN: 'env-tok-1' }
  }), null, '不同端口严格禁止返回 ANTIGRAVITY_CSRF_TOKEN');

  // 5.3 通过 preferEnvLs + env 绕过 CDP 直接连接本地 mock HTTP Language Server
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<script>window.__APP_CONFIG__ = {"productName":"antigravity","csrfToken":""};</script>');
      return;
    }
    if (req.url.endsWith('/GetUserStatus')) {
      assert.equal(req.headers['x-codeium-csrf-token'], 'ls-env-secret-235');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, lsVersion: '2.35.0' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const port = server.address().port;

  const conn = await localApi.connect({
    preferEnvLs: true,
    allowDaemonFallback: false,
    authBootstrap: null,
    env: {
      ANTIGRAVITY_LS_ADDRESS: `localhost:${port}`,
      ANTIGRAVITY_CSRF_TOKEN: 'ls-env-secret-235'
    }
  });
  assert.equal(conn.origin, `http://127.0.0.1:${port}`);
  const rpcOut = await conn.call('GetUserStatus', {});
  assert.equal(rpcOut.ok, true);
  assert.equal(rpcOut.lsVersion, '2.35.0');
});

test('2.35.0 unlock/enhance 磁盘静态缓存命中与失效控制，且兼容 PE BigInt textVA 序列化', async (t) => {
  const unlockMod = require('./meter-context-unlock');
  const enhanceMod = require('./meter-enhance');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-disk-cache-'));
  const stateDir = path.join(tmpDir, 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  // 构造最小合法 Mach-O 64-bit 二进制测试容器并验证磁盘缓存写入/读取/失效
  const fakeBin = path.join(tmpDir, 'fake_language_server');
  fs.writeFileSync(fakeBin, Buffer.alloc(128, 0));

  // 对不支持/小文件返回 unsupported（无 error 异常），不写入无效缓存
  const unsup = await unlockMod.analyzeBinaryAsync(fakeBin, { stateDir, skipSha256: true, skipProcessCheck: true });
  assert.equal(unsup.status, 'unsupported');

  // 使用最小合法 PE32+ Go embed.FS 模板容器验证磁盘缓存写入、缓存命中与 invalidateBinaryCache 清理
  const buildMinimalEnhancePe = () => {
    const enhanceTestMod = require('./meter-enhance');
    const imageBase = 0x140000000n;
    const rdataRva = 0x1000;
    const rdataPtr = 0x400;
    const totalSize = 0x4000;
    const buf = Buffer.alloc(totalSize, 0);
    buf.write('MZ', 0, 'ascii');
    buf.writeUInt32LE(0x80, 0x3c);
    buf.write('PE\0\0', 0x80, 'ascii');
    buf.writeUInt16LE(0x8664, 0x84);
    buf.writeUInt16LE(1, 0x86);
    buf.writeUInt32LE(0x69100000, 0x88);
    buf.writeUInt16LE(0xf0, 0x94);
    const opt = 0x98;
    buf.writeUInt16LE(0x020b, opt);
    buf.writeBigUInt64LE(imageBase, opt + 24);
    buf.writeUInt32LE(totalSize, opt + 56);
    const secOff = opt + 0xf0;
    buf.write('.rdata\0\0', secOff, 'ascii');
    buf.writeUInt32LE(totalSize - rdataPtr, secOff + 8);
    buf.writeUInt32LE(rdataRva, secOff + 12);
    buf.writeUInt32LE(totalSize - rdataPtr, secOff + 16);
    buf.writeUInt32LE(rdataPtr, secOff + 20);
    const fileOffToVa = (off) => imageBase + BigInt(rdataRva + (off - rdataPtr));
    const fullName = 'google3/third_party/jetski/prompt/template_provider/templates/system_prompts/identity.tmpl';
    const content = 'You are Antigravity, an agentic AI coding assistant.\n';
    buf.write(fullName, 0x500, 'utf8');
    buf.write(content, 0x600, 'utf8');
    const tableBase = 0x1000;
    buf.writeBigUInt64LE(fileOffToVa(0x500), tableBase);
    buf.writeBigUInt64LE(BigInt(Buffer.byteLength(fullName, 'utf8')), tableBase + 8);
    buf.writeBigUInt64LE(fileOffToVa(0x600), tableBase + 16);
    buf.writeBigUInt64LE(BigInt(Buffer.byteLength(content, 'utf8')), tableBase + 24);
    let tc = 0x2000;
    for (const r of enhanceTestMod.CHINESE_TITLE_RULES) {
      buf.write(r.oldText, tc, 'ascii');
      tc += Buffer.byteLength(r.oldText, 'ascii') + 16;
    }
    return buf;
  };
  const mockEnhanceBin = path.join(tmpDir, 'mock_enhance_ls.exe');
  fs.writeFileSync(mockEnhanceBin, buildMinimalEnhancePe());
  const enhanceTarget = { id: 'custom', label: 'MockBin', path: mockEnhanceBin };
  const res1 = await enhanceMod.getEnhanceStatusAsync({
    targets: [enhanceTarget],
    stateDir,
    backupDir: path.join(tmpDir, 'enh-bak'),
    skipProcessCheck: true
  });
  assert.equal(res1.binaries[0].exists, true);
  assert.equal(res1.binaries[0].error, null);
  assert.equal(res1.binaries[0].slotCount, 1);
  const diskCacheFile = path.join(stateDir, '.enhance-inspect-cache-v1.json');
  assert.equal(fs.existsSync(diskCacheFile), true, '第一次扫描后应写入 .enhance-inspect-cache-v1.json');

  // invalidateBinaryCache 应同步清除磁盘缓存，二次扫描应重建并命中
  enhanceMod.invalidateBinaryCache(mockEnhanceBin, { stateDir });
  const clearedJson = JSON.parse(fs.readFileSync(diskCacheFile, 'utf8'));
  assert.equal(clearedJson.entries[path.resolve(mockEnhanceBin).toLowerCase()], undefined);
  const res2 = await enhanceMod.getEnhanceStatusAsync({
    targets: [enhanceTarget],
    stateDir,
    backupDir: path.join(tmpDir, 'enh-bak'),
    skipProcessCheck: true
  });
  assert.equal(res2.binaries[0].slotCount, 1);
  const res3 = await enhanceMod.getEnhanceStatusAsync({
    targets: [enhanceTarget],
    stateDir,
    backupDir: path.join(tmpDir, 'enh-bak'),
    skipProcessCheck: true,
    useMainThread: true
  });
  assert.equal(res3.binaries[0].slotCount, res2.binaries[0].slotCount);

  // 验证 PE BigInt textVA 通过 unlock 磁盘缓存往返不丢失类型
  // 构造一个极简含 valid MZ/PE64 + .text 的文件仅测试 serialize/deserialize via unlock cache 写入
  const cacheJsonPath = path.join(stateDir, '.unlock-inspect-cache-v1.json');
  const st = fs.statSync(fakeBin);
  const statSig = `${st.size}:${st.mtimeMs}:${st.ctimeMs ?? 0}:${st.ino ?? 0}`;
  const cacheKey = path.resolve(fakeBin).toLowerCase();
  fs.writeFileSync(cacheJsonPath, JSON.stringify({
    version: 1,
    entries: {
      [cacheKey]: {
        statSig,
        expectedLimitKey: '',
        container: { textVA: { __agBigInt: '5368713216' }, textOff: 1024, arch: 'x86-64', format: 'PE', peTimeDateStamp: 1, peSizeOfImage: 2, buildId: '1_2_400' },
        currentSha256: 'abc',
        totalSymbols: 10,
        mode: 'standalone language_server',
        gate3a: { status: 'unpatched', mode: 'default', limit: 256000, hasDefaultSite: false },
        gate3b: { status: 'unpatched', offset: 1200, length: 4 },
        serializerGate: { present: false, status: 'absent', offset: null, limit: null }
      }
    }
  }), 'utf8');
  unlockMod.invalidateUnlockCache(fakeBin, { stateDir }); // 先确认 invalidateUnlockCache 会删掉磁盘缓存
  assert.equal(JSON.parse(fs.readFileSync(cacheJsonPath, 'utf8')).entries[cacheKey], undefined);

  // 重新写入后不清，验证 analyzeBinaryAsync 直接从磁盘命中返回状态且不报错
  fs.writeFileSync(cacheJsonPath, JSON.stringify({
    version: 1,
    entries: {
      [cacheKey]: {
        statSig,
        expectedLimitKey: '',
        container: { textVA: { __agBigInt: '5368713216' }, textOff: 1024, arch: 'x86-64', format: 'PE', peTimeDateStamp: 1, peSizeOfImage: 2, buildId: '1_2_400' },
        currentSha256: 'abc',
        totalSymbols: 10,
        mode: 'standalone language_server',
        gate3a: { status: 'unpatched', mode: 'default', limit: 256000, hasDefaultSite: false },
        gate3b: { status: 'unpatched', offset: 1200, length: 4 },
        serializerGate: { present: false, status: 'absent', offset: null, limit: null }
      }
    }
  }), 'utf8');
  const hitRes = await unlockMod.analyzeBinaryAsync(fakeBin, { stateDir, backupDir: path.join(tmpDir, 'bak'), skipProcessCheck: true });
  assert.equal(hitRes.format, 'PE');
  assert.equal(hitRes.peBuildId, '1_2_400');
  assert.equal(hitRes.status, 'not_patched');
});

test('meter-collector.collect 不得用旧步骤 currentError 覆盖更新的成功 generatorMetadata，并正确清除 currentError 与输出 capturedAt', async (t) => {
  const cascadeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<script>window.__APP_CONFIG__ = {"productName":"antigravity","csrfToken":"tok-recover","appVersion":"2.35.0"};</script>');
      return;
    }
    if (req.url.endsWith('/GetCascadeTrajectory')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'CASCADE_RUN_STATUS_RUNNING',
        numTotalSteps: 2,
        numTotalGeneratorMetadata: 2,
        trajectory: {
          steps: [
            { userInput: { userResponse: 'run refactor' } },
            { errorMessage: { error: { shortError: 'request failed: Post "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse": EOF' } } }
          ]
        }
      }));
      return;
    }
    if (req.url.endsWith('/GetCascadeTrajectoryGeneratorMetadata')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        generatorMetadata: [
          {
            stepIndices: [1],
            chatModel: {
              modelDisplayName: 'Gemini 4 Neon',
              retryInfos: [{ error: 'request failed: EOF', usage: { model: 'gemini' } }]
            }
          },
          {
            stepIndices: [3],
            chatModel: {
              modelDisplayName: 'Gemini 4 Neon',
              finishReason: 'FINISH_REASON_STOP',
              timeToFirstToken: '3.2s',
              streamingDuration: '2.1s',
              usage: { inputTokens: '15000', cacheReadTokens: '420000', outputTokens: '600' },
              chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 983040 } }
            }
          }
        ]
      }));
      return;
    }
    if (req.url.includes('/GetUserStatus')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ userStatus: {} }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const data = await collector.collect(origin, cascadeId, { force: true });
  assert.equal(data.latest.error, '');
  assert.equal(data.latest.network, false);
  assert.equal(data.latest.status, 'reported');
  assert.equal(data.latest.actual, 435600);
  assert.equal(data.session.currentError, null, '更新的成功 generatorMetadata 应清除旧步骤 currentError');
  assert.equal(data.latestMetaMaxStep, 3);
  assert.ok(Number.isFinite(data.capturedAt) && data.capturedAt > 0);
});
