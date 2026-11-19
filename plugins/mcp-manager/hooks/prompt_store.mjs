import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const PROMPT_MODES = ['on_demand', 'strict', 'session_start'];
export const MAX_PROMPT_LENGTH = 16000;
export const SAFE_SERVER_NAME_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_KEYWORDS = 30;

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Resolve the Antigravity config root (~/.gemini/config by default).
 */
export function resolveConfigRoot({ homeDir, configRoot } = {}) {
  return configRoot || join(homeDir || homedir(), '.gemini', 'config');
}

/**
 * Resolve the shared prompts.json file path used by both the Sidecar UI and Lifecycle Hooks.
 */
export function resolvePromptsFile({ homeDir, configRoot, promptsFile } = {}) {
  return (
    promptsFile
    || process.env.MCP_MANAGER_PROMPTS_FILE
    || join(resolveConfigRoot({ homeDir, configRoot }), 'sidecar_data', 'mcp_manager', 'prompts.json')
  );
}

/**
 * Resolve the directory holding per-conversation hook delivery state files.
 */
export function resolveHookStateDir({ homeDir, configRoot, stateDir } = {}) {
  return (
    stateDir
    || process.env.MCP_MANAGER_HOOK_STATE_DIR
    || join(resolveConfigRoot({ homeDir, configRoot }), 'sidecar_data', 'mcp_manager', 'hook_sessions')
  );
}

/**
 * Parse and deduplicate trigger keywords (case-insensitively, preserving first casing).
 */
export function parseKeywords(raw) {
  const tokens = Array.isArray(raw)
    ? raw.flatMap((item) => String(item ?? '').split(/[,，\n]/))
    : (typeof raw === 'string' ? raw.split(/[,，\n]/) : []);

  const out = [];
  const seen = new Set();
  for (const part of tokens) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

/**
 * Normalize a per-server prompt configuration entry.
 */
export function normalizePromptEntry(raw, { strict = false } = {}) {
  const src = isPlainObject(raw) ? raw : {};
  let prompt = typeof src.prompt === 'string' ? src.prompt.trim() : '';
  if (prompt.length > MAX_PROMPT_LENGTH) {
    if (strict) {
      throw new Error(`提示词长度不能超过 ${MAX_PROMPT_LENGTH} 个字符`);
    }
    prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
  }

  const rawMode = src.mode === undefined || src.mode === null || src.mode === '' ? 'on_demand' : String(src.mode);
  let mode = rawMode;
  if (!PROMPT_MODES.includes(rawMode)) {
    if (strict) {
      throw new Error(`不支持的注入模式 "${rawMode}"，可选值: ${PROMPT_MODES.join(', ')}`);
    }
    mode = 'on_demand';
  }

  return {
    enabled: src.enabled !== false,
    mode,
    prompt,
    keywords: parseKeywords(src.keywords),
    updatedAt: typeof src.updatedAt === 'string' && src.updatedAt.trim()
      ? src.updatedAt.trim()
      : new Date().toISOString(),
  };
}

/**
 * Compute a short content hash covering mode and prompt text for session deduplication.
 */
export function computePromptHash(entry) {
  const payload = JSON.stringify({
    mode: entry?.mode || 'on_demand',
    prompt: entry?.prompt || '',
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Safely read and normalize prompts.json; returns an empty store on missing or corrupt files.
 */
export function readPromptsStore(opts = {}) {
  const filePath = resolvePromptsFile(opts);
  if (!existsSync(filePath)) {
    return { schemaVersion: 1, prompts: {} };
  }
  try {
    const rawText = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    if (!rawText.trim()) {
      return { schemaVersion: 1, prompts: {} };
    }
    const parsed = JSON.parse(rawText);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.prompts)) {
      return { schemaVersion: 1, prompts: {} };
    }
    const prompts = {};
    for (const [serverName, entry] of Object.entries(parsed.prompts)) {
      if (!SAFE_SERVER_NAME_RE.test(serverName) || !isPlainObject(entry)) continue;
      const norm = normalizePromptEntry(entry, { strict: false });
      if (!norm.prompt) continue;
      prompts[serverName] = norm;
    }
    return { schemaVersion: 1, prompts };
  } catch {
    return { schemaVersion: 1, prompts: {} };
  }
}

/**
 * Atomically write prompts.json with restrictive 0600 permissions.
 */
export function writePromptsStore(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const payload = {
    schemaVersion: 1,
    prompts: isPlainObject(data?.prompts) ? data.prompts : {},
  };
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
  renameSync(tmp, filePath);
}

/**
 * Save or clear a per-server prompt configuration.
 */
export function saveServerPrompt(
  { serverName, prompt, enabled = true, mode = 'on_demand', keywords = [] },
  opts = {},
) {
  const cleanName = String(serverName || '').trim();
  if (!cleanName || !SAFE_SERVER_NAME_RE.test(cleanName)) {
    throw new Error('服务名称仅支持字母、数字、点(.)、下划线(_)和短横线(-)');
  }

  const normalized = normalizePromptEntry(
    {
      prompt: prompt ?? '',
      enabled,
      mode,
      keywords,
      updatedAt: new Date().toISOString(),
    },
    { strict: true },
  );

  const filePath = resolvePromptsFile(opts);
  const store = readPromptsStore({ ...opts, promptsFile: filePath });

  if (!normalized.prompt) {
    if (Object.prototype.hasOwnProperty.call(store.prompts, cleanName)) {
      delete store.prompts[cleanName];
      writePromptsStore(filePath, store);
    }
    return {
      ok: true,
      serverName: cleanName,
      deleted: true,
      entry: null,
      filePath,
    };
  }

  store.prompts[cleanName] = normalized;
  writePromptsStore(filePath, store);
  return {
    ok: true,
    serverName: cleanName,
    deleted: false,
    entry: normalized,
    filePath,
  };
}

/**
 * Delete a per-server prompt configuration if present.
 */
export function deleteServerPrompt(serverName, opts = {}) {
  const cleanName = String(serverName || '').trim();
  const filePath = resolvePromptsFile(opts);
  if (!cleanName) {
    return { ok: true, serverName: cleanName, removed: false, filePath };
  }
  const store = readPromptsStore({ ...opts, promptsFile: filePath });
  if (!Object.prototype.hasOwnProperty.call(store.prompts, cleanName)) {
    return { ok: true, serverName: cleanName, removed: false, filePath };
  }
  delete store.prompts[cleanName];
  writePromptsStore(filePath, store);
  return { ok: true, serverName: cleanName, removed: true, filePath };
}

/**
 * Move an existing server prompt entry when a server is renamed, if the target name is free.
 */
export function renameServerPrompt(oldName, newName, opts = {}) {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!from || !to || from === to || !SAFE_SERVER_NAME_RE.test(to)) {
    return { ok: false, renamed: false };
  }
  const filePath = resolvePromptsFile(opts);
  const store = readPromptsStore({ ...opts, promptsFile: filePath });
  if (
    !Object.prototype.hasOwnProperty.call(store.prompts, from)
    || Object.prototype.hasOwnProperty.call(store.prompts, to)
  ) {
    return { ok: true, renamed: false };
  }
  store.prompts[to] = {
    ...store.prompts[from],
    updatedAt: new Date().toISOString(),
  };
  delete store.prompts[from];
  writePromptsStore(filePath, store);
  return { ok: true, renamed: true };
}
