'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');

const LOOPBACK_ORIGIN_RE = /^https:\/\/127\.0\.0\.1:\d+$/;
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const PROBE_REQUEST_TIMEOUT_MS = 1800;

function getAppDataDir(options = {}) {
  if (options && typeof options.appDataDir === 'string' && options.appDataDir.trim()) {
    return path.resolve(options.appDataDir.trim());
  }
  if (process.env.APPDATA) return process.env.APPDATA;
  const home = (options && options.homeDir) || os.homedir();
  const platform = (options && options.platform) || process.platform;
  return platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support')
    : path.join(home, '.config');
}

function getMainLogCandidates(options = {}) {
  if (options && typeof options.mainLogPath === 'string' && options.mainLogPath.trim()) {
    return [path.resolve(options.mainLogPath.trim())];
  }
  const isTestEnv = process.env.AG_METER_TEST_MODE === '1' || process.env.NODE_ENV === 'test';
  const hasIsolatedAppData = Boolean(
    options?.appDataDir &&
    path.resolve(options.appDataDir).toLowerCase().includes(os.tmpdir().toLowerCase())
  );
  if (isTestEnv && !options?.homeDir && !hasIsolatedAppData) {
    return [];
  }
  const home = (options && options.homeDir) || os.homedir();
  const platform = (options && options.platform) || process.platform;
  if (platform === 'darwin') {
    if (options?.appDataDir) {
      return [path.join(path.resolve(options.appDataDir), 'Antigravity', 'logs', 'main.log')];
    }
    return [
      path.join(home, 'Library', 'Logs', 'Antigravity', 'main.log'),
      path.join(home, 'Library', 'Logs', 'Antigravity - Insiders', 'main.log')
    ];
  }
  const appData = getAppDataDir(options);
  return [
    path.join(appData, 'Antigravity', 'logs', 'main.log'),
    path.join(appData, 'Antigravity - Insiders', 'logs', 'main.log')
  ];
}

function extractCandidateOriginsFromLog(logText, maxCandidates = 6) {
  if (!logText || typeof logText !== 'string') return [];
  const matches = [...logText.matchAll(/https:\/\/127\.0\.0\.1:(\d+)\//g)];
  const out = [];
  const seen = new Set();
  for (let i = matches.length - 1; i >= 0; i--) {
    const origin = normalizeLoopbackOrigin(`https://127.0.0.1:${matches[i][1]}`);
    if (origin && !seen.has(origin)) {
      seen.add(origin);
      out.push(origin);
      if (out.length >= maxCandidates) break;
    }
  }
  return out;
}

function readLogTail(filePath, maxBytes = 65536) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size <= 0) return '';
    const bytesToRead = Math.min(st.size, maxBytes);
    const start = st.size - bytesToRead;
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(bytesToRead);
      fs.readSync(fd, buf, 0, bytesToRead, start);
      return buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function normalizeLoopbackOrigin(rawOrigin) {
  if (!rawOrigin || typeof rawOrigin !== 'string') return null;
  try {
    const parsed = new URL(rawOrigin.trim());
    const origin = parsed.origin;
    return LOOPBACK_ORIGIN_RE.test(origin) ? origin : null;
  } catch {
    return null;
  }
}

function request(url, body, token, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? https : http).request(url, { agent: false, rejectUnauthorized: false, method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'x-codeium-csrf-token': token } : {} }, response => {
      let text = ''; response.on('data', chunk => text += chunk);
      response.on('end', () => response.statusCode === 200 ? resolve(text) : reject(new Error(`HTTP ${response.statusCode}: ${text.slice(0, 200)}`)));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Local API timeout'))); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}

/**
 * 解析并缓存或实时提取指定本地页面原点的 CSRF Token 并构造 RPC 客户端。
 */
async function connectOrigin(rawOrigin, page = null, origins = null, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const origin = normalizeLoopbackOrigin(rawOrigin);
  if (!origin) {
    throw new Error('非法的本机回环页面地址');
  }
  const html = await request(origin + '/', null, null, timeoutMs);
  const m = html.match(/window\.__APP_CONFIG__\s*=\s*(.*?);/);
  if (!m) throw new Error('未能提取宿主 CSRF 令牌');
  const token = JSON.parse(m[1]).csrfToken;
  return {
    origin,
    page,
    origins: Array.isArray(origins) && origins.length ? origins : [origin],
    call: async (method, body) => JSON.parse(await request(`${origin}/exa.language_server_pb.LanguageServerService/${method}`, body, token))
  };
}

/**
 * 在无 DevToolsActivePort 时，从 Antigravity main.log 尾部探测仍在运行的本地 Language Server 原点。
 */
async function discoverOriginsFromMainLog(options = {}) {
  const candidates = [];
  const seen = new Set();
  for (const logPath of getMainLogCandidates(options)) {
    const tail = readLogTail(logPath);
    for (const origin of extractCandidateOriginsFromLog(tail)) {
      if (!seen.has(origin)) {
        seen.add(origin);
        candidates.push(origin);
      }
    }
  }
  const live = [];
  for (const origin of candidates) {
    try {
      const api = await connectOrigin(origin, null, [origin], PROBE_REQUEST_TIMEOUT_MS);
      if (api) live.push(api);
    } catch { }
  }
  return live;
}

/**
 * 连接到本地 Antigravity LanguageServerService。
 * 支持直接传入已知 `options.origin` 免 CDP/DevToolsActivePort 直连；
 * 若无显式 origin，依次尝试 DevToolsActivePort 与 Antigravity main.log 探测（兼容 >=2.33 默认关闭 CDP）。
 */
async function connect(options = {}) {
  const explicitOrigin = normalizeLoopbackOrigin(options?.origin);
  if (explicitOrigin) {
    return connectOrigin(explicitOrigin, null, [explicitOrigin]);
  }
  const portFile = options?.portFile
    ? path.resolve(options.portFile)
    : path.join(getAppDataDir(options), 'Antigravity', 'DevToolsActivePort');
  if (fs.existsSync(portFile)) {
    try {
      const port = Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]);
      if (Number.isFinite(port) && port > 0) {
        const pages = JSON.parse(await request(`http://127.0.0.1:${port}/json/list`, null, null, PROBE_REQUEST_TIMEOUT_MS));
        const matchedPages = pages.filter(item => item.type === 'page' && /^https:\/\/127\.0\.0\.1:\d+\//.test(item.url));
        const page = matchedPages[0];
        if (page) {
          const origins = Array.from(new Set(matchedPages.map(item => normalizeLoopbackOrigin(item.url)).filter(Boolean)));
          const targetOrigin = normalizeLoopbackOrigin(page.url);
          return connectOrigin(targetOrigin, page, origins);
        }
      }
    } catch { }
  }
  const logApis = await discoverOriginsFromMainLog(options);
  if (logApis.length > 0) {
    const primary = logApis[0];
    return {
      ...primary,
      origins: logApis.map(a => a.origin)
    };
  }
  throw new Error('Antigravity window not found (DevToolsActivePort unavailable and no live LS origin discovered)');
}

module.exports = {
  connect,
  connectOrigin,
  normalizeLoopbackOrigin,
  getAppDataDir,
  getMainLogCandidates,
  extractCandidateOriginsFromLog,
  discoverOriginsFromMainLog
};
