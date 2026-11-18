'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const LOADER_DIR = __dirname;
const UUID_RE = /^[a-f\d-]{36}$/i;

async function loadSidecarSdk() {
  try {
    return await import('sidecar_sdk');
  } catch (err) {
    const fallbackPath = path.join(
      os.homedir(),
      '.gemini',
      'antigravity',
      'lib',
      'node_modules',
      'sidecar_sdk',
      'index.mjs'
    );
    if (fs.existsSync(fallbackPath)) {
      return await import(pathToFileURL(fallbackPath).href);
    }
    throw err;
  }
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8'));
    return pkg.version || '0.8.7-2';
  } catch {
    return '0.8.7-2';
  }
}

function listRecentConversations(agDir, limit = 12) {
  const dir = path.resolve(agDir || path.join(os.homedir(), '.gemini', 'antigravity'));
  const convDir = path.join(dir, 'conversations');
  if (!fs.existsSync(convDir)) return [];
  try {
    const byId = new Map();
    for (const name of fs.readdirSync(convDir)) {
      const m = name.match(/^([a-f\d-]{36})\.(pb|db)$/i);
      if (!m) continue;
      const full = path.join(convDir, name);
      try {
        const st = fs.statSync(full);
        if (!st.isFile()) continue;
        const key = m[1].toLowerCase();
        const prev = byId.get(key);
        if (!prev || st.mtimeMs > prev.mtimeMs) {
          byId.set(key, {
            id: m[1],
            mtimeMs: st.mtimeMs,
            sizeBytes: st.size,
            title: null
          });
        }
      } catch { }
    }
    const rows = Array.from(byId.values());
    rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return rows.slice(0, limit);
  } catch {
    return [];
  }
}

function sanitizePlanMeta(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const copy = { ...plan };
  delete copy.email;
  delete copy.cascadeModelConfigs;
  delete copy.availableModelDetails;
  return copy;
}

function sanitizeTokensPayload(tokens) {
  if (!tokens || typeof tokens !== 'object') return null;
  return {
    version: tokens.version || null,
    updatedAt: tokens.updatedAt || null,
    firstUseDate: tokens.firstUseDate || null,
    summary: tokens.summary || null,
    sources: tokens.sources || null,
    planStatus: sanitizePlanMeta(tokens.planStatus),
    speedRecords: Array.isArray(tokens.speedRecords) ? tokens.speedRecords.slice(-12) : [],
    recentModelUsageCount: Array.isArray(tokens.recentModelUsage) ? tokens.recentModelUsage.length : 0
  };
}

function sanitizeUnlockPayload(unlock) {
  if (!unlock || typeof unlock !== 'object') return null;
  return {
    status: unlock.status || 'unknown',
    mode: unlock.mode || null,
    limit: unlock.limit ?? null,
    dynamicExpr: unlock.dynamicExpr || null,
    arch: unlock.arch || null,
    format: unlock.format || null,
    reason: unlock.reason || null,
    targetPath: unlock.targetPath || null,
    isPlatformSupported: unlock.isPlatformSupported !== false
  };
}

function sanitizeSettingsPayload(settings) {
  if (!settings || typeof settings !== 'object') return null;
  return {
    panelLanguage: settings.panelLanguage || 'zh-CN',
    showCliButton: settings.showCliButton === true,
    sidecarChinese: settings.sidecarChinese !== false,
    contextScopeMode: settings.contextScopeMode || 'unified',
    contextUnifiedPreference: settings.contextUnifiedPreference || { mode: 'default', limitTokens: null },
    updatedAt: settings.updatedAt || ''
  };
}

function sanitizeSidecarStatus(status) {
  if (!status || typeof status !== 'object') return null;
  return {
    installed: Boolean(status.installed),
    scriptExists: Boolean(status.scriptExists),
    sidecarDir: status.sidecarDir || null,
    logsDir: status.logsDir || null,
    runtimeLog: status.runtimeLog
      ? {
          path: status.runtimeLog.path || null,
          tail: Array.isArray(status.runtimeLog.tail) ? status.runtimeLog.tail.slice(-20) : []
        }
      : null
  };
}

