'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_PLUGIN_ID = 'antigravity-context-viewer';
const DEFAULT_SIDECAR_ID = 'live-loader';
const FAST_POLL_MS = 1500;
const IDLE_POLL_MS = 5000;

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return pkg.version || '0.8.2';
  } catch {
    return '0.8.2';
  }
}

function resolveSidecarPaths(options = {}) {
  const home = os.homedir();
  const pluginId = options.pluginId || DEFAULT_PLUGIN_ID;
  const sidecarId = options.sidecarId || DEFAULT_SIDECAR_ID;
  const configRoot = path.resolve(options.configRoot || path.join(home, '.gemini', 'config'));
  const appDataDir = path.resolve(options.appDataDir || path.join(home, '.gemini', 'antigravity'));
  const pluginDir = path.join(configRoot, 'plugins', pluginId);
  const sidecarDir = path.join(pluginDir, 'sidecars', sidecarId);
  const dataRoot = path.join(appDataDir, 'sidecar_data', pluginId, sidecarId);

  return {
    pluginId,
    sidecarId,
    configRoot,
    appDataDir,
    pluginDir,
    pluginManifestPath: path.join(pluginDir, 'plugin.json'),
    sidecarsRoot: path.join(pluginDir, 'sidecars'),
    sidecarDir,
    sidecarManifestPath: path.join(sidecarDir, 'sidecar.json'),
    logsDir: path.join(dataRoot, 'logs')
  };
}

function buildPluginManifest(options = {}) {
  return {
    name: options.pluginId || DEFAULT_PLUGIN_ID,
    displayName: 'Context Viewer (Auto-Loader)',
    version: readPackageVersion(),
    description: 'Automatically attaches antigravity-context-viewer live UI via CDP without patching app.asar.'
  };
}

function buildSidecarManifest(options = {}) {
  const scriptPath = path.resolve(options.scriptPath || path.join(__dirname, 'sidecar-live.js'));
  const command = options.nodePath || process.execPath;
  return {
    command,
    args: [scriptPath],
    env: {
      AG_SIDECAR_REV: String(options.rev ?? Date.now())
    },
    restart_policy: 'always',
    display_name: 'Context Viewer Auto-Loader',
    description: 'Watches Antigravity DevToolsActivePort and injects the context meter live panel via CDP on startup or window reload.'
  };
}

