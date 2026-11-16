'use strict';
// 本地开发与实时会话桥接服务。常规启动时由 Electron IPC 接管。
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { connect } = require('./local-api');
const {
  collect,
  collectTokenHistoryAsync,
  fetchQuotaSnapshotFromHost,
  recordModelCalls,
  getPluginSettings,
  savePluginSettings,
  launchCliSession,
  getContextUnlockStatus,
  applyContextUnlockAsync,
  restoreContextUnlockAsync
} = require('./meter-collector');
const { normalizeProxyUrl, normalizeBypassListForCompare, parseAndValidateProxyUrl } = require('./meter-proxy');
const { getStateDir } = require('./asar-engine');

const liveBootProxySnapshot = (() => {
  const bootInfo = (typeof globalThis !== 'undefined' && globalThis.__AG_PROXY_BOOT_INFO__ && globalThis.__AG_PROXY_BOOT_INFO__.injectedAtStartup)
    ? globalThis.__AG_PROXY_BOOT_INFO__
    : null;
  if (bootInfo) {
    return {
      injectedAtStartup: true,
      enabled: Boolean(bootInfo.active && bootInfo.proxyUrl),
      proxyUrl: bootInfo.proxyUrl || null,
      bypassList: typeof bootInfo.bypassList === 'string' ? bootInfo.bypassList : null
    };
  }
  const envProxy = normalizeProxyUrl(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || '');
  const envBypass = String(process.env.NO_PROXY || process.env.no_proxy || '').trim() || null;
  return {
    injectedAtStartup: false,
    enabled: Boolean(envProxy),
    proxyUrl: envProxy || null,
    bypassList: envBypass
  };
})();

const liveBootChineseSnapshots = new Map();

function resolveLiveBootChineseSnapshot(customAsarPath = null) {
  const key = `${String(process.env.AG_METER_STATE_DIR || '__default__')}::${customAsarPath || ''}`;
  if (liveBootChineseSnapshots.has(key)) return liveBootChineseSnapshots.get(key);
  let snap = { enabled: false, language: 'en' };
  try {
    const { loadModulesConfig, inspectDiskModules } = require('./modules-config');
    const cfg = loadModulesConfig();
    const disk = inspectDiskModules(customAsarPath || null);
    const ch = cfg?.modules?.chinese || {};
    const diskReady = disk.chineseReady !== undefined ? Boolean(disk.chineseReady) : Boolean(disk.chinese);
    const active = Boolean(ch.enabled && String(ch.language || '').toLowerCase() !== 'en' && diskReady);
    snap = {
      enabled: active,
      language: String(ch.language || (ch.enabled ? 'zh-CN' : 'en'))
    };
  } catch {}
  liveBootChineseSnapshots.set(key, snap);
  return snap;
}
try { resolveLiveBootChineseSnapshot(); } catch {}

function buildLiveRuntimeModulesMeta(cfg, customAsarPath = null) {
  const diskProxy = cfg?.modules?.proxy || {};
  const diskEnabled = Boolean(diskProxy.enabled);
  const diskUrl = normalizeProxyUrl(diskProxy.proxyUrl || '');
  const diskBypass = normalizeBypassListForCompare(diskProxy.bypassList || '');
  const runtimeEnabled = Boolean(liveBootProxySnapshot.enabled);
  const runtimeUrl = normalizeProxyUrl(liveBootProxySnapshot.proxyUrl || '');
  const runtimeBypass = normalizeBypassListForCompare(liveBootProxySnapshot.bypassList || '');
  const proxyNeedsRestart = runtimeEnabled !== diskEnabled ||
    (diskEnabled && runtimeEnabled && (diskUrl !== runtimeUrl || diskBypass !== runtimeBypass));
  const bootZh = resolveLiveBootChineseSnapshot(customAsarPath);
  const diskCh = cfg?.modules?.chinese || {};
  const diskZhActive = Boolean(diskCh.enabled && String(diskCh.language || '').toLowerCase() !== 'en');
  return {
    injectedAtStartup: Boolean(liveBootProxySnapshot.injectedAtStartup),
    proxyActive: runtimeEnabled,
    runtimeProxyUrl: runtimeUrl || null,
    runtimeBypassList: typeof liveBootProxySnapshot.bypassList === 'string' ? liveBootProxySnapshot.bypassList : null,
    proxyNeedsRestart,
    chineseActive: Boolean(bootZh.enabled),
    chineseBootLanguage: bootZh.language,
    chineseNeedsRestart: diskZhActive !== Boolean(bootZh.enabled)
  };
}

