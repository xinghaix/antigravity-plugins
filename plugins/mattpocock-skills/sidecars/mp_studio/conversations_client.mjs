import http from 'node:http';
import https from 'node:https';

/**
 * Normalize Antigravity 2.35.0+ ANTIGRAVITY_LS_ADDRESS to a strict loopback URL.
 * Defaults bare `host:port` values to `http://` and rejects non-loopback hosts.
 */
export function normalizeConversationServiceOrigin(rawAddr) {
  if (!rawAddr || typeof rawAddr !== 'string') return null;
  let val = rawAddr.trim();
  if (!val) return null;
  if (!/^https?:\/\//i.test(val)) {
    val = `http://${val}`;
  }
  try {
    const parsed = new URL(val);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]' && host !== '::1') {
      return null;
    }
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    const mappedHost = host === 'localhost' || host === '::1' || host === '[::1]' ? '127.0.0.1' : host;
    return `${parsed.protocol}//${mappedHost}:${port}`;
  } catch {
    return null;
  }
}

function defaultPostJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body || {});
    const req = mod.request(
      parsed,
      {
        method: 'POST',
        agent: false,
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'Content-Length': Buffer.byteLength(payload, 'utf8'),
          ...headers,
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(text ? JSON.parse(text) : {});
            } catch (err) {
              reject(new Error(`Invalid ConversationService JSON response: ${err.message}`));
            }
          } else {
            reject(new Error(`ConversationService HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('ConversationService request timeout')));
    req.on('error', reject);
    req.end(payload);
  });
}

/**
 * Create a lightweight HTTP+JSON Connect client for Antigravity 2.35+
 * `product.v1.ConversationService` using `ANTIGRAVITY_LS_ADDRESS` & `ANTIGRAVITY_CSRF_TOKEN`.
 */
export function createConversationClient({ env = process.env, timeoutMs = 8000, postJson = defaultPostJson } = {}) {
  const baseUrl = normalizeConversationServiceOrigin(env?.ANTIGRAVITY_LS_ADDRESS);
  const csrfToken = typeof env?.ANTIGRAVITY_CSRF_TOKEN === 'string' ? env.ANTIGRAVITY_CSRF_TOKEN.trim() : '';

  function isAvailable() {
    return Boolean(baseUrl && csrfToken);
  }

  async function rpc(method, body = {}) {
    if (!isAvailable()) {
      throw new Error('Antigravity ConversationService unavailable (missing ANTIGRAVITY_LS_ADDRESS or ANTIGRAVITY_CSRF_TOKEN)');
    }
    const url = `${baseUrl}/product.v1.ConversationService/${method}`;
    return postJson(url, { 'x-antigravity-csrf-token': csrfToken }, body, timeoutMs);
  }

  function listConversations({
    pageSize = 15,
    pageToken,
    projectId,
    parentConversationId,
    tags,
    includeArchived = false,
  } = {}) {
    const reqBody = {
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 15)),
      includeArchived: Boolean(includeArchived),
    };
    if (typeof pageToken === 'string' && pageToken) reqBody.pageToken = pageToken;
    if (typeof projectId === 'string' && projectId) reqBody.projectId = projectId;
    if (typeof parentConversationId === 'string') reqBody.parentConversationId = parentConversationId;
    if (Array.isArray(tags) && tags.length > 0) reqBody.tags = tags.map((t) => String(t));
    return rpc('ListConversations', reqBody);
  }

  function getConversation(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) throw new Error('conversationId is required');
    return rpc('GetConversation', { conversationId: id });
  }

  function createConversation({
    title,
    model = 'flash',
    tags = ['mp-studio'],
    prompt,
    projectId,
    environmentId,
  } = {}) {
    const reqBody = {
      model: String(model || 'flash'),
    };
    if (typeof title === 'string' && title.trim()) reqBody.title = title.trim();
    if (Array.isArray(tags) && tags.length > 0) reqBody.tags = tags.map((t) => String(t)).filter(Boolean);
    if (typeof projectId === 'string' && projectId.trim()) reqBody.projectId = projectId.trim();
    if (typeof environmentId === 'string' && environmentId.trim() && reqBody.projectId) {
      reqBody.environmentId = environmentId.trim();
    }
    if (typeof prompt === 'string' && prompt.trim()) {
      reqBody.prompt = [{ text: prompt.trim() }];
    } else if (Array.isArray(prompt) && prompt.length > 0) {
      reqBody.prompt = prompt;
    }
    return rpc('CreateConversation', reqBody);
  }

  function updateConversation({ conversationId, annotations = {} } = {}) {
    const id = String(conversationId || '').trim();
    if (!id) throw new Error('conversationId is required');
    if (!annotations || typeof annotations !== 'object') {
      throw new Error('annotations object is required');
    }
    const clean = {};
    if (typeof annotations.title === 'string') clean.title = annotations.title;
    if (typeof annotations.archived === 'boolean') clean.archived = annotations.archived;
    if (typeof annotations.pinned === 'boolean') clean.pinned = annotations.pinned;
    if (typeof annotations.starred === 'boolean') clean.starred = annotations.starred;
    if (Array.isArray(annotations.tags)) clean.tags = annotations.tags.map((t) => String(t)).filter(Boolean);
    if (typeof annotations.conversationGroupId === 'string') {
      clean.conversationGroupId = annotations.conversationGroupId;
    }
    return rpc('UpdateConversation', { conversationId: id, annotations: clean });
  }

  return {
    baseUrl,
    isAvailable,
    listConversations,
    getConversation,
    createConversation,
    updateConversation,
  };
}
