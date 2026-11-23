import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { expandPluginVariables, resolveExecutable } from './mcp_store.mjs';

const DEFAULT_TIMEOUT_MS = 7000;
const TRAJECTORY_RESULT_CAP_BYTES = 1024 * 1024;

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function resolveEffectiveConfig(rawConfig, context = {}) {
  if (!isPlainObject(rawConfig)) return rawConfig;
  if (context && (context.pluginRoot || context.pluginData)) {
    return expandPluginVariables(rawConfig, context);
  }
  return rawConfig;
}

export function extractMcpAppMeta(tool = {}) {
  const meta = isPlainObject(tool?._meta) ? tool._meta : {};
  const rawResourceUri = meta?.ui?.resourceUri ?? meta?.['ui/resourceUri'] ?? null;
  const rawUriStr = typeof rawResourceUri === 'string' ? rawResourceUri.trim() : null;
  const visibility = Array.isArray(meta?.ui?.visibility)
    ? meta.ui.visibility.filter((v) => typeof v === 'string')
    : [];
  const rawEntrypoints = meta?.['com.google.antigravity/ui']?.entrypoints;
  const entrypoints = Array.isArray(rawEntrypoints)
    ? rawEntrypoints
        .filter((e) => isPlainObject(e))
        .map((e) => ({ type: String(e.type || ''), title: String(e.title || '') }))
    : [];
  const requiredArgs = Array.isArray(tool?.inputSchema?.required)
    ? tool.inputSchema.required.filter((k) => typeof k === 'string')
    : [];
  const hasValidUiScheme = Boolean(rawUriStr && rawUriStr.startsWith('ui://'));
  const hasAuxPane = entrypoints.some((e) => e.type === 'aux_pane');
  const hasGlobal = entrypoints.some((e) => e.type === 'global');
  const isAppOnly = visibility.length > 0 && visibility.includes('app') && !visibility.includes('model');

  return {
    rawResourceUri: rawUriStr,
    resourceUri: hasValidUiScheme ? rawUriStr : null,
    visibility,
    entrypoints,
    requiredArgs,
    isMcpApp: hasValidUiScheme,
    isAppOnly,
    hasAuxPane,
    hasGlobal,
    isUiTool: hasValidUiScheme || entrypoints.length > 0,
  };
}

function normalizeToolRecord(t = {}) {
  return {
    name: String(t?.name || ''),
    title: typeof t?.title === 'string' ? t.title : '',
    description: typeof t?.description === 'string' ? t.description : '',
    inputSchema: isPlainObject(t?.inputSchema) ? t.inputSchema : null,
    annotations: isPlainObject(t?.annotations) ? t.annotations : null,
    ...extractMcpAppMeta(t),
  };
}

function normalizeResourceRecord(r = {}) {
  const uri = typeof r?.uri === 'string' ? r.uri : '';
  const uiMeta = isPlainObject(r?._meta?.ui) ? r._meta.ui : null;
  return {
    uri,
    name: typeof r?.name === 'string' ? r.name : uri,
    description: typeof r?.description === 'string' ? r.description : '',
    mimeType: typeof r?.mimeType === 'string' ? r.mimeType : '',
    isUiResource: uri.startsWith('ui://'),
    csp: isPlainObject(uiMeta?.csp) ? uiMeta.csp : null,
    prefersBorder: typeof uiMeta?.prefersBorder === 'boolean' ? uiMeta.prefersBorder : null,
  };
}

