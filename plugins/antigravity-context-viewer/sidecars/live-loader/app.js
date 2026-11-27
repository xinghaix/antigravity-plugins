(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const STR = {
    zh: {
      convLabel: '会话:',
      autoPick: '自动探测当前会话…',
      autoOn: '自动 25s',
      autoOff: '已暂停',
      tabContext: '上下文 & 详情',
      tabQuota: '配额 & 账号',
      tabTokens: 'Token & 费用',
      tabDiag: '诊断',
      modeAuxPill: 'Aux 原生直连 (免 CDP)',
      modeCdpPill: 'CDP 已连接',
      modeWaitPill: '等待 Antigravity',
      compatDescNoCdp: 'Antigravity 2.33+ 默认关闭 DevToolsActivePort；本侧边栏已内置完整引擎并直连宿主 Language Server 与 live-host，无需 CDP 即可使用全量上下文/配额/Token/热力图/模型解锁与系统增强功能。',
      compatSummary: '可选：如何开启顶部标题栏悬浮条 (CDP)',
      compatOptLaunch: '方案 1（免改盘推荐）：带调试端口启动 Antigravity',
      compatOptInstall: '方案 2（写入 app.asar）：持久化安装，无需调试端口',
      hotInjectBtn: '热注入',
      hotInjected: '已触发顶栏热注入',
      copied: '已复制命令到剪贴板',
      copyFail: '复制失败，请手动选中命令复制',
      copyBtn: '复制',
      embedLoading: '正在加载完整仪表盘…',
      embedLoadFail: '完整仪表盘脚本加载失败，请点击右上角刷新重试。',
      diagTitle: '运行环境诊断',
      originLabel: 'Language Server Origin',
      cdpLabel: 'CDP 调试端口',
      topbarLabel: '顶栏注入状态',
      unlockLabel: '上下文长度解锁 (Gate 3A/3B)',
      autostartLabel: '开机自启守护',
      capsLabel: 'Sidecar 全功能桥接',
      sidecarLabel: 'Sidecar 插件脚本',
      settingsTitle: '面板与注入设置',
      optChinese: 'CDP 热注入时启用桌面端中文汉化',
      optCli: '顶栏面板显示 CLI 快捷入口',
      optComposerBar: '在输入框下方显示上下文与配额状态条',
      optTurnFooter: '在每条回复尾部显示统计微徽标',
      optNextPrompt: '启用下一句预测建议（默认关闭）',
      saveOk: '设置已保存',
      logTitle: 'Sidecar 最近日志'
    },
    'zh-TW': {
      convLabel: '會話:',
      autoPick: '自動偵測目前會話…',
      autoOn: '自動 25s',
      autoOff: '已暫停',
      tabContext: '上下文 & 詳情',
      tabQuota: '配額 & 帳號',
      tabTokens: 'Token & 費用',
      tabDiag: '診斷',
      modeAuxPill: 'Aux 原生直連 (免 CDP)',
      modeCdpPill: 'CDP 已連線',
      modeWaitPill: '等待 Antigravity',
      compatDescNoCdp: 'Antigravity 2.33+ 預設關閉 DevToolsActivePort；本側邊欄已內建完整引擎並直連宿主 Language Server 與 live-host，無需 CDP 即可使用完整上下文/配額/Token/熱力圖/模型解鎖與系統增強功能。',
      compatSummary: '可選：如何開啟頂部標題列懸浮條 (CDP)',
      compatOptLaunch: '方案 1（免改寫磁碟推薦）：帶除錯連接埠啟動 Antigravity',
      compatOptInstall: '方案 2（寫入 app.asar）：持久化安裝，無需除錯連接埠',
      hotInjectBtn: '熱注入',
      hotInjected: '已觸發頂欄熱注入',
      copied: '已複製命令到剪貼簿',
      copyFail: '複製失敗，請手動選取命令複製',
      copyBtn: '複製',
      embedLoading: '正在載入完整儀表板…',
      embedLoadFail: '完整儀表板腳本載入失敗，請點擊右上角重新整理重試。',
      diagTitle: '執行環境診斷',
      originLabel: 'Language Server Origin',
      cdpLabel: 'CDP 除錯連接埠',
      topbarLabel: '頂欄注入狀態',
      unlockLabel: '上下文長度解鎖 (Gate 3A/3B)',
      autostartLabel: '開機自啟守護',
      capsLabel: 'Sidecar 全功能橋接',
      sidecarLabel: 'Sidecar 插件腳本',
      settingsTitle: '面板與注入設定',
      optChinese: 'CDP 熱注入時啟用桌面端簡體中文化',
      optCli: '頂欄面板顯示 CLI 快速入口',
      optComposerBar: '在輸入框下方顯示上下文與配額狀態列',
      optTurnFooter: '在每則回覆尾部顯示統計微徽章',
      optNextPrompt: '啟用下一句預測建議（預設關閉）',
      saveOk: '設定已儲存',
      logTitle: 'Sidecar 最近日誌'
    },
    en: {
      convLabel: 'Session:',
      autoPick: 'Auto-detect active session…',
      autoOn: 'Auto 25s',
      autoOff: 'Paused',
      tabContext: 'Context & Tools',
      tabQuota: 'Quota & Accounts',
      tabTokens: 'Tokens & Cost',
      tabDiag: 'Diagnostics',
      modeAuxPill: 'Aux Native (No CDP)',
      modeCdpPill: 'CDP Connected',
      modeWaitPill: 'Waiting for Host',
      compatDescNoCdp: 'Antigravity 2.33+ disables DevToolsActivePort by default. This Aux Pane embeds the full Context Viewer engine wired directly to the host Language Server and live-host backend — all panels work without CDP.',
      compatSummary: 'Optional: Restore desktop topbar overlay (CDP)',
      compatOptLaunch: 'Option 1 (No ASAR patch): Launch with CDP debug port',
      compatOptInstall: 'Option 2 (Patch app.asar): Persistent install without CDP',
      hotInjectBtn: 'Hot-Inject',
      hotInjected: 'Triggered topbar hot-injection',
      copied: 'Copied command to clipboard',
      copyFail: 'Copy failed; please copy manually',
      copyBtn: 'Copy',
      embedLoading: 'Loading full Context Viewer dashboard…',
      embedLoadFail: 'Failed to load dashboard bundle. Click Refresh to retry.',
      diagTitle: 'Runtime Diagnostics',
      originLabel: 'Language Server Origin',
      cdpLabel: 'CDP Debug Port',
      topbarLabel: 'Topbar Injection',
      unlockLabel: 'Context Unlock (Gate 3A/3B)',
      autostartLabel: 'Autostart Daemon',
      capsLabel: 'Full-Feature Live Bridge',
      sidecarLabel: 'Sidecar Script',
      settingsTitle: 'Preferences',
      optChinese: 'Enable Chinese UI translation on CDP hot-inject',
      optCli: 'Show CLI quick button on topbar widget',
      optComposerBar: 'Show compact context & quota strip below composer',
      optTurnFooter: 'Show mini stats footer on each assistant reply',
      optNextPrompt: 'Enable next-prompt prediction suggestions (off by default)',
      saveOk: 'Settings saved',
      logTitle: 'Recent Sidecar Logs'
    }
  };

  const state = {
    lang: 'zh',
    tab: 'context',
    autoRefresh: true,
    timerId: null,
    summaryTimerId: null,
    loading: false,
    manualConvId: null,
    data: null,
    embedReady: false,
    embedError: null,
    lastTheme: null,
    lastSummarySig: ''
  };

  const nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;

  function t(key) {
    return (STR[state.lang] && STR[state.lang][key]) || STR.zh[key] || key;
  }

  function detectHostTheme() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--background, #f6f7f9)';
    document.documentElement.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    const nums = (c.match(/[\d.]+/g) || []).map(Number);
    if (nums.length < 3) return document.documentElement.dataset.theme || 'dark';
    const scale = c.startsWith('color(') ? 1 : 255;
    const [r, g, b] = nums.slice(0, 3).map((v) => v / scale);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum < 0.5 ? 'dark' : 'light';
  }

  function syncTheme() {
    const nextTheme = detectHostTheme();
    document.documentElement.dataset.theme = nextTheme;
    if (state.lastTheme !== nextTheme) {
      state.lastTheme = nextTheme;
      try {
        if (window.__AGContextMeter?.setTheme) {
          window.__AGContextMeter.setTheme(nextTheme);
        }
      } catch { }
    }
  }

  function fmtTokensCompact(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '--';
    if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
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

  async function api(url, body = {}, opts = {}) {
    const fetcher = window.sidecar?.fetch ? window.sidecar.fetch.bind(window.sidecar) : nativeFetch;
    if (!fetcher) throw new Error('fetch unavailable');
    const fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    };
    if (opts?.signal) fetchOpts.signal = opts.signal;
    const res = await fetcher(url, fetchOpts);
    const json = await res.json();
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }
    return json;
  }

  function installSidecarEmbedGlobals() {
    if (typeof globalThis !== 'undefined') {
      globalThis.__AGContextMeterSidecarEmbed = true;
      globalThis.__AGContextMeterSidecarRoute = '';
      globalThis.__AGContextMeterSidecarLiveFetch = (routePath, body = {}, opts = {}) =>
        api('/api/live', {
          route: routePath,
          body,
          origin: state.data?.meta?.origin || null
        }, opts);
    }
    window.__APP_CONFIG__ = {
      ...(window.__APP_CONFIG__ || {}),
      csrfToken: 'sidecar-ls-proxy'
    };
    window.__AGContextMeterLive = {
      port: 1,
      token: 'sidecar-inproc',
      version: '0.9.3-2',
      capabilities: state.data?.meta?.capabilities || null,
      backendSource: 'sidecar-inproc'
    };
    window.contextMeterAPI = {
      ...(window.contextMeterAPI || {}),
      openExternal: (url) => api('/api/open-external', { url })
    };

    if (nativeFetch && !window.__AGContextMeterFetchWrapped) {
      window.__AGContextMeterFetchWrapped = true;
      window.fetch = async (input, init = {}) => {
        const rawUrl = typeof input === 'string'
          ? input
          : (input && typeof input.url === 'string' ? input.url : String(input || ''));
        const lsMatch = rawUrl.match(/\/exa\.language_server_pb\.LanguageServerService\/([A-Za-z0-9_]+)(?:[?#]|$)/);
        if (lsMatch) {
          let parsedBody = {};
          if (typeof init?.body === 'string' && init.body.trim()) {
            try { parsedBody = JSON.parse(init.body); } catch { parsedBody = {}; }
          }
          try {
            const rpcRes = await api('/api/ls-rpc', {
              method: lsMatch[1],
              body: parsedBody,
              origin: state.data?.meta?.origin || null
            }, { signal: init?.signal });
            return {
              ok: true,
              status: 200,
              json: async () => rpcRes?.data || {}
            };
          } catch (err) {
            return {
              ok: false,
              status: 502,
              json: async () => ({ error: err?.message || String(err) })
            };
          }
        }
        return nativeFetch(input, init);
      };
    }
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-ag-bundle="${src}"]`);
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.setAttribute('data-ag-bundle', src);
      s.addEventListener('load', () => {
        s.setAttribute('data-loaded', 'true');
        resolve();
      }, { once: true });
      s.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(s);
    });
  }

  function getDefaultHostConversationId() {
    try {
      const sp = new URLSearchParams(location.search || '');
      const fromQuery = sp.get('conversationId');
      if (fromQuery && fromQuery.trim()) return fromQuery.trim();
    } catch { }
    if (typeof window.sidecar?.conversationId === 'string' && window.sidecar.conversationId.trim()) {
      return window.sidecar.conversationId.trim();
    }
    return null;
  }

  async function ensureEmbeddedMeterBooted() {
    if (state.embedReady && window.__AGContextMeter) return window.__AGContextMeter;
    installSidecarEmbedGlobals();

    const activeConv = state.manualConvId || state.data?.selectedConversationId || getDefaultHostConversationId() || '';
    if (activeConv) {
      globalThis.__AGContextMeterSidecarRoute = activeConv;
    }

    try {
      await loadScriptOnce('/meter-core.js');
      await loadScriptOnce('/meter-renderer.js');
    } catch (err) {
      state.embedError = err?.message || t('embedLoadFail');
      const loadEl = $('embed-loading');
      if (loadEl) loadEl.textContent = t('embedLoadFail');
      throw err;
    }

    const loadEl = $('embed-loading');
    state.embedReady = Boolean(window.__AGContextMeter);
    if (!state.embedReady) {
      state.embedError = t('embedLoadFail');
      if (loadEl) loadEl.textContent = t('embedLoadFail');
      return null;
    }
    if (loadEl) loadEl.remove();

    if (window.__AGContextMeter) {
      syncTheme();
      try {
        window.__AGContextMeter.setTheme(state.lastTheme || detectHostTheme());
      } catch { }
      if (activeConv) {
        try { window.__AGContextMeter.setSidecarRoute(activeConv); } catch { }
      }
      if (state.tab !== 'diagnostics') {
        try { window.__AGContextMeter.showPanel(state.tab); } catch { }
      }
      syncTabSummaryPills();
    }
    return window.__AGContextMeter;
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
    $('lbl-tab-context').textContent = t('tabContext');
    $('lbl-tab-quota').textContent = t('tabQuota');
    $('lbl-tab-tokens').textContent = t('tabTokens');
    $('lbl-tab-diagnostics').textContent = t('tabDiag');
    $('btn-hot-inject').textContent = t('hotInjectBtn');
    $('btn-lang').textContent = state.lang === 'en' ? '中文' : 'EN';
    $('btn-auto').textContent = state.autoRefresh ? t('autoOn') : t('autoOff');
    $('btn-auto').classList.toggle('active', state.autoRefresh);
  }

  function renderHeaderStatus() {
    const meta = state.data?.meta || {};
    const modePill = $('mode-pill');
    const hotBtn = $('btn-hot-inject');
    if (modePill) {
      if (meta.cdpEnabled) {
        modePill.className = 'pill pill-ok';
        modePill.textContent = `${t('modeCdpPill')} · ${meta.cdpPort || ''}`;
      } else if (meta.antigravityRunning) {
        modePill.className = 'pill pill-accent';
        modePill.textContent = t('modeAuxPill');
      } else {
        modePill.className = 'pill pill-warn';
        modePill.textContent = t('modeWaitPill');
      }
    }
    if (hotBtn) {
      hotBtn.hidden = !meta.cdpEnabled;
    }
  }

  function renderConversationSelect() {
    const sel = $('conv-select');
    if (!sel) return;
    const convs = state.data?.conversations || [];
    const selected = state.manualConvId || state.data?.selectedConversationId || '';
    const opts = [`<option value="">${esc(t('autoPick'))}</option>`];
    for (const c of convs) {
      const shortId = String(c.id || '').slice(0, 8);
      const label = c.title ? `${c.title.slice(0, 34)} (${shortId})` : c.id;
      const isSel = selected && c.id && c.id.toLowerCase() === selected.toLowerCase();
      opts.push(`<option value="${esc(c.id)}"${isSel ? ' selected' : ''}>${esc(label)}</option>`);
    }
    const nextHtml = opts.join('');
    if (sel._lastOptsHtml !== nextHtml) {
      sel._lastOptsHtml = nextHtml;
      sel.innerHTML = nextHtml;
    }
  }

  function setOuterTabHighlight(nextTab) {
    state.tab = nextTab;
    document.querySelectorAll('.tab').forEach((b) => {
      const active = b.getAttribute('data-tab') === nextTab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const pEmbed = $('panel-embed');
    const pDiag = $('panel-diagnostics');
    if (nextTab === 'diagnostics') {
      pEmbed?.classList.remove('active');
      pDiag?.classList.add('active');
    } else {
      pDiag?.classList.remove('active');
      pEmbed?.classList.add('active');
    }
  }

  function syncTabSummaryPills() {
    let ctxText = '--%';
    let quotaText = '--';
    let tokenText = '--';

    if (window.__AGContextMeter?.getSidecarSummary) {
      const s = window.__AGContextMeter.getSidecarSummary();
      if (s.contextPct) ctxText = s.contextSubPct ? `${s.contextPct} ${s.contextSubPct}` : s.contextPct;
      if (s.quotaVal) quotaText = s.quotaTag ? `${s.quotaVal} ${s.quotaTag}` : s.quotaVal;
      if (s.tokenVal) tokenText = s.tokenVal;
      if (s.panelLanguage) {
        const mappedLang = s.panelLanguage === 'zh-TW' ? 'zh-TW' : (s.panelLanguage === 'en' ? 'en' : 'zh');
        if (mappedLang !== state.lang) {
          state.lang = mappedLang;
          applyStaticLabels();
          renderHeaderStatus();
          if (state.tab === 'diagnostics') renderDiagnosticsTab();
        }
      }
      if (state.tab !== 'diagnostics' && s.activePanel && ['context', 'quota', 'tokens'].includes(s.activePanel) && s.activePanel !== state.tab) {
        setOuterTabHighlight(s.activePanel);
      }
    } else if (state.data) {
      const pct = state.data.session?.latest?.percent;
      if (Number.isFinite(Number(pct))) ctxText = `${Number(pct).toFixed(0)}%`;
      const qBadge = state.data.quota?.snapshot?.badge;
      if (qBadge?.text) quotaText = qBadge.text;
      const gTotal = state.data.tokens?.summary?.grandTotalTokens;
      if (gTotal != null) tokenText = fmtTokensCompact(gTotal);
    }

    const sig = `${ctxText}|${quotaText}|${tokenText}`;
    if (sig === state.lastSummarySig) return;
    state.lastSummarySig = sig;
    if ($('pill-tab-context')) $('pill-tab-context').textContent = ctxText;
    if ($('pill-tab-quota')) $('pill-tab-quota').textContent = quotaText;
    if ($('pill-tab-tokens')) $('pill-tab-tokens').textContent = tokenText;
  }

  function renderDiagnosticsTab() {
    const el = $('panel-diagnostics');
    if (!el) return;
    const meta = state.data?.meta || {};
    const unlock = state.data?.unlock;
    const sidecar = state.data?.sidecar;
    const autostart = state.data?.autostart;
    const settings = state.data?.settings || {};

    const unlockText = unlock
      ? `${unlock.status}${unlock.mode ? ` (${unlock.mode}${unlock.limit ? ` · ${fmtTokensCompact(unlock.limit)}` : ''})` : ''}${unlock.arch ? ` [${unlock.arch}]` : ''}`
      : (state.data?.errors?.unlock || '--');

    const cdpText = meta.cdpEnabled
      ? `ON (${meta.cdpPort || '?'})`
      : `OFF (${meta.cdpReason || 'cdp_disabled'})`;

    const topbarText = meta.topbarActive
      ? `Active v${meta.topbarVersion || ''}`
      : (meta.installMarker?.meterVersion ? `ASAR v${meta.installMarker.meterVersion}` : 'Aux Pane Full Engine');

    const autostartText = autostart
      ? (autostart.supported === false
        ? `Unsupported (${autostart.platform || 'linux'})`
        : `${autostart.enabled ? 'ON' : 'OFF'}${autostart.kind || autostart.method ? ` (${autostart.kind || autostart.method})` : ''}`)
      : '--';

    const launchCmd = 'node plugins/antigravity-context-viewer/cli.js launch --restart';
    const installCmd = 'node plugins/antigravity-context-viewer/cli.js install';
    const noCdpCard = meta.cdpEnabled ? '' : `
      <div class="card">
        <div class="card-title"><span>${esc(t('compatSummary'))}</span></div>
        <div class="empty-note">${esc(t('compatDescNoCdp'))}</div>
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
      </div>
    `;

    el.innerHTML = `
      ${noCdpCard}
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
            <span class="kv-k">${esc(t('autostartLabel'))}</span>
            <span class="kv-v">${esc(autostartText)}</span>
          </div>
          <div class="kv-row">
            <span class="kv-k">${esc(t('capsLabel'))}</span>
            <span class="kv-v">${meta.capabilities ? `${Object.keys(meta.capabilities).length} routes ready` : 'active'}</span>
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
        <label class="toggle-row">
          <span>${esc(t('optComposerBar'))}</span>
          <input id="chk-show-composer-bar" type="checkbox"${settings.showComposerQuotaSummary === true ? ' checked' : ''}>
        </label>
        <label class="toggle-row">
          <span>${esc(t('optTurnFooter'))}</span>
          <input id="chk-show-turn-footer" type="checkbox"${settings.showTurnFooterStats !== false ? ' checked' : ''}>
        </label>
        <label class="toggle-row">
          <span>${esc(t('optNextPrompt'))}</span>
          <input id="chk-next-prompt" type="checkbox"${settings.nextPromptEnabled === true ? ' checked' : ''}>
        </label>
      </div>

      <div class="card">
        <div class="card-title"><span>${esc(t('logTitle'))}</span></div>
        <pre id="sidecar-log-tail" class="log-box"></pre>
      </div>
    `;

    const logBox = $('sidecar-log-tail');
    const tail = sidecar?.runtimeLog?.tail || [];
    if (logBox) logBox.textContent = tail.length ? tail.join('\n') : '(no logs yet)';

    el.querySelectorAll('.copy-cmd').forEach((btn) => {
      btn.addEventListener('click', () => copyCommand(btn.getAttribute('data-cmd') || ''));
    });
    $('chk-sidecar-zh')?.addEventListener('change', (ev) => saveSetting({ sidecarChinese: ev.target.checked }));
    $('chk-show-cli')?.addEventListener('change', (ev) => saveSetting({ showCliButton: ev.target.checked }));
    $('chk-show-composer-bar')?.addEventListener('change', (ev) => saveSetting({ showComposerQuotaSummary: ev.target.checked }));
    $('chk-show-turn-footer')?.addEventListener('change', (ev) => saveSetting({ showTurnFooterStats: ev.target.checked }));
    $('chk-next-prompt')?.addEventListener('change', (ev) => saveSetting({ nextPromptEnabled: ev.target.checked }));
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

  function applyActiveTabUi(nextTab) {
    setOuterTabHighlight(nextTab);
    if (nextTab === 'diagnostics') {
      renderDiagnosticsTab();
      if (!state.data || state.data.lightweight || !state.data.sidecar) {
        void refresh(false);
      }
    } else {
      if (window.__AGContextMeter?.showPanel) {
        try { window.__AGContextMeter.showPanel(nextTab); } catch { }
      }
      if (window.__AGContextMeter?.relayoutForSidecar && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          try { window.__AGContextMeter?.relayoutForSidecar?.(); } catch { }
        });
      }
    }
  }

  function render() {
    applyStaticLabels();
    if (!state.data) return;
    if (state.data.meta?.pluginVersion) {
      $('version-badge').textContent = `v${state.data.meta.pluginVersion}`;
    }
    if (window.__AGContextMeterLive && state.data.meta?.capabilities) {
      window.__AGContextMeterLive.capabilities = state.data.meta.capabilities;
    }
    renderHeaderStatus();
    renderConversationSelect();
    if (state.tab === 'diagnostics') renderDiagnosticsTab();
    syncTabSummaryPills();
  }

  async function refresh(force = false) {
    if (state.loading) return;
    state.loading = true;
    const btn = $('btn-refresh');
    btn?.classList.add('spin');
    try {
      const convId = state.manualConvId || getDefaultHostConversationId();
      const endpoint = force ? '/api/refresh' : '/api/overview';
      const lightweight = Boolean(state.embedReady && state.tab !== 'diagnostics' && !force);
      const data = await api(endpoint, { conversationId: convId, lightweight });
      if (data?.lightweight && state.data) {
        state.data = {
          ...state.data,
          meta: data.meta || state.data.meta,
          conversations: Array.isArray(data.conversations) ? data.conversations : state.data.conversations,
          selectedConversationId: data.selectedConversationId ?? state.data.selectedConversationId,
          errors: data.errors || state.data.errors,
          lightweight: true
        };
      } else {
        state.data = data;
      }
      render();
      if (!state.embedReady) {
        void ensureEmbeddedMeterBooted().catch(() => {});
      } else {
        const nextRoute = state.manualConvId || data?.selectedConversationId || '';
        if (nextRoute && globalThis.__AGContextMeterSidecarRoute !== nextRoute && window.__AGContextMeter?.setSidecarRoute) {
          window.__AGContextMeter.setSidecarRoute(nextRoute);
        }
        if (force && window.__AGContextMeter?.refreshAllForSidecar) {
          await window.__AGContextMeter.refreshAllForSidecar(true);
        }
        syncTabSummaryPills();
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      state.loading = false;
      btn?.classList.remove('spin');
    }
  }

  function resetAutoTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (state.autoRefresh) {
      state.timerId = setInterval(() => refresh(false), 25000);
    }
  }

  function bindEvents() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.getAttribute('data-tab');
        if (!nextTab) return;
        applyActiveTabUi(nextTab);
      });
    });

    $('btn-hot-inject')?.addEventListener('click', async () => {
      try {
        await api('/api/hot-inject', {});
        toast(t('hotInjected'), 'ok');
        await refresh(false);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('btn-refresh')?.addEventListener('click', () => refresh(true));
    $('btn-lang')?.addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'zh' : 'en';
      const mapped = state.lang === 'en' ? 'en' : (state.lang === 'zh-TW' ? 'zh-TW' : 'zh-CN');
      if (window.__AGContextMeter?.setPanelLanguage) {
        try { void window.__AGContextMeter.setPanelLanguage(mapped, { persist: false }); } catch { }
      }
      render();
    });
    $('btn-auto')?.addEventListener('click', () => {
      state.autoRefresh = !state.autoRefresh;
      applyStaticLabels();
      resetAutoTimer();
    });
    $('conv-select')?.addEventListener('change', (ev) => {
      const nextId = ev.target.value || null;
      state.manualConvId = nextId;
      const resolvedId = nextId || state.data?.selectedConversationId || '';
      if (window.__AGContextMeter?.setSidecarRoute) {
        try { window.__AGContextMeter.setSidecarRoute(resolvedId); } catch { }
      }
      refresh(false);
    });

    window.addEventListener('ag-sidecar-panel-change', (ev) => {
      const p = ev?.detail?.panel;
      if (p && ['context', 'quota', 'tokens'].includes(p) && state.tab !== 'diagnostics' && state.tab !== p) {
        setOuterTabHighlight(p);
      }
    });

    let resizeTimerId = null;
    window.addEventListener('resize', () => {
      if (resizeTimerId) clearTimeout(resizeTimerId);
      resizeTimerId = setTimeout(() => {
        resizeTimerId = null;
        if (state.embedReady && state.tab !== 'diagnostics' && window.__AGContextMeter?.relayoutForSidecar) {
          try { window.__AGContextMeter.relayoutForSidecar(); } catch { }
        }
      }, 120);
    });
  }

  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
  try {
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', syncTheme);
  } catch { }
  installSidecarEmbedGlobals();
  bindEvents();
  applyStaticLabels();
  refresh(false).then(() => ensureEmbeddedMeterBooted().catch(() => {}));
  resetAutoTimer();
  state.summaryTimerId = setInterval(() => {
    if (!document.hidden) syncTabSummaryPills();
  }, 2000);
})();
