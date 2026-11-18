(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const STR = {
    zh: {
      convLabel: '会话:',
      autoPick: '自动探测最近会话…',
      autoOn: '自动 10s',
      autoOff: '已暂停',
      tabSession: '会话',
      tabQuota: '配额',
      tabTokens: 'Token',
      tabDiag: '诊断',
      modeAuxPill: 'Aux Pane 原生模式 (2.33+ 免 CDP)',
      modeCdpPill: 'CDP 顶栏模式已连接',
      modeWaitPill: '等待连接 Antigravity',
      compatDescNoCdp: 'Antigravity 2.33+ 默认关闭 DevToolsActivePort，顶栏悬浮条依赖 CDP；当前面板已直连宿主 Language Server 读取实时上下文、配额与 Token 统计。',
      compatSummary: '可选：如何恢复顶部标题栏悬浮条',
      compatOptLaunch: '方案 1（免改盘推荐）：退出后带调试端口优雅重启',
      compatOptInstall: '方案 2（写入 app.asar）：持久化安装，无需调试端口',
      hotInjectBtn: '立即热注入顶栏',
      hotInjected: '已触发顶栏热注入',
      copied: '已复制命令到剪贴板',
      copyFail: '复制失败，请手动选中命令复制',
      copyBtn: '复制',
      noSession: '暂无活跃会话统计（请先发起对话或确认 Antigravity 已启动）',
      ctxTitle: '当前上下文窗口',
      exceeded: '超出上限',
      modelUnknown: '未检测到模型',
      speedTitle: '实时响应与用量',
      ttft: '首字延迟 (TTFT)',
      tps: '生成速度',
      duration: '耗时',
      steps: '步骤数',
      inputCacheOut: '输入 / 缓存 / 输出',
      attachments: '附件与外部上下文',
      breakdownTitle: '会话构成明细',
      grpUser: '用户消息',
      grpAssistant: '助手回复',
      grpThinking: '思考过程',
      grpTools: '工具调用/返回',
      grpSummaries: '历史摘要',
      grpSystem: '系统提示',
      grpDefinitions: '工具定义',
      grpAttachments: '附件扫描',
      quotaTitle: '账户与共享额度池',
      noQuota: '暂未获取到额度信息（请等待宿主登录态就绪后点击刷新）',
      resetIn: '距离重置',
      exhausted: '已耗尽',
      tokensTitle: '历史 Token 汇总',
      today: '今日用量',
      month: '本月用量',
      total: '累计总计',
      estCost: '参考 API 估算 (本月 / 累计)',
      convSteps: '对话数 / 步数 / 活跃天数',
      firstUse: '首次记录日期',
      noTokens: '暂无历史统计数据',
      diagTitle: '运行环境诊断',
      originLabel: 'Language Server Origin',
      cdpLabel: 'CDP 调试端口',
      topbarLabel: '顶栏注入状态',
      unlockLabel: '上下文长度解锁 (Gate 3A/3B)',
      sidecarLabel: 'Sidecar 插件脚本',
      settingsTitle: '面板与注入设置',
      optChinese: 'CDP 热注入时启用桌面端中文汉化',
      optCli: '顶栏面板显示 CLI 快捷入口',
      saveOk: '设置已保存',
      logTitle: 'Sidecar 最近日志'
    },
    en: {
      convLabel: 'Session:',
      autoPick: 'Auto-detect latest conversation…',
      autoOn: 'Auto 10s',
      autoOff: 'Paused',
      tabSession: 'Session',
      tabQuota: 'Quota',
      tabTokens: 'Tokens',
      tabDiag: 'Diagnostics',
      modeAuxPill: 'Aux Pane Native Mode (2.33+ No CDP)',
      modeCdpPill: 'CDP Topbar Connected',
      modeWaitPill: 'Waiting for Antigravity',
      compatDescNoCdp: 'Antigravity 2.33+ disables DevToolsActivePort by default, which topbar overlay injection relies on. This Aux Pane UI connects directly to the host Language Server for live metrics.',
      compatSummary: 'Optional: Restore topbar overlay mode',
      compatOptLaunch: 'Option 1 (No ASAR patch): Graceful restart with CDP flag',
      compatOptInstall: 'Option 2 (Patch app.asar): Persistent install without CDP',
      hotInjectBtn: 'Hot-Inject Topbar',
      hotInjected: 'Triggered topbar hot-injection',
      copied: 'Copied command to clipboard',
      copyFail: 'Copy failed; please copy manually',
      copyBtn: 'Copy',
      noSession: 'No active session stats yet (start a conversation or verify Antigravity is running).',
      ctxTitle: 'Context Window',
      exceeded: 'Exceeded',
      modelUnknown: 'Unknown Model',
      speedTitle: 'Speed & Token Breakdown',
      ttft: 'TTFT',
      tps: 'Throughput',
      duration: 'Duration',
      steps: 'Steps',
      inputCacheOut: 'Input / Cache / Output',
      attachments: 'Attachments',
      breakdownTitle: 'Session Composition',
      grpUser: 'User',
      grpAssistant: 'Assistant',
      grpThinking: 'Thinking',
      grpTools: 'Tools',
      grpSummaries: 'Summaries',
      grpSystem: 'System',
      grpDefinitions: 'Definitions',
      grpAttachments: 'Attachments',
      quotaTitle: 'Plan & Shared Quota Pools',
      noQuota: 'Quota snapshot unavailable yet.',
      resetIn: 'Resets in',
      exhausted: 'Exhausted',
      tokensTitle: 'Token History Summary',
      today: 'Today',
      month: 'This Month',
      total: 'All Time',
      estCost: 'Estimated API Cost (Month / Total)',
      convSteps: 'Sessions / Steps / Active Days',
      firstUse: 'First Recorded Date',
      noTokens: 'No token history available yet',
      diagTitle: 'Runtime Diagnostics',
      originLabel: 'Language Server Origin',
      cdpLabel: 'CDP Debug Port',
      topbarLabel: 'Topbar Injection',
      unlockLabel: 'Context Unlock (Gate 3A/3B)',
      sidecarLabel: 'Sidecar Script',
      settingsTitle: 'Preferences',
      optChinese: 'Enable Chinese UI translation on CDP hot-inject',
      optCli: 'Show CLI quick button on topbar widget',
      saveOk: 'Settings saved',
      logTitle: 'Recent Sidecar Logs'
    }
  };

  const state = {
    lang: 'zh',
    tab: 'session',
    autoRefresh: true,
    timerId: null,
    loading: false,
    manualConvId: null,
    data: null
  };

  function t(key) {
    return (STR[state.lang] && STR[state.lang][key]) || STR.zh[key] || key;
  }

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

  function fmtNum(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '--';
    return Math.round(v).toLocaleString('en-US');
  }

  function fmtTokensCompact(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '--';
    if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  }

  function fmtUsd(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '--';
    return `$${n.toFixed(n >= 10 ? 2 : 3)}`;
  }

  function fmtResetCountdown(iso) {
    if (!iso) return '--';
    const ms = new Date(iso).getTime() - Date.now();
    if (!Number.isFinite(ms)) return '--';
    if (ms <= 0) return state.lang === 'zh' ? '即将重置' : 'Soon';
    const mins = Math.floor(ms / 60000);
    const days = Math.floor(mins / 1440);
    const hrs = Math.floor((mins % 1440) / 60);
    const remM = mins % 60;
    if (days > 0) return `${days}d ${hrs}h`;
    if (hrs > 0) return `${hrs}h ${remM}m`;
    return `${remM}m`;
  }

  function toast(msg, type = 'ok') {
    const root = $('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  async function api(url, body = {}) {
    const fetcher = window.sidecar?.fetch ? window.sidecar.fetch.bind(window.sidecar) : fetch;
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  }

  async function copyCommand(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast(t('copied'), 'ok');
        return;
      }
      throw new Error('clipboard unavailable');
    } catch {
      toast(t('copyFail'), 'error');
    }
  }

  function applyStaticLabels() {
    $('lbl-conv').textContent = t('convLabel');
    $('tab-session').textContent = t('tabSession');
    $('tab-quota').textContent = t('tabQuota');
    $('tab-tokens').textContent = t('tabTokens');
    $('tab-diagnostics').textContent = t('tabDiag');
    $('btn-lang').textContent = state.lang === 'zh' ? 'EN' : '中文';
    $('btn-auto').textContent = state.autoRefresh ? t('autoOn') : t('autoOff');
    $('btn-auto').classList.toggle('active', state.autoRefresh);
  }

  function renderCompatBanner() {
    const box = $('compat-banner');
    const meta = state.data?.meta || {};
    if (meta.cdpEnabled) {
      box.innerHTML = `
        <div class="compat-head">
          <span class="pill pill-ok">${esc(t('modeCdpPill'))} · ${esc(meta.cdpPort || '')}</span>
          <button type="button" id="btn-hot-inject" class="btn btn-secondary btn-xs">${esc(t('hotInjectBtn'))}</button>
        </div>
      `;
      $('btn-hot-inject')?.addEventListener('click', async () => {
        try {
          await api('/api/hot-inject', {});
          toast(t('hotInjected'), 'ok');
          await refresh(false);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      return;
    }

    const launchCmd = 'node plugins/antigravity-context-viewer/cli.js launch --restart';
    const installCmd = 'node plugins/antigravity-context-viewer/cli.js install';
    const pillClass = meta.antigravityRunning ? 'pill-accent' : 'pill-warn';
    const pillText = meta.antigravityRunning ? t('modeAuxPill') : t('modeWaitPill');

    box.innerHTML = `
      <div class="compat-head">
        <span class="pill ${pillClass}">${esc(pillText)}</span>
        <span class="pill pill-muted">${esc(meta.origin || 'Main Log / LS')}</span>
      </div>
      <details class="compat-details">
        <summary>${esc(t('compatSummary'))}</summary>
        <div style="margin-top:5px">${esc(t('compatDescNoCdp'))}</div>
        <div style="margin-top:6px">${esc(t('compatOptLaunch'))}</div>
        <div class="cmd-row">
          <code title="${esc(launchCmd)}">${esc(launchCmd)}</code>
          <button type="button" class="btn btn-secondary btn-xs copy-cmd" data-cmd="${esc(launchCmd)}">${esc(t('copyBtn'))}</button>
        </div>
        <div style="margin-top:6px">${esc(t('compatOptInstall'))}</div>
        <div class="cmd-row">
          <code title="${esc(installCmd)}">${esc(installCmd)}</code>
          <button type="button" class="btn btn-secondary btn-xs copy-cmd" data-cmd="${esc(installCmd)}">${esc(t('copyBtn'))}</button>
        </div>
      </details>
    `;
    box.querySelectorAll('.copy-cmd').forEach((btn) => {
      btn.addEventListener('click', () => copyCommand(btn.getAttribute('data-cmd') || ''));
    });
  }

  function renderConversationSelect() {
    const sel = $('conv-select');
    const convs = state.data?.conversations || [];
    const selected = state.manualConvId || state.data?.selectedConversationId || '';
    const opts = [`<option value="">${esc(t('autoPick'))}</option>`];
    for (const c of convs) {
      const shortId = String(c.id || '').slice(0, 8);
      const label = c.title ? `${c.title.slice(0, 32)} (${shortId})` : c.id;
      const isSel = selected && c.id && c.id.toLowerCase() === selected.toLowerCase();
      opts.push(`<option value="${esc(c.id)}"${isSel ? ' selected' : ''}>${esc(label)}</option>`);
    }
    sel.innerHTML = opts.join('');
  }

  function renderSessionTab() {
    const el = $('panel-session');
    const session = state.data?.session;
    const errMsg = state.data?.errors?.session || state.data?.errors?.connection;
    if (!session) {
      el.innerHTML = `<div class="card"><div class="empty-note">${esc(errMsg || t('noSession'))}</div></div>`;
      return;
    }

    const latest = session.latest || {};
    const pct = Number.isFinite(Number(latest.percent)) ? Math.min(100, Math.max(0, Number(latest.percent))) : 0;
    const fillCls = latest.exceeded || pct >= 90 ? 'danger' : (pct >= 70 ? 'warn' : 'ok');
    const usedText = fmtTokensCompact(latest.used ?? latest.actual ?? latest.estimate);
    const budgetText = fmtTokensCompact(latest.budget);
    const speed = latest.speed || {};
    const groups = session.session?.groups || {};
    const totalCharsOrTok = Number(session.session?.total?.high) || Number(session.session?.total?.chars) || 1;

    const groupDefs = [
      ['user', t('grpUser')],
      ['assistant', t('grpAssistant')],
      ['thinking', t('grpThinking')],
      ['tools', t('grpTools')],
      ['summaries', t('grpSummaries')],
      ['system', t('grpSystem')],
      ['definitions', t('grpDefinitions')]
    ];

    const breakdownHtml = groupDefs.map(([k, label]) => {
      const g = groups[k] || {};
      const val = Number(g.high ?? g.low ?? 0);
      const ratio = Math.min(100, Math.max(val > 0 ? 2 : 0, (val / Math.max(1, Number(session.session?.total?.high || 1))) * 100));
      return `
        <div class="breakdown-row">
          <span class="breakdown-name">${esc(label)}</span>
          <div class="breakdown-bar"><span style="width:${ratio.toFixed(1)}%"></span></div>
          <span class="breakdown-val">${esc(fmtTokensCompact(val))}</span>
        </div>
      `;
    }).join('');

    const attHigh = Number(session.session?.attachmentTotal?.high || 0);
    const attCount = Array.isArray(session.session?.attachments) ? session.session.attachments.length : 0;

    el.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>${esc(t('ctxTitle'))}</span>
          <span class="pill ${latest.exceeded ? 'pill-danger' : 'pill-muted'}">${esc(latest.model || t('modelUnknown'))}</span>
        </div>
        <div class="hero-gauge">
          <span class="hero-pct">${pct.toFixed(1)}%</span>
          <span class="hero-sub">${esc(usedText)} / ${esc(budgetText)} tokens</span>
        </div>
        <div class="progress-track"><div class="progress-fill ${fillCls}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="kv-row" style="margin-top:4px">
          <span class="kv-k">${esc(latest.exceeded ? t('exceeded') : (latest.errorClassification || latest.status || ''))}</span>
          <span class="kv-v">${esc(t('inputCacheOut'))}: ${esc(fmtTokensCompact(latest.input))} / ${esc(fmtTokensCompact(latest.cached))} / ${esc(fmtTokensCompact(latest.output))}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span>${esc(t('speedTitle'))}</span></div>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-k">${esc(t('ttft'))}</div>
            <div class="stat-v">${speed.ttft != null ? `${Number(speed.ttft).toFixed(2)}s` : '--'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-k">${esc(t('tps'))}</div>
            <div class="stat-v">${speed.tps != null ? `${Number(speed.tps).toFixed(1)} tok/s` : '--'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-k">${esc(t('duration'))}</div>
            <div class="stat-v">${speed.duration != null ? `${Number(speed.duration).toFixed(2)}s` : '--'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-k">${esc(t('steps'))}</div>
            <div class="stat-v">${esc(fmtNum(session.session?.steps))} · ${esc(fmtNum(session.generatorCount))} calls</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>${esc(t('breakdownTitle'))}</span>
          <span class="pill pill-muted">${esc(t('attachments'))}: ${attCount} (${esc(fmtTokensCompact(attHigh))})</span>
        </div>
        ${breakdownHtml}
      </div>
    `;
  }

  function renderQuotaTab() {
    const el = $('panel-quota');
    const q = state.data?.quota;
    const pools = q?.snapshot?.pools || [];
    if (!q || !pools.length) {
      const err = state.data?.errors?.quota || t('noQuota');
      el.innerHTML = `<div class="card"><div class="empty-note">${esc(err)}</div></div>`;
      return;
    }

    const planName = q.planTierSummary?.tierName || q.planTierSummary?.planName || q.snapshot?.badge || 'Antigravity';
    const activeLabel = q.snapshot?.activeStatusLabel || q.snapshot?.activeStatus || '';

    const poolCards = pools.map((pool) => {
      const bucketsHtml = (pool.buckets || []).map((b) => {
        const frac = Number.isFinite(Number(b.remainingFraction)) ? Number(b.remainingFraction) * 100 : 0;
        const pct = Math.min(100, Math.max(0, frac));
        const fillCls = b.isExhausted || pct <= 10 ? 'danger' : (pct <= 35 ? 'warn' : 'ok');
        const badgeText = b.isExhausted ? t('exhausted') : (b.percentText || `${pct.toFixed(0)}%`);
        const resetText = b.hasResetTime ? `${t('resetIn')} ${fmtResetCountdown(b.resetTimeIso)}` : '';
        return `
          <div style="margin-top:8px">
            <div class="kv-row">
              <span class="kv-k">${esc(b.windowLabel || b.windowShort || b.bucketId)}</span>
              <span class="kv-v">${esc(badgeText)}${resetText ? ` · ${esc(resetText)}` : ''}</span>
            </div>
            <div class="progress-track"><div class="progress-fill ${fillCls}" style="width:${pct.toFixed(1)}%"></div></div>
          </div>
        `;
      }).join('');

      return `
        <div class="card">
          <div class="card-title">
            <span>${esc(pool.title || pool.poolKey)}</span>
            <span class="pill pill-muted">${esc(pool.description || '')}</span>
          </div>
          ${bucketsHtml}
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>${esc(t('quotaTitle'))}</span>
          <span class="pill pill-accent">${esc(planName)}</span>
        </div>
        ${activeLabel ? `<div class="empty-note">${esc(activeLabel)}</div>` : ''}
      </div>
      ${poolCards}
    `;
  }

  function renderTokensTab() {
    const el = $('panel-tokens');
    const summary = state.data?.tokens?.summary;
    if (!summary) {
      const err = state.data?.errors?.tokens || t('noTokens');
      el.innerHTML = `<div class="card"><div class="empty-note">${esc(err)}</div></div>`;
      return;
    }

    const monthCost = summary.costEstimateCurrentMonth?.pricedCostUSD ?? summary.referenceCost?.currentMonth?.totalCostUSD;
    const totalCost = summary.costEstimate?.pricedCostUSD ?? summary.referenceCost?.all?.totalCostUSD;

    el.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>${esc(t('tokensTitle'))}</span>
          <span class="pill pill-muted">${esc(state.data?.tokens?.updatedAt || '')}</span>
        </div>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-k">${esc(t('today'))}</div>
            <div class="stat-v">${esc(fmtTokensCompact(summary.todayTokens))}</div>
          </div>
          <div class="stat-box">
            <div class="stat-k">${esc(t('month'))}</div>
            <div class="stat-v">${esc(fmtTokensCompact(summary.monthTokens))}</div>
          </div>
          <div class="stat-box">
            <div class="stat-k">${esc(t('total'))}</div>
            <div class="stat-v">${esc(fmtTokensCompact(summary.grandTotalTokens))}</div>
          </div>
          <div class="stat-box">
            <div class="stat-k">${esc(t('estCost'))}</div>
            <div class="stat-v">${esc(fmtUsd(monthCost))} / ${esc(fmtUsd(totalCost))}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="kv-list">
          <div class="kv-row">
            <span class="kv-k">${esc(t('inputCacheOut'))}</span>
            <span class="kv-v">${esc(fmtTokensCompact(summary.totalInputTokens))} / ${esc(fmtTokensCompact(summary.totalCacheTokens))} / ${esc(fmtTokensCompact(summary.totalOutputTokens))}</span>
          </div>
          <div class="kv-row">
            <span class="kv-k">${esc(t('convSteps'))}</span>
            <span class="kv-v">${esc(fmtNum(summary.totalConversations))} / ${esc(fmtNum(summary.totalSteps))} / ${esc(fmtNum(summary.activeDaysCount))}d</span>
          </div>
          <div class="kv-row">
            <span class="kv-k">${esc(t('firstUse'))}</span>
            <span class="kv-v">${esc(summary.firstUseDate || '--')}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderDiagnosticsTab() {
    const el = $('panel-diagnostics');
    const meta = state.data?.meta || {};
    const unlock = state.data?.unlock;
    const sidecar = state.data?.sidecar;
    const settings = state.data?.settings || {};

    const unlockText = unlock
      ? `${unlock.status}${unlock.mode ? ` (${unlock.mode}${unlock.limit ? ` · ${fmtTokensCompact(unlock.limit)}` : ''})` : ''}${unlock.arch ? ` [${unlock.arch}]` : ''}`
      : (state.data?.errors?.unlock || '--');

    const cdpText = meta.cdpEnabled
      ? `ON (${meta.cdpPort || '?'})`
      : `OFF (${meta.cdpReason || 'cdp_disabled'})`;

    const topbarText = meta.topbarActive
      ? `Active v${meta.topbarVersion || ''}`
      : (meta.installMarker?.meterVersion ? `ASAR v${meta.installMarker.meterVersion}` : 'Aux Pane Only');

    el.innerHTML = `
      <div class="card">
        <div class="card-title"><span>${esc(t('diagTitle'))}</span></div>
        <div class="kv-list">
          <div class="kv-row">
            <span class="kv-k">${esc(t('originLabel'))}</span>
            <span class="kv-v">${esc(meta.origin || '--')}</span>
          </div>
          <div class="kv-row">
            <span class="kv-k">${esc(t('cdpLabel'))}</span>
            <span class="kv-v">${esc(cdpText)}</span>
          </div>
          <div class="kv-row">
            <span class="kv-k">${esc(t('topbarLabel'))}</span>
            <span class="kv-v">${esc(topbarText)}</span>
          </div>
          <div class="kv-row">
            <span class="kv-k">${esc(t('unlockLabel'))}</span>
            <span class="kv-v">${esc(unlockText)}</span>
          </div>
          <div class="kv-row">
            <span class="kv-k">${esc(t('sidecarLabel'))}</span>
            <span class="kv-v">${sidecar?.installed ? 'installed' : 'workspace/linked'} · ${sidecar?.scriptExists ? 'script ok' : 'script missing'}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span>${esc(t('settingsTitle'))}</span></div>
        <label class="toggle-row">
          <span>${esc(t('optChinese'))}</span>
          <input id="chk-sidecar-zh" type="checkbox"${settings.sidecarChinese !== false ? ' checked' : ''}>
        </label>
        <label class="toggle-row">
          <span>${esc(t('optCli'))}</span>
          <input id="chk-show-cli" type="checkbox"${settings.showCliButton === true ? ' checked' : ''}>
        </label>
      </div>

      <div class="card">
        <div class="card-title"><span>${esc(t('logTitle'))}</span></div>
        <pre id="sidecar-log-tail" class="log-box"></pre>
      </div>
    `;

    const logBox = $('sidecar-log-tail');
    const tail = sidecar?.runtimeLog?.tail || [];
    logBox.textContent = tail.length ? tail.join('\n') : '(no logs yet)';

    $('chk-sidecar-zh')?.addEventListener('change', (ev) => saveSetting({ sidecarChinese: ev.target.checked }));
    $('chk-show-cli')?.addEventListener('change', (ev) => saveSetting({ showCliButton: ev.target.checked }));
  }

  async function saveSetting(patch) {
    try {
      const res = await api('/api/settings', patch);
      if (state.data) state.data.settings = res.settings;
      toast(t('saveOk'), 'ok');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function render() {
    applyStaticLabels();
    if (!state.data) return;
    if (state.data.meta?.pluginVersion) {
      $('version-badge').textContent = `v${state.data.meta.pluginVersion}`;
    }
    renderConversationSelect();
    renderCompatBanner();
    renderSessionTab();
    renderQuotaTab();
    renderTokensTab();
    renderDiagnosticsTab();
  }

  async function refresh(force = false) {
    if (state.loading) return;
    state.loading = true;
    const btn = $('btn-refresh');
    btn.classList.add('spin');
    try {
      const convId = state.manualConvId || window.sidecar?.conversationId || null;
      const endpoint = force ? '/api/refresh' : '/api/overview';
      const data = await api(endpoint, { conversationId: convId });
      state.data = data;
      render();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      state.loading = false;
      btn.classList.remove('spin');
    }
  }

  function resetAutoTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (state.autoRefresh) {
      state.timerId = setInterval(() => refresh(false), 10000);
    }
  }

  function bindEvents() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.getAttribute('data-tab');
        if (!nextTab) return;
        state.tab = nextTab;
        document.querySelectorAll('.tab').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('.panel').forEach((p) => {
          p.classList.toggle('active', p.id === `panel-${nextTab}`);
        });
      });
    });

    $('btn-refresh').addEventListener('click', () => refresh(true));
    $('btn-lang').addEventListener('click', () => {
      state.lang = state.lang === 'zh' ? 'en' : 'zh';
      render();
    });
    $('btn-auto').addEventListener('click', () => {
      state.autoRefresh = !state.autoRefresh;
      applyStaticLabels();
      resetAutoTimer();
    });
    $('conv-select').addEventListener('change', (ev) => {
      state.manualConvId = ev.target.value || null;
      refresh(false);
    });
  }

  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  bindEvents();
  applyStaticLabels();
  refresh(false);
  resetAutoTimer();
})();