export function diagnoseMcpAppTools(tools = [], resources = null) {
  const warnings = [];
  const normalizedTools = tools.map((t) => (t && 'rawResourceUri' in t ? t : normalizeToolRecord(t)));
  const resList = Array.isArray(resources)
    ? resources.map((r) => (r && 'isUiResource' in r ? r : normalizeResourceRecord(r)))
    : null;

  for (const t of normalizedTools) {
    if (t.rawResourceUri && !t.rawResourceUri.startsWith('ui://')) {
      warnings.push({
        code: 'invalid_ui_uri',
        level: 'warn',
        tool: t.name,
        message: `工具 "${t.name}" 的 resourceUri ("${t.rawResourceUri}") 必须使用 ui:// scheme，否则宿主将丢弃其 UI 绑定`,
      });
    }
    if (t.entrypoints.length > 0 && !t.isMcpApp) {
      warnings.push({
        code: 'entrypoints_without_ui',
        level: 'warn',
        tool: t.name,
        message: `工具 "${t.name}" 声明了 aux_pane/global 入口，但缺少有效的 ui:// resourceUri`,
      });
    }
    if ((t.hasAuxPane || t.hasGlobal) && t.requiredArgs.length > 0) {
      warnings.push({
        code: 'entrypoint_required_args',
        level: 'warn',
        tool: t.name,
        message: `工具 "${t.name}" 注册了侧边栏/全局入口，但 inputSchema.required 包含必填参数 (${t.requiredArgs.join(', ')})；Antigravity 2.34+ 会以 {} 无参启动入口`,
      });
    }
    if (resList && t.isMcpApp) {
      const matchedRes = resList.find((r) => r.uri === t.resourceUri);
      if (!matchedRes) {
        warnings.push({
          code: 'missing_or_bad_ui_resource',
          level: 'warn',
          tool: t.name,
          message: `工具 "${t.name}" 引用了 "${t.resourceUri}"，但在 resources/list 中未找到对应资源`,
        });
      } else if (matchedRes.mimeType && matchedRes.mimeType !== 'text/html;profile=mcp-app') {
        warnings.push({
          code: 'missing_or_bad_ui_resource',
          level: 'warn',
          tool: t.name,
          message: `资源 "${t.resourceUri}" 的 mimeType 为 "${matchedRes.mimeType}"，Antigravity 2.34+ MCP Apps 要求 "text/html;profile=mcp-app"`,
        });
      }
    }
  }
  return warnings;
}

function buildProbeSummary({
  initResult = {},
  rawTools = [],
  rawResources = [],
  resourcesFetched = false,
  rawPrompts = [],
  note = null,
}) {
  const tools = Array.isArray(rawTools) ? rawTools.map(normalizeToolRecord) : [];
  const resources = Array.isArray(rawResources) ? rawResources.map(normalizeResourceRecord) : [];
  const uiResources = resources.filter((r) => r.isUiResource);
  const prompts = Array.isArray(rawPrompts)
    ? rawPrompts.map((p) => ({
        name: String(p?.name || ''),
        description: typeof p?.description === 'string' ? p.description : '',
        arguments: Array.isArray(p?.arguments) ? p.arguments : [],
      }))
    : [];
  const mcpAppCount = tools.filter((t) => t.isMcpApp).length;
  const appWarnings = diagnoseMcpAppTools(tools, resourcesFetched ? resources : null);

  return {
    ok: true,
    serverInfo: initResult?.serverInfo || null,
    protocolVersion: initResult?.protocolVersion || null,
    capabilities: isPlainObject(initResult?.capabilities) ? initResult.capabilities : {},
    tools,
    resources,
    uiResources,
    prompts,
    mcpAppCount,
    hasMcpApps: mcpAppCount > 0,
    appWarnings,
    ...(note ? { note } : {}),
  };
}

function parseSsePayloads(text) {
  const messages = [];
  const events = String(text || '').split(/\r?\n\r?\n/);
  for (const evt of events) {
    const dataLines = evt
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) continue;
    const raw = dataLines.join('\n').trim();
    if (!raw || raw === '[DONE]') continue;
    try {
      messages.push(JSON.parse(raw));
    } catch {
      // Ignore non-JSON SSE events (e.g. endpoint / ping)
    }
  }
  return messages;
}

class StdioJsonRpcReader {
  constructor(onMessage) {
    this.buffer = Buffer.alloc(0);
    this.onMessage = onMessage;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length > 0) {
      // Check for Content-Length header framing (LSP-style MCP)
      const headPreview = this.buffer.subarray(0, Math.min(64, this.buffer.length)).toString('utf-8');
      if (/^Content-Length:\s*\d+/i.test(headPreview)) {
        const sepIdx = this.buffer.indexOf('\r\n\r\n');
        const sepLen = sepIdx !== -1 ? 4 : 2;
        const idx = sepIdx !== -1 ? sepIdx : this.buffer.indexOf('\n\n');
        if (idx === -1) return; // Wait for complete header
        const headerStr = this.buffer.subarray(0, idx).toString('utf-8');
        const match = /Content-Length:\s*(\d+)/i.exec(headerStr);
        if (!match) {
          this.buffer = this.buffer.subarray(idx + sepLen);
          continue;
        }
        const len = Number(match[1]);
        const total = idx + sepLen + len;
        if (this.buffer.length < total) return; // Wait for full body
        const body = this.buffer.subarray(idx + sepLen, total).toString('utf-8');
        this.buffer = this.buffer.subarray(total);
        this.#emitJson(body);
        continue;
      }

      // Standard MCP newline-delimited JSON
      const nlIdx = this.buffer.indexOf('\n');
      if (nlIdx === -1) return;
      const line = this.buffer.subarray(0, nlIdx).toString('utf-8').trim();
      this.buffer = this.buffer.subarray(nlIdx + 1);
      if (line) this.#emitJson(line);
    }
  }

  #emitJson(raw) {
    try {
      const msg = JSON.parse(raw);
      this.onMessage(msg);
    } catch {
      // Ignore non-JSON stdout noise printed by misbehaving servers
    }
  }
}