function createDefaultDeps() {
  const localApi = require(path.join(PLUGIN_ROOT, 'local-api'));
  const collector = require(path.join(PLUGIN_ROOT, 'meter-collector'));
  const cli = require(path.join(PLUGIN_ROOT, 'cli'));
  const sidecarLive = require(path.join(PLUGIN_ROOT, 'sidecar-live'));
  const asarEngine = require(path.join(PLUGIN_ROOT, 'asar-engine'));
  return {
    localApi,
    collector,
    cli,
    sidecarLive,
    asarEngine
  };
}

function createUiHandlers(options = {}) {
  const deps = options.deps || createDefaultDeps();
  const originCache = { origin: null, origins: [], checkedAt: 0 };

  async function resolveLiveOrigin(requestedOrigin, liveWindow, force = false) {
    const normalize = deps.localApi.normalizeLoopbackOrigin;
    const explicit = normalize(requestedOrigin);
    if (explicit) return { origin: explicit, origins: [explicit], connectionError: null };

    const fromWindow = normalize(liveWindow?.origin);
    if (fromWindow) {
      originCache.origin = fromWindow;
      originCache.origins = Array.isArray(liveWindow?.origins) && liveWindow.origins.length
        ? liveWindow.origins
        : [fromWindow];
      originCache.checkedAt = Date.now();
      return { origin: originCache.origin, origins: originCache.origins, connectionError: null };
    }

    if (!force && originCache.origin && Date.now() - originCache.checkedAt < 15000) {
      return { origin: originCache.origin, origins: originCache.origins, connectionError: null };
    }

    try {
      const api = await deps.localApi.connect();
      const connectedOrigin = normalize(api?.origin);
      const origins = Array.isArray(api?.origins) && api.origins.length
        ? api.origins
        : (connectedOrigin ? [connectedOrigin] : []);
      originCache.origin = connectedOrigin;
      originCache.origins = origins;
      originCache.checkedAt = Date.now();
      return { origin: connectedOrigin, origins, connectionError: null, api };
    } catch (err) {
      originCache.origin = null;
      originCache.origins = [];
      originCache.checkedAt = 0;
      return {
        origin: null,
        origins: [],
        connectionError: err?.message || String(err)
      };
    }
  }

  async function resolveConversations(api, agDir) {
    const list = listRecentConversations(agDir, 15);
    if (api && typeof api.call === 'function') {
      try {
        const res = await Promise.race([
          api.call('GetAllCascadeTrajectories', {}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);
        const summaries = res?.trajectorySummaries;
        if (summaries && typeof summaries === 'object') {
          const byId = new Map(list.map(item => [item.id.toLowerCase(), item]));
          for (const [id, info] of Object.entries(summaries)) {
            if (!UUID_RE.test(id)) continue;
            const key = id.toLowerCase();
            const title = typeof info?.summary === 'string' ? info.summary.trim() : null;
            const modTs = info?.lastModifiedTime ? new Date(info.lastModifiedTime).getTime() : NaN;
            if (byId.has(key)) {
              const row = byId.get(key);
              if (title) row.title = title;
              if (Number.isFinite(modTs) && modTs > row.mtimeMs) row.mtimeMs = modTs;
            } else {
              const row = {
                id,
                mtimeMs: Number.isFinite(modTs) ? modTs : 0,
                sizeBytes: 0,
                title: title || null
              };
              list.push(row);
              byId.set(key, row);
            }
          }
          list.sort((a, b) => b.mtimeMs - a.mtimeMs);
        }
      } catch { }
    }
    return list.slice(0, 15);
  }

  function readInstallMarker() {
    try {
      const stateDir = deps.asarEngine?.getStateDir?.();
      if (!stateDir) return null;
      const instPath = path.join(stateDir, 'installation.json');
      if (!fs.existsSync(instPath)) return null;
      const raw = JSON.parse(fs.readFileSync(instPath, 'utf8'));
      return {
        meterVersion: raw.meterVersion || null,
        antigravityVersion: raw.version || null,
        installedAt: raw.installedAt || null
      };
    } catch {
      return null;
    }
  }

  async function buildOverview(data = {}) {
    const force = Boolean(data?.force);
    const agDir = options.agDir || process.env.AG_DIR || path.join(os.homedir(), '.gemini', 'antigravity');
    const liveWindow = await deps.cli.queryLiveWindow().catch(err => ({
      running: false,
      cdpEnabled: false,
      error: err?.message || String(err)
    }));
    const conn = await resolveLiveOrigin(data?.origin, liveWindow, force);
    const origin = conn.origin;
    const apiClient = conn.api || (origin ? await deps.localApi.connect({ origin }).catch(() => null) : null);
    const conversations = await resolveConversations(apiClient, agDir);
    const requestedConvId = typeof data?.conversationId === 'string' && UUID_RE.test(data.conversationId.trim())
      ? data.conversationId.trim()
      : null;
    const selectedConversationId = requestedConvId || conversations[0]?.id || null;

    const errors = {};
    if (conn.connectionError) errors.connection = conn.connectionError;

    const [sessionRes, quotaRes, tokensRes, unlockRes] = await Promise.allSettled([
      origin && selectedConversationId
        ? deps.collector.collect(origin, selectedConversationId, { force })
        : Promise.resolve(null),
      origin
        ? deps.collector.fetchQuotaSnapshotFromHost({ origin, force })
        : Promise.resolve(null),
      deps.collector.collectTokenHistoryAsync({ force }),
      deps.collector.getContextUnlockStatus
        ? deps.collector.getContextUnlockStatus(undefined, { skipSha256: true, forceRefresh: force })
        : Promise.resolve(null)
    ]);

    let session = null;
    if (sessionRes.status === 'fulfilled') {
      session = sessionRes.value;
    } else {
      errors.session = sessionRes.reason?.message || String(sessionRes.reason);
    }

    let quota = null;
    if (quotaRes.status === 'fulfilled') {
      const qv = quotaRes.value;
      quota = qv
        ? {
            ok: Boolean(qv.ok),
            error: qv.error || null,
            planTierSummary: sanitizePlanMeta(qv.planTierSummary),
            snapshot: qv.snapshot || null
          }
        : null;
      if (quota && !quota.ok && quota.error) errors.quota = quota.error;
    } else {
      errors.quota = quotaRes.reason?.message || String(quotaRes.reason);
    }

    let tokens = null;
    if (tokensRes.status === 'fulfilled') {
      tokens = sanitizeTokensPayload(tokensRes.value);
    } else {
      errors.tokens = tokensRes.reason?.message || String(tokensRes.reason);
    }

    let unlock = null;
    if (unlockRes.status === 'fulfilled') {
      unlock = sanitizeUnlockPayload(unlockRes.value);
    } else {
      errors.unlock = unlockRes.reason?.message || String(unlockRes.reason);
    }

    let settings = null;
    try {
      settings = sanitizeSettingsPayload(deps.collector.getPluginSettings({ agDir: options.agDir }));
    } catch (err) {
      errors.settings = err?.message || String(err);
    }

    let sidecar = null;
    try {
      sidecar = sanitizeSidecarStatus(deps.sidecarLive.getSidecarPluginStatus());
    } catch (err) {
      errors.sidecar = err?.message || String(err);
    }

    const installMarker = readInstallMarker();

    return {
      ok: true,
      meta: {
        pluginVersion: readPackageVersion(),
        generatedAt: new Date().toISOString(),
        origin,
        origins: conn.origins,
        antigravityRunning: Boolean(liveWindow?.running || origin),
        cdpEnabled: Boolean(liveWindow?.cdpEnabled),
        cdpPort: liveWindow?.cdpPort || null,
        cdpReason: liveWindow?.reason || (liveWindow?.cdpEnabled ? 'connected' : (liveWindow?.running ? 'cdp_disabled' : 'not_running')),
        pageFound: Boolean(liveWindow?.pageFound),
        topbarActive: Boolean(liveWindow?.active),
        topbarVersion: liveWindow?.version || null,
        installMarker
      },
      conversations,
      selectedConversationId,
      session,
      quota,
      tokens,
      unlock,
      settings,
      sidecar,
      errors
    };
  }

  async function handleHotInject() {
    const settings = deps.collector.getPluginSettings({ agDir: options.agDir });
    const injectChinese = settings?.sidecarChinese !== false;
    const res = await deps.sidecarLive.tickSidecarLive({
      injectChinese,
      forceInject: true
    });
    return {
      ok: true,
      result: res
    };
  }

  function handleSaveSettings(data = {}) {
    const patch = {};
    if (typeof data.sidecarChinese === 'boolean') patch.sidecarChinese = data.sidecarChinese;
    if (typeof data.showCliButton === 'boolean') patch.showCliButton = data.showCliButton;
    if (typeof data.panelLanguage === 'string' && ['zh-CN', 'zh-TW', 'en'].includes(data.panelLanguage)) {
      patch.panelLanguage = data.panelLanguage;
    }
    if (Object.keys(patch).length === 0) {
      throw new Error('缺少有效的设置字段');
    }
    const res = deps.collector.savePluginSettings(patch, { agDir: options.agDir });
    if (res && res.ok === false) {
      throw new Error(res.error || '保存设置失败');
    }
    return {
      ok: true,
      settings: sanitizeSettingsPayload(deps.collector.getPluginSettings({ agDir: options.agDir }))
    };
  }

  return {
    buildOverview,
    handleHotInject,
    handleSaveSettings
  };
}

function jsonErrorResponse(ResponseCtor, err, status = 400) {
  return new ResponseCtor(
    JSON.stringify({ ok: false, error: err?.message || String(err) }),
    { status, contentType: 'application/json; charset=utf-8' }
  );
}

async function startSidecarUiServer(options = {}) {
  const sdk = typeof options.importSidecarSdk === 'function'
    ? await options.importSidecarSdk()
    : await loadSidecarSdk();
  const { SidecarApp, Response } = sdk;
  if (!SidecarApp || !Response) {
    throw new Error('sidecar_sdk 未导出 SidecarApp 或 Response');
  }

  const app = typeof options.createSidecarApp === 'function'
    ? options.createSidecarApp()
    : new SidecarApp();
  const handlers = createUiHandlers(options);
  const uiDir = options.uiDir || LOADER_DIR;

  app.page('/', () => fs.readFileSync(path.join(uiDir, 'index.html'), 'utf8'));
  app.api('/styles.css', () => new Response(
    fs.readFileSync(path.join(uiDir, 'styles.css'), 'utf8'),
    { contentType: 'text/css; charset=utf-8' }
  ), 'GET');
  app.api('/app.js', () => new Response(
    fs.readFileSync(path.join(uiDir, 'app.js'), 'utf8'),
    { contentType: 'application/javascript; charset=utf-8' }
  ), 'GET');

  const wrap = (fn) => async (data) => {
    try {
      return await fn(data || {});
    } catch (err) {
      return jsonErrorResponse(Response, err);
    }
  };

  app.api('/api/overview', wrap((data) => handlers.buildOverview(data)), 'POST');
  app.api('/api/refresh', wrap((data) => handlers.buildOverview({ ...data, force: true })), 'POST');
  app.api('/api/hot-inject', wrap(() => handlers.handleHotInject()), 'POST');
  app.api('/api/settings', wrap((data) => handlers.handleSaveSettings(data)), 'POST');

  const runResult = await Promise.resolve(app.run());
  const port = Number(options.webPort || process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || runResult?.port || 0) || null;

  return {
    app,
    port,
    close: async () => {
      if (typeof runResult?.close === 'function') await runResult.close();
      else if (typeof app.close === 'function') await app.close();
      else if (typeof app.stop === 'function') await app.stop();
    }
  };
}

module.exports = {
  startSidecarUiServer,
  createUiHandlers,
  listRecentConversations,
  loadSidecarSdk
};
