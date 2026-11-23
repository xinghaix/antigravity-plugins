import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import { callServerTool, extractMcpAppMeta, probeServer } from './mcp_probe.mjs';
import { createStore } from './mcp_store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const store = createStore();
const app = new SidecarApp();

const STATIC = {
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
};

function handle(fn) {
  return async (data) => {
    try {
      return await fn(data || {});
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err?.message || String(err) }),
        { status: 400, contentType: 'application/json; charset=utf-8' },
      );
    }
  };
}

function pushWorkspaceEntry(list, raw) {
  if (typeof raw !== 'string' || !raw.trim()) return;
  const val = raw.trim();
  if (val.startsWith('file://')) {
    try { list.push(fileURLToPath(val)); } catch { /* ignore */ }
  } else if (isAbsolute(val)) {
    list.push(val);
  }
}

function detectHostWorkspaces(data) {
  const list = [];
  pushWorkspaceEntry(list, data?.workspace);

  let dataUris = data?.workspaceUris;
  if (typeof dataUris === 'string' && dataUris.trim()) {
    try {
      const parsed = JSON.parse(dataUris);
      dataUris = Array.isArray(parsed) ? parsed : dataUris.split(',');
    } catch {
      dataUris = dataUris.split(',');
    }
  }
  if (Array.isArray(dataUris)) {
    for (const u of dataUris) pushWorkspaceEntry(list, u);
  }

  const uris = app.config?.workspaceUris || app.config?.workspaces || [];
  if (Array.isArray(uris)) {
    for (const u of uris) pushWorkspaceEntry(list, u);
  }
  return [...new Set(list)];
}