async function runStdioRpcSession(rawConfig, timeoutMs, context, onFlow) {
  const start = Date.now();
  const config = resolveEffectiveConfig(rawConfig, context);
  const cmd = String(config.command || '').trim();
  const resolved = resolveExecutable(cmd, homedir());
  if (!resolved.found) {
    return {
      ok: false,
      transport: 'stdio',
      latencyMs: Date.now() - start,
      error: `未找到可执行命令: ${cmd}`,
      tools: [],
    };
  }

  const args = Array.isArray(config.args) ? config.args.map(String) : [];
  const cwd = typeof config.cwd === 'string' && config.cwd.trim() && existsSync(config.cwd.trim())
    ? config.cwd.trim()
    : undefined;
  const env = {
    ...process.env,
    ...(config.env && typeof config.env === 'object' ? config.env : {}),
  };

  return new Promise((resolvePromise) => {
    let settled = false;
    let stderrText = '';
    let initResult = null;
    let extraTimer = null;

    const targetCmd = resolved.resolvedPath || cmd;
    const child = spawn(targetCmd, args, {
      cwd,
      env,
      shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(targetCmd),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (extraTimer) clearTimeout(extraTimer);
      try {
        child.kill('SIGTERM');
        const killTimer = setTimeout(() => {
          try { child.kill('SIGKILL'); } catch { /* ignore */ }
        }, 200);
        killTimer.unref?.();
      } catch { /* ignore */ }
      resolvePromise({
        ...payload,
        transport: 'stdio',
        latencyMs: Date.now() - start,
        stderr: stderrText.trim().slice(0, 800) || null,
      });
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: `连接超时（>${timeoutMs}ms）。请检查命令参数或确认该进程确实实现了 MCP Stdio 协议。`,
        tools: [],
      });
    }, timeoutMs);

    const send = (obj) => {
      if (child.stdin.writable) {
        child.stdin.write(JSON.stringify(obj) + '\n');
      }
    };

    const setGraceTimer = (fn, ms) => {
      if (extraTimer) clearTimeout(extraTimer);
      extraTimer = setTimeout(fn, ms);
    };

    const flow = onFlow({ send, finish, setGraceTimer });

    const reader = new StdioJsonRpcReader((msg) => {
      if (msg.id === 1) {
        if (msg.error) {
          finish({ ok: false, error: msg.error.message || JSON.stringify(msg.error), tools: [] });
          return;
        }
        initResult = msg.result || {};
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        flow.onInitialized(initResult);
      } else if (msg.id !== undefined) {
        flow.onMessage(msg, initResult);
      }
    });

    child.stdout.on('data', (chunk) => reader.push(chunk));
    child.stderr.on('data', (chunk) => {
      if (stderrText.length < 2000) stderrText += chunk.toString('utf-8');
    });
    child.on('error', (err) => {
      finish({ ok: false, error: err.message, tools: [] });
    });
    child.on('exit', (code, signal) => {
      if (!settled) {
        finish({
          ok: false,
          error: `进程提前退出 (code=${code}, signal=${signal})${stderrText ? `: ${stderrText.trim().slice(0, 300)}` : ''}`,
          tools: [],
        });
      }
    });

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'mcp-manager-probe', version: '1.2.0' },
      },
    });
  });
}

