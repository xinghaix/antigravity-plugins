(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const I18N = {
    zh: {
      loading: '加载中…',
      refreshTip: '刷新配置',
      probeAll: '探测全部',
      probingProgress: '探测中 {done}/{total}…',
      addMcp: '+ 添加 MCP',
      scopeAll: '全部',
      scopeGlobal: '全局',
      scopeWorkspace: '工作区',
      scopePlugin: '插件',
      importBtn: '导入',
      rawBtn: 'Raw / 备份',
      searchPlaceholder: '搜索服务名、命令、URL…',
      statusAll: '全部状态',
      statusEnabled: '仅已启用',
      statusDisabled: '仅已禁用',
      statusWarn: '仅告警',
      wsLabel: '工作区:',
      wsPlaceholder: '添加项目目录路径，如 ~/Projects/app',
      wsAdd: '关联',
      wsRemoveTip: '移除此工作区',
      wsNoneOption: '尚未关联工作区',
      wsSelectPrompt: '请先在主界面关联一个工作区目录',
      summaryEnabled: '{enabled} / {total} 已启用',
      globalParseErr: '全局 mcp_config.json 解析失败：',
      wsParseErr: '工作区 {name} 的 mcp_config.json 解析失败：',
      fixJsonBtn: '修复 JSON',
      conflictBanner: '发现同名 MCP 冲突：{summary}。建议重命名以避免工具冲突。',
      emptyTitleNone: '还没有配置任何 MCP 服务',
      emptyTitleMatch: '没有匹配的 MCP 服务',
      emptyDescNone: '点击右上角「+ 添加 MCP」或「导入」即可快速接入本地或远程 MCP 工具。',
      emptyDescMatch: '尝试调整上方筛选条件或搜索关键词。',
      emptyAddBtn: '+ 添加第一个 MCP',
      scopeTagGlobal: '全局',
      scopeTagWs: '工作区 · {name}',
      scopeTagPlugin: '插件 · {name}',
      unknownProto: '未知协议',
      conflictBadge: '同名冲突',
      pluginDisabledBadge: '所属插件已禁用',
      hostReadyBadge: '宿主已就绪 · {count} 工具',
      hostErrorBadge: '宿主异常: {status}',
      hostReadyTip: '点击查看 Antigravity 已加载的工具列表',
      togglePluginTip: '插件自带 MCP 由所属插件整体控制开关',
      toggleOnTip: '点击禁用',
      toggleOffTip: '点击启用',
      envMeta: '环境变量 {n}',
      headersMeta: 'Headers {n}',
      allowToolsMeta: '白名单 {n} 个工具',
      denyToolsMeta: '已排除 {n} 个工具',
      cmdReadyMeta: '命令路径已就绪',
      bridgeSseBtn: '转为 mcp-remote 桥接',
      probingBtn: '探测中…',
      reprobeBtn: '重新探测',
      probeBtn: '探测工具',
      editBtn: '编辑',
      cloneBtn: '克隆',
      copyBtn: '复制 JSON',
      exportBtn: '打包为插件',
      deleteBtn: '删除',
      deleteConfirmBtn: '确认删除',
      cancelBtn: '取消',
      probeFailed: '探测失败 ({ms}ms)',
      collapseBtn: '收起',
      probeSuccess: '连接成功',
      hostLoadedLabel: '宿主已加载',
      discoveredTools: '发现 {n} 个工具',
      toolsSyncedBtn: '已同步',
      toolsSaveChangesBtn: '保存变更',
      selectAllBtn: '全选',
      selectNoneBtn: '全不选',
      filterToolsPlaceholder: '筛选工具名或描述…',
      noToolsReturned: '该服务未返回任何工具。',
      toggledOn: '{name} 已启用',
      toggledOff: '{name} 已禁用',
      deletedToast: '已删除 {name}',
      copiedToast: '已复制 mcpServers JSON',
      copyFailedToast: '复制失败，请手动在编辑窗口查看 JSON',
      toolsUpdatedToast: '已更新 {name} 的工具过滤配置',
      bridgedToast: '已将 {name} 转换为 mcp-remote 桥接',
      wsAddedToast: '已关联工作区',
      wsRemovedToast: '已移除工作区关联',
      savedToast: '已保存 {name}',
      importDoneToast: '导入完成：新增/更新 {imported} 个，跳过 {skipped} 个',
      rawSavedToast: 'Raw 配置已保存',
      backupRestoredToast: '已恢复备份，可随时检查确认',
      exportDoneToast: '已生成独立插件 {slug}，可在插件中心启用',
      batchProbeDone: '已完成 {n} 个服务的探测',
      batchProbeNone: '当前筛选下没有已启用的服务可探测',
      editorAddTitle: '添加 MCP 服务',
      editorEditTitle: '编辑 {name}',
      editorCloneTitle: '克隆 {name}',
      editorSubtitle: '支持本地 Stdio 进程与远程 Streamable HTTP',
      modeForm: '可视化表单',
      tplLabel: '快速模板:',
      scopeLabel: '作用域',
      scopeOptGlobal: '全局 (~/.gemini/config/mcp_config.json)',
      scopeOptWs: '工作区 (.agents/mcp_config.json)',
      targetWsLabel: '目标工作区',
      serverIdLabel: '服务名称 (ID)',
      transportLabel: '传输方式',
      transportStdio: '本地进程 (Stdio)',
      transportHttp: '远程 (Streamable HTTP)',
      quickCmdPlaceholder: '快捷拆解整行命令，如: npx -y @modelcontextprotocol/server-filesystem ~/Projects',
      splitCmdBtn: '一键填入',
      splitCmdToast: '已拆解命令和参数',
      commandLabel: '命令 (command)',
      cwdLabel: '工作目录 (cwd，可选)',
      argsLabel: '启动参数 (args，每行一个参数)',
      envLabel: '环境变量 (env)',
      addEnvBtn: '+ 添加变量',
      urlLabel: '服务端点 URL',
      urlHint: '请使用 Streamable HTTP 端点（通常为 /mcp）。如对方仅支持旧版 /sse，请改用「SSE Bridge」模板。',
      headersLabel: '请求头 (headers)',
      addHeaderBtn: '+ 添加请求头',
      authProviderLabel: '鉴权提供方 (authProviderType)',
      authOptDefault: '默认 / 自定义 Headers',
      optional: '可选',
      toolPolicyLabel: '工具过滤策略',
      toolPolicyAll: '不限制（暴露全部工具）',
      toolPolicyAllow: '仅允许白名单 (enabledTools)',
      toolPolicyDeny: '排除黑名单 (disabledTools)',
      enableStatusLabel: '启用状态',
      saveEnableNow: '保存后立即启用',
      saveDisableNow: '保存为禁用状态',
      toolsListLabel: '工具名称列表（逗号或换行分隔）',
      singleJsonLabel: '单服务 JSON 配置',
      editorProbeBtn: '测试连接并拉取工具',
      saveBtn: '保存配置',
      jsonBackErr: 'JSON 语法有误，无法切回表单: {err}',
      jsonErr: 'JSON 格式错误: {err}',
      probingNotice: '正在发送 MCP initialize & tools/list 请求…',
      importTitle: '粘贴 JSON 一键导入',
      importSub: '兼容 Antigravity、Claude Desktop、Cursor 与 VS Code 的 mcpServers 片段',
      importToLabel: '导入到',
      scopeGlobalOpt: '全局配置',
      scopeWsOpt: '工作区配置',
      importJsonLabel: 'JSON 配置片段',
      importOverwriteLabel: '若存在同名 MCP 服务，直接覆盖',
      importConfirmBtn: '确认导入',
      rawTitle: 'Raw 配置文件与备份恢复',
      rawScopeLabel: '配置文件作用域',
      backupLabel: '历史备份:',
      noBackupsOpt: '暂无历史备份',
      restoreBackupBtn: '恢复备份',
      formatJsonBtn: '格式化 JSON',
      saveFileBtn: '保存文件',
      exportTitle: '打包为独立插件',
      exportSub: '将此 MCP 封装到 ~/.gemini/config/plugins/，便于在插件页面独立开关',
      exportSlugLabel: '插件目录名 (小写 + 短横线)',
      exportDisplayLabel: '显示名称',
      exportDescLabel: '简介',
      exportConfirmBtn: '生成插件包',
    },
    en: {
      loading: 'Loading…',
      refreshTip: 'Refresh',
      probeAll: 'Probe All',
      probingProgress: 'Probing {done}/{total}…',
      addMcp: '+ Add MCP',
      scopeAll: 'All',
      scopeGlobal: 'Global',
      scopeWorkspace: 'Workspace',
      scopePlugin: 'Plugins',
      importBtn: 'Import',
      rawBtn: 'Raw / Backups',
      searchPlaceholder: 'Search name, command, URL…',
      statusAll: 'All Status',
      statusEnabled: 'Enabled Only',
      statusDisabled: 'Disabled Only',
      statusWarn: 'Warnings Only',
      wsLabel: 'Workspace:',
      wsPlaceholder: 'Add project path, e.g. ~/Projects/app',
      wsAdd: 'Link',
      wsRemoveTip: 'Unlink workspace',
      wsNoneOption: 'No workspace linked',
      wsSelectPrompt: 'Link a workspace directory in the header first',
      summaryEnabled: '{enabled} / {total} enabled',
      globalParseErr: 'Failed to parse global mcp_config.json: ',
      wsParseErr: 'Failed to parse workspace {name} mcp_config.json: ',
      fixJsonBtn: 'Fix JSON',
      conflictBanner: 'Duplicate MCP names detected: {summary}. Rename to avoid tool collisions.',
      emptyTitleNone: 'No MCP servers configured yet',
      emptyTitleMatch: 'No matching MCP servers',
      emptyDescNone: 'Click "+ Add MCP" or "Import" above to connect local or remote MCP tools.',
      emptyDescMatch: 'Try adjusting your scope tab, search query, or status filter.',
      emptyAddBtn: '+ Add First MCP',
      scopeTagGlobal: 'Global',
      scopeTagWs: 'Workspace · {name}',
      scopeTagPlugin: 'Plugin · {name}',
      unknownProto: 'Unknown',
      conflictBadge: 'Name Conflict',
      pluginDisabledBadge: 'Plugin Disabled',
      hostReadyBadge: 'Host Ready · {count} tools',
      hostErrorBadge: 'Host Status: {status}',
      hostReadyTip: 'Click to inspect tools loaded by Antigravity',
      togglePluginTip: 'Plugin MCPs are toggled via their parent plugin',
      toggleOnTip: 'Click to disable',
      toggleOffTip: 'Click to enable',
      envMeta: '{n} env',
      headersMeta: '{n} headers',
      allowToolsMeta: 'Allowlist: {n} tools',
      denyToolsMeta: 'Excluded: {n} tools',
      cmdReadyMeta: 'Command resolved',
      bridgeSseBtn: 'Convert to mcp-remote',
      probingBtn: 'Probing…',
      reprobeBtn: 'Re-probe',
      probeBtn: 'Probe Tools',
      editBtn: 'Edit',
      cloneBtn: 'Clone',
      copyBtn: 'Copy JSON',
      exportBtn: 'Export Plugin',
      deleteBtn: 'Delete',
      deleteConfirmBtn: 'Confirm Delete',
      cancelBtn: 'Cancel',
      probeFailed: 'Probe failed ({ms}ms)',
      collapseBtn: 'Collapse',
      probeSuccess: 'Connected',
      hostLoadedLabel: 'Loaded in Host',
      discoveredTools: '{n} tools',
      toolsSyncedBtn: 'Synced',
      toolsSaveChangesBtn: 'Save Changes',
      selectAllBtn: 'All',
      selectNoneBtn: 'None',
      filterToolsPlaceholder: 'Filter tool names or descriptions…',
      noToolsReturned: 'Server returned no tools.',
      toggledOn: '{name} enabled',
      toggledOff: '{name} disabled',
      deletedToast: 'Deleted {name}',
      copiedToast: 'Copied mcpServers JSON',
      copyFailedToast: 'Copy failed; open Edit -> JSON to copy manually',
      toolsUpdatedToast: 'Updated tool filters for {name}',
      bridgedToast: 'Converted {name} to mcp-remote bridge',
      wsAddedToast: 'Workspace linked',
      wsRemovedToast: 'Workspace unlinked',
      savedToast: 'Saved {name}',
      importDoneToast: 'Imported {imported} server(s), skipped {skipped}',
      rawSavedToast: 'Raw config saved',
      backupRestoredToast: 'Backup restored',
      exportDoneToast: 'Created plugin {slug}; enable it in Customizations',
      batchProbeDone: 'Probed {n} server(s)',
      batchProbeNone: 'No enabled servers in current view to probe',
      editorAddTitle: 'Add MCP Server',
      editorEditTitle: 'Edit {name}',
      editorCloneTitle: 'Clone {name}',
      editorSubtitle: 'Supports local Stdio processes and remote Streamable HTTP',
      modeForm: 'Visual Form',
      tplLabel: 'Templates:',
      scopeLabel: 'Scope',
      scopeOptGlobal: 'Global (~/.gemini/config/mcp_config.json)',
      scopeOptWs: 'Workspace (.agents/mcp_config.json)',
      targetWsLabel: 'Target Workspace',
      serverIdLabel: 'Server Name (ID)',
      transportLabel: 'Transport',
      transportStdio: 'Local Process (Stdio)',
      transportHttp: 'Remote (Streamable HTTP)',
      quickCmdPlaceholder: 'Split full command line, e.g. npx -y @modelcontextprotocol/server-filesystem ~/Projects',
      splitCmdBtn: 'Split',
      splitCmdToast: 'Command & args populated',
      commandLabel: 'Command',
      cwdLabel: 'Working Dir (cwd, optional)',
      argsLabel: 'Arguments (args, one per line)',
      envLabel: 'Environment Variables (env)',
      addEnvBtn: '+ Add Variable',
      urlLabel: 'Endpoint URL',
      urlHint: 'Use a Streamable HTTP endpoint (typically /mcp). For legacy /sse servers, use the "SSE Bridge" template.',
      headersLabel: 'HTTP Headers',
      addHeaderBtn: '+ Add Header',
      authProviderLabel: 'Auth Provider (authProviderType)',
      authOptDefault: 'Default / Custom Headers',
      optional: 'optional',
      toolPolicyLabel: 'Tool Filter Policy',
      toolPolicyAll: 'Unrestricted (all tools)',
      toolPolicyAllow: 'Allowlist only (enabledTools)',
      toolPolicyDeny: 'Denylist (disabledTools)',
      enableStatusLabel: 'Status',
      saveEnableNow: 'Enable immediately on save',
      saveDisableNow: 'Save as disabled',
      toolsListLabel: 'Tool Names (comma or newline separated)',
      singleJsonLabel: 'Server JSON Config',
      editorProbeBtn: 'Test & Fetch Tools',
      saveBtn: 'Save',
      jsonBackErr: 'Invalid JSON, cannot switch to form: {err}',
      jsonErr: 'Invalid JSON: {err}',
      probingNotice: 'Sending MCP initialize & tools/list…',
      importTitle: 'Paste JSON to Import',
      importSub: 'Compatible with Antigravity, Claude Desktop, Cursor & VS Code snippets',
      importToLabel: 'Import To',
      scopeGlobalOpt: 'Global Config',
      scopeWsOpt: 'Workspace Config',
      importJsonLabel: 'JSON Snippet',
      importOverwriteLabel: 'Overwrite existing servers with the same name',
      importConfirmBtn: 'Import',
      rawTitle: 'Raw Config & Backups',
      rawScopeLabel: 'Config Scope',
      backupLabel: 'Backups:',
      noBackupsOpt: 'No backups yet',
      restoreBackupBtn: 'Restore',
      formatJsonBtn: 'Format JSON',
      saveFileBtn: 'Save File',
      exportTitle: 'Package as Plugin',
      exportSub: 'Bundle into ~/.gemini/config/plugins/ for one-click toggling',
      exportSlugLabel: 'Plugin Directory Slug (lowercase + hyphens)',
      exportDisplayLabel: 'Display Name',
      exportDescLabel: 'Description',
      exportConfirmBtn: 'Create Plugin',
    },
  };

  let lang = localStorage.getItem('mcp_mgr_lang') === 'en' ? 'en' : 'zh';
  function t(key, vars = {}) {
    const dict = I18N[lang] || I18N.zh;
    let str = dict[key] ?? I18N.zh[key] ?? key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v ?? ''));
    }
    return str;
  }

  function applyStaticI18n() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    $('btn-lang').textContent = lang === 'en' ? '中' : 'EN';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
    });
  }

  const TEMPLATES = {
    filesystem: {
      name: 'filesystem',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users'],
      },
    },
    fetch: {
      name: 'fetch',
      config: {
        command: 'uvx',
        args: ['mcp-server-fetch'],
      },
    },
    github: {
      name: 'github',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
      },
    },
    sqlite: {
      name: 'sqlite',
      config: {
        command: 'uvx',
        args: ['mcp-server-sqlite', '--db-path', '/path/to/database.db'],
      },
    },
    http: {
      name: 'remote-mcp',
      config: {
        url: 'https://mcp.example.com/mcp',
        headers: { Authorization: 'Bearer YOUR_TOKEN' },
      },
    },
    'sse-bridge': {
      name: 'sse-bridge',
      config: {
        command: 'npx',
        args: ['-y', 'mcp-remote', 'https://example.com/sse'],
      },
    },
  };

  const SVG_EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const SVG_EYE_OFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
  const SVG_CLOSE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  const state = {
    data: null,
    scope: 'all',          // all | global | workspace | plugin
    selectedWorkspace: '', // active workspace path for workspace tab
    search: '',
    statusFilter: 'all',
    probes: new Map(),     // key -> probeResult
    probing: new Set(),    // keys currently probing
    probeFilters: new Map(),
    batchProbing: false,
    confirmDeleteKey: '',
    editor: {
      open: false,
      mode: 'form',        // form | json
      isEdit: false,
      originalScope: 'global',
      originalWorkspace: '',
      originalName: '',
      transport: 'stdio',
      extraConfig: {},
    },
    exportTarget: null,
  };

  // Sync theme light/dark from host preload tokens
  function syncTheme() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--background, #f6f7f9)';
    document.documentElement.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    const nums = (c.match(/[\d.]+/g) || []).map(Number);
    if (nums.length < 3) return;
    const scale = c.startsWith('color(') ? 1 : 255;
    const [r, g, b] = nums.slice(0, 3).map((v) => v / scale);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    document.documentElement.dataset.theme = lum < 0.5 ? 'dark' : 'light';
  }
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

  // API helper using window.sidecar.fetch when embedded
  async function api(path, body = null) {
    const f = window.sidecar?.fetch ? window.sidecar.fetch.bind(window.sidecar) : fetch;
    const opts = body === null
      ? { method: 'GET' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const res = await f(path, opts);
    const json = await res.json();
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  }

  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('toast-root').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function serverKey(srv) {
    return `${srv.scope}|${srv.workspacePath || srv.pluginDir || ''}|${srv.name}`;
  }

  function allServers() {
    if (!state.data) return [];
    const list = [...(state.data.global?.servers || [])];
    for (const ws of state.data.workspaces || []) {
      list.push(...(ws.servers || []));
    }
    for (const p of state.data.plugins || []) {
      list.push(...(p.servers || []));
    }
    return list;
  }

  function splitShellArgs(line) {
    const out = [];
    let cur = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quote) {
        if (ch === '\\' && quote === '"' && i + 1 < line.length) cur += line[++i];
        else if (ch === quote) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (/\s/.test(ch)) {
        if (cur) { out.push(cur); cur = ''; }
      } else if (ch === '\\' && i + 1 < line.length) {
        cur += line[++i];
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  async function refresh() {
    try {
      const data = await api('/api/state');
      state.data = data;
      const wsList = data.workspaces || [];
      if (!state.selectedWorkspace || !wsList.some((w) => w.path === state.selectedWorkspace)) {
        state.selectedWorkspace = wsList[0]?.path || '';
      }
      render();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function render() {
    applyStaticI18n();
    if (!state.data) return;
    const all = allServers();
    const globalCount = state.data.global.servers.length;
    const wsCount = state.data.workspaces.reduce((acc, w) => acc + w.servers.length, 0);
    const pluginCount = state.data.plugins.reduce((acc, p) => acc + p.servers.length, 0);
    const enabledCount = all.filter((s) => !s.disabled && !s.pluginDisabled).length;

    $('summary-pill').textContent = t('summaryEnabled', { enabled: enabledCount, total: all.length });
    $('cnt-all').textContent = String(all.length);
    $('cnt-global').textContent = String(globalCount);
    $('cnt-workspace').textContent = String(wsCount);
    $('cnt-plugin').textContent = String(pluginCount);

    document.querySelectorAll('.scope-tab').forEach((btn) => {
      const active = btn.dataset.scope === state.scope;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    // Workspace bar
    const wsList = state.data.workspaces || [];
    const showWsBar = state.scope === 'workspace' || wsList.length > 0;
    $('workspace-bar').classList.toggle('hidden', !showWsBar);
    if (showWsBar) {
      const sel = $('workspace-select');
      sel.innerHTML = wsList.length
        ? wsList.map((w) => `<option value="${esc(w.path)}"${w.path === state.selectedWorkspace ? ' selected' : ''}>${esc(w.name)} (${w.servers.length})</option>`).join('')
        : `<option value="">${esc(t('wsNoneOption'))}</option>`;
      $('btn-ws-remove').classList.toggle('hidden', !state.selectedWorkspace);
    }

    renderAlerts();
    renderServers(all);
  }

  function renderAlerts() {
    const area = $('alerts-area');
    const banners = [];
    if (state.data.global?.parseError) {
      banners.push(`
        <div class="alert-banner error">
          <div><strong>${esc(t('globalParseErr'))}</strong>${esc(state.data.global.parseError)}</div>
          <button type="button" class="btn btn-secondary btn-xs" data-open-raw="global">${esc(t('fixJsonBtn'))}</button>
        </div>
      `);
    }
    for (const ws of state.data.workspaces || []) {
      if (ws.parseError) {
        banners.push(`
          <div class="alert-banner error">
            <div><strong>${esc(t('wsParseErr', { name: ws.name }))}</strong>${esc(ws.parseError)}</div>
            <button type="button" class="btn btn-secondary btn-xs" data-open-raw="workspace" data-ws="${esc(ws.path)}">${esc(t('fixJsonBtn'))}</button>
          </div>
        `);
      }
    }
    const conflictEntries = Object.entries(state.data.conflicts || {});
    if (conflictEntries.length > 0) {
      const summary = conflictEntries.map(([n, srcs]) => `<code>${esc(n)}</code> (${esc(srcs.join(' / '))})`).join(', ');
      banners.push(`
        <div class="alert-banner warn">
          <div>${t('conflictBanner', { summary })}</div>
        </div>
      `);
    }
    area.innerHTML = banners.join('');
    area.querySelectorAll('[data-open-raw]').forEach((btn) => {
      btn.addEventListener('click', () => openRawModal(btn.dataset.openRaw, btn.dataset.ws || state.selectedWorkspace));
    });
  }

  function filterServers(all) {
    const q = state.search.trim().toLowerCase();
    return all.filter((s) => {
      if (state.scope !== 'all' && s.scope !== state.scope) return false;
      if (state.scope === 'workspace' && state.selectedWorkspace && s.workspacePath !== state.selectedWorkspace) return false;
      const isOff = Boolean(s.disabled || s.pluginDisabled);
      if (state.statusFilter === 'enabled' && isOff) return false;
      if (state.statusFilter === 'disabled' && !isOff) return false;
      if (state.statusFilter === 'warn' && (!s.warnings || s.warnings.length === 0)) return false;
      if (q) {
        const hay = [
          s.name,
          s.config?.command,
          ...(s.config?.args || []),
          s.endpointUrl,
          s.pluginName,
          s.workspaceName,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function endpointSummary(srv) {
    if (srv.transport === 'stdio') {
      const args = Array.isArray(srv.config?.args) ? srv.config.args.join(' ') : '';
      return `${srv.config?.command || ''} ${args}`.trim();
    }
    return srv.endpointUrl || 'URL not set';
  }

  function renderServers(all) {
    const list = filterServers(all);
    const root = $('server-list');
    if (list.length === 0) {
      root.innerHTML = `
        <div class="empty-state">
          <h3>${esc(all.length === 0 ? t('emptyTitleNone') : t('emptyTitleMatch'))}</h3>
          <p>${esc(all.length === 0 ? t('emptyDescNone') : t('emptyDescMatch'))}</p>
          ${all.length === 0 ? `<button type="button" class="btn btn-primary btn-sm" id="empty-add-btn">${esc(t('emptyAddBtn'))}</button>` : ''}
        </div>
      `;
      const emptyBtn = $('empty-add-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openEditorModal());
      return;
    }

    root.innerHTML = list.map((srv) => renderCardHtml(srv)).join('');
    bindCardEvents();
  }

  function renderHostBadge(srv, key) {
    const hs = srv.hostStatus;
    if (!hs || srv.disabled || srv.pluginDisabled) return '';
    if (hs.ready) {
      const count = Array.isArray(hs.tools) ? hs.tools.length : 0;
      return `<button type="button" class="badge badge-success" data-action="host-tools" data-key="${esc(key)}" title="${esc(t('hostReadyTip'))}">${esc(t('hostReadyBadge', { count }))}</button>`;
    }
    const shortSt = String(hs.status || '').replace(/^MCP_SERVER_STATUS_/, '') || 'ERROR';
    return `<span class="badge badge-danger">${esc(t('hostErrorBadge', { status: shortSt }))}</span>`;
  }

  function renderCardHtml(srv) {
    const key = serverKey(srv);
    const isPlugin = srv.scope === 'plugin';
    const isOff = Boolean(srv.disabled || srv.pluginDisabled);
    const hasErr = (srv.warnings || []).some((w) => w.level === 'error') || Boolean(srv.hostStatus && !srv.hostStatus.ready && !isOff);
    const hasWarn = (srv.warnings || []).length > 0;
    const dotClass = isOff ? 'off' : (hasErr ? 'err' : (hasWarn ? 'warn' : ''));
    const scopeLabel = srv.scope === 'global'
      ? t('scopeTagGlobal')
      : (srv.scope === 'workspace' ? t('scopeTagWs', { name: srv.workspaceName }) : t('scopeTagPlugin', { name: srv.pluginName }));
    const transportLabel = srv.transport === 'stdio' ? 'Stdio' : (srv.transport === 'http' ? 'Streamable HTTP' : t('unknownProto'));
    const hasConflict = Boolean(state.data.conflicts?.[srv.name]);
    const probe = state.probes.get(key);
    const isProbing = state.probing.has(key);

    const enabledTools = Array.isArray(srv.config?.enabledTools) ? srv.config.enabledTools : [];
    const disabledTools = Array.isArray(srv.config?.disabledTools) ? srv.config.disabledTools : [];
    const envCount = srv.config?.env && typeof srv.config.env === 'object' ? Object.keys(srv.config.env).length : 0;
    const hdrCount = srv.config?.headers && typeof srv.config.headers === 'object' ? Object.keys(srv.config.headers).length : 0;

    const metaBits = [];
    if (envCount) metaBits.push(t('envMeta', { n: envCount }));
    if (hdrCount) metaBits.push(t('headersMeta', { n: hdrCount }));
    if (enabledTools.length) metaBits.push(t('allowToolsMeta', { n: enabledTools.length }));
    else if (disabledTools.length) metaBits.push(t('denyToolsMeta', { n: disabledTools.length }));
    if (srv.resolvedCommand) metaBits.push(t('cmdReadyMeta'));

    const warningsHtml = (srv.warnings || []).map((w) => `
      <div class="warn-item ${w.level === 'error' ? 'error' : ''}">
        <span>${esc(w.message)}</span>
        ${w.canBridgeSse && !isPlugin ? `<button type="button" class="btn btn-secondary btn-xs" data-action="bridge-sse" data-key="${esc(key)}">${esc(t('bridgeSseBtn'))}</button>` : ''}
      </div>
    `).join('');

    const probeHtml = probe ? renderProbeDrawer(key, srv, probe) : '';
    const confirmDelete = state.confirmDeleteKey === key;

    return `
      <article class="server-card ${isOff ? 'is-disabled' : ''}" data-key="${esc(key)}">
        <div class="card-head">
          <div class="card-title-group">
            <div class="card-title-row">
              <span class="status-dot ${dotClass}"></span>
              <span class="server-name">${esc(srv.name)}</span>
              <span class="badge ${srv.scope === 'global' ? 'badge-accent' : ''}">${esc(scopeLabel)}</span>
              <span class="badge">${esc(transportLabel)}</span>
              ${renderHostBadge(srv, key)}
              ${hasConflict ? `<span class="badge badge-warn">${esc(t('conflictBadge'))}</span>` : ''}
              ${srv.pluginDisabled ? `<span class="badge badge-warn">${esc(t('pluginDisabledBadge'))}</span>` : ''}
            </div>
          </div>
          <label class="switch-wrap" title="${esc(isPlugin ? t('togglePluginTip') : (srv.disabled ? t('toggleOffTip') : t('toggleOnTip')))}">
            <input type="checkbox" data-action="toggle" data-key="${esc(key)}" ${isOff ? '' : 'checked'} ${isPlugin ? 'disabled' : ''}>
            <span class="switch-track"></span>
          </label>
        </div>

        <div class="card-endpoint" title="${esc(endpointSummary(srv))}">${esc(endpointSummary(srv))}</div>

        ${metaBits.length ? `<div class="card-meta-row">${metaBits.map((b) => `<span>· ${esc(b)}</span>`).join('')}</div>` : ''}
        ${warningsHtml}
        ${probeHtml}

        <div class="card-actions">
          <button type="button" class="btn btn-secondary btn-xs" data-action="probe" data-key="${esc(key)}" ${isProbing ? 'disabled' : ''}>
            ${esc(isProbing ? t('probingBtn') : (probe ? t('reprobeBtn') : t('probeBtn')))}
          </button>
          ${!isPlugin ? `<button type="button" class="btn btn-secondary btn-xs" data-action="edit" data-key="${esc(key)}">${esc(t('editBtn'))}</button>` : ''}
          ${!isPlugin ? `<button type="button" class="btn btn-ghost btn-xs" data-action="clone" data-key="${esc(key)}">${esc(t('cloneBtn'))}</button>` : ''}
          <button type="button" class="btn btn-ghost btn-xs" data-action="copy" data-key="${esc(key)}">${esc(t('copyBtn'))}</button>
          ${!isPlugin ? `<button type="button" class="btn btn-ghost btn-xs" data-action="export" data-key="${esc(key)}">${esc(t('exportBtn'))}</button>` : ''}
          <div class="spacer"></div>
          ${!isPlugin ? (confirmDelete
            ? `<button type="button" class="btn btn-danger-ghost btn-xs" data-action="delete-confirm" data-key="${esc(key)}">${esc(t('deleteConfirmBtn'))}</button>
               <button type="button" class="btn btn-ghost btn-xs" data-action="delete-cancel">${esc(t('cancelBtn'))}</button>`
            : `<button type="button" class="btn btn-danger-ghost btn-xs" data-action="delete-ask" data-key="${esc(key)}">${esc(t('deleteBtn'))}</button>`) : ''}
        </div>
      </article>
    `;
  }

  function isToolCheckedByConfig(srv, toolName) {
    if (Array.isArray(srv.config?.enabledTools)) {
      return srv.config.enabledTools.includes(toolName);
    }
    if (Array.isArray(srv.config?.disabledTools)) {
      return !srv.config.disabledTools.includes(toolName);
    }
    return true;
  }

  function updateApplyToolsState(key) {
    const srv = findServerByKey(key);
    const grid = document.querySelector(`[data-probe-grid="${CSS.escape(key)}"]`);
    const btn = document.querySelector(`[data-action="apply-tools"][data-key="${CSS.escape(key)}"]`);
    if (!srv || !grid || !btn) return;
    let dirty = false;
    grid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      const chip = cb.closest('.tool-chip');
      if (chip) chip.classList.toggle('is-excluded', !cb.checked);
      if (cb.checked !== isToolCheckedByConfig(srv, cb.value)) dirty = true;
    });
    btn.disabled = !dirty;
    btn.classList.toggle('btn-primary', dirty);
    btn.classList.toggle('btn-secondary', !dirty);
    btn.textContent = dirty ? t('toolsSaveChangesBtn') : t('toolsSyncedBtn');
  }

  function renderProbeDrawer(key, srv, probe) {
    if (!probe.ok) {
      return `
        <div class="probe-box">
          <div class="probe-head">
            <span style="color:var(--danger);font-weight:600">${esc(t('probeFailed', { ms: probe.latencyMs }))}</span>
            <button type="button" class="link-btn" data-action="probe-close" data-key="${esc(key)}">${esc(t('collapseBtn'))}</button>
          </div>
          <div style="font-size:11.5px;color:var(--fg)">${esc(probe.error)}</div>
          ${probe.stderr ? `<pre class="mono" style="margin:0;font-size:10.5px;overflow:auto;max-height:90px">${esc(probe.stderr)}</pre>` : ''}
        </div>
      `;
    }

    const tools = probe.tools || [];
    const srvInfo = probe.serverInfo?.name ? `${probe.serverInfo.name}${probe.serverInfo.version ? ' v' + probe.serverInfo.version : ''}` : t('probeSuccess');
    const timingOrHost = probe.fromHost ? t('hostLoadedLabel') : `${probe.latencyMs}ms`;
    const filterQ = (state.probeFilters.get(key) || '').toLowerCase();

    return `
      <div class="probe-box">
        <div class="probe-head">
          <span>
            <strong style="color:var(--success)">${esc(t('probeSuccess'))}</strong> · ${esc(srvInfo)} · ${esc(timingOrHost)} · <strong>${esc(t('discoveredTools', { n: tools.length }))}</strong>
          </span>
          <div style="display:flex;gap:8px;align-items:center">
            ${!srv.readOnly && tools.length ? `<button type="button" class="btn btn-secondary btn-xs" data-action="apply-tools" data-key="${esc(key)}" disabled>${esc(t('toolsSyncedBtn'))}</button>` : ''}
            <button type="button" class="link-btn" data-action="probe-close" data-key="${esc(key)}">${esc(t('collapseBtn'))}</button>
          </div>
        </div>
        ${probe.note ? `<div class="field-hint">${esc(probe.note)}</div>` : ''}
        ${tools.length && !srv.readOnly ? `
          <div class="probe-toolbar">
            ${tools.length > 6 ? `<input type="search" class="probe-filter-input" data-probe-search="${esc(key)}" value="${esc(state.probeFilters.get(key) || '')}" placeholder="${esc(t('filterToolsPlaceholder'))}">` : '<span class="spacer"></span>'}
            <div class="probe-bulk-actions">
              <button type="button" class="link-btn" data-action="tools-all" data-key="${esc(key)}">${esc(t('selectAllBtn'))}</button>
              <button type="button" class="link-btn" data-action="tools-none" data-key="${esc(key)}">${esc(t('selectNoneBtn'))}</button>
            </div>
          </div>
        ` : ''}
        ${tools.length ? `
          <div class="probe-tools-grid" data-probe-grid="${esc(key)}">
            ${tools.map((tool) => {
              const checked = isToolCheckedByConfig(srv, tool.name);
              const hiddenByFilter = filterQ && !`${tool.name} ${tool.description || ''}`.toLowerCase().includes(filterQ);
              return `
                <label class="tool-chip ${checked ? '' : 'is-excluded'} ${hiddenByFilter ? 'hidden' : ''}" title="${esc(tool.description || tool.name)}">
                  <input type="checkbox" value="${esc(tool.name)}" ${checked ? 'checked' : ''} ${srv.readOnly ? 'disabled' : ''}>
                  <div>
                    <div class="tool-chip-name">${esc(tool.name)}</div>
                    ${tool.description ? `<div class="tool-chip-desc">${esc(tool.description)}</div>` : ''}
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        ` : `<div class="field-hint">${esc(t('noToolsReturned'))}</div>`}
      </div>
    `;
  }

  function findServerByKey(key) {
    return allServers().find((s) => serverKey(s) === key);
  }

  function bindCardEvents() {
    $('server-list').querySelectorAll('[data-probe-grid]').forEach((grid) => {
      const key = grid.dataset.probeGrid;
      grid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener('change', () => updateApplyToolsState(key));
      });
    });

    $('server-list').querySelectorAll('[data-probe-search]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.probeSearch;
        state.probeFilters.set(key, inp.value);
        const q = inp.value.trim().toLowerCase();
        const grid = document.querySelector(`[data-probe-grid="${CSS.escape(key)}"]`);
        if (!grid) return;
        grid.querySelectorAll('.tool-chip').forEach((chip) => {
          const text = chip.textContent.toLowerCase();
          chip.classList.toggle('hidden', Boolean(q && !text.includes(q)));
        });
      });
    });

    $('server-list').querySelectorAll('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      const key = el.dataset.key;
      if (action === 'toggle') {
        el.addEventListener('change', async () => {
          const srv = findServerByKey(key);
          if (!srv) return;
          try {
            await api('/api/server/toggle', {
              scope: srv.scope,
              workspacePath: srv.workspacePath,
              name: srv.name,
              disabled: !el.checked,
            });
            toast(t(el.checked ? 'toggledOn' : 'toggledOff', { name: srv.name }), 'success');
            await refresh();
          } catch (err) {
            toast(err.message, 'error');
            await refresh();
          }
        });
        return;
      }

      el.addEventListener('click', async () => {
        const srv = findServerByKey(key);
        if (action === 'delete-ask') {
          state.confirmDeleteKey = key;
          render();
        } else if (action === 'delete-cancel') {
          state.confirmDeleteKey = '';
          render();
        } else if (action === 'delete-confirm' && srv) {
          try {
            await api('/api/server/delete', {
              scope: srv.scope,
              workspacePath: srv.workspacePath,
              name: srv.name,
            });
            state.confirmDeleteKey = '';
            toast(t('deletedToast', { name: srv.name }), 'success');
            await refresh();
          } catch (err) {
            toast(err.message, 'error');
          }
        } else if (action === 'edit' && srv) {
          openEditorModal(srv, false);
        } else if (action === 'clone' && srv) {
          openEditorModal(srv, true);
        } else if (action === 'copy' && srv) {
          const snippet = JSON.stringify({ mcpServers: { [srv.name]: srv.config } }, null, 2);
          try {
            await navigator.clipboard.writeText(snippet);
            toast(t('copiedToast'), 'success');
          } catch {
            toast(t('copyFailedToast'), 'error');
          }
        } else if (action === 'host-tools' && srv?.hostStatus?.ready) {
          if (state.probes.has(key)) {
            state.probes.delete(key);
          } else {
            state.probes.set(key, {
              ok: true,
              fromHost: true,
              latencyMs: 0,
              serverInfo: srv.hostStatus.serverInfo || null,
              tools: srv.hostStatus.tools || [],
            });
          }
          render();
        } else if (action === 'probe' && srv) {
          await probeSingleServer(srv);
        } else if (action === 'probe-close') {
          state.probes.delete(key);
          render();
        } else if ((action === 'tools-all' || action === 'tools-none')) {
          const grid = document.querySelector(`[data-probe-grid="${CSS.escape(key)}"]`);
          if (!grid) return;
          const targetState = action === 'tools-all';
          grid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            cb.checked = targetState;
          });
          updateApplyToolsState(key);
        } else if (action === 'apply-tools' && srv) {
          const grid = document.querySelector(`[data-probe-grid="${CSS.escape(key)}"]`);
          if (!grid) return;
          const boxes = [...grid.querySelectorAll('input[type="checkbox"]')];
          const checked = boxes.filter((b) => b.checked).map((b) => b.value);
          const unchecked = boxes.filter((b) => !b.checked).map((b) => b.value);
          const nextCfg = { ...srv.config };

          if (Array.isArray(srv.config?.enabledTools)) {
            // Preserve allowlist mode when enabledTools was originally active
            nextCfg.enabledTools = checked;
            delete nextCfg.disabledTools;
          } else {
            delete nextCfg.enabledTools;
            if (unchecked.length > 0) nextCfg.disabledTools = unchecked;
            else delete nextCfg.disabledTools;
          }
          try {
            await api('/api/server/save', {
              scope: srv.scope,
              workspacePath: srv.workspacePath,
              originalScope: srv.scope,
              originalWorkspacePath: srv.workspacePath,
              originalName: srv.name,
              name: srv.name,
              config: nextCfg,
            });
            toast(t('toolsUpdatedToast', { name: srv.name }), 'success');
            await refresh();
          } catch (err) {
            toast(err.message, 'error');
          }
        } else if (action === 'bridge-sse' && srv) {
          const nextCfg = {
            command: 'npx',
            args: ['-y', 'mcp-remote', srv.endpointUrl],
            ...(srv.config?.disabled ? { disabled: true } : {}),
          };
          try {
            await api('/api/server/save', {
              scope: srv.scope,
              workspacePath: srv.workspacePath,
              originalScope: srv.scope,
              originalWorkspacePath: srv.workspacePath,
              originalName: srv.name,
              name: srv.name,
              config: nextCfg,
            });
            toast(t('bridgedToast', { name: srv.name }), 'success');
            await refresh();
          } catch (err) {
            toast(err.message, 'error');
          }
        } else if (action === 'export' && srv) {
          openExportModal(srv);
        }
      });
    });
  }

  async function probeSingleServer(srv, skipRender = false) {
    const key = serverKey(srv);
    state.probing.add(key);
    if (!skipRender) render();
    try {
      const res = await api('/api/probe', { config: srv.config });
      state.probes.set(key, res.probe);
    } catch (err) {
      state.probes.set(key, { ok: false, latencyMs: 0, error: err.message, tools: [] });
    } finally {
      state.probing.delete(key);
      if (!skipRender) render();
    }
  }

  async function probeAllVisible() {
    if (state.batchProbing || !state.data) return;
    const targets = filterServers(allServers()).filter((s) => !s.disabled && !s.pluginDisabled);
    if (!targets.length) {
      toast(t('batchProbeNone'));
      return;
    }
    state.batchProbing = true;
    const btn = $('btn-probe-all');
    const span = btn.querySelector('[data-i18n="probeAll"]');
    btn.disabled = true;
    let done = 0;
    const updateLabel = () => {
      if (span) span.textContent = t('probingProgress', { done, total: targets.length });
    };
    updateLabel();

    const queue = [...targets];
    const worker = async () => {
      while (queue.length) {
        const srv = queue.shift();
        await probeSingleServer(srv, true);
        done += 1;
        updateLabel();
        render();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker));

    state.batchProbing = false;
    btn.disabled = false;
    if (span) span.textContent = t('probeAll');
    toast(t('batchProbeDone', { n: targets.length }), 'success');
  }

  // ---------- KV Rows (Env / Headers) ----------
  function addKvRow(containerId, k = '', v = '', isSecret = false) {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
      <input type="text" class="kv-k" placeholder="KEY" value="${esc(k)}">
      <input type="${isSecret ? 'password' : 'text'}" class="kv-v" placeholder="VALUE" value="${esc(v)}">
      <button type="button" class="icon-btn sm kv-eye" aria-label="Toggle visibility">${isSecret ? SVG_EYE : SVG_EYE_OFF}</button>
      <button type="button" class="icon-btn sm kv-del" aria-label="Remove">${SVG_CLOSE}</button>
    `;
    const valInput = row.querySelector('.kv-v');
    const eyeBtn = row.querySelector('.kv-eye');
    eyeBtn.addEventListener('click', () => {
      const nextSecret = valInput.type !== 'password';
      valInput.type = nextSecret ? 'password' : 'text';
      eyeBtn.innerHTML = nextSecret ? SVG_EYE : SVG_EYE_OFF;
    });
    row.querySelector('.kv-del').addEventListener('click', () => row.remove());
    $(containerId).appendChild(row);
  }

  function readKvRows(containerId) {
    const obj = {};
    $(containerId).querySelectorAll('.kv-row').forEach((row) => {
      const k = row.querySelector('.kv-k').value.trim();
      const v = row.querySelector('.kv-v').value;
      if (k) obj[k] = v;
    });
    return obj;
  }

  // ---------- Editor Modal ----------
  function populateWorkspaceSelect(selectEl, currentPath) {
    const wsList = state.data?.workspaces || [];
    selectEl.innerHTML = wsList.length
      ? wsList.map((w) => `<option value="${esc(w.path)}"${w.path === currentPath ? ' selected' : ''}>${esc(w.name)} (${esc(w.path)})</option>`).join('')
      : `<option value="">${esc(t('wsSelectPrompt'))}</option>`;
  }

  function setEditorTransport(tr) {
    state.editor.transport = tr;
    document.querySelectorAll('.seg-btn[data-transport]').forEach((b) => {
      b.classList.toggle('active', b.dataset.transport === tr);
    });
    $('pane-stdio').classList.toggle('hidden', tr !== 'stdio');
    $('pane-http').classList.toggle('hidden', tr !== 'http');
  }

  function setEditorMode(mode) {
    if (mode === 'json' && state.editor.mode === 'form') {
      const cfg = buildConfigFromForm();
      $('ed-raw-json').value = JSON.stringify(cfg, null, 2);
    } else if (mode === 'form' && state.editor.mode === 'json') {
      try {
        const parsed = JSON.parse($('ed-raw-json').value);
        fillFormFromConfig(parsed);
      } catch (err) {
        toast(t('jsonBackErr', { err: err.message }), 'error');
        return;
      }
    }
    state.editor.mode = mode;
    document.querySelectorAll('.mode-btn[data-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    $('editor-form-pane').classList.toggle('hidden', mode !== 'form');
    $('editor-json-pane').classList.toggle('hidden', mode !== 'json');
  }

  function fillFormFromConfig(cfg) {
    const c = cfg && typeof cfg === 'object' ? cfg : {};
    state.editor.extraConfig = { ...c };
    const isHttp = Boolean(!c.command && (c.url || c.serverUrl));
    setEditorTransport(isHttp ? 'http' : 'stdio');

    $('ed-command').value = c.command || '';
    $('ed-cwd').value = c.cwd || '';
    $('ed-args').value = Array.isArray(c.args) ? c.args.join('\n') : '';
    $('ed-env-rows').innerHTML = '';
    if (c.env && typeof c.env === 'object') {
      for (const [k, v] of Object.entries(c.env)) {
        addKvRow('ed-env-rows', k, String(v ?? ''), /token|key|secret|pass/i.test(k));
      }
    }

    $('ed-url').value = c.url || c.serverUrl || '';
    $('ed-header-rows').innerHTML = '';
    if (c.headers && typeof c.headers === 'object') {
      for (const [k, v] of Object.entries(c.headers)) {
        addKvRow('ed-header-rows', k, String(v ?? ''), /auth|token|key|secret/i.test(k));
      }
    }
    $('ed-auth-type').value = c.authProviderType || '';
    $('ed-oauth-id').value = c.oauth?.clientId || '';
    $('ed-oauth-secret').value = c.oauth?.clientSecret || '';

    $('ed-enabled').checked = !c.disabled;
    $('ed-enabled-label').textContent = !c.disabled ? t('saveEnableNow') : t('saveDisableNow');

    if (Array.isArray(c.enabledTools)) {
      $('ed-tool-mode').value = 'allow';
      $('ed-tools-wrap').classList.remove('hidden');
      $('ed-tools-list').value = c.enabledTools.join('\n');
    } else if (Array.isArray(c.disabledTools)) {
      $('ed-tool-mode').value = 'deny';
      $('ed-tools-wrap').classList.remove('hidden');
      $('ed-tools-list').value = c.disabledTools.join('\n');
    } else {
      $('ed-tool-mode').value = 'all';
      $('ed-tools-wrap').classList.add('hidden');
      $('ed-tools-list').value = '';
    }
  }

  function buildConfigFromForm() {
    const cfg = { ...(state.editor.extraConfig || {}) };
    delete cfg.command;
    delete cfg.args;
    delete cfg.cwd;
    delete cfg.env;
    delete cfg.url;
    delete cfg.serverUrl;
    delete cfg.headers;
    delete cfg.authProviderType;
    delete cfg.oauth;
    delete cfg.enabledTools;
    delete cfg.disabledTools;
    delete cfg.disabled;

    if (state.editor.transport === 'stdio') {
      const cmd = $('ed-command').value.trim();
      if (cmd) cfg.command = cmd;
      const args = $('ed-args').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (args.length) cfg.args = args;
      const cwd = $('ed-cwd').value.trim();
      if (cwd) cfg.cwd = cwd;
      const env = readKvRows('ed-env-rows');
      if (Object.keys(env).length) cfg.env = env;
    } else {
      const url = $('ed-url').value.trim();
      if (url) cfg.url = url;
      const headers = readKvRows('ed-header-rows');
      if (Object.keys(headers).length) cfg.headers = headers;
      const auth = $('ed-auth-type').value;
      if (auth) cfg.authProviderType = auth;
      const oauthId = $('ed-oauth-id').value.trim();
      const oauthSecret = $('ed-oauth-secret').value.trim();
      if (oauthId || oauthSecret) {
        cfg.oauth = { ...(state.editor.extraConfig?.oauth || {}) };
        if (oauthId) cfg.oauth.clientId = oauthId;
        else delete cfg.oauth.clientId;
        if (oauthSecret) cfg.oauth.clientSecret = oauthSecret;
        else delete cfg.oauth.clientSecret;
      }
    }

    const toolMode = $('ed-tool-mode').value;
    const tools = $('ed-tools-list').value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (toolMode === 'allow' && tools.length) cfg.enabledTools = tools;
    if (toolMode === 'deny' && tools.length) cfg.disabledTools = tools;

    if (!$('ed-enabled').checked) cfg.disabled = true;
    return cfg;
  }

  function syncEditorScopeUi() {
    const isWs = $('ed-scope').value === 'workspace';
    $('ed-ws-wrap').classList.toggle('hidden', !isWs);
  }

  function openEditorModal(srv = null, isClone = false) {
    const isEdit = Boolean(srv && !isClone);
    state.editor.isEdit = isEdit;
    state.editor.originalScope = srv?.scope || (state.scope === 'workspace' ? 'workspace' : 'global');
    state.editor.originalWorkspace = srv?.workspacePath || state.selectedWorkspace || '';
    state.editor.originalName = isEdit ? (srv?.name || '') : '';
    state.editor.mode = 'form';

    $('editor-title').textContent = isEdit
      ? t('editorEditTitle', { name: srv.name })
      : (isClone && srv ? t('editorCloneTitle', { name: srv.name }) : t('editorAddTitle'));
    $('template-strip').classList.toggle('hidden', isEdit);
    $('editor-probe-box').classList.add('hidden');
    $('editor-probe-box').innerHTML = '';
    $('ed-cmd-quick').value = '';

    populateWorkspaceSelect($('ed-workspace'), state.editor.originalWorkspace);
    $('ed-scope').value = state.editor.originalScope;
    // Allow moving across scopes while editing
    $('ed-scope').disabled = false;
    $('ed-workspace').disabled = false;
    syncEditorScopeUi();

    $('ed-name').value = isClone && srv ? `${srv.name}-copy` : (srv?.name || '');
    fillFormFromConfig(srv?.config || {});
    setEditorMode('form');
    $('modal-editor').classList.remove('hidden');
    $('ed-name').focus();
  }

  async function loadBackupsIntoSelect() {
    const sel = $('raw-backup-select');
    const restoreBtn = $('btn-raw-restore');
    try {
      const res = await api('/api/backups');
      const list = res.backups || [];
      if (!list.length) {
        sel.innerHTML = `<option value="">${esc(t('noBackupsOpt'))}</option>`;
        restoreBtn.disabled = true;
      } else {
        sel.innerHTML = list.map((b) => {
          const ts = new Date(b.createdAt).toLocaleString();
          return `<option value="${esc(b.id)}">${esc(ts)} · ${esc(b.label)} (${b.sizeBytes}B)</option>`;
        }).join('');
        restoreBtn.disabled = false;
      }
    } catch {
      sel.innerHTML = `<option value="">${esc(t('noBackupsOpt'))}</option>`;
      restoreBtn.disabled = true;
    }
  }

  async function openRawModal(scope = 'global', wsPath = '') {
    const targetScope = scope === 'workspace' ? 'workspace' : 'global';
    populateWorkspaceSelect($('raw-workspace'), wsPath || state.selectedWorkspace);
    $('raw-scope').value = targetScope;
    syncRawContent();
    $('modal-raw').classList.remove('hidden');
    await loadBackupsIntoSelect();
  }

  function syncRawContent() {
    const scope = $('raw-scope').value;
    const isWs = scope === 'workspace';
    $('raw-ws-wrap').classList.toggle('hidden', !isWs);
    if (!isWs) {
      $('raw-filepath').textContent = state.data?.global?.filePath || '~/.gemini/config/mcp_config.json';
      $('raw-text').value = state.data?.global?.raw || '{\n  "mcpServers": {}\n}\n';
    } else {
      const wsPath = $('raw-workspace').value;
      const ws = (state.data?.workspaces || []).find((w) => w.path === wsPath);
      $('raw-filepath').textContent = ws?.filePath || '';
      $('raw-text').value = ws?.raw || '{\n  "mcpServers": {}\n}\n';
    }
  }

  function openExportModal(srv) {
    state.exportTarget = srv;
    const slug = srv.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'custom-mcp';
    $('exp-slug').value = slug.endsWith('-mcp') ? slug : `${slug}-mcp`;
    $('exp-display').value = `${srv.name} MCP`;
    $('exp-desc').value = `Standalone Antigravity plugin bundling the ${srv.name} MCP server.`;
    $('modal-export').classList.remove('hidden');
  }

  async function saveEditorModal() {
    const scope = $('ed-scope').value;
    const workspacePath = scope === 'workspace' ? $('ed-workspace').value : undefined;
    const name = $('ed-name').value.trim();
    let cfg;
    try {
      cfg = state.editor.mode === 'json' ? JSON.parse($('ed-raw-json').value) : buildConfigFromForm();
    } catch (err) {
      toast(t('jsonErr', { err: err.message }), 'error');
      return;
    }
    try {
      await api('/api/server/save', {
        scope,
        workspacePath,
        originalScope: state.editor.isEdit ? state.editor.originalScope : undefined,
        originalWorkspacePath: state.editor.isEdit ? state.editor.originalWorkspace : undefined,
        originalName: state.editor.isEdit ? state.editor.originalName : undefined,
        name,
        config: cfg,
      });
      $('modal-editor').classList.add('hidden');
      toast(t('savedToast', { name }), 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function saveRawModal() {
    const scope = $('raw-scope').value;
    const workspacePath = scope === 'workspace' ? $('raw-workspace').value : undefined;
    try {
      await api('/api/raw/save', {
        scope,
        workspacePath,
        rawJson: $('raw-text').value,
      });
      $('modal-raw').classList.add('hidden');
      toast(t('rawSavedToast'), 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ---------- Global Event Bindings ----------
  $('btn-lang').addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('mcp_mgr_lang', lang);
    render();
  });
  $('btn-refresh').addEventListener('click', refresh);
  $('btn-probe-all').addEventListener('click', probeAllVisible);
  $('btn-add').addEventListener('click', () => openEditorModal());
  $('btn-import').addEventListener('click', () => {
    populateWorkspaceSelect($('imp-workspace'), state.selectedWorkspace);
    $('imp-scope').value = state.scope === 'workspace' ? 'workspace' : 'global';
    $('imp-ws-wrap').classList.toggle('hidden', $('imp-scope').value !== 'workspace');
    $('imp-text').value = '';
    $('modal-import').classList.remove('hidden');
  });
  $('btn-raw').addEventListener('click', () => openRawModal(state.scope === 'workspace' ? 'workspace' : 'global', state.selectedWorkspace));

  document.querySelectorAll('.scope-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.scope = btn.dataset.scope;
      render();
    });
  });

  $('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });
  $('status-filter').addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    render();
  });

  $('workspace-select').addEventListener('change', (e) => {
    state.selectedWorkspace = e.target.value;
    render();
  });

  $('btn-ws-add').addEventListener('click', async () => {
    const p = $('ws-path-input').value.trim();
    if (!p) return;
    try {
      await api('/api/workspaces/add', { path: p });
      $('ws-path-input').value = '';
      toast(t('wsAddedToast'), 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btn-ws-remove').addEventListener('click', async () => {
    if (!state.selectedWorkspace) return;
    try {
      await api('/api/workspaces/remove', { path: state.selectedWorkspace });
      state.selectedWorkspace = '';
      toast(t('wsRemovedToast'), 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Modal close buttons & backdrop/keyboard shortcuts
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => $(btn.dataset.close).classList.add('hidden'));
  });
  document.querySelectorAll('.modal-backdrop').forEach((bg) => {
    bg.addEventListener('click', (e) => {
      if (e.target === bg) bg.classList.add('hidden');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
      return;
    }
    const isMetaS = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's';
    if (isMetaS) {
      if (!$('modal-editor').classList.contains('hidden')) {
        e.preventDefault();
        saveEditorModal();
        return;
      }
      if (!$('modal-raw').classList.contains('hidden')) {
        e.preventDefault();
        saveRawModal();
        return;
      }
    }
    const anyModalOpen = [...document.querySelectorAll('.modal-backdrop')].some((m) => !m.classList.contains('hidden'));
    if (anyModalOpen) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    const inField = tag === 'input' || tag === 'textarea' || tag === 'select';
    if ((e.key === '/' && !inField) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      $('search-input').focus();
    }
  });

  // Editor modal internal events
  $('ed-scope').addEventListener('change', syncEditorScopeUi);
  document.querySelectorAll('.mode-btn[data-mode]').forEach((b) => {
    b.addEventListener('click', () => setEditorMode(b.dataset.mode));
  });
  document.querySelectorAll('.seg-btn[data-transport]').forEach((b) => {
    b.addEventListener('click', () => setEditorTransport(b.dataset.transport));
  });
  $('btn-add-env').addEventListener('click', () => addKvRow('ed-env-rows'));
  $('btn-add-header').addEventListener('click', () => addKvRow('ed-header-rows'));
  $('ed-tool-mode').addEventListener('change', () => {
    $('ed-tools-wrap').classList.toggle('hidden', $('ed-tool-mode').value === 'all');
  });
  $('ed-enabled').addEventListener('change', () => {
    $('ed-enabled-label').textContent = $('ed-enabled').checked ? t('saveEnableNow') : t('saveDisableNow');
  });

  $('btn-split-cmd').addEventListener('click', () => {
    const parts = splitShellArgs($('ed-cmd-quick').value.trim());
    if (!parts.length) return;
    $('ed-command').value = parts[0];
    $('ed-args').value = parts.slice(1).join('\n');
    toast(t('splitCmdToast'), 'success');
  });

  document.querySelectorAll('.tpl-chip[data-tpl]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const tpl = TEMPLATES[chip.dataset.tpl];
      if (!tpl) return;
      if (!$('ed-name').value.trim()) $('ed-name').value = tpl.name;
      fillFormFromConfig(tpl.config);
      if (state.editor.mode === 'json') $('ed-raw-json').value = JSON.stringify(tpl.config, null, 2);
    });
  });

  $('btn-editor-probe').addEventListener('click', async () => {
    let cfg;
    try {
      cfg = state.editor.mode === 'json' ? JSON.parse($('ed-raw-json').value) : buildConfigFromForm();
    } catch (err) {
      toast(t('jsonErr', { err: err.message }), 'error');
      return;
    }
    const box = $('editor-probe-box');
    box.classList.remove('hidden');
    box.innerHTML = `<div class="field-hint">${esc(t('probingNotice'))}</div>`;
    try {
      const res = await api('/api/probe', { config: cfg });
      const p = res.probe;
      if (!p.ok) {
        box.innerHTML = `<div style="color:var(--danger);font-size:12px"><strong>${esc(t('probeFailed', { ms: p.latencyMs }))}:</strong> ${esc(p.error)}</div>`;
        return;
      }
      const tools = p.tools || [];
      box.innerHTML = `
        <div class="probe-head">
          <span><strong style="color:var(--success)">${esc(t('probeSuccess'))}</strong> (${p.latencyMs}ms) · ${esc(t('discoveredTools', { n: tools.length }))}</span>
        </div>
        <div style="font-size:11px;color:var(--fg-muted);word-break:break-all">
          ${tools.length ? tools.map((item) => `<code>${esc(item.name)}</code>`).join(' ') : esc(t('noToolsReturned'))}
        </div>
      `;
    } catch (err) {
      box.innerHTML = `<div style="color:var(--danger);font-size:12px">${esc(err.message)}</div>`;
    }
  });

  $('btn-editor-save').addEventListener('click', saveEditorModal);

  // Import modal
  $('imp-scope').addEventListener('change', () => {
    $('imp-ws-wrap').classList.toggle('hidden', $('imp-scope').value !== 'workspace');
  });
  $('btn-import-run').addEventListener('click', async () => {
    const scope = $('imp-scope').value;
    const workspacePath = scope === 'workspace' ? $('imp-workspace').value : undefined;
    try {
      const res = await api('/api/import', {
        scope,
        workspacePath,
        snippet: $('imp-text').value,
        overwrite: $('imp-overwrite').checked,
      });
      $('modal-import').classList.add('hidden');
      toast(t('importDoneToast', { imported: res.imported.length, skipped: res.skipped.length }), 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Raw modal
  $('raw-scope').addEventListener('change', syncRawContent);
  $('raw-workspace').addEventListener('change', syncRawContent);
  $('btn-raw-format').addEventListener('click', () => {
    try {
      const obj = JSON.parse($('raw-text').value);
      $('raw-text').value = JSON.stringify(obj, null, 2) + '\n';
    } catch (err) {
      toast(t('jsonErr', { err: err.message }), 'error');
    }
  });
  $('btn-raw-restore').addEventListener('click', async () => {
    const id = $('raw-backup-select').value;
    if (!id) return;
    const scope = $('raw-scope').value;
    const workspacePath = scope === 'workspace' ? $('raw-workspace').value : undefined;
    try {
      await api('/api/backups/restore', { id, scope, workspacePath });
      toast(t('backupRestoredToast'), 'success');
      await refresh();
      syncRawContent();
      await loadBackupsIntoSelect();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  $('btn-raw-save').addEventListener('click', saveRawModal);

  // Export plugin modal
  $('btn-export-run').addEventListener('click', async () => {
    if (!state.exportTarget) return;
    try {
      const res = await api('/api/export-plugin', {
        serverName: state.exportTarget.name,
        config: state.exportTarget.config,
        pluginSlug: $('exp-slug').value,
        displayName: $('exp-display').value,
        description: $('exp-desc').value,
      });
      $('modal-export').classList.add('hidden');
      toast(t('exportDoneToast', { slug: res.pluginSlug }), 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  applyStaticI18n();
  refresh();
})();