async function callLsRpc(method, body = {}, timeoutMs = 1500) {
  const addr = process.env.ANTIGRAVITY_LS_ADDRESS;
  if (!addr) return null;
  try {
    const res = await fetch(`http://${addr}/exa.language_server_pb.LanguageServerService/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': process.env.ANTIGRAVITY_CSRF_TOKEN || '',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

async function fetchHostMcpStates() {
  const payload = await callLsRpc('GetMcpServerStates', {}, 1200);
  if (!payload) return {};
  const map = {};
  for (const st of payload?.states || []) {
    const name = st?.spec?.serverName || st?.name;
    if (!name) continue;
    const status = st.status || '';
    map[name] = {
      status,
      ready: status === 'MCP_SERVER_STATUS_READY',
      serverInfo: st.serverInfo || null,
      tools: Array.isArray(st.tools)
        ? st.tools.map((t) => ({
            name: t.name,
            title: t.title || '',
            description: t.description || '',
            inputSchema: t.inputSchema || null,
            annotations: t.annotations || null,
            ...extractMcpAppMeta(t),
          }))
        : [],
      resources: Array.isArray(st.resources) ? st.resources : [],
      hasToolErrors: Array.isArray(st.toolErrors) && st.toolErrors.some(Boolean),
    };
  }
  return map;
}

async function fetchHostMcpExtras() {
  if (!process.env.ANTIGRAVITY_LS_ADDRESS) return null;
  const [resRes, promptsRes, authRes] = await Promise.allSettled([
    callLsRpc('ListMcpResources', {}, 1000),
    callLsRpc('ListMcpPrompts', {}, 1000),
    callLsRpc('ListPluginAuthProviders', {}, 1000),
  ]);
  const resPayload = resRes.status === 'fulfilled' ? resRes.value : null;
  const promptPayload = promptsRes.status === 'fulfilled' ? promptsRes.value : null;
  const authPayload = authRes.status === 'fulfilled' ? authRes.value : null;
  return {
    connected: Boolean(resPayload || promptPayload || authPayload),
    resourcesCount: Array.isArray(resPayload?.resources) ? resPayload.resources.length : 0,
    promptsCount: Array.isArray(promptPayload?.prompts) ? promptPayload.prompts.length : 0,
    authProviders: Array.isArray(authPayload?.providers) ? authPayload.providers : [],
  };
}

async function refreshHostMcpServers(serverName = '') {
  const cleanName = typeof serverName === 'string' ? serverName.trim() : '';
  const body = cleanName ? { serverName: cleanName } : {};
  const res = await callLsRpc('RefreshMcpServers', body, 2500);
  return {
    available: Boolean(process.env.ANTIGRAVITY_LS_ADDRESS),
    refreshed: res !== null,
    serverName: cleanName || null,
  };
}

async function buildFullState(data) {
  const hostWs = detectHostWorkspaces(data);
  const [hostStates, hostExtra] = await Promise.all([
    fetchHostMcpStates(),
    fetchHostMcpExtras(),
  ]);
  return { ok: true, ...store.getState(hostWs, hostStates, { hostExtra }) };
}

app.page('/', () => readFileSync(join(__dirname, 'index.html'), 'utf-8'));

for (const [route, [file, contentType]] of Object.entries(STATIC)) {
  app.api(route, () => new Response(readFileSync(join(__dirname, file), 'utf-8'), { contentType }), 'GET');
}

app.api('/api/state', handle(async (data) => buildFullState(data)), 'GET');

app.api('/api/state/query', handle(async (data) => buildFullState(data)));

app.api('/api/host/refresh', handle(async (data) => {
  const refresh = await refreshHostMcpServers(data?.serverName || '');
  const [hostStates, hostExtra] = await Promise.all([
    fetchHostMcpStates(),
    fetchHostMcpExtras(),
  ]);
  return { ok: true, refresh, hostStates, hostSummary: hostExtra };
}));

app.api('/api/backups', handle(() => ({ ok: true, backups: store.listBackups() })), 'GET');

app.api('/api/backups/restore', handle((data) => {
  const res = store.restoreBackup(data);
  void refreshHostMcpServers();
  return res;
}));

app.api('/api/workspaces/add', handle((data) => {
  const workspaces = store.addWorkspace(data.path);
  return { ok: true, workspaces };
}));

app.api('/api/workspaces/remove', handle((data) => {
  const workspaces = store.removeWorkspace(data.path);
  return { ok: true, workspaces };
}));

app.api('/api/server/save', handle((data) => {
  const res = store.saveServer(data);
  void refreshHostMcpServers();
  return res;
}));

app.api('/api/server/toggle', handle((data) => {
  const res = store.toggleServer(data);
  void refreshHostMcpServers(data?.name || '');
  return res;
}));

app.api('/api/server/delete', handle((data) => {
  const res = store.deleteServer(data);
  void refreshHostMcpServers();
  return res;
}));

app.api('/api/raw/save', handle((data) => {
  const res = store.saveRawConfig(data);
  void refreshHostMcpServers();
  return res;
}));

app.api('/api/import', handle((data) => {
  const res = store.importSnippet(data);
  void refreshHostMcpServers();
  return res;
}));

app.api('/api/export-plugin', handle((data) => {
  const res = store.exportAsPlugin(data);
  void refreshHostMcpServers();
  return res;
}));

app.api('/api/prompt/save', handle((data) => store.savePrompt(data)));

app.api('/api/prompt/delete', handle((data) => store.deletePrompt(data)));

app.api('/api/probe', handle(async (data) => {
  const result = await probeServer(
    data.config,
    typeof data.timeoutMs === 'number' ? data.timeoutMs : 7000,
    { pluginRoot: data.pluginRoot || '', pluginData: data.pluginData || '' },
  );
  return { ok: true, probe: result };
}));

app.api('/api/probe/call-tool', handle(async (data) => {
  const result = await callServerTool(data.config, {
    toolName: data.toolName,
    args: data.args || {},
    timeoutMs: typeof data.timeoutMs === 'number' ? data.timeoutMs : 8000,
    context: { pluginRoot: data.pluginRoot || '', pluginData: data.pluginData || '' },
  });
  return { ok: true, call: result };
}));

app.run();
