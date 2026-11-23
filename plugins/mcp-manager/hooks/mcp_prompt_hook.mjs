#!/usr/bin/env node
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computePromptHash,
  readPromptsStore,
  resolveConfigRoot,
  resolveHookStateDir,
} from './prompt_store.mjs';

const MAX_TRANSCRIPT_TAIL_BYTES = 512 * 1024;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DIRECT_MCP_TOOL_NAMES = new Set([
  'call_mcp_tool',
  'mcp_tool',
  'list_resources',
  'read_resource',
]);

const READ_LIST_TOOL_NAMES = new Set([
  'view_file',
  'read_file',
  'list_dir',
  'find_by_name',
  'grep_search',
  'view_file_outline',
  'view_code_item',
]);

const PATH_ARG_KEYS = [
  'Path',
  'AbsolutePath',
  'DirectoryPath',
  'SearchDirectory',
  'path',
  'file_path',
  'filePath',
  'absolutePath',
  'directoryPath',
  'searchDirectory',
];

const MCP_SCHEMA_PATH_RE = /(?:^|[\\/])mcp[\\/]([^\\/]+)(?:[\\/]|$)/i;

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function readJsonObjSafe(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Strip matching wrapping single or double quotes (transcript.jsonl stores JSON-encoded arg strings).
 */
export function stripWrappingQuotes(val) {
  if (typeof val !== 'string') return '';
  let s = val.trim();
  while (
    s.length >= 2
    && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function normalizeNameSet(configuredNames) {
  if (configuredNames instanceof Set) return configuredNames;
  if (Array.isArray(configuredNames)) return new Set(configuredNames);
  if (configuredNames && typeof configuredNames[Symbol.iterator] === 'function') {
    return new Set(configuredNames);
  }
  return new Set();
}

/**
 * Scan installed/builtin plugin mcp_config.json files to map Antigravity 2.34+
 * `<pluginSlug>_<serverName>` host identifiers back to their raw server names.
 */
export function buildPluginServerAliasMap({ homeDir = homedir(), configRoot } = {}) {
  const root = resolveConfigRoot({ homeDir, configRoot });
  const map = new Map();
  const pluginRoots = [
    join(root, 'plugins'),
    join(homeDir, '.gemini', 'antigravity', 'builtin', 'plugins'),
  ];
  for (const pRoot of pluginRoots) {
    if (!existsSync(pRoot)) continue;
    let dirs = [];
    try {
      dirs = readdirSync(pRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of dirs) {
      if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
      const pDir = join(pRoot, ent.name);
      const mcpObj = readJsonObjSafe(join(pDir, 'mcp_config.json'));
      if (!mcpObj || !isPlainObject(mcpObj.mcpServers)) continue;
      const manifest = readJsonObjSafe(join(pDir, 'plugin.json')) || {};
      const pluginSlug = typeof manifest.name === 'string' && manifest.name.trim()
        ? manifest.name.trim()
        : ent.name;
      for (const rawSrv of Object.keys(mcpObj.mcpServers)) {
        map.set(`${pluginSlug}_${rawSrv}`, rawSrv);
        if (ent.name !== pluginSlug) {
          map.set(`${ent.name}_${rawSrv}`, rawSrv);
        }
      }
    }
  }
  return map;
}

function resolveAliasedServer(candidate, nameSet, aliasMap) {
  if (!candidate) return '';
  if (nameSet.has(candidate)) return candidate;
  if (aliasMap instanceof Map && aliasMap.has(candidate)) {
    const raw = aliasMap.get(candidate);
    if (nameSet.has(raw)) return raw;
  }
  return '';
}

/**
 * Extract matching configured MCP server names referenced by a single toolCall object.
 */
export function extractServersFromToolCall(
  toolCall,
  configuredNames,
  { includeSchemaReads = true, aliasMap = null } = {},
) {
  const nameSet = normalizeNameSet(configuredNames);
  if (nameSet.size === 0 || !isPlainObject(toolCall)) return [];

  const toolName = String(toolCall.name || '').trim();
  if (!toolName) return [];
  const args = isPlainObject(toolCall.args) ? toolCall.args : {};
  const matched = [];
  const addMatch = (candidate) => {
    const srv = resolveAliasedServer(candidate, nameSet, aliasMap);
    if (srv && !matched.includes(srv)) {
      matched.push(srv);
    }
  };

  if (DIRECT_MCP_TOOL_NAMES.has(toolName)) {
    const rawSrv = args.ServerName ?? args.serverName ?? args.server_name;
    addMatch(stripWrappingQuotes(rawSrv));
  }

  if (toolName.startsWith('mcp_')) {
    let bestPrefixLen = -1;
    let bestResolved = '';
    for (const srv of nameSet) {
      if (toolName.startsWith(`mcp_${srv}_`) && srv.length > bestPrefixLen) {
        bestPrefixLen = srv.length;
        bestResolved = srv;
      }
    }
    if (aliasMap instanceof Map) {
      for (const [namespaced, rawSrv] of aliasMap.entries()) {
        if (!nameSet.has(rawSrv)) continue;
        if (toolName.startsWith(`mcp_${namespaced}_`) && namespaced.length > bestPrefixLen) {
          bestPrefixLen = namespaced.length;
          bestResolved = rawSrv;
        }
      }
    }
    if (bestResolved) addMatch(bestResolved);
  }

  if (includeSchemaReads && READ_LIST_TOOL_NAMES.has(toolName)) {
    for (const key of PATH_ARG_KEYS) {
      const candidate = stripWrappingQuotes(args[key]);
      if (!candidate) continue;
      const m = MCP_SCHEMA_PATH_RE.exec(candidate);
      if (m && m[1]) {
        addMatch(m[1]);
      }
    }
  }

  return matched;
}

/**
 * Incrementally scan new complete JSONL lines in transcriptPath for PLANNER_RESPONSE tool_calls.
 */
export function extractServersFromTranscript(
  transcriptPath,
  fromOffset = 0,
  configuredNames = [],
  { aliasMap = null } = {},
) {
  const nameSet = normalizeNameSet(configuredNames);
  const startOffset = typeof fromOffset === 'number' && fromOffset >= 0 ? fromOffset : 0;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return { servers: [], nextOffset: startOffset };
  }

  let size = 0;
  try {
    size = statSync(transcriptPath).size;
  } catch {
    return { servers: [], nextOffset: startOffset };
  }

  let offset = startOffset;
  if (size < offset) offset = 0;
  if (offset === 0 && size > MAX_TRANSCRIPT_TAIL_BYTES) {
    offset = size - MAX_TRANSCRIPT_TAIL_BYTES;
  }
  if (size <= offset || nameSet.size === 0) {
    return { servers: [], nextOffset: size < startOffset ? 0 : offset };
  }

  const len = size - offset;
  const buf = Buffer.allocUnsafe(len);
  let fd;
  let bytesRead = 0;
  try {
    fd = openSync(transcriptPath, 'r');
    bytesRead = readSync(fd, buf, 0, len, offset);
  } catch {
    return { servers: [], nextOffset: offset };
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }

  if (bytesRead <= 0) {
    return { servers: [], nextOffset: offset };
  }

  const slice = buf.subarray(0, bytesRead);
  const lastNl = slice.lastIndexOf(0x0a);
  if (lastNl === -1) {
    return { servers: [], nextOffset: offset };
  }

  const text = slice.subarray(0, lastNl + 1).toString('utf-8');
  const nextOffset = offset + lastNl + 1;
  const servers = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (rec?.type !== 'PLANNER_RESPONSE' || !Array.isArray(rec.tool_calls)) continue;
    for (const tc of rec.tool_calls) {
      for (const srv of extractServersFromToolCall(tc, nameSet, { includeSchemaReads: true, aliasMap })) {
        if (!servers.includes(srv)) servers.push(srv);
      }
    }
  }

  return { servers, nextOffset };
}

function readPluginDisabledMap(configRoot) {
  const map = {};
  const cfg = readJsonObjSafe(join(configRoot, 'config.json'));
  if (!cfg || !isPlainObject(cfg.plugins)) return map;
  for (const [dir, val] of Object.entries(cfg.plugins)) {
    if (isPlainObject(val) && typeof val.enabled === 'boolean') {
      map[dir] = !val.enabled;
    }
  }
  return map;
}

function normalizeWorkspacePath(ws) {
  if (typeof ws !== 'string') return '';
  const trimmed = ws.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('file://')) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return '';
    }
  }
  return trimmed;
}