export async function probeStdioServer(config, timeoutMs = DEFAULT_TIMEOUT_MS, context = {}) {
  return runStdioRpcSession(config, timeoutMs, context, ({ send, finish, setGraceTimer }) => {
    let initResult = {};
    let rawTools = [];
    let toolsNote = null;
    let rawResources = [];
    let rawPrompts = [];
    let resourcesFetched = false;
    const pendingExtras = new Set();

    const finalize = () => {
      finish(buildProbeSummary({
        initResult,
        rawTools,
        rawResources,
        resourcesFetched,
        rawPrompts,
        note: toolsNote,
      }));
    };

    return {
      onInitialized(init) {
        initResult = init || {};
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      },
      onMessage(msg) {
        if (msg.id === 2) {
          if (msg.error) {
            toolsNote = `tools/list 返回: ${msg.error.message || '不支持或无工具'}`;
            rawTools = [];
          } else {
            rawTools = Array.isArray(msg.result?.tools) ? msg.result.tools : [];
          }

          const caps = isPlainObject(initResult?.capabilities) ? initResult.capabilities : {};
          const hasAnyUiTool = rawTools.some((t) => extractMcpAppMeta(t).isUiTool);
          if (caps.resources || hasAnyUiTool) {
            pendingExtras.add(3);
            send({ jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} });
          }
          if (caps.prompts) {
            pendingExtras.add(4);
            send({ jsonrpc: '2.0', id: 4, method: 'prompts/list', params: {} });
          }

          if (pendingExtras.size === 0) {
            finalize();
          } else {
            // Do not hang forever if optional list calls go unanswered
            setGraceTimer(finalize, Math.min(2000, Math.max(400, Math.floor(timeoutMs * 0.45))));
          }
          return;
        }

        if (msg.id === 3 && pendingExtras.has(3)) {
          pendingExtras.delete(3);
          if (!msg.error && Array.isArray(msg.result?.resources)) {
            rawResources = msg.result.resources;
            resourcesFetched = true;
          }
          if (pendingExtras.size === 0) finalize();
          return;
        }

        if (msg.id === 4 && pendingExtras.has(4)) {
          pendingExtras.delete(4);
          if (!msg.error && Array.isArray(msg.result?.prompts)) {
            rawPrompts = msg.result.prompts;
          }
          if (pendingExtras.size === 0) finalize();
        }
      },
    };
  });
}

async function postJsonRpc(url, headers, payload, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(payload),
    signal,
  });

  const sessionId = res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id') || null;
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 240)}` : ''}`);
  }

  let messages = [];
  if (contentType.includes('text/event-stream')) {
    messages = parseSsePayloads(text);
  } else if (text.trim()) {
    const parsed = JSON.parse(text);
    messages = Array.isArray(parsed) ? parsed : [parsed];
  }
  return { sessionId, messages };
}

async function openHttpMcpSession(rawConfig, timeoutMs, context) {
  const config = resolveEffectiveConfig(rawConfig, context);
  const url = String(config.url || config.serverUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('无效的 HTTP(S) URL');
  }

  const headers = config.headers && typeof config.headers === 'object' ? { ...config.headers } : {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const initResp = await postJsonRpc(
    url,
    headers,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'mcp-manager-probe', version: '1.2.0' },
      },
    },
    controller.signal,
  );

  const initMsg = initResp.messages.find((m) => m.id === 1) || initResp.messages[0];
  if (initMsg?.error) {
    clearTimeout(timer);
    throw new Error(initMsg.error.message || JSON.stringify(initMsg.error));
  }
  const initResult = initMsg?.result || {};
  const sessionHeaders = initResp.sessionId ? { ...headers, 'Mcp-Session-Id': initResp.sessionId } : headers;

  // Best-effort initialized notification (ignore 202/empty)
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...sessionHeaders,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      signal: controller.signal,
    });
  } catch { /* ignore */ }

  return {
    url,
    sessionHeaders,
    initResult,
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

export async function probeHttpServer(rawConfig, timeoutMs = DEFAULT_TIMEOUT_MS, context = {}) {
  const start = Date.now();
  let session = null;
  try {
    session = await openHttpMcpSession(rawConfig, timeoutMs, context);
    const { url, sessionHeaders, initResult, signal } = session;

    const listResp = await postJsonRpc(
      url,
      sessionHeaders,
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      signal,
    );
    const listMsg = listResp.messages.find((m) => m.id === 2) || listResp.messages[0];
    const toolsNote = listMsg?.error ? `tools/list 返回: ${listMsg.error.message || '不支持或无工具'}` : null;
    const rawTools = !listMsg?.error && Array.isArray(listMsg?.result?.tools) ? listMsg.result.tools : [];

    const caps = isPlainObject(initResult?.capabilities) ? initResult.capabilities : {};
    const hasAnyUiTool = rawTools.some((t) => extractMcpAppMeta(t).isUiTool);
    let rawResources = [];
    let resourcesFetched = false;
    let rawPrompts = [];

    if (caps.resources || hasAnyUiTool) {
      try {
        const resResp = await postJsonRpc(
          url,
          sessionHeaders,
          { jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} },
          signal,
        );
        const resMsg = resResp.messages.find((m) => m.id === 3) || resResp.messages[0];
        if (!resMsg?.error && Array.isArray(resMsg?.result?.resources)) {
          rawResources = resMsg.result.resources;
          resourcesFetched = true;
        }
      } catch { /* optional capability */ }
    }

    if (caps.prompts) {
      try {
        const promptResp = await postJsonRpc(
          url,
          sessionHeaders,
          { jsonrpc: '2.0', id: 4, method: 'prompts/list', params: {} },
          signal,
        );
        const promptMsg = promptResp.messages.find((m) => m.id === 4) || promptResp.messages[0];
        if (!promptMsg?.error && Array.isArray(promptMsg?.result?.prompts)) {
          rawPrompts = promptMsg.result.prompts;
        }
      } catch { /* optional capability */ }
    }

    return {
      ...buildProbeSummary({
        initResult,
        rawTools,
        rawResources,
        resourcesFetched,
        rawPrompts,
        note: toolsNote,
      }),
      transport: 'http',
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      transport: 'http',
      latencyMs: Date.now() - start,
      error: isAbort ? `请求超时（>${timeoutMs}ms）` : (err?.message || String(err)),
      tools: [],
    };
  } finally {
    session?.cleanup?.();
  }
}

