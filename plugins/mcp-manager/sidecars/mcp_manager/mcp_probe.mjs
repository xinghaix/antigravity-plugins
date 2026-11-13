import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolveExecutable } from './mcp_store.mjs';

const DEFAULT_TIMEOUT_MS = 7000;

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

export async function probeStdioServer(config, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
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

    const reader = new StdioJsonRpcReader((msg) => {
      if (msg.id === 1) {
        if (msg.error) {
          finish({ ok: false, error: msg.error.message || JSON.stringify(msg.error), tools: [] });
          return;
        }
        initResult = msg.result || {};
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      } else if (msg.id === 2) {
        if (msg.error) {
          // Some servers initialize without exposing tools capability
          finish({
            ok: true,
            serverInfo: initResult?.serverInfo || null,
            protocolVersion: initResult?.protocolVersion || null,
            tools: [],
            note: `tools/list 返回: ${msg.error.message || '不支持或无工具'}`,
          });
          return;
        }
        const tools = Array.isArray(msg.result?.tools)
          ? msg.result.tools.map((t) => ({ name: t.name, description: t.description || '' }))
          : [];
        finish({
          ok: true,
          serverInfo: initResult?.serverInfo || null,
          protocolVersion: initResult?.protocolVersion || null,
          tools,
        });
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
        clientInfo: { name: 'mcp-manager-probe', version: '1.0.0' },
      },
    });
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

export async function probeHttpServer(config, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  const url = String(config.url || config.serverUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      transport: 'http',
      latencyMs: Date.now() - start,
      error: '无效的 HTTP(S) URL',
      tools: [],
    };
  }

  const headers = config.headers && typeof config.headers === 'object' ? { ...config.headers } : {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
          clientInfo: { name: 'mcp-manager-probe', version: '1.0.0' },
        },
      },
      controller.signal,
    );

    const initMsg = initResp.messages.find((m) => m.id === 1) || initResp.messages[0];
    if (initMsg?.error) {
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

    const listResp = await postJsonRpc(
      url,
      sessionHeaders,
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      controller.signal,
    );

    const listMsg = listResp.messages.find((m) => m.id === 2) || listResp.messages[0];
    if (listMsg?.error) {
      return {
        ok: true,
        transport: 'http',
        latencyMs: Date.now() - start,
        serverInfo: initResult.serverInfo || null,
        protocolVersion: initResult.protocolVersion || null,
        tools: [],
        note: `tools/list 返回: ${listMsg.error.message || '不支持或无工具'}`,
      };
    }

    const tools = Array.isArray(listMsg?.result?.tools)
      ? listMsg.result.tools.map((t) => ({ name: t.name, description: t.description || '' }))
      : [];

    return {
      ok: true,
      transport: 'http',
      latencyMs: Date.now() - start,
      serverInfo: initResult.serverInfo || null,
      protocolVersion: initResult.protocolVersion || null,
      tools,
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
    clearTimeout(timer);
  }
}

export async function probeServer(config, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!config || typeof config !== 'object') {
    return { ok: false, error: '无效的服务配置', tools: [], latencyMs: 0 };
  }
  if (typeof config.command === 'string' && config.command.trim()) {
    return probeStdioServer(config, timeoutMs);
  }
  if (typeof config.url === 'string' && config.url.trim() || typeof config.serverUrl === 'string' && config.serverUrl.trim()) {
    return probeHttpServer(config, timeoutMs);
  }
  return { ok: false, error: '缺少 command 或 url', tools: [], latencyMs: 0 };
}