function installSidecarPlugin(options = {}) {
  const paths = resolveSidecarPaths(options);
  const pluginManifest = buildPluginManifest(options);
  const sidecarManifest = buildSidecarManifest(options);

  fs.mkdirSync(paths.sidecarDir, { recursive: true });
  fs.writeFileSync(paths.pluginManifestPath, JSON.stringify(pluginManifest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(paths.sidecarManifestPath, JSON.stringify(sidecarManifest, null, 2) + '\n', 'utf8');

  return {
    ok: true,
    ...paths,
    pluginManifest,
    sidecarManifest
  };
}

function uninstallSidecarPlugin(options = {}) {
  const paths = resolveSidecarPaths(options);
  const removed = [];

  if (fs.existsSync(paths.sidecarDir)) {
    fs.rmSync(paths.sidecarDir, { recursive: true, force: true });
    removed.push(paths.sidecarDir);
  }

  try {
    if (fs.existsSync(paths.sidecarsRoot) && fs.readdirSync(paths.sidecarsRoot).length === 0) {
      fs.rmdirSync(paths.sidecarsRoot);
    }
  } catch {}

  try {
    if (fs.existsSync(paths.pluginDir)) {
      const entries = fs.readdirSync(paths.pluginDir);
      if (entries.every(name => name === 'plugin.json')) {
        if (fs.existsSync(paths.pluginManifestPath)) {
          fs.unlinkSync(paths.pluginManifestPath);
          removed.push(paths.pluginManifestPath);
        }
        fs.rmdirSync(paths.pluginDir);
        removed.push(paths.pluginDir);
      }
    }
  } catch {}

  return {
    ok: true,
    removed,
    ...paths
  };
}

function findLatestSidecarLog(logsDir) {
  if (!logsDir || !fs.existsSync(logsDir)) return null;
  try {
    const entries = fs.readdirSync(logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const full = path.join(logsDir, f);
        return { path: full, mtimeMs: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (!entries.length) return null;
    const latest = entries[0].path;
    const content = fs.readFileSync(latest, 'utf8');
    const lines = content.trim().split(/\r?\n/).filter(Boolean);
    return {
      path: latest,
      tail: lines.slice(-10)
    };
  } catch {
    return null;
  }
}

function getSidecarPluginStatus(options = {}) {
  const paths = resolveSidecarPaths(options);
  const pluginExists = fs.existsSync(paths.pluginManifestPath);
  const sidecarExists = fs.existsSync(paths.sidecarManifestPath);
  let pluginManifest = null;
  let sidecarManifest = null;
  let scriptExists = false;

  if (pluginExists) {
    try {
      pluginManifest = JSON.parse(fs.readFileSync(paths.pluginManifestPath, 'utf8'));
    } catch {}
  }
  if (sidecarExists) {
    try {
      sidecarManifest = JSON.parse(fs.readFileSync(paths.sidecarManifestPath, 'utf8'));
      const entry = Array.isArray(sidecarManifest?.args) ? sidecarManifest.args[0] : null;
      scriptExists = Boolean(entry && fs.existsSync(entry));
    } catch {}
  }

  const latestLog = findLatestSidecarLog(paths.logsDir);

  return {
    installed: Boolean(pluginExists && sidecarExists),
    scriptExists,
    ...paths,
    pluginManifest,
    sidecarManifest,
    runtimeLog: latestLog
  };
}

function getBundleStamp(repoDir = __dirname) {
  try {
    return ['meter-core.js', 'meter-renderer.js'].map(file => {
      const st = fs.statSync(path.join(repoDir, file));
      return `${file}:${st.size}:${Math.trunc(st.mtimeMs)}`;
    }).join('|');
  } catch {
    return null;
  }
}

function getBundleStampPath(stateDirOverride) {
  try {
    const dir = stateDirOverride || require('./asar-engine').getStateDir();
    return path.join(dir, '.live-bundle-stamp.json');
  } catch {
    return null;
  }
}

function readInjectedBundleStamp(origin, stateDirOverride) {
  try {
    const p = getBundleStampPath(stateDirOverride);
    if (!p || !fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (origin && data.origin !== origin) return null;
    return data.stamp || null;
  } catch {
    return null;
  }
}

function writeInjectedBundleStamp(origin, stamp, stateDirOverride) {
  try {
    const p = getBundleStampPath(stateDirOverride);
    if (!p || !stamp) return;
    fs.writeFileSync(p, JSON.stringify({ origin: origin || null, stamp, updatedAt: Date.now() }), 'utf8');
  } catch {}
}

function createManagedBridgeController(deps = {}) {
  let activeBridge = null;
  const checkExternalAlive = deps.isBridgeAlive || (origin => require('./cli').isLiveBridgeAlive(origin));
  const startServer = deps.startManagedBridge || (() => require('./live-host').startLiveHostServer({ managed: true, quiet: true }));

  return {
    isManagedAlive(origin) {
      return Boolean(activeBridge && (!origin || activeBridge.origin === origin));
    },
    async ensure(origin) {
      if (activeBridge && (!origin || activeBridge.origin === origin)) {
        return activeBridge;
      }
      if (activeBridge) {
        try { await activeBridge.close(); } catch {}
        activeBridge = null;
      }
      if (checkExternalAlive(origin)) {
        return null;
      }
      activeBridge = await startServer({ origin });
      return activeBridge;
    },
    async close() {
      if (!activeBridge) return;
      const closing = activeBridge;
      activeBridge = null;
      try { await closing.close(); } catch {}
    }
  };
}

async function tickSidecarLive(deps = {}) {
  let cliModule;
  const getCli = () => (cliModule || (cliModule = require('./cli')));
  const queryWindow = deps.queryWindow || (() => getCli().queryLiveWindow());
  const isBridgeAlive = deps.isBridgeAlive || (origin => getCli().isLiveBridgeAlive(origin));
  const ensureBridge = deps.ensureBridge || (() => getCli().ensureLiveBridgeIfNeeded());
  const hotInject = deps.hotInject || (opts => require('./install').tryHotInject(opts));
  const readBundleStamp = deps.getBundleStamp || (() => getBundleStamp());
  const readSavedStamp = deps.readInjectedBundleStamp || (origin => readInjectedBundleStamp(origin));
  const writeSavedStamp = deps.writeInjectedBundleStamp || ((origin, stamp) => writeInjectedBundleStamp(origin, stamp));
  const isChineseEnabled = deps.isChineseEnabled || (() => {
    try {
      return require('./meter-collector').getPluginSettings()?.sidecarChinese !== false;
    } catch {
      return true;
    }
  });

  const live = await queryWindow();
  if (!live || !live.running) {
    if (deps.onInactive) await deps.onInactive();
    return { action: 'waiting', reason: 'client_not_running', live: live || { running: false } };
  }
  if (!live.pageFound) {
    return { action: 'waiting', reason: 'window_not_ready', live };
  }

  const currentStamp = readBundleStamp();
  const hasDomStampField = Object.prototype.hasOwnProperty.call(live, 'injectedStamp');
  const activeStamp = hasDomStampField
    ? live.injectedStamp
    : (currentStamp ? readSavedStamp(live.origin) : null);
  const bundleUpdated = Boolean(currentStamp && currentStamp !== activeStamp);
  const wantChinese = Boolean(isChineseEnabled());
  const hasI18nField = Object.prototype.hasOwnProperty.call(live, 'i18nActive');
  const missingLiveChinese = Boolean(hasI18nField && wantChinese && !live.i18nActive);

  if (live.hasIpcBridge) {
    if (!bundleUpdated && !missingLiveChinese) {
      return { action: 'noop', reason: 'asar_ipc_active', live };
    }
    if (!bundleUpdated && missingLiveChinese) {
      const ok = await hotInject({ onlyChinese: true, injectChinese: true });
      return {
        action: ok ? 'injected' : 'retry',
        reason: ok ? 'chinese_synced' : 'inject_failed',
        live
      };
    }
    const ok = await hotInject({ skipLiveSession: true, bundleStamp: currentStamp, injectChinese: wantChinese });
    if (ok && currentStamp) {
      writeSavedStamp(live.origin, currentStamp);
    }
    return {
      action: ok ? 'injected' : 'retry',
      reason: ok ? 'asar_bundle_synced' : 'inject_failed',
      live
    };
  }

  const bridgeAlive = Boolean(isBridgeAlive(live.origin));
  if (live.active && bridgeAlive && !bundleUpdated) {
    if (!missingLiveChinese) {
      return { action: 'noop', reason: 'already_active', live };
    }
    const ok = await hotInject({ onlyChinese: true, injectChinese: true });
    return {
      action: ok ? 'injected' : 'retry',
      reason: ok ? 'chinese_synced' : 'inject_failed',
      live
    };
  }

  await ensureBridge(live.origin);
  const ok = await hotInject({ skipLiveSession: false, bundleStamp: currentStamp, injectChinese: wantChinese });
  if (ok && currentStamp) {
    writeSavedStamp(live.origin, currentStamp);
  }
  const injectReason = !ok
    ? 'inject_failed'
    : !live.active
      ? 'injected'
      : !bridgeAlive
        ? 'bridge_refreshed'
        : 'bundle_updated';
  return {
    action: ok ? 'injected' : 'retry',
    reason: injectReason,
    live
  };
}

function logStateChange(lastKeyRef, result, logger = console.log) {
  const key = `${result.action}:${result.reason}:${result.live?.origin || ''}`;
  if (lastKeyRef.current === key) return;
  lastKeyRef.current = key;
  const ts = new Date().toISOString();
  if (result.action === 'injected') {
    logger(`[${ts}] [context-viewer sidecar] CDP hot-injected live UI (${result.reason}) on ${result.live?.origin || 'unknown origin'}`);
  } else if (result.action === 'noop') {
    logger(`[${ts}] [context-viewer sidecar] Active cleanly (${result.reason})`);
  } else if (result.action === 'retry') {
    logger(`[${ts}] [context-viewer sidecar] Window detected (${result.live?.origin || 'pending'}), waiting to retry CDP injection`);
  } else {
    logger(`[${ts}] [context-viewer sidecar] Waiting for Antigravity window (${result.reason})`);
  }
}

async function runOnceWithTimeout(options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 20000;
  const pollMs = Number(options.pollMs) > 0 ? Number(options.pollMs) : FAST_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  const lastKey = { current: '' };

  while (true) {
    const res = await tickSidecarLive(options.deps);
    logStateChange(lastKey, res, options.logger);
    if (res.action === 'injected' || res.action === 'noop') {
      return res;
    }
    if (Date.now() >= deadline) {
      return res;
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
}

function startSidecarDaemon(options = {}) {
  const fastMs = Number(options.fastPollMs) > 0 ? Number(options.fastPollMs) : FAST_POLL_MS;
  const idleMs = Number(options.idlePollMs) > 0 ? Number(options.idlePollMs) : IDLE_POLL_MS;
  const lastKey = { current: '' };
  let stopped = false;
  let timer = null;
  let inFlight = false;

  const customDeps = options.deps || {};
  const useManagedBridge = !customDeps.ensureBridge;
  const bridgeCtrl = useManagedBridge ? createManagedBridgeController(customDeps) : null;
  const daemonDeps = bridgeCtrl ? {
    ...customDeps,
    isBridgeAlive: origin => bridgeCtrl.isManagedAlive(origin) || (customDeps.isBridgeAlive ? customDeps.isBridgeAlive(origin) : require('./cli').isLiveBridgeAlive(origin)),
    ensureBridge: origin => bridgeCtrl.ensure(origin),
    onInactive: () => bridgeCtrl.close()
  } : customDeps;

  const scheduleNext = delay => {
    if (stopped) return;
    timer = setTimeout(runStep, delay);
    if (typeof timer.unref === 'function' && options.unrefTimer) {
      timer.unref();
    }
  };

  const runStep = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    let nextDelay = idleMs;
    try {
      const res = await tickSidecarLive(daemonDeps);
      logStateChange(lastKey, res, options.logger);
      if (res.action === 'retry' || (res.action === 'waiting' && res.reason === 'window_not_ready')) {
        nextDelay = fastMs;
      }
    } catch (err) {
      const ts = new Date().toISOString();
      (options.errorLogger || console.error)(`[${ts}] [context-viewer sidecar] tick error: ${err.message}`);
      nextDelay = idleMs;
    } finally {
      inFlight = false;
      scheduleNext(nextDelay);
    }
  };

  runStep();

  return {
    async stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (bridgeCtrl) {
        await bridgeCtrl.close();
      }
    }
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--once')) {
    const tIdx = args.indexOf('--timeout-ms');
    const timeoutMs = tIdx >= 0 ? Number(args[tIdx + 1]) : 20000;
    runOnceWithTimeout({ timeoutMs }).then(res => {
      if (res.action !== 'injected' && res.action !== 'noop') {
        process.exitCode = 1;
      }
    }).catch(err => {
      console.error('❌ Sidecar once error:', err.message);
      process.exitCode = 1;
    });
  } else {
    const daemon = startSidecarDaemon();
    const shutdown = () => {
      Promise.resolve(daemon.stop()).finally(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

module.exports = {
  DEFAULT_PLUGIN_ID,
  DEFAULT_SIDECAR_ID,
  resolveSidecarPaths,
  buildPluginManifest,
  buildSidecarManifest,
  installSidecarPlugin,
  uninstallSidecarPlugin,
  getSidecarPluginStatus,
  createManagedBridgeController,
  tickSidecarLive,
  runOnceWithTimeout,
  startSidecarDaemon
};