const MAX_BODY_BYTES = 1024 * 1024; // 1MB 传输体积上限
const MAX_RECORD_CALLS = 500; // 单批次最大记录数
const ALLOWED_ROUTES = [
  '/scan',
  '/token-history',
  '/quota',
  '/record-calls',
  '/get-settings',
  '/save-settings',
  '/launch-cli',
  '/context-unlock-status',
  '/context-unlock-apply',
  '/context-unlock-restore',
  '/enhance-status',
  '/enhance-apply',
  '/enhance-restore',
  '/restart-language-servers',
  '/modules-status',
  '/toggle-module',
  '/test-proxy',
  '/restart-host',
  '/sidecar-chinese-toggle'
];

function createLiveRequestHandler(arg1, arg2) {
  const opts = (arg1 && typeof arg1 === 'object' && arg1.api && arg1.secret)
    ? arg1
    : { api: arg1, secret: arg2, managed: false };
  const { api, secret } = opts;
  const isManagedSidecar = opts.managed === true;
  return async (req, res) => {
    const origin = req.headers.origin;
    if (origin !== api.origin) { res.writeHead(403); res.end(); return; }
    res.setHeader('Access-Control-Allow-Origin', api.origin);
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-AG-Context-Token');
      res.writeHead(204); res.end(); return;
    }
    if (req.method !== 'POST' || !ALLOWED_ROUTES.includes(req.url) || req.headers['x-ag-context-token'] !== secret) { res.writeHead(403); res.end(); return; }
    let body = '';
    let bodyLength = 0;
    let exceeded = false;
    req.on('data', chunk => {
      bodyLength += chunk.length;
      if (bodyLength > MAX_BODY_BYTES) {
        exceeded = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '请求体积超出限制（最大 1MB）' }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', async () => {
      if (exceeded) return;
      try {
        const request = JSON.parse(body || '{}');
        if (req.url === '/record-calls') {
          const calls = Array.isArray(request.calls) ? request.calls : [];
          if (calls.length > MAX_RECORD_CALLS) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: `单次入账记录数超出上限（最多 ${MAX_RECORD_CALLS} 条）` }));
            return;
          }
          const resCall = recordModelCalls(calls);
          if (resCall && typeof resCall === 'object' && resCall.ok === false) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: false,
              changed: false,
              error: resCall.error || '入账落盘失败',
              ...(resCall.phase ? { phase: resCall.phase } : {}),
              ...(resCall.code ? { code: resCall.code } : {})
            }));
            return;
          }
          const changed = (resCall && typeof resCall === 'object') ? !!resCall.changed : !!resCall;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, changed }));
          return;
        }
        if (req.url === '/get-settings') {
          const result = getPluginSettings(request);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/save-settings') {
          const result = savePluginSettings(request);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/launch-cli') {
          const result = await launchCliSession(request);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/context-unlock-status') {
          const result = await getContextUnlockStatus(undefined, request || {});
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
          return;
        }
        if (req.url === '/context-unlock-apply') {
          const opts = { ...(request || {}) };
          if (opts.syncConfigFiles === undefined && !opts.backupDir) opts.syncConfigFiles = true;
          const result = await applyContextUnlockAsync(opts);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/context-unlock-restore') {
          const opts = { ...(request || {}) };
          if (opts.syncConfigFiles === undefined && !opts.backupDir) opts.syncConfigFiles = true;
          const result = await restoreContextUnlockAsync(opts);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/enhance-status') {
          const { getEnhanceStatusAsync } = require('./meter-enhance');
          const result = await getEnhanceStatusAsync(request || {});
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
          return;
        }
        if (req.url === '/enhance-apply') {
          const { applyEnhancePatchAsync } = require('./meter-enhance');
          const result = await applyEnhancePatchAsync(request || {});
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/enhance-restore') {
          const { restoreAllEnhanceAsync } = require('./meter-enhance');
          const result = await restoreAllEnhanceAsync(request || {});
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/restart-language-servers') {
          const { restartLanguageServersAsync } = require('./meter-enhance');
          const result = await restartLanguageServersAsync();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/test-proxy') {
          const { testProxyHealth } = require('./modules-config');
          const report = await testProxyHealth(request?.proxyUrl);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: report }));
          return;
        }
        if (req.url === '/modules-status') {
          const { loadModulesConfig, inspectDiskModules } = require('./modules-config');
          const cfg = loadModulesConfig();
          const customAsarPath = request?.asarPath || null;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            data: cfg,
            disk: inspectDiskModules(customAsarPath),
            runtime: buildLiveRuntimeModulesMeta(cfg, customAsarPath),
            configCorrupted: Boolean(cfg.__configCorrupted),
            configError: cfg.__configError || null,
            corruptedConfigPath: cfg.__corruptedConfigPath || null
          }));
          return;
        }
        if (req.url === '/sidecar-chinese-toggle') {
          const enable = Boolean(request?.enable);
          const saveRes = savePluginSettings({ sidecarChinese: enable, email: request?.email });
          if (!saveRes || !saveRes.ok) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: saveRes?.error || '保存汉化设置失败' }));
            return;
          }
          try {
            const { loadModulesConfig, saveModulesConfig } = require('./modules-config');
            const cfg = loadModulesConfig();
            cfg.modules.chinese.enabled = enable;
            cfg.modules.chinese.language = enable ? 'zh-CN' : 'en';
            cfg.modules.chinese.lastUpdated = new Date().toISOString();
            saveModulesConfig(cfg);
          } catch {}
          let injected = false;
          if (enable) {
            const { tryHotInject } = require('./install');
            injected = await tryHotInject({ onlyChinese: true, injectChinese: true });
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            enabled: enable,
            injected,
            restartRequired: !enable,
            uiPreferences: saveRes.uiPreferences
          }));
          return;
        }
        if (req.url === '/toggle-module') {
          const { loadModulesConfig, saveModulesConfig, inspectDiskModules, normalizeBrandTitle, normalizeClientLanguage } = require('./modules-config');
          const cfg = loadModulesConfig();
          const mod = request?.name;
          if (!cfg.modules[mod]) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: `未知模块: ${mod}` }));
            return;
          }
          const extra = request?.opts || {};
          const targetEnable = Boolean(request?.enable);
          const customAsarPath = extra.asarPath || null;
          const disk = inspectDiskModules(customAsarPath);
          const hasDiskCapability = mod === 'chinese'
            ? Boolean(disk.chineseReady)
            : (mod === 'proxy' ? Boolean(disk.proxyReady) : Boolean(disk.meterReady));

          // Sidecar 免改盘托管模式下，若客户端 ASAR 未注入汉化但用户点击语言切换，直接走 Sidecar 运行时热注入与设置保存
          if (isManagedSidecar && mod === 'chinese' && !hasDiskCapability && !customAsarPath) {
            const nextLang = normalizeClientLanguage(extra.language, targetEnable);
            const nextEnabled = nextLang === 'zh-CN';
            cfg.modules.chinese.language = nextLang;
            cfg.modules.chinese.enabled = nextEnabled;
            if (extra.brandTitle !== undefined) cfg.modules.chinese.brandTitle = normalizeBrandTitle(extra.brandTitle);
            cfg.modules.chinese.lastUpdated = new Date().toISOString();
            saveModulesConfig(cfg);
            savePluginSettings({ sidecarChinese: nextEnabled });
            let injected = false;
            if (nextEnabled) {
              const { tryHotInject } = require('./install');
              injected = await tryHotInject({ onlyChinese: true, injectChinese: true });
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ok: true,
              status: 'config_toggled',
              data: cfg,
              disk,
              runtime: buildLiveRuntimeModulesMeta(cfg, null),
              injected,
              restartRequired: !nextEnabled,
              message: nextEnabled ? '已启用免改盘中文界面并触发即时注入' : '已关闭中文界面，重启或重载后恢复英文'
            }));
            return;
          }

          // 在热挂载模式或未持久化注入下尝试开启未注入模块时，给出可执行的外部补装指引，不假报切换成功
          if (targetEnable && !hasDiskCapability) {
            const modLabel = mod === 'chinese' ? '汉化' : (mod === 'proxy' ? '免 TUN 代理' : '核心监控');
            const subCmd = mod === 'proxy' ? 'proxy:enable' : (mod === 'chinese' ? 'chinese:enable' : 'install');
            const cmdHint = process.platform === 'win32'
              ? `在插件目录打开终端运行 install.bat 或 node cli.js ${subCmd}`
              : `在插件目录打开终端运行 node cli.js ${subCmd}`;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ok: false,
              status: 'install_failed',
              data: cfg,
              disk,
              runtime: buildLiveRuntimeModulesMeta(cfg, customAsarPath),
              error: `当前客户端磁盘 ASAR 未注入${modLabel}组件（或组件不完整）。请先彻底退出 Antigravity（包含系统托盘），再${cmdHint} 完成持久化注入。`,
              restartRequired: false
            }));
            return;
          }

          // 在写盘更改前先确保本生命周期启动汉化快照已捕获
          resolveLiveBootChineseSnapshot(customAsarPath);
          const prevChineseEnabled = Boolean(cfg.modules.chinese?.enabled);
          const prevChineseLang = cfg.modules.chinese?.language || (prevChineseEnabled ? 'zh-CN' : 'en');
          if (mod === 'chinese') {
            const nextLang = normalizeClientLanguage(extra.language, targetEnable);
            cfg.modules.chinese.language = nextLang;
            cfg.modules.chinese.enabled = nextLang === 'zh-CN';
            if (extra.brandTitle !== undefined) cfg.modules.chinese.brandTitle = normalizeBrandTitle(extra.brandTitle);
            cfg.modules.chinese.lastUpdated = new Date().toISOString();
          } else {
            if (mod === 'proxy' && extra.proxyUrl !== undefined) {
              const check = parseAndValidateProxyUrl(extra.proxyUrl);
              if (!check.ok) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  ok: false,
                  status: 'invalid_config',
                  error: check.error,
                  data: cfg,
                  runtime: buildLiveRuntimeModulesMeta(cfg, customAsarPath)
                }));
                return;
              }
              cfg.modules.proxy.proxyUrl = check.value;
            }
            cfg.modules[mod].enabled = targetEnable;
            if (mod === 'proxy') {
              if (typeof extra.bypassList === 'string') {
                cfg.modules.proxy.bypassList = extra.bypassList.trim();
              }
              cfg.modules.proxy.lastUpdated = new Date().toISOString();
            }
          }
          saveModulesConfig(cfg);
          const runtime = buildLiveRuntimeModulesMeta(cfg, customAsarPath);
          const langChanged = mod === 'chinese' && (
            Boolean(cfg.modules.chinese.enabled) !== prevChineseEnabled ||
            cfg.modules.chinese.language !== prevChineseLang
          );
          const brandOnlyUpdate = mod === 'chinese' && extra.brandTitle !== undefined && !langChanged;
          const restartRequired = mod === 'proxy'
            ? Boolean(runtime.proxyNeedsRestart)
            : (brandOnlyUpdate ? false : Boolean(runtime.chineseNeedsRestart));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            status: 'config_toggled',
            data: cfg,
            disk,
            runtime,
            restartRequired
          }));
          return;
        }
        if (req.url === '/restart-host') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, supported: false }));
          return;
        }
        if (req.url === '/token-history') {
          const data = await collectTokenHistoryAsync({ force: request.force === true });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data }));
          return;
        }
        if (req.url === '/quota') {
          const resData = await fetchQuotaSnapshotFromHost({ force: request.force === true });
          const { _raw, ...safeData } = resData || {};
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: safeData }));
          return;
        }
        const data = await collect(api.origin, request.id, { force: request.force === true });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, data }));
      }
      catch (e) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: false, error: e.message })); }
    });
  };
}