export async function probeServer(config, timeoutMs = DEFAULT_TIMEOUT_MS, context = {}) {
  if (!config || typeof config !== 'object') {
    return { ok: false, error: '无效的服务配置', tools: [], latencyMs: 0 };
  }
  const effective = resolveEffectiveConfig(config, context);
  if (typeof effective.command === 'string' && effective.command.trim()) {
    return probeStdioServer(config, timeoutMs, context);
  }
  if ((typeof effective.url === 'string' && effective.url.trim()) || (typeof effective.serverUrl === 'string' && effective.serverUrl.trim())) {
    return probeHttpServer(config, timeoutMs, context);
  }
  return { ok: false, error: '缺少 command 或 url', tools: [], latencyMs: 0 };
}

function formatCallResult(transport, latencyMs, rpcResult) {
  const serialized = JSON.stringify(rpcResult ?? {});
  const resultBytes = Buffer.byteLength(serialized, 'utf-8');
  return {
    ok: true,
    transport,
    latencyMs,
    isError: Boolean(rpcResult?.isError),
    content: Array.isArray(rpcResult?.content) ? rpcResult.content : [],
    structuredContent: rpcResult?.structuredContent ?? null,
    resultBytes,
    exceedsTrajectoryCap: resultBytes > TRAJECTORY_RESULT_CAP_BYTES,
  };
}

export async function callServerTool(
  rawConfig,
  { toolName, args = {}, timeoutMs = 8000, context = {} } = {},
) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return { ok: false, error: '无效的服务配置', latencyMs: 0 };
  }
  const cleanTool = String(toolName || '').trim();
  if (!cleanTool) {
    return { ok: false, error: '缺少 toolName', latencyMs: 0 };
  }
  const safeArgs = isPlainObject(args) ? args : {};
  const effective = resolveEffectiveConfig(rawConfig, context);
  const start = Date.now();

  if (typeof effective.command === 'string' && effective.command.trim()) {
    return runStdioRpcSession(rawConfig, timeoutMs, context, ({ send, finish }) => ({
      onInitialized() {
        send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: cleanTool, arguments: safeArgs },
        });
      },
      onMessage(msg) {
        if (msg.id !== 2) return;
        if (msg.error) {
          finish({ ok: false, error: msg.error.message || JSON.stringify(msg.error) });
          return;
        }
        finish(formatCallResult('stdio', Date.now() - start, msg.result || {}));
      },
    }));
  }

  if ((typeof effective.url === 'string' && effective.url.trim()) || (typeof effective.serverUrl === 'string' && effective.serverUrl.trim())) {
    let session = null;
    try {
      session = await openHttpMcpSession(rawConfig, timeoutMs, context);
      const callResp = await postJsonRpc(
        session.url,
        session.sessionHeaders,
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: cleanTool, arguments: safeArgs } },
        session.signal,
      );
      const callMsg = callResp.messages.find((m) => m.id === 2) || callResp.messages[0];
      if (callMsg?.error) {
        throw new Error(callMsg.error.message || JSON.stringify(callMsg.error));
      }
      return formatCallResult('http', Date.now() - start, callMsg?.result || {});
    } catch (err) {
      const isAbort = err?.name === 'AbortError';
      return {
        ok: false,
        transport: 'http',
        latencyMs: Date.now() - start,
        error: isAbort ? `调用超时（>${timeoutMs}ms）` : (err?.message || String(err)),
      };
    } finally {
      session?.cleanup?.();
    }
  }

  return { ok: false, error: '缺少 command 或 url', latencyMs: 0 };
}