/**
 * Determine whether a server is disabled across all discovered mcp_config.json files.
 * Returns true ONLY if the server appears at least once and every occurrence is disabled.
 */
export function isServerDisabledInConfigs(
  serverName,
  { homeDir = homedir(), configRoot, workspacePaths = [] } = {},
) {
  const root = resolveConfigRoot({ homeDir, configRoot });
  let foundCount = 0;
  let enabledCount = 0;

  const inspectMcpMap = (mcpObj, parentDisabled = false, pluginPrefixes = []) => {
    if (!mcpObj || !isPlainObject(mcpObj.mcpServers)) return;
    let candidateKey = Object.prototype.hasOwnProperty.call(mcpObj.mcpServers, serverName)
      ? serverName
      : '';
    if (!candidateKey && pluginPrefixes.length > 0) {
      for (const prefix of pluginPrefixes) {
        if (prefix && serverName.startsWith(`${prefix}_`)) {
          const stripped = serverName.slice(prefix.length + 1);
          if (Object.prototype.hasOwnProperty.call(mcpObj.mcpServers, stripped)) {
            candidateKey = stripped;
            break;
          }
        }
      }
    }
    if (!candidateKey) return;
    const entry = mcpObj.mcpServers[candidateKey];
    if (!isPlainObject(entry)) return;
    foundCount += 1;
    if (!parentDisabled && !entry.disabled) {
      enabledCount += 1;
    }
  };

  if (Array.isArray(workspacePaths)) {
    for (const rawWs of workspacePaths) {
      const ws = normalizeWorkspacePath(rawWs);
      if (!ws) continue;
      inspectMcpMap(readJsonObjSafe(join(ws, '.agents', 'mcp_config.json')), false);
    }
  }

  inspectMcpMap(readJsonObjSafe(join(root, 'mcp_config.json')), false);

  const disabledOverride = readPluginDisabledMap(root);
  const pluginRoots = [
    join(root, 'plugins'),
    join(homeDir, '.gemini', 'antigravity', 'builtin', 'plugins'),
  ];
  for (const pRoot of pluginRoots) {
    if (!existsSync(pRoot)) continue;
    let dirs = [];
    try {
      dirs = readdirSync(pRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of dirs) {
      if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
      const pDir = join(pRoot, ent.name);
      const mcpObj = readJsonObjSafe(join(pDir, 'mcp_config.json'));
      if (!mcpObj) continue;
      const manifest = readJsonObjSafe(join(pDir, 'plugin.json')) || {};
      const pluginSlug = typeof manifest.name === 'string' && manifest.name.trim()
        ? manifest.name.trim()
        : ent.name;
      const pluginDisabled = typeof disabledOverride[ent.name] === 'boolean'
        ? disabledOverride[ent.name]
        : Boolean(manifest.disabled);
      inspectMcpMap(mcpObj, pluginDisabled, [pluginSlug, ent.name]);
    }
  }

  return foundCount > 0 && enabledCount === 0;
}

/**
 * Format one or more per-server instructions into a single concise systemMessage block.
 */
export function formatInjectedSystemMessage(entries) {
  const blocks = entries.map(({ serverName, entry }) => (
    `<mcp_instructions server="${serverName}">\n${entry.prompt}\n</mcp_instructions>`
  ));
  return [
    '[MCP Manager — Active Per-Server Instructions]',
    'Follow these user-configured instructions whenever using the MCP server(s) below:',
    '',
    ...blocks.flatMap((b, i) => (i === 0 ? [b] : ['', b])),
  ].join('\n');
}

/**
 * Format the one-time PreToolUse deny reason in strict mode.
 */
export function formatStrictDenyReason(serverName, entry) {
  return [
    `[MCP Manager — Mandatory Server Instructions for "${serverName}"]`,
    `Before calling "${serverName}", read and follow these user-configured instructions, then immediately retry your tool call:`,
    '',
    `<mcp_instructions server="${serverName}">`,
    entry.prompt,
    '</mcp_instructions>',
  ].join('\n');
}

function sessionFilePath(stateDir, conversationId) {
  const raw = String(conversationId || 'default').trim() || 'default';
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'default';
  return join(stateDir, `${safe}.json`);
}

function loadSessionState(filePath, conversationId) {
  const empty = {
    conversationId: String(conversationId || 'default'),
    delivered: {},
    pending: [],
    transcriptOffset: 0,
    updatedAt: 0,
  };
  if (!existsSync(filePath)) return empty;
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!isPlainObject(parsed)) return empty;
    return {
      conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : empty.conversationId,
      delivered: isPlainObject(parsed.delivered) ? { ...parsed.delivered } : {},
      pending: Array.isArray(parsed.pending) ? [...new Set(parsed.pending.filter((s) => typeof s === 'string'))] : [],
      transcriptOffset: typeof parsed.transcriptOffset === 'number' && parsed.transcriptOffset >= 0
        ? parsed.transcriptOffset
        : 0,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return empty;
  }
}