async function startLiveHostServer(options = {}) {
  const api = options.api || await connect();
  const secret = crypto.randomBytes(32).toString('hex');
  const stamp = options.stampPath || path.join(getStateDir(), '.live-session.json');
  const server = http.createServer(createLiveRequestHandler({ api, secret, managed: Boolean(options.managed) }));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const info = { port: server.address().port, token: secret, pid: process.pid, origin: api.origin, startedAt: Date.now() };
  fs.writeFileSync(stamp, JSON.stringify(info));
  if (!options.quiet) {
    console.log('Context Meter local bridge ready on loopback port ' + info.port);
  }

  let check = null;
  let closed = false;
  const close = () => {
    if (closed) return Promise.resolve();
    closed = true;
    if (check) {
      clearInterval(check);
      check = null;
    }
    try {
      if (fs.existsSync(stamp)) {
        const cur = JSON.parse(fs.readFileSync(stamp, 'utf8'));
        if (cur && cur.pid === process.pid && cur.token === secret) {
          fs.unlinkSync(stamp);
        }
      }
    } catch {}
    return new Promise(resolve => {
      try {
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        server.close(() => resolve());
      } catch {
        resolve();
      }
    });
  };

  if (!options.managed) {
    let misses = 0;
    check = setInterval(async () => {
      try { const a = await connect(); if (a.origin !== api.origin) throw new Error('App restarted'); misses = 0; }
      catch {
        if (++misses >= 3) {
          await close();
          process.exit(0);
        }
      }
    }, 10000);
  }

  return { ...info, stampPath: stamp, server, close };
}

async function startLiveHost(options = {}) {
  return await startLiveHostServer(options);
}

if (require.main === module) {
  startLiveHost().catch(e => { console.error(e.message); process.exitCode = 1; });
}

module.exports = {
  buildLiveRuntimeModulesMeta,
  createLiveRequestHandler,
  startLiveHost,
  startLiveHostServer
};
