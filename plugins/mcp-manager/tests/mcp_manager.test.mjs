import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, normalizeSnippetInput, resolveExecutable } from '../sidecars/mcp_manager/mcp_store.mjs';
import { probeHttpServer, probeStdioServer } from '../sidecars/mcp_manager/mcp_probe.mjs';
import { getStatus, installPlugin, uninstallPlugin } from '../scripts/cli.mjs';

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

  console.log('ALL MCP MANAGER TESTS PASSED');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
