(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const I18N = {
    zh: {
      loading: '加载中…',
      refreshTip: '刷新状态',
      syncBtn: '同步上游',
      syncingBtn: '同步中…',
      tabSkills: '技能编排',
      tabWorkflow: '流程领航',
      tabWorkspace: '项目工作台',
      tabSettings: '同步与设置',
      bucketSectionTitle: '技能分桶开关',
      bucketSectionSub: '默认开启 {promoted} 个核心技能，{extra} 个演进与扩展技能可按需开启',
      presetPromoted: '标准 {n}',
      presetCore: '精简主干',
      presetAll: '全量 {n}',
      deliverBtn: '投递到项目',
      skillsUnit: '技能',
      detailSectionTitle: '技能明细与指令预览',
      tabAll: '全部',
      tabEngineering: '核心工程',
      tabProductivity: '生产力',
      tabExtra: '扩展',
      searchPlaceholder: '搜索技能名称、/命令、触发方式（如：自动加载）或场景标签…',
      triggerAndStatusLabel: '触发与状态',
      invUser: '用户命令',
      invModel: '自动加载',
      statusEnabled: '已启用',
      statusDisabled: '未启用',
      scenarioLabel: '二级场景 (多选)',
      clearFilters: '重置筛选',
      previewBtn: '预览',
      collapseBtn: '收起',
      badgeBeta: '实验',
      badgeMisc: '扩展',
      badgeCollision: '内置同名提示',
      emptyFilterTitle: '没有匹配的技能',
      emptyFilterDesc: '尝试清空部分筛选条件或更换搜索关键词。',
      previewAdapted: 'Antigravity 原生指令',
      previewUpstream: '上游原版 SKILL.md',
      previewDeps: '调用技能',
      previewAgents: '叶子子代理',
      previewAdaptations: '原生适配',
      copyPromptBtn: '复制调用指令',
      slashHideBtn: '隐藏 / 菜单',
      slashShowBtn: '显示在 / 菜单',
      deliverOneBtn: '投递到当前项目',
      copiedToast: '已复制：{text}',
      toggledOnToast: '已启用 {name}',
      toggledOffToast: '已停用 {name}',
      autoEnabledToast: '已自动联动启用依赖：{deps}',
      dependentsWarnToast: '提示：已启用的 {deps} 引用了此技能',
      bucketOnToast: '已开启 {name} 分桶 ({n} 个技能)',
      bucketOffToast: '已关闭 {name} 分桶',
      presetAppliedToast: '已应用预设（共启用 {n} 个技能）',
      syncDoneToast: '已同步上游 v{ver}（共 {n} 个技能）',
      deliverModalTitle: '投递技能到项目 .agents/skills/',
      deliverModalSub: '让协作者克隆仓库即可直接使用指定技能（自动补齐所需依赖）',
      targetWorkspaceLabel: '目标项目工作区',
      deliverScopeLabel: '投递范围',
      deliverEnabledOpt: '当前全局已启用的全部技能',
      deliverCoreOpt: '精简核心主干 (10 技能)',
      deliverSingleOpt: '仅指定单个技能',
      deliverModeLabel: '写入方式',
      deliverCopyOpt: '复制文件（推荐，可提交 Git 团队共享）',
      deliverLinkOpt: '软链接（跟随本地插件目录实时更新）',
      deliverSingleNameLabel: '技能名称',
      cancelBtn: '取消',
      confirmDeliverBtn: '确认投递',
      deliveredToast: '已投递 {n} 个技能到项目 .agents/skills/',
      noWorkspaceErr: '请先在「项目工作台」关联一个本地项目目录',
      // Workflow tab
      wfSpineTitle: '主干研发流水线（Idea → Ship Spine）',
      wfSpineSub: '点击任意阶段查看最佳实践、阶段边界建议并一键复制调用指令',
      wfOnRampsTitle: '三大快捷入口（On-Ramps）',
      wfOnRampsSub: '非标准新需求场景直接从对应入口切入，再合流回主干',
      wfPhaseTitle: '上下文阶段边界速查（Phase Boundaries）',
      wfPhaseSub: '决定什么时候继续、压缩、新开会话或派发叶子子代理',
      wfPhaseAdvice: '阶段边界建议',
      // Workspace tab
      wsLabel: '当前工作区:',
      wsNone: '尚未关联工作区',
      wsPathPlaceholder: '输入项目绝对路径或 ~/Projects/...',
      wsAddBtn: '关联工作区',
      wsRemoveBtn: '移除关联',
      wsDeliveredTitle: '项目级 .agents/skills/ 投递管理',
      wsDeliveredSub: '独立于全局插件生效，适合团队随仓库共享',
      wsDeliveredEmpty: '当前项目 .agents/skills/ 还没有投递任何技能。',
      wsSetupTitle: '可视化仓库初始化（替代多轮对话版 /setup-matt-pocock-skills）',
      wsSetupSub: '一键生成 docs/agents/*.md 并幂等写入引导规则文件（写入前自动备份）',
      wsTrackerLabel: 'Issue Tracker 类型',
      wsLayoutLabel: '领域文档结构',
      wsRuleTargetLabel: '规则写入目标',
      wsSyncGhLabel: '同时通过 gh CLI 在 GitHub 创建缺失的 5 个 Triage 标签',
      wsSaveSetupBtn: '保存并生成仓库配置',
      wsSetupSavedToast: '仓库初始化配置已写入（已创建安全备份）',
      wsBoardTitle: 'Tracer-Bullet 票据前沿看板（.scratch/*/issues/*.md）',
      wsBoardSub: '自动解析 Blocked by 依赖边，识别可立即并发派发的 Ready Frontier',
      wsColReady: '就绪前沿 Ready',
      wsColBlocked: '阻塞中 Blocked',
      wsColDone: '已完成 Done',
      wsBoardEmpty: '未检测到 .scratch/*/issues/*.md 票据文件。运行 /to-tickets 并选择本地 Markdown 追踪器后即可在此查看依赖图。',
      wsGlossaryTitle: '领域通用语言（GLOSSARY.md）与 ADR 记录',
      wsGlossarySaveBtn: '保存 GLOSSARY.md',
      wsGlossarySavedToast: 'GLOSSARY.md 已保存',
      // Settings tab
      stUpstreamTitle: '上游仓库同步（mattpocock/skills）',
      stInstallTitle: '插件安装模式与全局动态开关',
      stInstallSub: '默认使用软链接模式（--link）跟随源码更新；切换到独立复制模式（--copy）可实现不污染 Git 仓库的全局动态开关',
      stSwitchLinkBtn: '切换为软链接模式 (--link · 默认)',
      stSwitchCopyBtn: '切换为独立复制模式 (--copy)',
      stResetBtn: '恢复默认 27 个正式技能',
      stBackupTitle: '工作区配置安全备份历史',
      stBackupRestoreBtn: '回滚此快照',
      stRestoredToast: '已恢复配置快照',
    },
    en: {
      loading: 'Loading…',
      refreshTip: 'Refresh state',
      syncBtn: 'Sync Upstream',
      syncingBtn: 'Syncing…',
      tabSkills: 'Skills',
      tabWorkflow: 'Workflow',
      tabWorkspace: 'Workspace Hub',
      tabSettings: 'Sync & Settings',
      bucketSectionTitle: 'Skill Bucket Toggles',
      bucketSectionSub: '{promoted} promoted skills enabled by default; {extra} experimental & utility skills optional',
      presetPromoted: 'Standard {n}',
      presetCore: 'Core Spine',
      presetAll: 'All {n}',
      deliverBtn: 'Deliver to Repo',
      skillsUnit: 'skills',
      detailSectionTitle: 'Skills Catalog & Instruction Preview',
      tabAll: 'All',
      tabEngineering: 'Engineering',
      tabProductivity: 'Productivity',
      tabExtra: 'Extended',
      searchPlaceholder: 'Search skill name, /command, trigger, or scenario tag…',
      triggerAndStatusLabel: 'Trigger & Status',
      invUser: 'User Command',
      invModel: 'Auto-Loaded',
      statusEnabled: 'Enabled',
      statusDisabled: 'Disabled',
      scenarioLabel: 'Scenarios (Multi)',
      clearFilters: 'Reset Filters',
      previewBtn: 'Preview',
      collapseBtn: 'Hide',
      badgeBeta: 'Beta',
      badgeMisc: 'Misc',
      badgeCollision: 'Built-in Name Note',
      emptyFilterTitle: 'No matching skills',
      emptyFilterDesc: 'Try clearing filters or changing your search query.',
      previewAdapted: 'Antigravity Native',
      previewUpstream: 'Upstream Original',
      previewDeps: 'Calls Skills',
      previewAgents: 'Leaf Subagents',
      previewAdaptations: 'Adaptations',
      copyPromptBtn: 'Copy Prompt',
      slashHideBtn: 'Hide from / menu',
      slashShowBtn: 'Show in / menu',
      deliverOneBtn: 'Deliver to Active Repo',
      copiedToast: 'Copied: {text}',
      toggledOnToast: 'Enabled {name}',
      toggledOffToast: 'Disabled {name}',
      autoEnabledToast: 'Auto-enabled dependencies: {deps}',
      dependentsWarnToast: 'Note: enabled skill(s) {deps} reference this skill',
      bucketOnToast: 'Enabled {name} ({n} skills)',
      bucketOffToast: 'Disabled {name}',
      presetAppliedToast: 'Applied preset ({n} skills enabled)',
      syncDoneToast: 'Synced upstream v{ver} ({n} skills)',
      deliverModalTitle: 'Deliver Skills to .agents/skills/',
      deliverModalSub: 'Share skills directly in a project repository (dependencies resolved automatically)',
      targetWorkspaceLabel: 'Target Workspace',
      deliverScopeLabel: 'Scope',
      deliverEnabledOpt: 'All currently enabled global skills',
      deliverCoreOpt: 'Core Spine (10 skills)',
      deliverSingleOpt: 'Single skill only',
      deliverModeLabel: 'Delivery Mode',
      deliverCopyOpt: 'Copy files (recommended for Git team sharing)',
      deliverLinkOpt: 'Symlink (follows local plugin updates)',
      deliverSingleNameLabel: 'Skill Name',
      cancelBtn: 'Cancel',
      confirmDeliverBtn: 'Deliver',
      deliveredToast: 'Delivered {n} skills to .agents/skills/',
      noWorkspaceErr: 'Please add a workspace path in Workspace Hub first',
      wfSpineTitle: 'Idea → Ship Spine',
      wfSpineSub: 'Click any stage to inspect guidance, phase-boundary advice, and copy starter prompt',
      wfOnRampsTitle: 'Entry On-Ramps',
      wfOnRampsSub: 'Enter from incoming issues, bugs, or oversized foggy projects',
      wfPhaseTitle: 'Phase Boundaries Cheat-Sheet',
      wfPhaseSub: 'When to continue, compact, start a new conversation, handoff, or spawn a subagent',
      wfPhaseAdvice: 'Phase Boundary Advice',
      wsLabel: 'Workspace:',
      wsNone: 'No workspace linked',
      wsPathPlaceholder: 'Enter project path, e.g. ~/Projects/my-app',
      wsAddBtn: 'Add',
      wsRemoveBtn: 'Remove',
      wsDeliveredTitle: 'Project .agents/skills/ Delivery',
      wsDeliveredSub: 'Overrides global skills inside this repository',
      wsDeliveredEmpty: 'No skills delivered to .agents/skills/ in this workspace yet.',
      wsSetupTitle: 'Visual Repo Setup (replaces multi-turn /setup-matt-pocock-skills)',
      wsSetupSub: 'Generate docs/agents/*.md and idempotently update steering files (auto-backed up)',
      wsTrackerLabel: 'Issue Tracker',
      wsLayoutLabel: 'Domain Doc Layout',
      wsRuleTargetLabel: 'Steering Rule Target',
      wsSyncGhLabel: 'Also create missing triage labels on GitHub via gh CLI',
      wsSaveSetupBtn: 'Save Repo Setup',
      wsSetupSavedToast: 'Repo setup saved (backup created)',
      wsBoardTitle: 'Tracer-Bullet Ticket Frontier (.scratch/*/issues/*.md)',
      wsBoardSub: 'Parses Blocked by edges to highlight the unblocked Ready Frontier',
      wsColReady: 'Ready Frontier',
      wsColBlocked: 'Blocked',
      wsColDone: 'Done',
      wsBoardEmpty: 'No .scratch/*/issues/*.md tickets found yet.',
      wsGlossaryTitle: 'Domain Glossary (GLOSSARY.md) & ADRs',
      wsGlossarySaveBtn: 'Save GLOSSARY.md',
      wsGlossarySavedToast: 'GLOSSARY.md saved',
      stUpstreamTitle: 'Upstream Sync (mattpocock/skills)',
      stInstallTitle: 'Plugin Install Mode & Global Dynamic Toggles',
      stInstallSub: 'Default symlink (--link) tracks this repo directly; standalone copy (--copy) supports untracked global dynamic skill toggling',
      stSwitchLinkBtn: 'Switch to Symlink (--link · Default)',
      stSwitchCopyBtn: 'Switch to Standalone Copy (--copy)',
      stResetBtn: 'Reset to Default 27 Promoted Skills',
      stBackupTitle: 'Workspace Config Backup Snapshots',
      stBackupRestoreBtn: 'Restore',
      stRestoredToast: 'Restored snapshot',
    },
  };

  let lang = localStorage.getItem('mp_studio_lang') === 'en' ? 'en' : 'zh';
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
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
    });
  }

  // Sync light/dark theme dynamically from Antigravity host CSS variables
  function syncTheme() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--background, #141517)';
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

  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('toast-root').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('copiedToast', { text: text.length > 42 ? `${text.slice(0, 42)}…` : text }), 'ok');
    } catch {
      toast('Clipboard unavailable', 'warn');
    }
  }

  const state = {
    data: null,
    activeTab: 'skills',      // skills | workflow | workspace | settings
    bucketTab: 'all',         // all | engineering | productivity | extra
    search: '',
    invocationFilter: '',     // '' | user | model
    enabledFilter: '',        // '' | enabled | disabled
    scenarioFilters: new Set(),
    expandedSkill: '',
    previewCache: new Map(),
    previewTab: 'adapted',    // adapted | upstream | <companion>
    selectedWorkflowId: 'grill',
    selectedWorkspace: '',
    backups: [],
    syncing: false,
  };

  async function refresh() {
    try {
      const payload = state.selectedWorkspace
        ? await api('/api/state/query', { workspace: state.selectedWorkspace })
        : await api('/api/state');
      state.data = payload;
      if (payload.activeWorkspace?.path) {
        state.selectedWorkspace = payload.activeWorkspace.path;
      } else if (payload.workspaces?.length && !state.selectedWorkspace) {
        state.selectedWorkspace = payload.workspaces[0].path;
      }
      renderHeader();
      renderMain();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  async function loadBackups() {
    try {
      const res = await api('/api/backups');
      state.backups = res.backups || [];
    } catch {
      state.backups = [];
    }
  }

  function renderHeader() {
    if (!state.data) return;
    const skills = state.data.skills || [];
    const enabledCount = skills.filter((s) => s.enabled).length;
    $('summary-pill').textContent = `${enabledCount} / ${skills.length} ${lang === 'en' ? 'enabled' : '已启用'}`;
    const mode = state.data.install?.installMode || 'not_installed';
    $('mode-pill').textContent = mode === 'symlink' ? '--link' : (mode === 'copy' ? '--copy' : 'local');
  }

  function renderMain() {
    if (!state.data) return;
    const root = $('main-content');
    if (state.activeTab === 'skills') {
      root.innerHTML = renderSkillsTab();
      bindSkillsEvents();
    } else if (state.activeTab === 'workflow') {
      root.innerHTML = renderWorkflowTab();
      bindWorkflowEvents();
    } else if (state.activeTab === 'workspace') {
      root.innerHTML = renderWorkspaceTab();
      bindWorkspaceEvents();
    } else {
      root.innerHTML = renderSettingsTab();
      bindSettingsEvents();
    }
  }

  function getScenarioLabel(id) {
    const sc = (state.data?.scenarios || []).find((x) => x.id === id);
    if (!sc) return id;
    return lang === 'en' ? sc.labelEn : sc.labelZh;
  }

  function filteredSkills({ ignoreScenario = false } = {}) {
    const all = state.data?.skills || [];
    const q = state.search.trim().toLowerCase();
    return all.filter((s) => {
      if (state.bucketTab === 'engineering' && s.bucket !== 'engineering') return false;
      if (state.bucketTab === 'productivity' && s.bucket !== 'productivity') return false;
      if (state.bucketTab === 'extra' && s.bucket !== 'in-progress' && s.bucket !== 'misc') return false;
      if (state.invocationFilter && s.invocation !== state.invocationFilter) return false;
      if (state.enabledFilter === 'enabled' && !s.enabled) return false;
      if (state.enabledFilter === 'disabled' && s.enabled) return false;
      if (!ignoreScenario && state.scenarioFilters.size > 0 && !state.scenarioFilters.has(s.scenario)) return false;
      if (q) {
        const hay = [
          s.name,
          `/${s.name}`,
          s.zhSummary,
          s.enSummary,
          s.description,
          getScenarioLabel(s.scenario),
          s.invocation === 'user' ? '用户命令 user' : '自动加载 model',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderSkillsTab() {
    const data = state.data;
    const all = data.skills || [];
    const promotedTotal = all.filter((s) => s.defaultEnabled).length;
    const extraTotal = all.length - promotedTotal;
    const engTotal = all.filter((s) => s.bucket === 'engineering').length;
    const prodTotal = all.filter((s) => s.bucket === 'productivity').length;
    const invUserCount = all.filter((s) => s.invocation === 'user').length;
    const invModelCount = all.filter((s) => s.invocation === 'model').length;
    const enCount = all.filter((s) => s.enabled).length;
    const disCount = all.length - enCount;

    const bucketsHtml = (data.buckets || []).map((b) => {
      const title = lang === 'en' ? b.titleEn : b.titleZh;
      const desc = lang === 'en' ? b.descEn : b.descZh;
      const allOn = b.enabledCount === b.totalCount && b.totalCount > 0;
      const partial = b.enabledCount > 0 && b.enabledCount < b.totalCount;
      const countText = partial
        ? `${b.enabledCount}/${b.totalCount} ${t('skillsUnit')}`
        : `${b.totalCount} ${t('skillsUnit')}`;
      return `
        <article class="bucket-card ${b.enabledCount > 0 ? 'bucket-active' : ''}">
          <div class="bucket-card-top">
            <div class="bucket-title-wrap">
              <span class="bucket-title">${esc(title)}</span>
              <span class="bucket-count-badge">${esc(countText)}</span>
            </div>
            <label class="switch" title="${esc(title)}">
              <input type="checkbox" class="bucket-switch" data-bucket="${esc(b.id)}" ${allOn || partial ? 'checked' : ''}>
              <span class="switch-track"></span>
            </label>
          </div>
          <p class="bucket-desc">${esc(desc)}</p>
        </article>
      `;
    }).join('');

    const scenarioCounts = new Map();
    for (const s of filteredSkills({ ignoreScenario: true })) {
      scenarioCounts.set(s.scenario, (scenarioCounts.get(s.scenario) || 0) + 1);
    }

    const scenariosHtml = (data.scenarios || []).map((sc) => {
      const cnt = scenarioCounts.get(sc.id) || 0;
      const active = state.scenarioFilters.has(sc.id);
      return `<button type="button" class="chip ${active ? 'active' : ''}" data-scenario="${esc(sc.id)}">${esc(lang === 'en' ? sc.labelEn : sc.labelZh)} (${cnt})</button>`;
    }).join('');

    const hasActiveFilters = Boolean(
      state.search || state.invocationFilter || state.enabledFilter || state.scenarioFilters.size > 0 || state.bucketTab !== 'all',
    );

    const visible = filteredSkills();
    const listHtml = visible.length === 0
      ? `<div class="empty-box"><strong>${esc(t('emptyFilterTitle'))}</strong><p>${esc(t('emptyFilterDesc'))}</p><button type="button" id="btn-reset-filters-empty" class="btn btn-secondary btn-sm">${esc(t('clearFilters'))}</button></div>`
      : visible.map((s) => renderSkillRow(s)).join('');

    return `
      <section>
        <div class="section-header">
          <div class="section-title-group">
            <h2 class="section-title">${esc(t('bucketSectionTitle'))}</h2>
            <span class="section-sub">${esc(t('bucketSectionSub', { promoted: promotedTotal, extra: extraTotal }))}</span>
          </div>
          <div class="preset-row">
            <button type="button" class="btn btn-secondary btn-xs" data-preset="promoted">${esc(t('presetPromoted', { n: promotedTotal }))}</button>
            <button type="button" class="btn btn-secondary btn-xs" data-preset="core">${esc(t('presetCore'))}</button>
            <button type="button" class="btn btn-secondary btn-xs" data-preset="all">${esc(t('presetAll', { n: all.length }))}</button>
            <button type="button" id="btn-open-deliver" class="btn btn-primary btn-xs">${esc(t('deliverBtn'))}</button>
          </div>
        </div>
        <div class="bucket-grid">${bucketsHtml}</div>
      </section>

      <section>
        <div class="section-header">
          <div class="section-title-group">
            <h2 class="section-title">${esc(t('detailSectionTitle'))}</h2>
          </div>
        </div>

        <div class="toolbar-row">
          <div class="segmented-tabs" role="tablist">
            <button type="button" class="seg-tab ${state.bucketTab === 'all' ? 'active' : ''}" data-btab="all">${esc(t('tabAll'))} (${all.length})</button>
            <button type="button" class="seg-tab ${state.bucketTab === 'engineering' ? 'active' : ''}" data-btab="engineering">${esc(t('tabEngineering'))} (${engTotal})</button>
            <button type="button" class="seg-tab ${state.bucketTab === 'productivity' ? 'active' : ''}" data-btab="productivity">${esc(t('tabProductivity'))} (${prodTotal})</button>
            <button type="button" class="seg-tab ${state.bucketTab === 'extra' ? 'active' : ''}" data-btab="extra">${esc(t('tabExtra'))} (${extraTotal})</button>
          </div>
          <label class="search-box">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input id="skill-search" type="search" value="${esc(state.search)}" placeholder="${esc(t('searchPlaceholder'))}" autocomplete="off">
            <kbd class="kbd-hint">/</kbd>
          </label>
        </div>

        <div class="facets-card">
          <div class="facet-row">
            <span class="facet-label">${esc(t('triggerAndStatusLabel'))}</span>
            <button type="button" class="chip ${state.invocationFilter === 'user' ? 'active' : ''}" data-inv="user">${esc(t('invUser'))} (${invUserCount})</button>
            <button type="button" class="chip ${state.invocationFilter === 'model' ? 'active' : ''}" data-inv="model">${esc(t('invModel'))} (${invModelCount})</button>
            <span class="facet-divider"></span>
            <button type="button" class="chip ${state.enabledFilter === 'enabled' ? 'active' : ''}" data-en="enabled">${esc(t('statusEnabled'))} (${enCount})</button>
            <button type="button" class="chip ${state.enabledFilter === 'disabled' ? 'active' : ''}" data-en="disabled">${esc(t('statusDisabled'))} (${disCount})</button>
            ${hasActiveFilters ? `<button type="button" id="btn-reset-filters" class="btn btn-ghost btn-xs" style="margin-left:auto">${esc(t('clearFilters'))}</button>` : ''}
          </div>
          <div class="facet-row">
            <span class="facet-label">${esc(t('scenarioLabel'))}</span>
            ${scenariosHtml}
          </div>
        </div>

        <div class="skills-list-card">${listHtml}</div>
      </section>
    `;
  }

  function renderSkillRow(s) {
    const isExpanded = state.expandedSkill === s.name;
    const displayName = s.invocation === 'user' ? `/${s.name}` : s.name;
    const invLabel = s.invocation === 'user' ? t('invUser') : t('invModel');
    const summary = lang === 'en' ? s.enSummary : s.zhSummary;
    const bucketBadge = s.bucket === 'in-progress'
      ? `<span class="badge">${esc(t('badgeBeta'))}</span>`
      : (s.bucket === 'misc' ? `<span class="badge">${esc(t('badgeMisc'))}</span>` : '');
    const collisionBadge = s.collisionNote
      ? `<span class="badge badge-warn" title="${esc(s.collisionNote)}">${esc(t('badgeCollision'))}</span>`
      : '';

    return `
      <div class="skill-item ${s.enabled ? '' : 'skill-disabled'} ${isExpanded ? 'expanded' : ''}" data-skill="${esc(s.name)}">
        <div class="skill-row">
          <div class="skill-main">
            <button type="button" class="skill-name-btn" data-copy-prompt="${esc(s.samplePrompt)}" title="${esc(s.samplePrompt)}">${esc(displayName)}</button>
            <span class="skill-badges">
              <span class="badge ${s.invocation === 'user' ? 'badge-user' : 'badge-model'}">${esc(invLabel)}</span>
              <span class="badge">${esc(getScenarioLabel(s.scenario))}</span>
              ${bucketBadge}
              ${collisionBadge}
            </span>
            <span class="skill-summary" title="${esc(summary)}">${esc(summary)}</span>
          </div>
          <div class="skill-actions">
            <button type="button" class="preview-btn" data-preview="${esc(s.name)}">${esc(isExpanded ? t('collapseBtn') : t('previewBtn'))} ${isExpanded ? '▴' : '▾'}</button>
            <label class="switch">
              <input type="checkbox" class="skill-switch" data-skill="${esc(s.name)}" ${s.enabled ? 'checked' : ''}>
              <span class="switch-track"></span>
            </label>
          </div>
        </div>
        ${isExpanded ? renderPreviewDrawer(s) : ''}
      </div>
    `;
  }

  function renderPreviewDrawer(s) {
    const cached = state.previewCache.get(s.name);
    if (!cached) {
      return `<div class="skill-preview-drawer"><span class="section-sub">${esc(t('loading'))}</span></div>`;
    }

    const tabs = [
      { id: 'adapted', label: t('previewAdapted'), content: cached.adaptedSkillMd },
      { id: 'upstream', label: t('previewUpstream'), content: cached.upstreamSkillMd },
      ...(cached.companionFiles || []).map((f) => ({ id: `file:${f.name}`, label: f.name, content: f.content })),
    ];
    const activeTabObj = tabs.find((x) => x.id === state.previewTab) || tabs[0];

    const depsTag = (s.dependsOnSkills || []).length
      ? `<span class="badge badge-user">${esc(t('previewDeps'))}: ${esc(s.dependsOnSkills.join(', '))}</span>`
      : '';
    const agentsTag = (s.usesAgents || []).length
      ? `<span class="badge badge-ok">${esc(t('previewAgents'))}: ${esc(s.usesAgents.join(', '))}</span>`
      : '';
    const adaptTag = (s.adaptations || []).length
      ? `<span class="badge">${esc(t('previewAdaptations'))}: ${esc(s.adaptations.join(', '))}</span>`
      : '';

    return `
      <div class="skill-preview-drawer">
        ${s.collisionNote ? `<div class="alert-banner"><span>${esc(s.collisionNote)}</span></div>` : ''}
        <div class="preview-meta-bar">
          <div class="preview-meta-tags">
            ${depsTag}
            ${agentsTag}
            ${adaptTag}
          </div>
          <div class="preview-actions">
            <button type="button" class="btn btn-secondary btn-xs" data-copy-prompt="${esc(s.samplePrompt)}">${esc(t('copyPromptBtn'))}</button>
            <button type="button" class="btn btn-secondary btn-xs" data-toggle-slash="${esc(s.name)}">${esc(s.disableSlashCommand ? t('slashShowBtn') : t('slashHideBtn'))}</button>
            <button type="button" class="btn btn-primary btn-xs" data-deliver-single="${esc(s.name)}">${esc(t('deliverOneBtn'))}</button>
          </div>
        </div>
        <div class="preview-file-tabs">
          ${tabs.map((tb) => `<button type="button" class="file-tab ${tb.id === activeTabObj.id ? 'active' : ''}" data-ftab="${esc(tb.id)}">${esc(tb.label)}</button>`).join('')}
        </div>
        <pre class="code-viewer">${esc(activeTabObj.content)}</pre>
      </div>
    `;
  }

  function renderWorkflowTab() {
    const wf = state.data.workflow;
    const nodes = wf.mainFlow || [];
    const selected = nodes.find((n) => n.id === state.selectedWorkflowId) || nodes[0];
    const selectedMeta = (state.data.skills || []).find((s) => s.name === selected?.skill);

    return `
      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('wfSpineTitle'))}</h3>
            <p>${esc(t('wfSpineSub'))}</p>
          </div>
        </div>
        <div class="spine-grid">
          ${nodes.map((n) => `
            <button type="button" class="spine-node ${n.id === selected?.id ? 'active' : ''}" data-wf-id="${esc(n.id)}">
              <span class="spine-node-title">${esc(lang === 'en' ? n.titleEn : n.titleZh)}</span>
              <span class="spine-node-skill">/${esc(n.skill)}</span>
              <span class="spine-node-desc">${esc(lang === 'en' ? n.descEn : n.descZh)}</span>
            </button>
          `).join('')}
        </div>
        ${selected ? `
          <div class="alert-banner" style="background: var(--elevated-bg); border-color: var(--card-border-col);">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <strong>${esc(lang === 'en' ? selected.titleEn : selected.titleZh)} · <code>/${esc(selected.skill)}</code></strong>
              <span class="section-sub"><strong>${esc(t('wfPhaseAdvice'))}：</strong>${esc(lang === 'en' ? selected.phaseTipEn : selected.phaseTipZh)}</span>
            </div>
            <button type="button" class="btn btn-primary btn-xs" data-copy-prompt="${esc(selectedMeta?.samplePrompt || `/${selected.skill}`)}">${esc(t('copyPromptBtn'))}</button>
          </div>
        ` : ''}
      </section>

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('wfOnRampsTitle'))}</h3>
            <p>${esc(t('wfOnRampsSub'))}</p>
          </div>
        </div>
        <div class="spine-grid">
          ${(wf.onRamps || []).map((r) => {
            const meta = (state.data.skills || []).find((s) => s.name === r.skill);
            return `
              <div class="spine-node">
                <span class="spine-node-title">${esc(lang === 'en' ? r.titleEn : r.titleZh)}</span>
                <span class="spine-node-skill">${meta?.invocation === 'user' ? `/${r.skill}` : r.skill}</span>
                <span class="spine-node-desc">${esc(lang === 'en' ? r.descEn : r.descZh)}</span>
                <div style="margin-top:6px;">
                  <button type="button" class="btn btn-secondary btn-xs" data-copy-prompt="${esc(meta?.samplePrompt || r.skill)}">${esc(t('copyPromptBtn'))}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('wfPhaseTitle'))}</h3>
            <p>${esc(t('wfPhaseSub'))}</p>
          </div>
        </div>
        <div class="skills-list-card">
          ${(wf.phaseBoundaries || []).map((pb) => `
            <div class="skill-item">
              <div class="skill-row">
                <strong class="mono" style="min-width:210px;">${esc(pb.action)}</strong>
                <span class="skill-summary" style="white-space:normal;">${esc(lang === 'en' ? pb.whenEn : pb.whenZh)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderWorkspaceTab() {
    const wsList = state.data.workspaces || [];
    const active = state.data.activeWorkspace;

    const wsSelectorHtml = `
      <div class="ws-bar">
        <div class="ws-select-group">
          <span class="field-label">${esc(t('wsLabel'))}</span>
          <select id="ws-select" class="select" style="max-width:340px;">
            ${wsList.length === 0 ? `<option value="">${esc(t('wsNone'))}</option>` : ''}
            ${wsList.map((w) => `<option value="${esc(w.path)}" ${w.path === active?.path ? 'selected' : ''}>${esc(w.name)} (${esc(w.path)})</option>`).join('')}
          </select>
          ${active && !wsList.find((w) => w.path === active.path && w.isHostDetected) ? `<button type="button" id="btn-ws-remove" class="btn btn-ghost btn-xs">${esc(t('wsRemoveBtn'))}</button>` : ''}
        </div>
        <div class="ws-add-group">
          <input id="ws-add-input" type="text" class="input" placeholder="${esc(t('wsPathPlaceholder'))}">
          <button type="button" id="btn-ws-add" class="btn btn-secondary btn-sm">${esc(t('wsAddBtn'))}</button>
        </div>
      </div>
    `;

    if (!active || !active.exists) {
      return `
        ${wsSelectorHtml}
        <div class="panel-card"><div class="empty-box"><p>${esc(t('noWorkspaceErr'))}</p></div></div>
      `;
    }

    const setup = active.setup;
    const board = active.board || { tickets: [] };
    const readyTickets = board.tickets.filter((tk) => tk.state === 'ready');
    const blockedTickets = board.tickets.filter((tk) => tk.state === 'blocked');
    const doneTickets = board.tickets.filter((tk) => tk.state === 'done');

    const renderTicketCard = (tk) => `
      <div class="ticket-card">
        <div class="ticket-title">${esc(tk.title)}</div>
        <div class="ticket-meta">
          <span class="mono">${esc(tk.relPath)}</span>
          ${tk.unresolvedBlockers?.length ? `<span class="badge badge-warn">Blocked by: ${esc(tk.unresolvedBlockers.join(','))}</span>` : ''}
        </div>
        ${tk.state === 'ready' ? `<button type="button" class="btn btn-primary btn-xs" data-copy-prompt="/implement ${esc(tk.relPath)}">/implement</button>` : ''}
      </div>
    `;

    return `
      ${wsSelectorHtml}

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('wsDeliveredTitle'))}</h3>
            <p>${esc(t('wsDeliveredSub'))}</p>
          </div>
          <button type="button" id="btn-ws-deliver-open" class="btn btn-primary btn-sm">${esc(t('deliverBtn'))}</button>
        </div>
        ${active.deliveredSkills.length === 0
          ? `<span class="section-sub">${esc(t('wsDeliveredEmpty'))}</span>`
          : `<div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${active.deliveredSkills.map((ds) => `
                <span class="chip">
                  <span class="mono">${esc(ds.name)}</span>
                  <span class="badge">${esc(ds.mode)}</span>
                  <button type="button" class="btn btn-ghost btn-xs" style="padding:0 4px;border:none;" data-ws-rm-skill="${esc(ds.name)}" title="Remove">✕</button>
                </span>
              `).join('')}
            </div>`
        }
      </section>

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('wsSetupTitle'))}</h3>
            <p>${esc(t('wsSetupSub'))}</p>
          </div>
          <span class="badge ${setup.configured ? 'badge-ok' : 'badge-warn'}">${setup.configured ? 'Configured' : 'Not Configured'}</span>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field-label">${esc(t('wsTrackerLabel'))}</span>
            <select id="setup-tracker" class="select">
              <option value="github" ${setup.trackerType === 'github' ? 'selected' : ''}>GitHub (gh CLI)</option>
              <option value="gitlab" ${setup.trackerType === 'gitlab' ? 'selected' : ''}>GitLab (glab CLI)</option>
              <option value="local" ${setup.trackerType === 'local' ? 'selected' : ''}>Local Markdown (.scratch/)</option>
              <option value="custom" ${setup.trackerType === 'custom' ? 'selected' : ''}>Custom (Linear / Jira / Prose)</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">${esc(t('wsRuleTargetLabel'))}</span>
            <select id="setup-rule-target" class="select">
              <option value="AGENTS.md" ${active.steering.recommendedRuleTarget === 'AGENTS.md' ? 'selected' : ''}>AGENTS.md (Repo Root)</option>
              <option value=".agents/rules/mattpocock-skills.md" ${active.steering.recommendedRuleTarget !== 'AGENTS.md' ? 'selected' : ''}>.agents/rules/mattpocock-skills.md (Native Rule)</option>
              <option value="GEMINI.md">GEMINI.md</option>
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field-label">${esc(t('wsLayoutLabel'))}</span>
            <select id="setup-layout" class="select">
              <option value="single-context" ${setup.domainLayout === 'single-context' ? 'selected' : ''}>single-context (GLOSSARY.md + docs/adr/)</option>
              <option value="multi-context" ${setup.domainLayout === 'multi-context' ? 'selected' : ''}>multi-context (Monorepo GLOSSARY-MAP.md)</option>
            </select>
          </label>
          <div class="field" style="justify-content:flex-end;">
            <label class="check-row">
              <input id="setup-sync-gh" type="checkbox">
              <span>${esc(t('wsSyncGhLabel'))}</span>
            </label>
          </div>
        </div>
        <div id="setup-custom-wrap" class="field ${setup.trackerType === 'custom' ? '' : 'hidden'}">
          <span class="field-label">Custom Issue Tracker Workflow Prose</span>
          <textarea id="setup-custom-prose" class="textarea" placeholder="Describe how issues and blocking edges are read/written..."></textarea>
        </div>
        <div class="field">
          <span class="field-label">5 Canonical Triage Labels Mapping</span>
          <div class="field-row-5">
            ${Object.entries(setup.labels).map(([role, val]) => `
              <label class="field">
                <span class="section-sub mono">${esc(role)}</span>
                <input type="text" class="input mono setup-label-input" data-role="${esc(role)}" value="${esc(val)}">
              </label>
            `).join('')}
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" id="btn-save-setup" class="btn btn-primary btn-sm">${esc(t('wsSaveSetupBtn'))}</button>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('wsBoardTitle'))}</h3>
            <p>${esc(t('wsBoardSub'))}</p>
          </div>
        </div>
        ${board.tickets.length === 0
          ? `<span class="section-sub">${esc(t('wsBoardEmpty'))}</span>`
          : `<div class="kanban-grid">
              <div class="kanban-col">
                <div class="kanban-col-head"><span>🟢 ${esc(t('wsColReady'))}</span><span class="badge badge-ok">${readyTickets.length}</span></div>
                ${readyTickets.map(renderTicketCard).join('') || '<span class="section-sub">-</span>'}
              </div>
              <div class="kanban-col">
                <div class="kanban-col-head"><span>🟡 ${esc(t('wsColBlocked'))}</span><span class="badge badge-warn">${blockedTickets.length}</span></div>
                ${blockedTickets.map(renderTicketCard).join('') || '<span class="section-sub">-</span>'}
              </div>
              <div class="kanban-col">
                <div class="kanban-col-head"><span>✅ ${esc(t('wsColDone'))}</span><span class="badge">${doneTickets.length}</span></div>
                ${doneTickets.map(renderTicketCard).join('') || '<span class="section-sub">-</span>'}
              </div>
            </div>`
        }
      </section>

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('wsGlossaryTitle'))}</h3>
            <p>ADRs: ${active.adrs.length} · HTML Reports: ${active.reports.length}</p>
          </div>
          <button type="button" id="btn-save-glossary" class="btn btn-secondary btn-sm">${esc(t('wsGlossarySaveBtn'))}</button>
        </div>
        <textarea id="ws-glossary-editor" class="textarea mono" placeholder="# Glossary\n\nDefine ubiquitous domain terms here...">${esc(active.glossary.content)}</textarea>
        ${active.adrs.length ? `
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${active.adrs.map((a) => `<span class="badge mono" title="${esc(a.path)}">${esc(a.title)}</span>`).join('')}
          </div>
        ` : ''}
      </section>
    `;
  }

  function renderSettingsTab() {
    const up = state.data.upstream || {};
    const inst = state.data.install || {};
    const mode = inst.installMode || 'not_installed';

    return `
      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('stUpstreamTitle'))}</h3>
            <p>Repo: <code>${esc(up.repo || 'mattpocock/skills')}</code> · Version: <code>v${esc(up.version)}</code> · Commit: <code>${esc((up.commit || '').slice(0, 7))}</code></p>
          </div>
          <button type="button" id="btn-settings-sync" class="btn btn-primary btn-sm" ${state.syncing ? 'disabled' : ''}>${esc(state.syncing ? t('syncingBtn') : t('syncBtn'))}</button>
        </div>
        <span class="section-sub">Last synced: ${esc(up.syncedAt || '-')}</span>
      </section>

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('stInstallTitle'))}</h3>
            <p>${esc(t('stInstallSub'))}</p>
          </div>
          <span class="mode-pill">${esc(mode)}</span>
        </div>
        <div class="section-sub mono">Target: ${esc(inst.target)}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" id="btn-mode-link" class="btn ${mode === 'symlink' ? 'btn-primary' : 'btn-secondary'} btn-sm">${esc(t('stSwitchLinkBtn'))}</button>
          <button type="button" id="btn-mode-copy" class="btn ${mode === 'copy' ? 'btn-primary' : 'btn-secondary'} btn-sm">${esc(t('stSwitchCopyBtn'))}</button>
          <button type="button" id="btn-reset-promoted" class="btn btn-ghost btn-sm">${esc(t('stResetBtn'))}</button>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-card-head">
          <div>
            <h3>${esc(t('stBackupTitle'))}</h3>
          </div>
        </div>
        ${state.backups.length === 0
          ? '<span class="section-sub">暂无备份记录 / No backups yet.</span>'
          : `<div class="skills-list-card">
              ${state.backups.map((bk) => `
                <div class="skill-item">
                  <div class="skill-row">
                    <div class="skill-main">
                      <span class="mono">${esc(bk.createdAt)}</span>
                      <span class="section-sub">${esc(bk.workspacePath)} (${bk.fileCount} files)</span>
                    </div>
                    <button type="button" class="btn btn-secondary btn-xs" data-restore-bk="${esc(bk.id)}">${esc(t('stBackupRestoreBtn'))}</button>
                  </div>
                </div>
              `).join('')}
            </div>`
        }
      </section>
    `;
  }

  // Event Binding
  function bindSkillsEvents() {
    $('skill-search')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      renderMain();
      const input = $('skill-search');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });

    document.querySelectorAll('[data-btab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.bucketTab = btn.dataset.btab;
        renderMain();
      });
    });

    document.querySelectorAll('[data-inv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.inv;
        state.invocationFilter = state.invocationFilter === val ? '' : val;
        renderMain();
      });
    });

    document.querySelectorAll('[data-en]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.en;
        state.enabledFilter = state.enabledFilter === val ? '' : val;
        renderMain();
      });
    });

    document.querySelectorAll('[data-scenario]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.scenario;
        if (state.scenarioFilters.has(id)) state.scenarioFilters.delete(id);
        else state.scenarioFilters.add(id);
        renderMain();
      });
    });

    const resetFilters = () => {
      state.bucketTab = 'all';
      state.search = '';
      state.invocationFilter = '';
      state.enabledFilter = '';
      state.scenarioFilters.clear();
      renderMain();
    };
    $('btn-reset-filters')?.addEventListener('click', resetFilters);
    $('btn-reset-filters-empty')?.addEventListener('click', resetFilters);

    document.querySelectorAll('.bucket-switch').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const bucket = chk.dataset.bucket;
        const enabled = chk.checked;
        try {
          const res = await api('/api/bucket/toggle', { bucket, enabled });
          const bObj = state.data.buckets.find((x) => x.id === bucket);
          const bTitle = lang === 'en' ? bObj?.titleEn : bObj?.titleZh;
          toast(enabled ? t('bucketOnToast', { name: bTitle || bucket, n: res.count }) : t('bucketOffToast', { name: bTitle || bucket }));
          await refresh();
        } catch (err) {
          toast(err.message, 'err');
          await refresh();
        }
      });
    });

    document.querySelectorAll('.skill-switch').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const name = chk.dataset.skill;
        const enabled = chk.checked;
        try {
          const res = await api('/api/skill/toggle', { name, enabled });
          toast(enabled ? t('toggledOnToast', { name }) : t('toggledOffToast', { name }));
          if (res.autoEnabled?.length) {
            toast(t('autoEnabledToast', { deps: res.autoEnabled.join(', ') }), 'ok');
          }
          if (res.dependentsWarning?.length) {
            toast(t('dependentsWarnToast', { deps: res.dependentsWarning.join(', ') }), 'warn');
          }
          await refresh();
        } catch (err) {
          toast(err.message, 'err');
          await refresh();
        }
      });
    });

    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await api('/api/preset/apply', { preset: btn.dataset.preset });
          toast(t('presetAppliedToast', { n: res.enabledCount }));
          await refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    });

    document.querySelectorAll('[data-preview]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.preview;
        if (state.expandedSkill === name) {
          state.expandedSkill = '';
          renderMain();
          return;
        }
        state.expandedSkill = name;
        state.previewTab = 'adapted';
        renderMain();
        if (!state.previewCache.has(name)) {
          try {
            const res = await api('/api/skill/preview', { name });
            state.previewCache.set(name, res);
            renderMain();
          } catch (err) {
            toast(err.message, 'err');
          }
        }
      });
    });

    document.querySelectorAll('[data-ftab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.previewTab = btn.dataset.ftab;
        renderMain();
      });
    });

    document.querySelectorAll('[data-toggle-slash]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.toggleSlash;
        const s = state.data.skills.find((x) => x.name === name);
        if (!s) return;
        try {
          await api('/api/skill/toggle', { name, enabled: s.enabled, disableSlashCommand: !s.disableSlashCommand });
          await refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    });

    document.querySelectorAll('[data-deliver-single]').forEach((btn) => {
      btn.addEventListener('click', () => openDeliverModal(btn.dataset.deliverSingle));
    });

    $('btn-open-deliver')?.addEventListener('click', () => openDeliverModal(''));

    bindCopyPromptButtons();
  }

  function bindWorkflowEvents() {
    document.querySelectorAll('[data-wf-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedWorkflowId = btn.dataset.wfId;
        renderMain();
      });
    });
    bindCopyPromptButtons();
  }

  function bindWorkspaceEvents() {
    $('ws-select')?.addEventListener('change', async (e) => {
      state.selectedWorkspace = e.target.value;
      await refresh();
    });

    $('btn-ws-add')?.addEventListener('click', async () => {
      const p = $('ws-add-input')?.value?.trim();
      if (!p) return;
      try {
        const res = await api('/api/workspaces/add', { path: p });
        state.selectedWorkspace = res.path;
        await refresh();
      } catch (err) {
        toast(err.message, 'err');
      }
    });

    $('btn-ws-remove')?.addEventListener('click', async () => {
      if (!state.selectedWorkspace) return;
      try {
        await api('/api/workspaces/remove', { path: state.selectedWorkspace });
        state.selectedWorkspace = '';
        await refresh();
      } catch (err) {
        toast(err.message, 'err');
      }
    });

    $('btn-ws-deliver-open')?.addEventListener('click', () => openDeliverModal(''));

    document.querySelectorAll('[data-ws-rm-skill]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api('/api/workspace/skill/remove', {
            workspacePath: state.selectedWorkspace,
            skillName: btn.dataset.wsRmSkill,
          });
          await refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    });

    $('setup-tracker')?.addEventListener('change', (e) => {
      $('setup-custom-wrap')?.classList.toggle('hidden', e.target.value !== 'custom');
    });

    $('btn-save-setup')?.addEventListener('click', async () => {
      const labels = {};
      document.querySelectorAll('.setup-label-input').forEach((inp) => {
        labels[inp.dataset.role] = inp.value.trim();
      });
      try {
        await api('/api/workspace/setup', {
          workspacePath: state.selectedWorkspace,
          trackerType: $('setup-tracker').value,
          customTrackerProse: $('setup-custom-prose')?.value || '',
          labels,
          domainLayout: $('setup-layout').value,
          targetRuleFile: $('setup-rule-target').value,
          syncGithubLabels: Boolean($('setup-sync-gh')?.checked),
        });
        toast(t('wsSetupSavedToast'));
        await refresh();
      } catch (err) {
        toast(err.message, 'err');
      }
    });

    $('btn-save-glossary')?.addEventListener('click', async () => {
      try {
        await api('/api/workspace/glossary', {
          workspacePath: state.selectedWorkspace,
          content: $('ws-glossary-editor').value,
        });
        toast(t('wsGlossarySavedToast'));
        await refresh();
      } catch (err) {
        toast(err.message, 'err');
      }
    });

    bindCopyPromptButtons();
  }

  function bindSettingsEvents() {
    $('btn-settings-sync')?.addEventListener('click', runSync);
    $('btn-mode-link')?.addEventListener('click', async () => {
      try {
        await api('/api/install/mode', { mode: 'link' });
        await refresh();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
    $('btn-mode-copy')?.addEventListener('click', async () => {
      try {
        await api('/api/install/mode', { mode: 'copy' });
        await refresh();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
    $('btn-reset-promoted')?.addEventListener('click', async () => {
      try {
        const res = await api('/api/preset/apply', { preset: 'promoted' });
        toast(t('presetAppliedToast', { n: res.enabledCount }));
        await refresh();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
    document.querySelectorAll('[data-restore-bk]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api('/api/backups/restore', { id: btn.dataset.restoreBk });
          toast(t('stRestoredToast'));
          await refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    });
  }

  function bindCopyPromptButtons() {
    document.querySelectorAll('[data-copy-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => copyText(btn.dataset.copyPrompt));
    });
  }

  function openDeliverModal(singleSkill = '') {
    const wsList = state.data?.workspaces || [];
    if (wsList.length === 0) {
      toast(t('noWorkspaceErr'), 'warn');
      state.activeTab = 'workspace';
      document.querySelectorAll('.primary-tab').forEach((tb) => {
        tb.classList.toggle('active', tb.dataset.tab === 'workspace');
      });
      renderMain();
      return;
    }

    const wsSel = $('deliver-ws-select');
    wsSel.innerHTML = wsList
      .map((w) => `<option value="${esc(w.path)}" ${w.path === state.selectedWorkspace ? 'selected' : ''}>${esc(w.name)} (${esc(w.path)})</option>`)
      .join('');

    if (singleSkill) {
      $('deliver-scope-select').value = 'single';
      $('deliver-single-name').value = singleSkill;
      $('deliver-single-wrap').classList.remove('hidden');
    } else {
      $('deliver-scope-select').value = 'enabled';
      $('deliver-single-wrap').classList.add('hidden');
    }
    $('modal-deliver').classList.remove('hidden');
  }

  async function runSync() {
    if (state.syncing) return;
    state.syncing = true;
    const btn = $('btn-quick-sync');
    if (btn) btn.disabled = true;
    try {
      const res = await api('/api/upstream/sync', {});
      state.previewCache.clear();
      toast(t('syncDoneToast', { ver: res.upstream?.version || '', n: res.totalSkills }));
      await refresh();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      state.syncing = false;
      if (btn) btn.disabled = false;
    }
  }

  // Global static event listeners
  $('btn-lang').addEventListener('click', () => {
    lang = lang === 'en' ? 'zh' : 'en';
    localStorage.setItem('mp_studio_lang', lang);
    applyStaticI18n();
    renderHeader();
    renderMain();
  });

  $('btn-refresh').addEventListener('click', refresh);
  $('btn-quick-sync').addEventListener('click', runSync);

  document.querySelectorAll('.primary-tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.activeTab = btn.dataset.tab;
      document.querySelectorAll('.primary-tab').forEach((b) => {
        const isAct = b === btn;
        b.classList.toggle('active', isAct);
        b.setAttribute('aria-selected', isAct ? 'true' : 'false');
      });
      if (state.activeTab === 'settings') {
        await loadBackups();
      }
      renderMain();
    });
  });

  $('deliver-scope-select').addEventListener('change', (e) => {
    $('deliver-single-wrap').classList.toggle('hidden', e.target.value !== 'single');
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $(btn.dataset.close)?.classList.add('hidden');
    });
  });

  $('btn-deliver-confirm').addEventListener('click', async () => {
    const workspacePath = $('deliver-ws-select').value;
    const scope = $('deliver-scope-select').value;
    const mode = $('deliver-mode-select').value;
    let skillNames = [];
    if (scope === 'single') {
      skillNames = [$('deliver-single-name').value];
    } else if (scope === 'core') {
      skillNames = state.data?.presets?.core?.skills || [];
    }
    try {
      const res = await api('/api/workspace/deliver', { workspacePath, skillNames, mode });
      $('modal-deliver').classList.add('hidden');
      toast(t('deliveredToast', { n: res.delivered?.length || 0 }));
      await refresh();
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      if (state.activeTab === 'skills') {
        e.preventDefault();
        $('skill-search')?.focus();
      }
    } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      if (state.activeTab === 'skills') {
        e.preventDefault();
        $('skill-search')?.focus();
      }
    } else if (e.key === 'Escape') {
      $('modal-deliver').classList.add('hidden');
    }
  });

  applyStaticI18n();
  refresh();
})();
