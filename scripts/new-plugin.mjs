#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRegistry } from './sync-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(__dirname, '..');

const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;

function toTitle(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function scaffoldPlugin({
  pluginId,
  displayName = '',
  description = '',
  withUi = false,
  rootDir = MONOREPO_ROOT,
} = {}) {
  if (!PLUGIN_ID_RE.test(String(pluginId || ''))) {
    throw new Error(`Invalid plugin ID "${pluginId}". Use lowercase kebab-case (e.g. "prompt-vault").`);
  }

  const pluginDir = join(rootDir, 'plugins', pluginId);
  if (existsSync(pluginDir)) {
    throw new Error(`Plugin already exists: ${pluginDir}`);
  }

  const title = displayName || toTitle(pluginId);
  const desc = description || `${title} plugin for Google Antigravity.`;
  const safeSidecar = pluginId.replace(/-/g, '_');

  mkdirSync(join(pluginDir, 'assets'), { recursive: true });
  mkdirSync(join(pluginDir, 'skills', pluginId), { recursive: true });
  mkdirSync(join(pluginDir, 'tests'), { recursive: true });

  writeFileSync(
    join(pluginDir, 'plugin.json'),
    `${JSON.stringify({
      name: pluginId,
      displayName: title,
      description: desc,
      version: '1.0.0',
      logo: 'assets/logo.svg',
      author: {
        name: 'xinghaix',
        url: 'https://github.com/xinghaix',
      },
      homepage: `https://github.com/xinghaix/antigravity-plugins/tree/main/plugins/${pluginId}`,
      repository: {
        type: 'git',
        url: 'https://github.com/xinghaix/antigravity-plugins.git',
      },
      suggestedPrompts: [
        withUi ? `打开 ${title} 面板` : `使用 ${pluginId} 技能处理当前任务`,
      ],
    }, null, 2)}\n`,
    'utf-8',
  );

  writeFileSync(
    join(pluginDir, 'package.json'),
    `${JSON.stringify({
      name: `antigravity-plugin-${pluginId}`,
      version: '1.0.0',
      description: desc,
      type: 'module',
      engines: { node: '>=20.0.0' },
      scripts: {
        test: `node tests/${safeSidecar}.test.mjs`,
      },
      license: 'MIT',
    }, null, 2)}\n`,
    'utf-8',
  );

  writeFileSync(
    join(pluginDir, 'assets', 'logo.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" fill="none">
  <rect x="14" y="14" width="100" height="100" rx="24" fill="#181B21" stroke="#3B82F6" stroke-width="4"/>
  <circle cx="64" cy="64" r="22" stroke="#60A5FA" stroke-width="6"/>
  <circle cx="64" cy="64" r="7" fill="#34D399"/>
</svg>
`,
    'utf-8',
  );

  const skillBody = withUi
    ? `When the user wants to open or use ${title}, surface the sidecar pill link:\n\n[${title}](sidecar://${pluginId}/${safeSidecar}/)\n`
    : `Provide clear, actionable workflow steps for ${title} here.\n`;

  writeFileSync(
    join(pluginDir, 'skills', pluginId, 'SKILL.md'),
    `---\nname: ${pluginId}\ndescription: ${JSON.stringify(desc)}\n---\n\n# ${title}\n\n${skillBody}`,
    'utf-8',
  );

  writeFileSync(
    join(pluginDir, 'README.md'),
    `# ${title}\n\n${desc}\n\n## 安装\n\n\`\`\`bash\ncurl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- ${pluginId}\n\`\`\`\n\n或从仓库源码软链接安装：\n\n\`\`\`bash\nnode scripts/cli.mjs install ${pluginId}\n\`\`\`\n`,
    'utf-8',
  );

  writeFileSync(
    join(pluginDir, 'CHANGELOG.md'),
    `# Changelog\n\n## [1.0.0]\n\n- Initial release of \`${pluginId}\`.\n`,
    'utf-8',
  );

  writeFileSync(
    join(pluginDir, 'tests', `${safeSidecar}.test.mjs`),
    `import assert from 'node:assert/strict';\nimport { existsSync, readFileSync } from 'node:fs';\nimport { dirname, join, resolve } from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nconst ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');\nconst manifest = JSON.parse(readFileSync(join(ROOT, 'plugin.json'), 'utf-8'));\nassert.equal(manifest.name, '${pluginId}');\nassert.ok(existsSync(join(ROOT, 'skills', '${pluginId}', 'SKILL.md')));\nconsole.log('${pluginId} tests passed');\n`,
    'utf-8',
  );

  if (withUi) {
    const scDir = join(pluginDir, 'sidecars', safeSidecar);
    mkdirSync(scDir, { recursive: true });
    writeFileSync(
      join(scDir, 'package.json'),
      `${JSON.stringify({ name: safeSidecar, version: '1.0.0', type: 'module', description: `${title} sidecar` }, null, 2)}\n`,
      'utf-8',
    );
    writeFileSync(
      join(scDir, 'sidecar.json'),
      `${JSON.stringify({
        command: 'node',
        args: ['main.mjs'],
        restart_policy: 'always',
        display_name: title,
        description: desc,
        has_web_ui: true,
        ui_config: {
          display_name: title,
          views: [{ path: '/', entrypoint: 'SIDECAR_UI_ENTRYPOINT_AUX_PANE', title }],
        },
      }, null, 2)}\n`,
      'utf-8',
    );
    writeFileSync(
      join(scDir, 'main.mjs'),
      `import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new SidecarApp();

app.page('/', () => readFileSync(join(__dirname, 'index.html'), 'utf-8'));
app.api('/styles.css', () => new Response(readFileSync(join(__dirname, 'styles.css'), 'utf-8'), { contentType: 'text/css; charset=utf-8' }), 'GET');
app.api('/app.js', () => new Response(readFileSync(join(__dirname, 'app.js'), 'utf-8'), { contentType: 'application/javascript; charset=utf-8' }), 'GET');
app.api('/api/health', () => ({ ok: true, plugin: '${pluginId}' }), 'GET');

app.run();
`,
      'utf-8',
    );
    writeFileSync(
      join(scDir, 'index.html'),
      `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="/preload.js"></script>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="shell">
    <h1>${title}</h1>
    <p>${desc}</p>
    <div id="status">Loading…</div>
  </main>
  <script src="/app.js"></script>
</body>
</html>
`,
      'utf-8',
    );
    writeFileSync(
      join(scDir, 'styles.css'),
      `:root {
  --bg: var(--background, #f6f7f9);
  --card-bg: var(--card, #ffffff);
  --fg: var(--foreground, #181a1f);
  --border-col: var(--border, rgba(15, 23, 42, 0.1));
}
body { margin: 0; padding: 16px; font-family: var(--font-family, system-ui, sans-serif); background: var(--bg); color: var(--fg); }
.shell { background: var(--card-bg); border: 1px solid var(--border-col); border-radius: 12px; padding: 16px; }
`,
      'utf-8',
    );
    writeFileSync(
      join(scDir, 'app.js'),
      `(async () => {
  const f = window.sidecar?.fetch ? window.sidecar.fetch.bind(window.sidecar) : fetch;
  const res = await f('/api/health');
  const data = await res.json();
  document.getElementById('status').textContent = data.ok ? 'Sidecar Ready' : 'Error';
})();
`,
      'utf-8',
    );
  }

  writeRegistry(rootDir);
  return { pluginDir, withUi };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const pluginId = args.find((a) => !a.startsWith('-'));
  if (!pluginId) {
    console.error('Usage: node scripts/new-plugin.mjs <plugin-id> [--display-name "..."] [--description "..."] [--ui]');
    process.exit(1);
  }
  const withUi = args.includes('--ui');
  const dnIdx = args.indexOf('--display-name');
  const descIdx = args.indexOf('--description');
  const displayName = dnIdx !== -1 && args[dnIdx + 1] ? args[dnIdx + 1] : '';
  const description = descIdx !== -1 && args[descIdx + 1] ? args[descIdx + 1] : '';

  const res = scaffoldPlugin({ pluginId, displayName, description, withUi });
  console.log(`Scaffolded ${pluginId} at ${res.pluginDir} (ui: ${res.withUi}) and updated registry.json`);
}
