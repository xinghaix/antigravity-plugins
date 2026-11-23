import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeServer,
  createStore,
  expandPluginVariables,
  normalizeSnippetInput,
  resolveExecutable,
} from '../sidecars/mcp_manager/mcp_store.mjs';
import {
  callServerTool,
  diagnoseMcpAppTools,
  extractMcpAppMeta,
  probeHttpServer,
  probeStdioServer,
} from '../sidecars/mcp_manager/mcp_probe.mjs';
import { getStatus, installPlugin, uninstallPlugin } from '../scripts/cli.mjs';
import {
  deleteServerPrompt,
  MAX_PROMPT_LENGTH,
  parseKeywords,
  readPromptsStore,
  renameServerPrompt,
  saveServerPrompt,
} from '../hooks/prompt_store.mjs';
import {
  buildPluginServerAliasMap,
  extractServersFromToolCall,
  extractServersFromTranscript,
  handleHookEvent,
  isServerDisabledInConfigs,
  stripWrappingQuotes,
} from '../hooks/mcp_prompt_hook.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK_SCRIPT_PATH = resolve(__dirname, '..', 'hooks', 'mcp_prompt_hook.mjs');

const tempRoot = mkdtempSync(join(tmpdir(), 'mcp-manager-test-'));

try {
  const homeDir = join(tempRoot, 'home');
  const configRoot = join(homeDir, '.gemini', 'config');
  const dataDir = join(tempRoot, 'data');
  const wsDir = join(tempRoot, 'workspace-a');
  const pluginDir = join(configRoot, 'plugins', 'demo-plugin');

  mkdirSync(configRoot, { recursive: true });
  mkdirSync(wsDir, { recursive: true });
  mkdirSync(pluginDir, { recursive: true });

  writeFileSync(join(pluginDir, 'plugin.json'), JSON.stringify({ name: 'demo-plugin', displayName: 'Demo Plugin' }));
  writeFileSync(join(pluginDir, 'mcp_config.json'), JSON.stringify({
    mcpServers: {
      shared: { url: 'https://plugin.example.com/mcp' },
    },
  }));

  const store = createStore({
    homeDir,
    configRoot,
    dataDir,
    userPluginsDir: join(configRoot, 'plugins'),
    builtinPluginsDir: join(tempRoot, 'no-builtin'),
  });

  // 1. Initial state & plugin discovery
  let st = store.getState();
  assert.equal(st.global.servers.length, 0);
  assert.equal(st.plugins.length, 1);
  assert.equal(st.plugins[0].servers[0].name, 'shared');

  // 2. Save global server + conflict detection
  store.saveServer({
    scope: 'global',
    name: 'shared',
    config: { url: 'https://example.com/sse' },
  });
  st = store.getState();
  assert.equal(st.global.servers.length, 1);
  assert.ok(st.global.servers[0].warnings.some((w) => w.code === 'legacy_sse'));
  assert.ok(st.conflicts.shared);

  // 3. Toggle & rename + hostStates enrichment
  store.toggleServer({ scope: 'global', name: 'shared', disabled: true });
  st = store.getState([], {
    shared: { status: 'MCP_SERVER_STATUS_READY', ready: true, tools: [{ name: 't1', description: '' }] },
  });
  assert.equal(st.global.servers[0].disabled, true);
  assert.equal(st.global.servers[0].hostStatus.ready, true);

  store.saveServer({
    scope: 'global',
    originalScope: 'global',
    originalName: 'shared',
    name: 'my-stdio',
    config: { command: process.execPath, args: ['-v'] },
  });
  st = store.getState();
  assert.equal(st.global.servers[0].name, 'my-stdio');
  assert.equal(st.global.servers[0].transport, 'stdio');
  assert.ok(st.global.servers[0].resolvedCommand);

  // 4. Workspace add + snippet import (VS Code & mcpServers format)
  store.addWorkspace(wsDir);
  const imported = store.importSnippet({
    scope: 'workspace',
    workspacePath: wsDir,
    snippet: JSON.stringify({
      servers: {
        'vs-fetch': { type: 'http', serverUrl: 'https://remote.test/mcp' },
      },
    }),
  });
  assert.deepEqual(imported.imported, ['vs-fetch']);
  st = store.getState();
  assert.equal(st.workspaces.length, 1);
  assert.equal(st.workspaces[0].servers[0].config.url, 'https://remote.test/mcp');
  assert.equal(st.workspaces[0].servers[0].config.type, undefined);

  // 4b. Cross-scope server migration (global -> workspace)
  const moveRes = store.saveServer({
    scope: 'workspace',
    workspacePath: wsDir,
    originalScope: 'global',
    originalName: 'my-stdio',
    name: 'moved-stdio',
    config: { command: process.execPath, args: ['-v'] },
  });
  assert.equal(moveRes.moved, true);
  st = store.getState();
  assert.equal(st.global.servers.length, 0);
  assert.ok(st.workspaces[0].servers.some((s) => s.name === 'moved-stdio'));

  // 4c. Backups list & restore
  const backups = store.listBackups();
  assert.ok(backups.length >= 1, 'Expected automatic backups to be recorded');
  assert.throws(() => store.restoreBackup({ id: '../evil.bak', scope: 'global' }), /无效/);
  const latestGlobalBak = backups.find((b) => b.id.includes('mcp_config.json'));
  assert.ok(latestGlobalBak, 'Expected backup entry for mcp_config.json');
  store.restoreBackup({ id: latestGlobalBak.id, scope: 'global' });

  // 5. Export plugin
  const exp = store.exportAsPlugin({
    serverName: 'my-stdio',
    config: { command: 'node', args: ['-v'] },
    pluginSlug: 'exported-stdio',
    displayName: 'Exported Stdio',
    description: 'Test export',
  });
  assert.ok(existsSync(join(exp.pluginDir, 'plugin.json')));
  assert.ok(existsSync(join(exp.pluginDir, 'mcp_config.json')));

  // 6. Delete server if present after restore
  st = store.getState();
  for (const s of st.global.servers) {
    store.deleteServer({ scope: 'global', name: s.name });
  }
  st = store.getState();
  assert.equal(st.global.servers.length, 0);

  // 7. Snippet normalizer & Windows PATHEXT executable resolution
  assert.throws(() => normalizeSnippetInput('not json'), /JSON|Unexpected|token/i);
  const winBinDir = join(tempRoot, 'win-bin');
  mkdirSync(winBinDir, { recursive: true });
  writeFileSync(join(winBinDir, 'npx.cmd'), '@echo off\r\n');
  const winHit = resolveExecutable(join(winBinDir, 'npx'), homeDir, 'win32');
  assert.equal(winHit.found, true);
  assert.ok(winHit.resolvedPath.endsWith('npx.cmd'));

  // 8. CLI installer (copy, status, uninstall, link)
  const cliTarget = join(tempRoot, 'cli-install', 'mcp-manager');
  const copyRes = installPlugin({ link: false, target: cliTarget });
  assert.equal(copyRes.mode, 'copy');
  assert.ok(existsSync(join(cliTarget, 'plugin.json')));
  assert.ok(existsSync(join(cliTarget, 'hooks.json')));
  assert.ok(existsSync(join(cliTarget, 'hooks', 'mcp_prompt_hook.mjs')));
  assert.ok(existsSync(join(cliTarget, 'hooks', 'prompt_store.mjs')));
  assert.equal(getStatus({ target: cliTarget, home: homeDir }).installMode, 'copy');

  const linkRes = installPlugin({ link: true, target: cliTarget });
  assert.equal(linkRes.mode, 'link');
  assert.ok(lstatSync(cliTarget).isSymbolicLink());
  assert.equal(getStatus({ target: cliTarget, home: homeDir }).installMode, 'symlink');

  const unRes = uninstallPlugin({ target: cliTarget });
  assert.equal(unRes.removed, true);
  assert.equal(getStatus({ target: cliTarget, home: homeDir }).installMode, 'not_installed');

  // 9. Live Stdio Probe (newline-delimited JSON)
  const mockStdioScript = join(tempRoot, 'mock-mcp-stdio.mjs');
  writeFileSync(mockStdioScript, `
    import readline from 'node:readline';
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      const msg = JSON.parse(line);
      if (msg.method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { protocolVersion: '2025-03-26', serverInfo: { name: 'mock-stdio', version: '0.1.0' }, capabilities: { tools: {} } }
        }) + '\\n');
      } else if (msg.method === 'tools/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { tools: [{ name: 'ping', description: 'Ping tool' }] }
        }) + '\\n');
      }
    });
  `);
  const stdioProbe = await probeStdioServer({ command: process.execPath, args: [mockStdioScript] }, 4000);
  assert.equal(stdioProbe.ok, true);
  assert.equal(stdioProbe.serverInfo.name, 'mock-stdio');
  assert.equal(stdioProbe.tools.length, 1);
  assert.equal(stdioProbe.tools[0].name, 'ping');

  // 10. Live HTTP Probe (Streamable HTTP with SSE response + Mcp-Session-Id via mocked fetch)
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const msg = JSON.parse(init.body || '{}');
    if (msg.method === 'notifications/initialized') {
      return new globalThis.Response('', { status: 202 });
    }
    if (msg.method === 'initialize') {
      return new globalThis.Response(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { protocolVersion: '2025-03-26', serverInfo: { name: 'mock-http', version: '1.2.0' } },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'sess-123' },
      });
    }
    if (msg.method === 'tools/list') {
      assert.equal(init.headers['Mcp-Session-Id'], 'sess-123');
      const sse = `event: message\ndata: ${JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { tools: [{ name: 'http_echo', description: 'Echo over HTTP' }] },
      })}\n\n`;
      return new globalThis.Response(sse, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    throw new Error('Unexpected RPC method');
  };
  try {
    const httpProbe = await probeHttpServer({ url: 'https://mock.local/mcp' }, 4000);
    assert.equal(httpProbe.ok, true, httpProbe.error);
    assert.equal(httpProbe.serverInfo.name, 'mock-http');
    assert.equal(httpProbe.tools[0].name, 'http_echo');
  } finally {
    globalThis.fetch = origFetch;
  }

  // 11. Prompt store CRUD, validation, keyword parsing, and rename
  const promptOpts = { homeDir, configRoot };
  assert.deepEqual(parseKeywords('ck, ClickHouse，CK\n sql '), ['ck', 'ClickHouse', 'sql']);
  assert.throws(
    () => saveServerPrompt({ serverName: 'bad name!', prompt: 'x' }, promptOpts),
    /服务名称/,
  );
  assert.throws(
    () => saveServerPrompt({ serverName: 'clickhouse-mcp', prompt: 'x', mode: 'invalid_mode' }, promptOpts),
    /不支持的注入模式/,
  );
  assert.throws(
    () => saveServerPrompt({ serverName: 'clickhouse-mcp', prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1) }, promptOpts),
    /不能超过/,
  );

  const savedP = saveServerPrompt({
    serverName: 'clickhouse-mcp',
    prompt: '  Always inspect tables before querying.  ',
    mode: 'on_demand',
    keywords: 'ClickHouse, ck',
  }, promptOpts);
  assert.equal(savedP.deleted, false);
  assert.equal(savedP.entry.prompt, 'Always inspect tables before querying.');
  assert.deepEqual(savedP.entry.keywords, ['ClickHouse', 'ck']);
  assert.equal(readPromptsStore(promptOpts).prompts['clickhouse-mcp'].mode, 'on_demand');

  const renRes = renameServerPrompt('clickhouse-mcp', 'ck-renamed', promptOpts);
  assert.equal(renRes.renamed, true);
  assert.equal(readPromptsStore(promptOpts).prompts['clickhouse-mcp'], undefined);
  assert.equal(readPromptsStore(promptOpts).prompts['ck-renamed'].prompt, 'Always inspect tables before querying.');

  const clearedP = saveServerPrompt({ serverName: 'ck-renamed', prompt: '   ' }, promptOpts);
  assert.equal(clearedP.deleted, true);
  assert.equal(readPromptsStore(promptOpts).prompts['ck-renamed'], undefined);

  // 12. mcp_store integration: promptConfig attachment on global/workspace/plugin + rename migration
  store.saveServer({
    scope: 'global',
    name: 'ck-global',
    config: { url: 'https://ck.local/mcp' },
  });
  store.savePrompt({
    serverName: 'ck-global',
    prompt: 'Global CK rule',
    mode: 'on_demand',
    keywords: ['ck'],
  });
  store.savePrompt({
    serverName: 'shared',
    prompt: 'Plugin shared rule',
    mode: 'strict',
  });
  st = store.getState();
  assert.equal(st.global.servers.find((s) => s.name === 'ck-global').promptConfig.prompt, 'Global CK rule');
  assert.equal(st.plugins[0].servers[0].promptConfig.mode, 'strict');
  assert.equal(st.workspaces[0].servers[0].promptConfig, null);

  // Renaming ck-global (across same scope) migrates promptConfig
  store.saveServer({
    scope: 'global',
    originalScope: 'global',
    originalName: 'ck-global',
    name: 'ck-global-v2',
    config: { url: 'https://ck.local/mcp' },
  });
  st = store.getState();
  assert.equal(st.global.servers.find((s) => s.name === 'ck-global-v2').promptConfig.prompt, 'Global CK rule');
  assert.equal(st.prompts['ck-global'], undefined);

  // Cross-scope move + rename also migrates promptConfig
  store.saveServer({
    scope: 'workspace',
    workspacePath: wsDir,
    originalScope: 'global',
    originalName: 'ck-global-v2',
    name: 'ck-ws',
    config: { url: 'https://ck.local/mcp' },
  });
  st = store.getState();
  assert.equal(st.workspaces[0].servers.find((s) => s.name === 'ck-ws').promptConfig.prompt, 'Global CK rule');
  assert.equal(st.prompts['ck-global-v2'], undefined);

  const delPromptRes = store.deletePrompt({ serverName: 'ck-ws' });
  assert.equal(delPromptRes.removed, true);
  store.deletePrompt({ serverName: 'shared' });
  store.deleteServer({ scope: 'workspace', workspacePath: wsDir, name: 'ck-ws' });

  // 13. Hook helpers & fast-path when no prompts configured
  const hookHome = join(tempRoot, 'hook-home');
  const hookConfigRoot = join(hookHome, '.gemini', 'config');
  const hookPromptsFile = join(hookConfigRoot, 'sidecar_data', 'mcp_manager', 'prompts.json');
  const hookStateDir = join(hookConfigRoot, 'sidecar_data', 'mcp_manager', 'hook_sessions');
  const hookOpts = { homeDir: hookHome, configRoot: hookConfigRoot, promptsFile: hookPromptsFile, stateDir: hookStateDir };

  assert.equal(stripWrappingQuotes('"/Users/a/mcp/ck/run_query.json"'), '/Users/a/mcp/ck/run_query.json');
  assert.deepEqual(
    extractServersFromToolCall(
      { name: 'mcp_foo_bar_query', args: {} },
      new Set(['foo', 'foo_bar']),
    ),
    ['foo_bar'],
  );
  assert.deepEqual(
    extractServersFromToolCall(
      { name: 'read_file', args: { Path: '"/Users/xing/.gemini/antigravity/mcp/clickhouse-mcp/run_query.json"' } },
      new Set(['clickhouse-mcp']),
    ),
    ['clickhouse-mcp'],
  );

  // Fast-path when prompts.json is empty
  assert.deepEqual(handleHookEvent({ hookEventName: 'SessionStart', conversationId: 'c0' }, hookOpts), {});
  assert.deepEqual(handleHookEvent({ hookEventName: 'PreInvocation', conversationId: 'c0' }, hookOpts), {});
  assert.deepEqual(handleHookEvent({ hookEventName: 'PostToolUse', conversationId: 'c0', toolCall: { name: 'read_file', args: {} } }, hookOpts), {});
  assert.deepEqual(handleHookEvent({ hookEventName: 'PreToolUse', conversationId: 'c0', toolCall: { name: 'call_mcp_tool', args: { ServerName: 'clickhouse-mcp' } } }, hookOpts), { decision: 'ask' });

  // 14. Hook on_demand lazy schema-read flow + deduplication + live edit re-delivery
  saveServerPrompt({
    serverName: 'clickhouse-mcp',
    prompt: 'Rule v1: Always add LIMIT 100.',
    mode: 'on_demand',
    keywords: ['clickhouse'],
  }, hookOpts);

  const postRead = handleHookEvent({
    hookEventName: 'PostToolUse',
    conversationId: 'conv-ondemand',
    toolCall: {
      name: 'read_file',
      args: { Path: '/Users/xing/.gemini/antigravity/mcp/clickhouse-mcp/run_query.json' },
    },
  }, hookOpts);
  assert.deepEqual(postRead, {});

  const preInv1 = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-ondemand',
    lastUserInput: 'check metrics',
  }, hookOpts);
  assert.equal(preInv1.injectSteps.length, 1);
  assert.match(preInv1.injectSteps[0].systemMessage.systemMessage, /Rule v1: Always add LIMIT 100\./);
  assert.match(preInv1.injectSteps[0].systemMessage.systemMessage, /<mcp_instructions server="clickhouse-mcp">/);

  // Second PreInvocation in same conversation must deduplicate
  const preInv2 = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-ondemand',
    lastUserInput: 'clickhouse again',
  }, hookOpts);
  assert.deepEqual(preInv2, {});

  // Editing prompt content changes hash and re-triggers delivery on next signal
  saveServerPrompt({
    serverName: 'clickhouse-mcp',
    prompt: 'Rule v2: Always filter by event_date.',
    mode: 'on_demand',
    keywords: ['clickhouse'],
  }, hookOpts);
  const preInvEdited = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-ondemand',
    lastUserInput: 'run another ClickHouse query',
  }, hookOpts);
  assert.equal(preInvEdited.injectSteps.length, 1);
  assert.match(preInvEdited.injectSteps[0].systemMessage.systemMessage, /Rule v2: Always filter by event_date\./);

  // 15. Hook keyword early trigger (non-matching ignored, case-insensitive match triggers)
  assert.deepEqual(
    handleHookEvent({ hookEventName: 'PreInvocation', conversationId: 'conv-kw', lastUserInput: 'hello world' }, hookOpts),
    {},
  );
  const kwHit = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-kw',
    lastUserInput: 'Please query CLICKHOUSE tables',
  }, hookOpts);
  assert.equal(kwHit.injectSteps.length, 1);
  assert.match(kwHit.injectSteps[0].systemMessage.systemMessage, /Rule v2/);

  // 16. Hook incremental transcript fallback (JSON-quoted args trigger; prose mentions do NOT trigger)
  saveServerPrompt({
    serverName: 'trino-mcp',
    prompt: 'Trino rule: use EXPLAIN first.',
    mode: 'on_demand',
  }, hookOpts);
  const transcriptFile = join(tempRoot, 'transcript.jsonl');
  writeFileSync(transcriptFile, [
    JSON.stringify({ step_index: 0, type: 'USER_INPUT', content: 'Please mention trino-mcp in prose only' }),
    JSON.stringify({ step_index: 1, type: 'PLANNER_RESPONSE', content: 'Thinking about trino-mcp', tool_calls: [] }),
  ].join('\n') + '\n');

  const tr1 = extractServersFromTranscript(transcriptFile, 0, ['trino-mcp']);
  assert.deepEqual(tr1.servers, []);
  const preTr1 = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-transcript',
    transcriptPath: transcriptFile,
  }, hookOpts);
  assert.deepEqual(preTr1, {});

  // Append a real PLANNER_RESPONSE tool_call reading trino-mcp schema (with JSON-quoted Path arg)
  const existingTranscript = readFileSync(transcriptFile, 'utf-8');
  writeFileSync(transcriptFile, existingTranscript + JSON.stringify({
    step_index: 2,
    type: 'PLANNER_RESPONSE',
    tool_calls: [
      {
        name: 'read_file',
        args: { Path: '"/Users/xing/.gemini/antigravity/mcp/trino-mcp/execute_query.json"' },
      },
    ],
  }) + '\n');

  const preTr2 = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-transcript',
    transcriptPath: transcriptFile,
  }, hookOpts);
  assert.equal(preTr2.injectSteps.length, 1);
  assert.match(preTr2.injectSteps[0].systemMessage.systemMessage, /Trino rule: use EXPLAIN first\./);

  // Direct on_demand fallback on PreToolUse -> returns ask & queues for next PreInvocation
  const preOnDemandDirect = handleHookEvent({
    hookEventName: 'PreToolUse',
    conversationId: 'conv-direct-ondemand',
    toolCall: { name: 'call_mcp_tool', args: { ServerName: 'trino-mcp', ToolName: 'list_catalogs' } },
  }, hookOpts);
  assert.deepEqual(preOnDemandDirect, { decision: 'ask' });
  const preInvAfterDirect = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-direct-ondemand',
  }, hookOpts);
  assert.equal(preInvAfterDirect.injectSteps.length, 1);
  assert.match(preInvAfterDirect.injectSteps[0].systemMessage.systemMessage, /Trino rule: use EXPLAIN first\./);

  // 17. Hook strict mode: blocks 1st un-briefed call (call_mcp_tool & eager mcp_<server>_<tool>), allows 2nd, skips block if already briefed
  saveServerPrompt({
    serverName: 'strict-srv',
    prompt: 'Never run DROP TABLE.',
    mode: 'strict',
  }, hookOpts);

  const strictDeny1 = handleHookEvent({
    hookEventName: 'PreToolUse',
    conversationId: 'conv-strict-1',
    toolCall: { name: 'call_mcp_tool', args: { ServerName: 'strict-srv', ToolName: 'exec' } },
  }, hookOpts);
  assert.equal(strictDeny1.decision, 'deny');
  assert.match(strictDeny1.reason, /Never run DROP TABLE\./);

  const strictRetry = handleHookEvent({
    hookEventName: 'PreToolUse',
    conversationId: 'conv-strict-1',
    toolCall: { name: 'call_mcp_tool', args: { ServerName: 'strict-srv', ToolName: 'exec' } },
  }, hookOpts);
  assert.deepEqual(strictRetry, { decision: 'ask' });

  // Eager tool mcp_<serverName>_<toolName>
  const eagerDeny = handleHookEvent({
    hookEventName: 'PreToolUse',
    conversationId: 'conv-strict-eager',
    toolCall: { name: 'mcp_strict-srv_run_query', args: {} },
  }, hookOpts);
  assert.equal(eagerDeny.decision, 'deny');
  assert.match(eagerDeny.reason, /Never run DROP TABLE\./);
  assert.deepEqual(
    handleHookEvent({
      hookEventName: 'PreToolUse',
      conversationId: 'conv-strict-eager',
      toolCall: { name: 'mcp_strict-srv_run_query', args: {} },
    }, hookOpts),
    { decision: 'ask' },
  );

  // If strict-srv was already briefed proactively via schema read + PreInvocation, PreToolUse does NOT deny
  handleHookEvent({
    hookEventName: 'PostToolUse',
    conversationId: 'conv-strict-proactive',
    toolCall: { name: 'read_file', args: { Path: '/tmp/.gemini/antigravity/mcp/strict-srv/exec.json' } },
  }, hookOpts);
  const strictProactiveInv = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-strict-proactive',
  }, hookOpts);
  assert.equal(strictProactiveInv.injectSteps.length, 1);
  assert.deepEqual(
    handleHookEvent({
      hookEventName: 'PreToolUse',
      conversationId: 'conv-strict-proactive',
      toolCall: { name: 'call_mcp_tool', args: { ServerName: 'strict-srv', ToolName: 'exec' } },
    }, hookOpts),
    { decision: 'ask' },
  );

  // 18. Hook session_start mode: active vs disabled in mcp_config.json vs prompt enabled: false + stale session cleanup
  mkdirSync(hookConfigRoot, { recursive: true });
  writeFileSync(join(hookConfigRoot, 'mcp_config.json'), JSON.stringify({
    mcpServers: {
      'sess-active': { url: 'https://a.test/mcp' },
      'sess-disabled': { url: 'https://b.test/mcp', disabled: true },
    },
  }));
  assert.equal(isServerDisabledInConfigs('sess-active', hookOpts), false);
  assert.equal(isServerDisabledInConfigs('sess-disabled', hookOpts), true);

  saveServerPrompt({ serverName: 'sess-active', prompt: 'Active session rule', mode: 'session_start' }, hookOpts);
  saveServerPrompt({ serverName: 'sess-disabled', prompt: 'Disabled server rule', mode: 'session_start' }, hookOpts);
  saveServerPrompt({ serverName: 'sess-paused', prompt: 'Paused prompt rule', mode: 'session_start', enabled: false }, hookOpts);

  // Create a stale 8-day-old session file to verify pruning on SessionStart
  mkdirSync(hookStateDir, { recursive: true });
  const staleFile = join(hookStateDir, 'old-session.json');
  writeFileSync(staleFile, '{"conversationId":"old-session"}\n');
  const eightDaysAgoSec = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000;
  utimesSync(staleFile, eightDaysAgoSec, eightDaysAgoSec);

  const sessStartRes = handleHookEvent({
    hookEventName: 'SessionStart',
    conversationId: 'conv-sess-1',
  }, hookOpts);
  assert.equal(sessStartRes.injectSteps.length, 1);
  assert.match(sessStartRes.injectSteps[0].systemMessage.systemMessage, /Active session rule/);
  assert.doesNotMatch(sessStartRes.injectSteps[0].systemMessage.systemMessage, /Disabled server rule/);
  assert.doesNotMatch(sessStartRes.injectSteps[0].systemMessage.systemMessage, /Paused prompt rule/);
  assert.equal(existsSync(staleFile), false, 'Expected >7d session state file to be pruned');

  // Catch-up in PreInvocation if added mid-session without SessionStart
  saveServerPrompt({ serverName: 'sess-late', prompt: 'Late session_start rule', mode: 'session_start' }, hookOpts);
  const lateCatchup = handleHookEvent({
    hookEventName: 'PreInvocation',
    conversationId: 'conv-sess-1',
  }, hookOpts);
  assert.equal(lateCatchup.injectSteps.length, 1);
  assert.match(lateCatchup.injectSteps[0].systemMessage.systemMessage, /Late session_start rule/);

  // 19. Real CLI subprocess stdin/stdout smoke test for mcp_prompt_hook.mjs
  const cliOut = execFileSync(process.execPath, [HOOK_SCRIPT_PATH], {
    input: JSON.stringify({
      hookEventName: 'PreToolUse',
      conversationId: 'conv-cli-smoke',
      toolCall: { name: 'call_mcp_tool', args: { ServerName: 'strict-srv', ToolName: 'ping' } },
    }),
    env: {
      ...process.env,
      MCP_MANAGER_PROMPTS_FILE: hookPromptsFile,
      MCP_MANAGER_HOOK_STATE_DIR: hookStateDir,
    },
    encoding: 'utf-8',
  });
  const parsedCliOut = JSON.parse(cliOut);
  assert.equal(parsedCliOut.decision, 'deny');
  assert.match(parsedCliOut.reason, /Never run DROP TABLE\./);

  deleteServerPrompt('strict-srv', hookOpts);

  // 20. Antigravity 2.34+ ${PLUGIN_ROOT} & ${PLUGIN_DATA} expansion & scope warning
  const pRootDir = join(tempRoot, 'plugin-vars-root');
  const pDataDir = join(tempRoot, 'plugin-vars-data');
  mkdirSync(join(pRootDir, 'bin'), { recursive: true });
  mkdirSync(pDataDir, { recursive: true });
  const fakeBin = join(pRootDir, 'bin', 'mock-bin.sh');
  writeFileSync(fakeBin, '#!/bin/sh\nexit 0\n');
  chmodSync(fakeBin, 0o755);

  const expandedCfg = expandPluginVariables(
    {
      command: '${PLUGIN_ROOT}/bin/mock-bin.sh',
      args: ['--data', '${PLUGIN_DATA}'],
      cwd: '${PLUGIN_DATA}',
      env: { DATA_DIR: '${PLUGIN_DATA}' },
    },
    { pluginRoot: pRootDir, pluginData: pDataDir },
  );
  assert.equal(resolve(expandedCfg.command), resolve(fakeBin));
  assert.equal(expandedCfg.args[1], pDataDir);
  assert.equal(expandedCfg.cwd, pDataDir);
  assert.equal(expandedCfg.env.DATA_DIR, pDataDir);

  const pluginScopedAnalysis = analyzeServer(
    'var-srv',
    { command: '${PLUGIN_ROOT}/bin/mock-bin.sh', cwd: '${PLUGIN_DATA}' },
    homeDir,
    { pluginRoot: pRootDir, pluginData: pDataDir },
  );
  assert.equal(pluginScopedAnalysis.usesPluginVars, true);
  assert.equal(pluginScopedAnalysis.warnings.some((w) => w.code === 'command_not_found'), false);
  assert.equal(pluginScopedAnalysis.warnings.some((w) => w.code === 'plugin_vars_outside_plugin'), false);

  const globalVarAnalysis = analyzeServer(
    'global-var-srv',
    { command: '${PLUGIN_ROOT}/bin/mock-bin.sh' },
    homeDir,
  );
  assert.ok(globalVarAnalysis.warnings.some((w) => w.code === 'plugin_vars_outside_plugin'));

  // 21. Antigravity 2.34+ <pluginSlug>_<serverName> host matching & hook alias resolution
  st = store.getState([], {
    'demo-plugin_shared': {
      status: 'MCP_SERVER_STATUS_READY',
      ready: true,
      tools: [
        {
          name: 'open_ui',
          description: 'MCP App tool',
          _meta: {
            ui: { resourceUri: 'ui://demo/view', visibility: ['model', 'app'] },
            'com.google.antigravity/ui': { entrypoints: [{ type: 'aux_pane', title: 'Demo View' }] },
          },
        },
      ],
    },
  });
  const demoPluginSrv = st.plugins[0].servers[0];
  assert.equal(demoPluginSrv.namespacedName, 'demo-plugin_shared');
  assert.equal(demoPluginSrv.hostStatus.ready, true);
  assert.equal(demoPluginSrv.mcpAppCount, 1);

  const hookNsPlugin = join(hookConfigRoot, 'plugins', 'demo-plugin');
  mkdirSync(hookNsPlugin, { recursive: true });
  writeFileSync(join(hookNsPlugin, 'plugin.json'), JSON.stringify({ name: 'demo-plugin', displayName: 'Demo Plugin' }));
  writeFileSync(join(hookNsPlugin, 'mcp_config.json'), JSON.stringify({
    mcpServers: {
      shared: { url: 'https://plugin.example.com/mcp' },
    },
  }));
  const aliasMap = buildPluginServerAliasMap({ homeDir, configRoot: hookConfigRoot });
  assert.equal(aliasMap.get('demo-plugin_shared'), 'shared');
  assert.deepEqual(
    extractServersFromToolCall(
      { name: 'mcp_demo-plugin_shared_open_ui', args: {} },
      new Set(['shared']),
      { aliasMap },
    ),
    ['shared'],
  );
  assert.deepEqual(
    extractServersFromToolCall(
      { name: 'call_mcp_tool', args: { ServerName: 'demo-plugin_shared', ToolName: 'open_ui' } },
      new Set(['shared']),
      { aliasMap },
    ),
    ['shared'],
  );
  assert.equal(isServerDisabledInConfigs('demo-plugin_shared', hookOpts), false);

  saveServerPrompt({ serverName: 'shared', prompt: 'Always check plugin shared quota.', mode: 'strict' }, hookOpts);
  const nsDeny = handleHookEvent({
    hookEventName: 'PreToolUse',
    conversationId: 'conv-ns-plugin',
    toolCall: { name: 'mcp_demo-plugin_shared_query', args: {} },
  }, hookOpts);
  assert.equal(nsDeny.decision, 'deny');
  assert.match(nsDeny.reason, /Always check plugin shared quota\./);

  // 22. exportAsPlugin bundles clean server key, suggestedPrompts, and rules/AGENTS.md
  store.savePrompt({ serverName: 'rule-srv', prompt: 'Follow rule-srv guidelines strictly.', mode: 'on_demand' });
  const expWithRule = store.exportAsPlugin({
    serverName: 'rule-srv',
    config: { command: process.execPath, args: ['-v'] },
    pluginSlug: 'rule-srv-plugin',
    displayName: 'Rule Server Plugin',
    description: 'Plugin with bundled rules',
  });
  assert.equal(expWithRule.serverName, 'rule-srv');
  assert.equal(expWithRule.namespacedName, 'rule-srv-plugin_rule-srv');
  assert.ok(expWithRule.bundledRulePath && existsSync(expWithRule.bundledRulePath));
  assert.match(readFileSync(expWithRule.bundledRulePath, 'utf-8'), /Follow rule-srv guidelines strictly\./);
  const expManifest = JSON.parse(readFileSync(join(expWithRule.pluginDir, 'plugin.json'), 'utf-8'));
  assert.ok(Array.isArray(expManifest.suggestedPrompts) && expManifest.suggestedPrompts.length >= 2);

  // 23. MCP Apps metadata extraction, validation warnings, resources/prompts probing & callServerTool sandbox
  const badAppDiag = diagnoseMcpAppTools([
    extractMcpAppMeta({
      name: 'bad_uri_tool',
      _meta: { ui: { resourceUri: 'https://not-ui-scheme.test' } },
    }),
    extractMcpAppMeta({
      name: 'bad_entrypoint_tool',
      inputSchema: { type: 'object', required: ['id'] },
      _meta: {
        ui: { resourceUri: 'ui://app/missing' },
        'com.google.antigravity/ui': { entrypoints: [{ type: 'aux_pane', title: 'Bad' }] },
      },
    }),
  ], [{ uri: 'ui://app/other', mimeType: 'text/plain' }]);
  assert.ok(badAppDiag.some((w) => w.code === 'invalid_ui_uri'));
  assert.ok(badAppDiag.some((w) => w.code === 'entrypoint_required_args'));
  assert.ok(badAppDiag.some((w) => w.code === 'missing_or_bad_ui_resource'));

  const mockAppServer = join(pRootDir, 'mcp-app-server.mjs');
  writeFileSync(mockAppServer, `
    import readline from 'node:readline';
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      const msg = JSON.parse(line);
      if (msg.method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: '2025-03-26',
            serverInfo: { name: 'mock-mcp-app', version: '2.0.0' },
            capabilities: { tools: {}, resources: {}, prompts: {} }
          }
        }) + '\\n');
      } else if (msg.method === 'tools/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            tools: [
              {
                name: 'open_board',
                description: 'Opens board UI',
                _meta: {
                  ui: { resourceUri: 'ui://board/index.html', visibility: ['model', 'app'] },
                  'com.google.antigravity/ui': { entrypoints: [{ type: 'aux_pane', title: 'Board' }] }
                }
              },
              {
                name: 'save_note',
                description: 'App-only callback',
                _meta: { ui: { resourceUri: 'ui://board/index.html', visibility: ['app'] } }
              }
            ]
          }
        }) + '\\n');
      } else if (msg.method === 'resources/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            resources: [
              {
                uri: 'ui://board/index.html',
                name: 'Board UI',
                mimeType: 'text/html;profile=mcp-app',
                _meta: { ui: { prefersBorder: false } }
              }
            ]
          }
        }) + '\\n');
      } else if (msg.method === 'prompts/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { prompts: [{ name: 'summarize_board', description: 'Summarize' }] }
        }) + '\\n');
      } else if (msg.method === 'tools/call') {
        if (msg.params?.name === 'big_payload') {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: { content: [{ type: 'text', text: 'x'.repeat(1100000) }] }
          }) + '\\n');
        } else {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              content: [{ type: 'text', text: 'board ready' }],
              structuredContent: { ok: true, echo: msg.params?.arguments || {} }
            }
          }) + '\\n');
        }
      }
    });
  `);

  const appProbe = await probeStdioServer(
    { command: process.execPath, args: ['${PLUGIN_ROOT}/mcp-app-server.mjs'] },
    4000,
    { pluginRoot: pRootDir, pluginData: pDataDir },
  );
  assert.equal(appProbe.ok, true, appProbe.error);
  assert.equal(appProbe.mcpAppCount, 2);
  assert.equal(appProbe.uiResources.length, 1);
  assert.equal(appProbe.prompts.length, 1);
  assert.equal(appProbe.tools.find((t) => t.name === 'save_note').isAppOnly, true);
  assert.equal(appProbe.tools.find((t) => t.name === 'open_board').hasAuxPane, true);
  assert.equal(appProbe.appWarnings.length, 0);

  const callOk = await callServerTool(
    { command: process.execPath, args: ['${PLUGIN_ROOT}/mcp-app-server.mjs'] },
    { toolName: 'open_board', args: { filter: 'todo' }, context: { pluginRoot: pRootDir, pluginData: pDataDir } },
  );
  assert.equal(callOk.ok, true, callOk.error);
  assert.equal(callOk.structuredContent.echo.filter, 'todo');
  assert.equal(callOk.exceedsTrajectoryCap, false);

  const callTooBig = await callServerTool(
    { command: process.execPath, args: ['${PLUGIN_ROOT}/mcp-app-server.mjs'] },
    { toolName: 'big_payload', args: {}, context: { pluginRoot: pRootDir, pluginData: pDataDir } },
  );
  assert.equal(callTooBig.ok, true, callTooBig.error);
  assert.equal(callTooBig.exceedsTrajectoryCap, true);

  console.log('ALL MCP MANAGER TESTS PASSED');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
