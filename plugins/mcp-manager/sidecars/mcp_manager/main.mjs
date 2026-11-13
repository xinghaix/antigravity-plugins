import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import { probeServer } from './mcp_probe.mjs';
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

function detectHostWorkspaces(data) {
  const list = [];
  if (typeof data?.workspace === 'string' && data.workspace) list.push(data.workspace);
  const uris = app.config?.workspaceUris || app.config?.workspaces || [];
  if (Array.isArray(uris)) {
    for (const u of uris) {
      if (typeof u === 'string' && u.startsWith('file://')) {
        try { list.push(fileURLToPath(u)); } catch { /* ignore */ }
      } else if (typeof u === 'string' && isAbsolute(u)) {
        list.push(u);
      }
    }
  }
  return list;
}

async function fetchHostMcpStates() {
  const addr = process.env.ANTIGRAVITY_LS_ADDRESS;
  if (!addr) return {};
  try {
    const res = await fetch(`http://${addr}/exa.language_server_pb.LanguageServerService/GetMcpServerStates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': process.env.ANTIGRAVITY_CSRF_TOKEN || '',
      },
      body: '{}',
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) return {};
    const payload = await res.json();
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
          ? st.tools.map((t) => ({ name: t.name, description: t.description || '' }))
          : [],
        hasToolErrors: Array.isArray(st.toolErrors) && st.toolErrors.some(Boolean),
      };
    }
    return map;
  } catch {
    return {};
  }
}

app.page('/', () => readFileSync(join(__dirname, 'index.html'), 'utf-8'));

for (const [route, [file, contentType]] of Object.entries(STATIC)) {
  app.api(route, () => new Response(readFileSync(join(__dirname, file), 'utf-8'), { contentType }), 'GET');
}

app.api('/api/state', handle(async (data) => {
  const hostWs = detectHostWorkspaces(data);
  const hostStates = await fetchHostMcpStates();
  return { ok: true, ...store.getState(hostWs, hostStates) };
}), 'GET');

app.api('/api/backups', handle(() => ({ ok: true, backups: store.listBackups() })), 'GET');

app.api('/api/backups/restore', handle((data) => store.restoreBackup(data)));

app.api('/api/workspaces/add', handle((data) => {
  const workspaces = store.addWorkspace(data.path);
  return { ok: true, workspaces };
}));

app.api('/api/workspaces/remove', handle((data) => {
  const workspaces = store.removeWorkspace(data.path);
  return { ok: true, workspaces };
}));

app.api('/api/server/save', handle((data) => store.saveServer(data)));

app.api('/api/server/toggle', handle((data) => store.toggleServer(data)));

app.api('/api/server/delete', handle((data) => store.deleteServer(data)));

app.api('/api/raw/save', handle((data) => store.saveRawConfig(data)));

app.api('/api/import', handle((data) => store.importSnippet(data)));

app.api('/api/export-plugin', handle((data) => store.exportAsPlugin(data)));

app.api('/api/probe', handle(async (data) => {
  const result = await probeServer(data.config, typeof data.timeoutMs === 'number' ? data.timeoutMs : 7000);
  return { ok: true, probe: result };
}));

app.run();
