import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import { createConversationClient } from './conversations_client.mjs';
import { createStore } from './studio_store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const store = createStore();
const app = new SidecarApp();
const convClient = createConversationClient();

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
    try {
      list.push(fileURLToPath(val));
    } catch {
      // ignore
    }
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

app.page('/', () => readFileSync(join(__dirname, 'index.html'), 'utf-8'));

for (const [route, [file, contentType]] of Object.entries(STATIC)) {
  app.api(route, () => new Response(readFileSync(join(__dirname, file), 'utf-8'), { contentType }), 'GET');
}

function buildCapabilities() {
  return {
    conversationService: convClient.isAvailable(),
    projectId: app.config?.projectId || null,
    conversationId: app.config?.conversationId || null,
  };
}

app.api('/api/state', handle((data) => {
  const hostWs = detectHostWorkspaces(data);
  const selected = typeof data?.workspace === 'string' ? data.workspace : '';
  return { ok: true, capabilities: buildCapabilities(), ...store.getState(hostWs, selected) };
}), 'GET');

app.api('/api/state/query', handle((data) => {
  const hostWs = detectHostWorkspaces(data);
  const selected = typeof data?.workspace === 'string' ? data.workspace : '';
  return { ok: true, capabilities: buildCapabilities(), ...store.getState(hostWs, selected) };
}));

app.api('/api/skill/preview', handle((data) => ({ ok: true, ...store.getSkillPreview(data) })));
app.api('/api/skill/toggle', handle((data) => store.toggleSkill(data)));
app.api('/api/bucket/toggle', handle((data) => store.toggleBucket(data)));
app.api('/api/preset/apply', handle((data) => store.applyPreset(data)));
app.api('/api/install/mode', handle((data) => store.switchInstallMode(data)));

app.api('/api/workspaces/add', handle((data) => {
  const added = store.addWorkspace(data.path);
  return { ok: true, path: added };
}));
app.api('/api/workspaces/remove', handle((data) => {
  const workspaces = store.removeWorkspace(data.path);
  return { ok: true, workspaces };
}));
app.api('/api/workspace/inspect', handle((data) => ({ ok: true, workspace: store.inspectWorkspace(data.workspacePath) })));
app.api('/api/workspace/deliver', handle((data) => store.deliverToWorkspace(data)));
app.api('/api/workspace/skills-json', handle((data) => store.saveWorkspaceSkillsJson(data)));
app.api('/api/workspace/skill/remove', handle((data) => store.removeWorkspaceSkill(data)));
app.api('/api/workspace/setup', handle((data) => store.saveRepoSetup(data)));
app.api('/api/workspace/glossary', handle((data) => store.saveGlossary(data)));

app.api('/api/conversations', handle(async () => {
  if (!convClient.isAvailable()) {
    return { ok: true, available: false, conversations: [] };
  }
  const res = await convClient.listConversations({
    pageSize: 15,
    projectId: app.config?.projectId || undefined,
  });
  return { ok: true, available: true, ...res };
}), 'GET');

app.api('/api/conversations/query', handle(async (data) => {
  if (!convClient.isAvailable()) {
    return { ok: true, available: false, conversations: [] };
  }
  const res = await convClient.listConversations({
    pageSize: data.pageSize || 15,
    pageToken: data.pageToken,
    projectId: data.projectId !== undefined ? data.projectId : (app.config?.projectId || undefined),
    parentConversationId: data.parentConversationId,
    tags: Array.isArray(data.tags) ? data.tags : undefined,
    includeArchived: Boolean(data.includeArchived),
  });
  return { ok: true, available: true, ...res };
}));

app.api('/api/conversations/create', handle(async (data) => {
  const res = await convClient.createConversation({
    title: data.title,
    model: data.model || 'flash',
    tags: Array.isArray(data.tags) ? data.tags : ['mp-studio'],
    prompt: data.prompt,
    projectId: data.projectId || app.config?.projectId || undefined,
    environmentId: data.environmentId,
  });
  return { ok: true, ...res };
}));

app.api('/api/conversations/update', handle(async (data) => {
  const res = await convClient.updateConversation({
    conversationId: data.conversationId,
    annotations: data.annotations,
  });
  return { ok: true, ...res };
}));

app.api('/api/backups', handle(() => ({ ok: true, backups: store.listBackups() })), 'GET');
app.api('/api/backups/restore', handle((data) => store.restoreBackup(data)));

app.api('/api/upstream/sync', handle(() => store.syncUpstream()));

app.api('/api/orchestrate/plan', handle((data) => store.buildOrchestrationPlan(data)));

app.run();