function saveSessionState(filePath, state, nowMs) {
  mkdirSync(join(filePath, '..'), { recursive: true });
  const payload = {
    ...state,
    updatedAt: nowMs,
  };
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
  renameSync(tmp, filePath);
}

function pruneOldSessionFiles(stateDir, nowMs) {
  if (!existsSync(stateDir)) return;
  try {
    for (const ent of readdirSync(stateDir, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
      const full = join(stateDir, ent.name);
      try {
        const st = statSync(full);
        if (nowMs - st.mtimeMs > SESSION_TTL_MS) {
          unlinkSync(full);
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function isDelivered(sessionState, serverName, entry) {
  return sessionState.delivered?.[serverName] === computePromptHash(entry);
}

function markDelivered(sessionState, serverName, entry) {
  sessionState.delivered[serverName] = computePromptHash(entry);
  sessionState.pending = sessionState.pending.filter((s) => s !== serverName);
}

/**
 * Core hook event handler shared by unit tests and the CLI entrypoint.
 */
export function handleHookEvent(payload, opts = {}) {
  const event = String(payload?.hookEventName || '').trim();
  const passthrough = () => (event === 'PreToolUse' ? { decision: 'ask' } : {});

  const homeDir = opts.homeDir || homedir();
  const configRoot = resolveConfigRoot({ homeDir, configRoot: opts.configRoot });
  const stateDir = resolveHookStateDir({ homeDir, configRoot, stateDir: opts.stateDir });
  const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();

  const { prompts } = readPromptsStore({
    homeDir,
    configRoot,
    promptsFile: opts.promptsFile,
  });

  const activeMap = new Map();
  for (const [serverName, entry] of Object.entries(prompts)) {
    if (entry?.enabled && entry?.prompt) {
      activeMap.set(serverName, entry);
    }
  }
  if (activeMap.size === 0) {
    return passthrough();
  }

  const activeNames = new Set(activeMap.keys());
  const aliasMap = buildPluginServerAliasMap({ homeDir, configRoot });
  const convId = payload?.conversationId || 'default';
  const sPath = sessionFilePath(stateDir, convId);
  const sessionState = loadSessionState(sPath, convId);
  let stateDirty = false;

  if (event === 'SessionStart') {
    pruneOldSessionFiles(stateDir, nowMs);
    const toInject = [];
    for (const [serverName, entry] of activeMap.entries()) {
      if (entry.mode !== 'session_start') continue;
      if (isDelivered(sessionState, serverName, entry)) continue;
      if (isServerDisabledInConfigs(serverName, {
        homeDir,
        configRoot,
        workspacePaths: payload?.workspacePaths || [],
      })) {
        continue;
      }
      toInject.push({ serverName, entry });
    }
    if (toInject.length === 0) {
      return {};
    }
    for (const item of toInject) {
      markDelivered(sessionState, item.serverName, item.entry);
    }
    saveSessionState(sPath, sessionState, nowMs);
    return {
      injectSteps: [
        {
          systemMessage: {
            systemMessage: formatInjectedSystemMessage(toInject),
          },
        },
      ],
    };
  }

  if (event === 'PostToolUse') {
    const matched = extractServersFromToolCall(payload?.toolCall, activeNames, {
      includeSchemaReads: true,
      aliasMap,
    });
    for (const srv of matched) {
      const entry = activeMap.get(srv);
      if (!entry || isDelivered(sessionState, srv, entry)) continue;
      if (!sessionState.pending.includes(srv)) {
        sessionState.pending.push(srv);
        stateDirty = true;
      }
    }
    if (stateDirty) {
      saveSessionState(sPath, sessionState, nowMs);
    }
    return {};
  }

  if (event === 'PreInvocation') {
    const candidates = [];
    const addCandidate = (srv) => {
      if (!candidates.includes(srv)) candidates.push(srv);
    };

    const nextPending = [];
    for (const srv of sessionState.pending) {
      const entry = activeMap.get(srv);
      if (!entry || isDelivered(sessionState, srv, entry)) {
        stateDirty = true;
        continue;
      }
      nextPending.push(srv);
      addCandidate(srv);
    }
    if (nextPending.length !== sessionState.pending.length) {
      sessionState.pending = nextPending;
    }

    if (payload?.transcriptPath) {
      const { servers: transcriptServers, nextOffset } = extractServersFromTranscript(
        payload.transcriptPath,
        sessionState.transcriptOffset,
        activeNames,
        { aliasMap },
      );
      if (nextOffset !== sessionState.transcriptOffset) {
        sessionState.transcriptOffset = nextOffset;
        stateDirty = true;
      }
      for (const srv of transcriptServers) {
        const entry = activeMap.get(srv);
        if (entry && !isDelivered(sessionState, srv, entry)) {
          addCandidate(srv);
        }
      }
    }

    const userInput = typeof payload?.lastUserInput === 'string'
      ? payload.lastUserInput.toLowerCase()
      : '';
    if (userInput) {
      for (const [srv, entry] of activeMap.entries()) {
        if (isDelivered(sessionState, srv, entry)) continue;
        if (!Array.isArray(entry.keywords) || entry.keywords.length === 0) continue;
        if (entry.keywords.some((kw) => userInput.includes(kw.toLowerCase()))) {
          addCandidate(srv);
        }
      }
    }

    for (const [srv, entry] of activeMap.entries()) {
      if (entry.mode !== 'session_start') continue;
      if (isDelivered(sessionState, srv, entry)) continue;
      if (isServerDisabledInConfigs(srv, {
        homeDir,
        configRoot,
        workspacePaths: payload?.workspacePaths || [],
      })) {
        continue;
      }
      addCandidate(srv);
    }

    const toInject = candidates
      .map((srv) => ({ serverName: srv, entry: activeMap.get(srv) }))
      .filter(({ serverName, entry }) => Boolean(entry) && !isDelivered(sessionState, serverName, entry));

    if (toInject.length > 0) {
      for (const item of toInject) {
        markDelivered(sessionState, item.serverName, item.entry);
      }
      saveSessionState(sPath, sessionState, nowMs);
      return {
        injectSteps: [
          {
            systemMessage: {
              systemMessage: formatInjectedSystemMessage(toInject),
            },
          },
        ],
      };
    }

    if (stateDirty) {
      saveSessionState(sPath, sessionState, nowMs);
    }
    return {};
  }

  if (event === 'PreToolUse') {
    const matched = extractServersFromToolCall(payload?.toolCall, activeNames, {
      includeSchemaReads: false,
      aliasMap,
    });
    for (const srv of matched) {
      const entry = activeMap.get(srv);
      if (!entry || isDelivered(sessionState, srv, entry)) continue;

      if (entry.mode === 'strict') {
        markDelivered(sessionState, srv, entry);
        saveSessionState(sPath, sessionState, nowMs);
        return {
          decision: 'deny',
          reason: formatStrictDenyReason(srv, entry),
        };
      }

      if (!sessionState.pending.includes(srv)) {
        sessionState.pending.push(srv);
        stateDirty = true;
      }
    }

    if (stateDirty) {
      saveSessionState(sPath, sessionState, nowMs);
    }
    return { decision: 'ask' };
  }

  return passthrough();
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (isMainModule()) {
  let payload = {};
  try {
    const stdinText = readFileSync(0, 'utf-8').trim();
    if (stdinText) {
      payload = JSON.parse(stdinText);
    }
    const output = handleHookEvent(payload);
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch {
    const fallback = payload?.hookEventName === 'PreToolUse' ? { decision: 'ask' } : {};
    process.stdout.write(`${JSON.stringify(fallback)}\n`);
  }
}
