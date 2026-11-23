import {
  accessSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import {
  deleteServerPrompt,
  readPromptsStore,
  renameServerPrompt,
  resolvePromptsFile,
  saveServerPrompt,
} from '../../hooks/prompt_store.mjs';

const SAFE_NAME_RE = /^[a-zA-Z0-9._-]+$/;
const PLUGIN_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SSE_PATH_RE = /(?:^|\/)sse(?:$|[?#])/i;
const BACKUP_FILE_RE = /^[a-zA-Z0-9._-]+\.bak$/;
const WIN_PATHEXT_DEFAULT = ['.exe', '.cmd', '.bat', '.com'];

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

const PLUGIN_VAR_RE = /\$\{(PLUGIN_ROOT|PLUGIN_DATA)\}/;

export function containsPluginVariables(cfg) {
  if (!isPlainObject(cfg)) return false;
  const checkStr = (v) => typeof v === 'string' && PLUGIN_VAR_RE.test(v);
  if (checkStr(cfg.command) || checkStr(cfg.cwd) || checkStr(cfg.url) || checkStr(cfg.serverUrl)) {
    return true;
  }
  if (Array.isArray(cfg.args) && cfg.args.some(checkStr)) return true;
  if (isPlainObject(cfg.env) && Object.values(cfg.env).some(checkStr)) return true;
  if (isPlainObject(cfg.headers) && Object.values(cfg.headers).some(checkStr)) return true;
  return false;
}

export function expandPluginVariables(rawConfig, { pluginRoot = '', pluginData = '' } = {}) {
  if (!isPlainObject(rawConfig)) return rawConfig;
  const rootVal = typeof pluginRoot === 'string' ? pluginRoot : '';
  const dataVal = typeof pluginData === 'string' ? pluginData : '';
  if (!rootVal && !dataVal) return rawConfig;

  const replaceVars = (val) => {
    if (typeof val !== 'string') return val;
    let out = val;
    if (rootVal) out = out.replace(/\$\{PLUGIN_ROOT\}/g, rootVal);
    if (dataVal) out = out.replace(/\$\{PLUGIN_DATA\}/g, dataVal);
    return out;
  };

  const cloned = { ...rawConfig };
  if (typeof cloned.command === 'string') cloned.command = replaceVars(cloned.command);
  if (typeof cloned.cwd === 'string') cloned.cwd = replaceVars(cloned.cwd);
  if (typeof cloned.url === 'string') cloned.url = replaceVars(cloned.url);
  if (typeof cloned.serverUrl === 'string') cloned.serverUrl = replaceVars(cloned.serverUrl);
  if (Array.isArray(cloned.args)) cloned.args = cloned.args.map(replaceVars);
  if (isPlainObject(cloned.env)) {
    const nextEnv = {};
    for (const [k, v] of Object.entries(cloned.env)) nextEnv[k] = replaceVars(v);
    cloned.env = nextEnv;
  }
  if (isPlainObject(cloned.headers)) {
    const nextHeaders = {};
    for (const [k, v] of Object.entries(cloned.headers)) nextHeaders[k] = replaceVars(v);
    cloned.headers = nextHeaders;
  }
  return cloned;
}

function readJsonSafe(filePath) {
  if (!existsSync(filePath)) {
    return { exists: false, raw: '{\n  "mcpServers": {}\n}\n', parsed: { mcpServers: {} }, parseError: null };
  }
  const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : { mcpServers: {} };
    if (!isPlainObject(parsed)) {
      return { exists: true, raw, parsed: null, parseError: 'Root JSON value must be an object' };
    }
    return { exists: true, raw, parsed, parseError: null };
  } catch (err) {
    return { exists: true, raw, parsed: null, parseError: err.message };
  }
}

function discoverNvmBins(home) {
  const nvmDir = join(home, '.nvm', 'versions', 'node');
  if (!existsSync(nvmDir)) return [];
  try {
    return readdirSync(nvmDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((ver) => join(nvmDir, ver, 'bin'));
  } catch {
    return [];
  }
}

function buildSearchPaths(home, platform = process.platform) {
  const envPaths = (process.env.PATH || '').split(delimiter).filter(Boolean);
  const extraPaths = platform === 'win32'
    ? [
        join(home, '.local', 'bin'),
        join(home, '.cargo', 'bin'),
        join(home, '.bun', 'bin'),
        join(home, 'AppData', 'Roaming', 'npm'),
      ]
    : [
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        join(home, '.local', 'bin'),
        join(home, '.cargo', 'bin'),
        join(home, '.bun', 'bin'),
        join(home, '.volta', 'bin'),
        join(home, '.hermes', 'node', 'bin'),
        ...discoverNvmBins(home),
      ];
  return [...new Set([...envPaths, ...extraPaths])];
}

function windowsCandidatePaths(basePath) {
  if (extname(basePath)) return [basePath];
  const rawExt = (process.env.PATHEXT || '').split(';').map((e) => e.trim()).filter(Boolean);
  const exts = rawExt.length ? rawExt : WIN_PATHEXT_DEFAULT;
  return [basePath, ...exts.map((ext) => `${basePath}${ext.toLowerCase()}`)];
}

export function resolveExecutable(cmd, home = homedir(), platform = process.platform) {
  if (!cmd || typeof cmd !== 'string') return { found: false, resolvedPath: null };
  const trimmed = cmd.trim();
  if (!trimmed) return { found: false, resolvedPath: null };

  const isExecutable = (p) => {
    try {
      if (!existsSync(p) || statSync(p).isDirectory()) return false;
      if (platform !== 'win32') accessSync(p, fsConstants.X_OK);
      return true;
    } catch {
      return false;
    }
  };

  const checkCandidate = (base) => {
    const candidates = platform === 'win32' ? windowsCandidatePaths(base) : [base];
    for (const c of candidates) {
      if (isExecutable(c)) return c;
    }
    return null;
  };

  if (trimmed.includes('/') || trimmed.includes('\\') || isAbsolute(trimmed)) {
    const expanded = trimmed.startsWith('~/') ? join(home, trimmed.slice(2)) : trimmed;
    const hit = checkCandidate(expanded);
    return { found: Boolean(hit), resolvedPath: hit };
  }

  for (const dir of buildSearchPaths(home, platform)) {
    const hit = checkCandidate(join(dir, trimmed));
    if (hit) return { found: true, resolvedPath: hit };
  }
  return { found: false, resolvedPath: null };
}

export function analyzeServer(name, cfg, home = homedir(), context = {}) {
  const warnings = [];
  if (!isPlainObject(cfg)) {
    return {
      name,
      transport: 'invalid',
      disabled: false,
      warnings: [{ code: 'invalid_entry', level: 'error', message: '配置项必须是 JSON 对象' }],
      config: {},
    };
  }

  const usesPluginVars = containsPluginVariables(cfg);
  const hasPluginContext = Boolean(context && (context.pluginRoot || context.pluginData));
  const effectiveCfg = hasPluginContext ? expandPluginVariables(cfg, context) : cfg;

  if (usesPluginVars && !hasPluginContext) {
    warnings.push({
      code: 'plugin_vars_outside_plugin',
      level: 'warn',
      message: '检测到 ${PLUGIN_ROOT} / ${PLUGIN_DATA}：Antigravity 2.34+ 仅在插件 mcp_config.json 中自动展开这些变量，全局或工作区配置中不会展开',
    });
  }

  const hasCommand = typeof effectiveCfg.command === 'string' && effectiveCfg.command.trim().length > 0;
  const endpointUrl = typeof effectiveCfg.url === 'string' && effectiveCfg.url.trim()
    ? effectiveCfg.url.trim()
    : (typeof effectiveCfg.serverUrl === 'string' && effectiveCfg.serverUrl.trim() ? effectiveCfg.serverUrl.trim() : '');
  const hasUrl = endpointUrl.length > 0;

  let transport = 'unknown';
  if (hasCommand) transport = 'stdio';
  else if (hasUrl) transport = 'http';
  else {
    warnings.push({
      code: 'missing_transport',
      level: 'error',
      message: '缺少 command（本地 Stdio）或 url（远程 Streamable HTTP）',
    });
  }

  let commandCheck = null;
  if (transport === 'stdio') {
    commandCheck = resolveExecutable(effectiveCfg.command, home);
    if (!commandCheck.found) {
      warnings.push({
        code: 'command_not_found',
        level: 'warn',
        message: `未在 PATH 中找到命令 "${effectiveCfg.command}"`,
      });
    }
    if (typeof effectiveCfg.cwd === 'string' && effectiveCfg.cwd.trim() && !existsSync(effectiveCfg.cwd.trim())) {
      warnings.push({
        code: 'cwd_missing',
        level: 'warn',
        message: `工作目录不存在: ${effectiveCfg.cwd}`,
      });
    }
  }

  if (transport === 'http') {
    if (!/^https?:\/\//i.test(endpointUrl)) {
      warnings.push({
        code: 'invalid_url',
        level: 'error',
        message: 'url 必须以 http:// 或 https:// 开头',
      });
    } else if (SSE_PATH_RE.test(endpointUrl)) {
      warnings.push({
        code: 'legacy_sse',
        level: 'warn',
        message: '检测到 /sse 路径：Antigravity 仅原生支持 Streamable HTTP（通常为 /mcp），旧版 SSE 建议转换为 mcp-remote Stdio 桥接',
        canBridgeSse: true,
      });
    }
    if (!cfg.url && cfg.serverUrl) {
      warnings.push({
        code: 'legacy_server_url',
        level: 'info',
        message: '当前使用旧字段 serverUrl，推荐迁移为标准字段 url',
      });
    }
  }

  if (Array.isArray(cfg.enabledTools) && cfg.enabledTools.length > 0 && Array.isArray(cfg.disabledTools) && cfg.disabledTools.length > 0) {
    warnings.push({
      code: 'both_tool_filters',
      level: 'info',
      message: '同时设置了 enabledTools 和 disabledTools，白名单 enabledTools 将优先生效',
    });
  }

  return {
    name,
    transport,
    disabled: Boolean(cfg.disabled),
    endpointUrl: endpointUrl || null,
    resolvedCommand: commandCheck?.resolvedPath || null,
    usesPluginVars,
    warnings,
    config: cfg,
  };
}

export function normalizeSnippetInput(input) {
  let obj = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('粘贴内容不能为空');
    obj = JSON.parse(trimmed);
  }
  if (!isPlainObject(obj)) {
    throw new Error('导入内容必须是 JSON 对象');
  }

  let rawMap = null;
  if (isPlainObject(obj.mcpServers)) rawMap = obj.mcpServers;
  else if (isPlainObject(obj.servers)) rawMap = obj.servers; // VS Code format
  else if (typeof obj.command === 'string' || typeof obj.url === 'string' || typeof obj.serverUrl === 'string') {
    throw new Error('检测到单个服务配置，请包裹为 { "server-name": { ... } } 或 { "mcpServers": { "server-name": { ... } } }');
  } else {
    rawMap = obj;
  }

  const normalized = {};
  for (const [name, entry] of Object.entries(rawMap)) {
    if (!isPlainObject(entry)) {
      throw new Error(`服务 "${name}" 的配置必须是对象`);
    }
    const clean = { ...entry };
    // Normalize VS Code / Cursor / Claude Desktop idioms cleanly
    if (clean.serverUrl && !clean.url) {
      clean.url = clean.serverUrl;
      delete clean.serverUrl;
    }
    if (clean.type === 'stdio' || clean.type === 'http' || clean.type === 'streamable-http' || clean.type === 'sse') {
      delete clean.type;
    }
    normalized[name] = clean;
  }
  return normalized;
}

export function createStore(options = {}) {
  const home = options.homeDir || homedir();
  const configRoot = options.configRoot || join(home, '.gemini', 'config');
  const globalConfigPath = options.globalConfigPath || join(configRoot, 'mcp_config.json');
  const userPluginsDir = options.userPluginsDir || join(configRoot, 'plugins');
  const builtinPluginsDir = options.builtinPluginsDir || join(home, '.gemini', 'antigravity', 'builtin', 'plugins');
  const dataDir = options.dataDir || process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || join(configRoot, 'sidecar_data', 'mcp_manager');
  const promptsFile = resolvePromptsFile({ homeDir: home, configRoot, promptsFile: options.promptsFile });
  const workspacesFile = join(dataDir, 'workspaces.json');
  const backupsDir = join(dataDir, 'backups');

  function ensureDataDir() {
    mkdirSync(dataDir, { recursive: true });
  }

  function loadWorkspaces() {
    const out = new Set();
    if (process.env.ANTIGRAVITY_WORKSPACE_PATH && existsSync(process.env.ANTIGRAVITY_WORKSPACE_PATH)) {
      out.add(resolve(process.env.ANTIGRAVITY_WORKSPACE_PATH));
    }
    if (existsSync(workspacesFile)) {
      try {
        const list = JSON.parse(readFileSync(workspacesFile, 'utf-8'));
        if (Array.isArray(list)) {
          for (const p of list) {
            if (typeof p === 'string' && p.trim()) out.add(resolve(p.trim()));
          }
        }
      } catch {
        // Ignore corrupted workspace list
      }
    }
    return [...out];
  }

  function saveWorkspaces(list) {
    ensureDataDir();
    const clean = [...new Set(list.map((p) => resolve(p)))];
    const tmp = join(dataDir, `.workspaces.tmp-${process.pid}-${Date.now()}`);
    writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', 'utf-8');
    renameSync(tmp, workspacesFile);
    return clean;
  }

  function addWorkspace(wsPath) {
    if (!wsPath || typeof wsPath !== 'string') throw new Error('请输入有效的工作区路径');
    const expanded = wsPath.trim().startsWith('~/') ? join(home, wsPath.trim().slice(2)) : wsPath.trim();
    const abs = resolve(expanded);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      throw new Error(`目录不存在: ${abs}`);
    }
    const list = loadWorkspaces();
    if (!list.includes(abs)) list.push(abs);
    return saveWorkspaces(list);
  }

  function removeWorkspace(wsPath) {
    const abs = resolve(wsPath);
    const list = loadWorkspaces().filter((p) => p !== abs);
    return saveWorkspaces(list);
  }

  function readPluginDisabledMap() {
    const map = {};
    const cfgPath = join(configRoot, 'config.json');
    if (!existsSync(cfgPath)) return map;
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
      if (isPlainObject(cfg?.plugins)) {
        for (const [dir, val] of Object.entries(cfg.plugins)) {
          if (isPlainObject(val) && typeof val.enabled === 'boolean') {
            map[dir] = !val.enabled;
          }
        }
      }
    } catch {
      // Read-only best effort
    }
    return map;
  }

  function scanPluginsDir(rootDir, isBuiltin, disabledOverrideMap) {
    const results = [];
    if (!rootDir || !existsSync(rootDir)) return results;
    let entries = [];
    try {
      entries = readdirSync(rootDir, { withFileTypes: true });
    } catch {
      return results;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
      const dirName = ent.name;
      const pluginDir = join(rootDir, dirName);
      const mcpPath = join(pluginDir, 'mcp_config.json');
      if (!existsSync(mcpPath)) continue;

      let manifest = {};
      const manifestPath = join(pluginDir, 'plugin.json');
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        } catch {
          manifest = {};
        }
      }
      const mcpInfo = readJsonSafe(mcpPath);
      const serversObj = isPlainObject(mcpInfo.parsed?.mcpServers) ? mcpInfo.parsed.mcpServers : {};
      const pluginSlug = typeof manifest.name === 'string' && manifest.name.trim()
        ? manifest.name.trim()
        : dirName;
      const pluginData = isBuiltin
        ? join(home, '.gemini', 'antigravity', 'sidecar_data', pluginSlug)
        : join(dirname(rootDir), 'plugin_data', pluginSlug);
      const pluginDisabled = typeof disabledOverrideMap[dirName] === 'boolean'
        ? disabledOverrideMap[dirName]
        : Boolean(manifest.disabled);

      const servers = Object.entries(serversObj).map(([sName, sCfg]) => ({
        ...analyzeServer(sName, sCfg, home, { pluginRoot: pluginDir, pluginData }),
        scope: 'plugin',
        pluginDir: dirName,
        pluginSlug,
        pluginRoot: pluginDir,
        pluginData,
        namespacedName: `${pluginSlug}_${sName}`,
        dirNamespacedName: `${dirName}_${sName}`,
        pluginName: manifest.displayName || manifest.name || dirName,
        pluginDisabled,
        isBuiltin,
        filePath: mcpPath,
        readOnly: true,
      }));

      results.push({
        dir: dirName,
        name: manifest.name || dirName,
        displayName: manifest.displayName || manifest.name || dirName,
        disabled: pluginDisabled,
        isBuiltin,
        filePath: mcpPath,
        parseError: mcpInfo.parseError,
        servers,
      });
    }
    return results;
  }

  function resolveTargetFile(scope, workspacePath) {
    if (scope === 'global') return globalConfigPath;
    if (scope === 'workspace') {
      if (!workspacePath) throw new Error('请选择一个工作区目录');
      const abs = resolve(workspacePath);
      return join(abs, '.agents', 'mcp_config.json');
    }
    throw new Error(`不支持修改的作用域: ${scope}`);
  }

  function backupFile(filePath) {
    if (!existsSync(filePath)) return;
    mkdirSync(backupsDir, { recursive: true });
    const safeTag = filePath.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bakPath = join(backupsDir, `${stamp}__${safeTag}.bak`);
    writeFileSync(bakPath, readFileSync(filePath), { mode: 0o600 });

    // Keep at most 15 backups
    try {
      const files = readdirSync(backupsDir).filter((f) => f.endsWith('.bak')).sort();
      if (files.length > 15) {
        for (const old of files.slice(0, files.length - 15)) {
          try {
            unlinkSync(join(backupsDir, old));
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  function listBackups() {
    if (!existsSync(backupsDir)) return [];
    try {
      return readdirSync(backupsDir)
        .filter((f) => BACKUP_FILE_RE.test(f))
        .sort()
        .reverse()
        .slice(0, 15)
        .map((id) => {
          const full = join(backupsDir, id);
          let sizeBytes = 0;
          let mtimeMs = 0;
          try {
            const st = statSync(full);
            sizeBytes = st.size;
            mtimeMs = st.mtimeMs;
          } catch { /* ignore */ }
          const [stampPart, tagPart = ''] = id.split('__');
          const isoGuess = stampPart
            .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
          const createdAt = Number.isNaN(Date.parse(isoGuess))
            ? (mtimeMs ? new Date(mtimeMs).toISOString() : stampPart)
            : isoGuess;
          const label = tagPart.replace(/\.bak$/, '').replace(/^_+/, '') || id;
          return { id, createdAt, sizeBytes, label };
        });
    } catch {
      return [];
    }
  }

  function restoreBackup({ id, scope = 'global', workspacePath }) {
    if (!id || typeof id !== 'string' || !BACKUP_FILE_RE.test(id)) {
      throw new Error('无效的备份文件名');
    }
    const bakPath = join(backupsDir, id);
    if (!existsSync(bakPath)) {
      throw new Error(`备份不存在: ${id}`);
    }
    const info = readJsonSafe(bakPath);
    if (info.parseError || !isPlainObject(info.parsed)) {
      throw new Error(`备份文件 JSON 无效: ${info.parseError || '格式错误'}`);
    }
    const parsed = { ...info.parsed };
    if (!isPlainObject(parsed.mcpServers)) parsed.mcpServers = {};
    const filePath = resolveTargetFile(scope, workspacePath);
    writeConfigAtomic(filePath, parsed);
    return { ok: true, id, filePath };
  }

  function writeConfigAtomic(filePath, configObj) {
    mkdirSync(dirname(filePath), { recursive: true });
    backupFile(filePath);
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const jsonText = JSON.stringify(configObj, null, 2) + '\n';
    writeFileSync(tmp, jsonText, { encoding: 'utf-8', mode: 0o600 });
    renameSync(tmp, filePath);
    return jsonText;
  }

  function loadScope(scope, workspacePath) {
    const filePath = resolveTargetFile(scope, workspacePath);
    const info = readJsonSafe(filePath);
    if (info.parseError) {
      throw new Error(`配置文件 JSON 解析失败 (${filePath}): ${info.parseError}。请先在 Raw JSON 编辑器中修复格式。`);
    }
    const root = { ...info.parsed };
    if (!isPlainObject(root.mcpServers)) root.mcpServers = {};
    return { filePath, root };
  }

  function enrichHostFields(entry, hostStatus) {
    const tools = Array.isArray(hostStatus?.tools) ? hostStatus.tools : [];
    const mcpAppCount = tools.filter((t) => {
      if (t?.isMcpApp || t?.isUiTool) return true;
      const uri = t?._meta?.ui?.resourceUri ?? t?._meta?.['ui/resourceUri'];
      return typeof uri === 'string' && uri.startsWith('ui://');
    }).length;
    return {
      ...entry,
      hostStatus,
      mcpAppCount,
      hasMcpApps: mcpAppCount > 0,
    };
  }

  function getState(requestedWorkspaces = [], hostStates = {}, options = {}) {
    const storedWorkspaces = loadWorkspaces();
    const allWorkspaces = [...new Set([...storedWorkspaces, ...requestedWorkspaces.filter(Boolean).map((p) => resolve(p))])];
    const hostOf = (name, altNames = []) => {
      if (!isPlainObject(hostStates)) return null;
      if (name && hostStates[name]) return hostStates[name];
      for (const alt of altNames) {
        if (alt && hostStates[alt]) return hostStates[alt];
      }
      return null;
    };
    const promptsMap = readPromptsStore({ promptsFile }).prompts;
    const promptOf = (name, altNames = []) => {
      if (name && promptsMap[name]) return promptsMap[name];
      for (const alt of altNames) {
        if (alt && promptsMap[alt]) return promptsMap[alt];
      }
      return null;
    };

    const globalInfo = readJsonSafe(globalConfigPath);
    const globalServersObj = isPlainObject(globalInfo.parsed?.mcpServers) ? globalInfo.parsed.mcpServers : {};
    const globalServers = Object.entries(globalServersObj).map(([name, cfg]) => enrichHostFields({
      ...analyzeServer(name, cfg, home),
      scope: 'global',
      filePath: globalConfigPath,
      readOnly: false,
      promptConfig: promptOf(name),
    }, hostOf(name)));

    const workspaces = allWorkspaces.map((wsPath) => {
      const filePath = join(wsPath, '.agents', 'mcp_config.json');
      const info = readJsonSafe(filePath);
      const serversObj = isPlainObject(info.parsed?.mcpServers) ? info.parsed.mcpServers : {};
      const servers = Object.entries(serversObj).map(([name, cfg]) => enrichHostFields({
        ...analyzeServer(name, cfg, home),
        scope: 'workspace',
        workspacePath: wsPath,
        workspaceName: basename(wsPath),
        filePath,
        readOnly: false,
        promptConfig: promptOf(name),
      }, hostOf(name)));
      return {
        path: wsPath,
        name: basename(wsPath),
        exists: existsSync(wsPath),
        configExists: info.exists,
        filePath,
        raw: info.raw,
        parseError: info.parseError,
        servers,
      };
    });

    const disabledMap = readPluginDisabledMap();
    const plugins = [
      ...scanPluginsDir(userPluginsDir, false, disabledMap),
      ...scanPluginsDir(builtinPluginsDir, true, disabledMap),
    ].map((p) => ({
      ...p,
      servers: p.servers.map((s) => enrichHostFields({
        ...s,
        promptConfig: promptOf(s.name, [s.namespacedName, s.dirNamespacedName]),
      }, hostOf(s.namespacedName, [s.dirNamespacedName, s.name]))),
    }));

    // Collect name collisions across active servers
    const nameOccurrences = new Map();
    const record = (srv, label) => {
      if (!nameOccurrences.has(srv.name)) nameOccurrences.set(srv.name, []);
      nameOccurrences.get(srv.name).push(label);
    };
    globalServers.forEach((s) => record(s, '全局'));
    workspaces.forEach((w) => w.servers.forEach((s) => record(s, `工作区:${w.name}`)));
    plugins.forEach((p) => p.servers.forEach((s) => record(s, `插件:${p.displayName}`)));

    const conflicts = {};
    for (const [name, sources] of nameOccurrences.entries()) {
      if (sources.length > 1) conflicts[name] = sources;
    }

    return {
      global: {
        filePath: globalConfigPath,
        exists: globalInfo.exists,
        raw: globalInfo.raw,
        parseError: globalInfo.parseError,
        servers: globalServers,
      },
      workspaces,
      plugins,
      conflicts,
      prompts: promptsMap,
      hostSummary: isPlainObject(options?.hostExtra) ? options.hostExtra : null,
      paths: {
        globalConfigPath,
        userPluginsDir,
        backupsDir,
        promptsFile,
      },
    };
  }

  function saveServer({ scope = 'global', workspacePath, originalScope, originalWorkspacePath, originalName, name, config }) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName || !SAFE_NAME_RE.test(trimmedName)) {
      throw new Error('服务名称仅支持字母、数字、点(.)、下划线(_)和短横线(-)');
    }
    if (!isPlainObject(config)) {
      throw new Error('服务配置必须是一个对象');
    }

    const analysis = analyzeServer(trimmedName, config, home);
    const fatal = analysis.warnings.find((w) => w.level === 'error');
    if (fatal) {
      throw new Error(fatal.message);
    }

    const sameTarget = (!originalScope || originalScope === scope)
      && (scope !== 'workspace' || resolve(originalWorkspacePath || workspacePath) === resolve(workspacePath));

    const { filePath, root } = loadScope(scope, workspacePath);
    const servers = { ...root.mcpServers };

    const maybeMigratePrompt = () => {
      if (!originalName || originalName === trimmedName) return;
      const st = getState([workspacePath, originalWorkspacePath].filter(Boolean));
      const stillExists = st.global.servers.some((s) => s.name === originalName)
        || st.workspaces.some((w) => w.servers.some((s) => s.name === originalName))
        || st.plugins.some((p) => p.servers.some((s) => s.name === originalName));
      if (!stillExists) {
        renameServerPrompt(originalName, trimmedName, { promptsFile });
      }
    };

    if (originalName && !sameTarget) {
      if (Object.prototype.hasOwnProperty.call(servers, trimmedName)) {
        throw new Error(`目标作用域中已存在同名服务 "${trimmedName}"`);
      }
      servers[trimmedName] = config;
      root.mcpServers = servers;
      writeConfigAtomic(filePath, root);

      const orig = loadScope(originalScope, originalWorkspacePath);
      if (Object.prototype.hasOwnProperty.call(orig.root.mcpServers, originalName)) {
        const nextOrig = { ...orig.root.mcpServers };
        delete nextOrig[originalName];
        orig.root.mcpServers = nextOrig;
        writeConfigAtomic(orig.filePath, orig.root);
      }
      maybeMigratePrompt();
      return { ok: true, filePath, name: trimmedName, moved: true };
    }

    if (originalName && originalName !== trimmedName) {
      if (Object.prototype.hasOwnProperty.call(servers, trimmedName)) {
        throw new Error(`目标名称 "${trimmedName}" 已存在`);
      }
      delete servers[originalName];
    }

    servers[trimmedName] = config;
    root.mcpServers = servers;
    writeConfigAtomic(filePath, root);
    maybeMigratePrompt();
    return { ok: true, filePath, name: trimmedName };
  }

  function toggleServer({ scope = 'global', workspacePath, name, disabled }) {
    const { filePath, root } = loadScope(scope, workspacePath);
    if (!Object.prototype.hasOwnProperty.call(root.mcpServers, name)) {
      throw new Error(`未找到服务 "${name}"`);
    }
    const entry = { ...root.mcpServers[name] };
    if (disabled) {
      entry.disabled = true;
    } else {
      delete entry.disabled;
    }
    root.mcpServers = { ...root.mcpServers, [name]: entry };
    writeConfigAtomic(filePath, root);
    return { ok: true, name, disabled: Boolean(disabled) };
  }

  function deleteServer({ scope = 'global', workspacePath, name }) {
    const { filePath, root } = loadScope(scope, workspacePath);
    if (!Object.prototype.hasOwnProperty.call(root.mcpServers, name)) {
      throw new Error(`未找到服务 "${name}"`);
    }
    const next = { ...root.mcpServers };
    delete next[name];
    root.mcpServers = next;
    writeConfigAtomic(filePath, root);
    return { ok: true, name };
  }

  function saveRawConfig({ scope = 'global', workspacePath, rawJson }) {
    let parsed;
    try {
      parsed = JSON.parse(String(rawJson || ''));
    } catch (err) {
      throw new Error(`JSON 语法错误: ${err.message}`);
    }
    if (!isPlainObject(parsed)) {
      throw new Error('根节点必须是 JSON 对象');
    }
    if (parsed.mcpServers !== undefined && !isPlainObject(parsed.mcpServers)) {
      throw new Error('"mcpServers" 字段必须是对象');
    }
    if (!parsed.mcpServers) parsed.mcpServers = {};
    const filePath = resolveTargetFile(scope, workspacePath);
    writeConfigAtomic(filePath, parsed);
    return { ok: true, filePath };
  }

  function importSnippet({ scope = 'global', workspacePath, snippet, overwrite = false }) {
    const incoming = normalizeSnippetInput(snippet);
    const { filePath, root } = loadScope(scope, workspacePath);
    const next = { ...root.mcpServers };
    const imported = [];
    const skipped = [];

    for (const [name, cfg] of Object.entries(incoming)) {
      if (!SAFE_NAME_RE.test(name)) {
        throw new Error(`非法服务名 "${name}"：仅支持字母、数字、.、_、-`);
      }
      if (Object.prototype.hasOwnProperty.call(next, name) && !overwrite) {
        skipped.push(name);
        continue;
      }
      next[name] = cfg;
      imported.push(name);
    }

    if (imported.length > 0) {
      root.mcpServers = next;
      writeConfigAtomic(filePath, root);
    }
    return { ok: true, imported, skipped, filePath };
  }

  function exportAsPlugin({
    serverName,
    config,
    pluginSlug,
    displayName,
    description,
    includePromptRule = true,
  }) {
    const slug = String(pluginSlug || '').trim().toLowerCase();
    if (!PLUGIN_SLUG_RE.test(slug)) {
      throw new Error('插件目录名必须为小写字母、数字和短横线（如 my-mcp-plugin）');
    }
    if (!isPlainObject(config)) {
      throw new Error('无效的 MCP 配置');
    }
    const targetDir = join(userPluginsDir, slug);
    if (existsSync(targetDir)) {
      throw new Error(`插件目录已存在: ${targetDir}`);
    }

    const cleanServerKey = (String(serverName || 'server').trim().replace(/[^a-zA-Z0-9._-]/g, '-') || 'server').slice(0, 64);
    const namespacedName = `${slug}_${cleanServerKey}`;
    mkdirSync(targetDir, { recursive: true });

    const manifest = {
      name: slug,
      displayName: displayName?.trim() || slug,
      description: description?.trim() || `Packaged MCP plugin for ${serverName}`,
      version: '1.0.0',
      suggestedPrompts: [
        `使用 ${displayName?.trim() || slug} 服务提供的工具完成任务`,
        `检查 ${cleanServerKey} MCP 服务连接状态与可用工具`,
      ],
    };
    const mcpCfg = {
      mcpServers: {
        [cleanServerKey]: config,
      },
    };
    const readme = `# ${manifest.displayName}\n\n${manifest.description}\n\nBundled MCP Server: \`${cleanServerKey}\` (Antigravity 2.34+ host ID: \`${namespacedName}\`)\n`;

    writeFileSync(join(targetDir, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    writeFileSync(join(targetDir, 'mcp_config.json'), JSON.stringify(mcpCfg, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
    writeFileSync(join(targetDir, 'README.md'), readme, 'utf-8');

    let bundledRulePath = null;
    if (includePromptRule !== false) {
      const promptsMap = readPromptsStore({ promptsFile }).prompts || {};
      const savedPrompt = promptsMap[serverName] || promptsMap[cleanServerKey] || promptsMap[namespacedName] || null;
      if (savedPrompt?.prompt) {
        const rulesDir = join(targetDir, 'rules');
        mkdirSync(rulesDir, { recursive: true });
        bundledRulePath = join(rulesDir, 'AGENTS.md');
        writeFileSync(
          bundledRulePath,
          `# MCP Server Usage Rules (${cleanServerKey})\n\n${savedPrompt.prompt}\n`,
          'utf-8',
        );
      }
    }

    return {
      ok: true,
      pluginDir: targetDir,
      pluginSlug: slug,
      serverName: cleanServerKey,
      namespacedName,
      bundledRulePath,
      customizationLink: `customization://${slug}`,
    };
  }

  function savePrompt({ serverName, prompt, enabled, mode, keywords } = {}) {
    return saveServerPrompt({ serverName, prompt, enabled, mode, keywords }, { promptsFile });
  }

  function deletePrompt({ serverName } = {}) {
    return deleteServerPrompt(serverName, { promptsFile });
  }

  return {
    getState,
    addWorkspace,
    removeWorkspace,
    saveServer,
    toggleServer,
    deleteServer,
    saveRawConfig,
    importSnippet,
    exportAsPlugin,
    listBackups,
    restoreBackup,
    savePrompt,
    deletePrompt,
  };
}
