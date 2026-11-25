## v0.9.3-1

基于上游 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer) **`v0.9.3`** 完成全量合并，并完整保留与兼容本仓近期防卡滞错误自愈修复、Antigravity `2.35+` 内存优化及全部 Aux Pane Sidecar 改版特性：

- **上游 `v0.9.3` 核心更新全量同步**：
  - **Antigravity `2.35.1` 原生设置侧栏集成与交互统一**（`src/renderer/host-settings.js`、`src/renderer/context-settings-ui.js`、`src/renderer/dropdown.js`）：插件设置以同级独立页接入原生设置侧栏，支持单击直达、页签往返恢复与键盘导航；统一原生设置页与面板下拉菜单和候选账号滑动开关视觉，修复深色主题原生下拉白底白字与卡片裁切；语言切换重启确认升级为顶层原生 `<dialog>` 弹窗；修复 Windows 标题栏空白区拖拽及顶栏圆环左右键分工。
  - **多账号自动切号收敛与提示去重**（`meter-accounts.js`、`meter-main.js`、`live-host.js`）：自动切号监控项收敛为 Gemini 与 Claude / GPT 的 5 小时与周额度四项并按池分组；持久化切号成功提示消费记录，修复跨冷启动重复弹窗；新增单会话混合计价折算与远程/SSH 附件跳过。
  - **模型选择收敛与可选下一句预测建议**（`meter-next-prompt.js`、`src/renderer/next-prompt.js`、`live-host.js`）：移出自绘模型选择器改复用 Antigravity 原生模型菜单；新增默认关闭的下一句预测建议（支持 8 项防干扰门禁、`Tab` 仅填不发与 `live-host` `/predict-next-prompt` 路由）。
  - **免改盘更新与安装恢复加固**（`cli.js`、`install.js`、`modular-installer.js`、`restore.js`）：新增 `node cli.js update` 免改盘检查/下载、`createWindow` `await win.loadURL` 兼容与 4 阶段 `diagnoseCleanStructure` 结构诊断，限定 `cli-window-helper.exe` 仅在 Windows 平台部署并在卸载时清理。
- **完整保留与兼容本仓近期修复与 Sidecar 特性**：
  - **Aux Pane Sidecar 引擎与原生设置页细节适配 `v0.9.3`**：在 `IS_SIDECAR_EMBED` 模式下点击设置直接展开内嵌设置工作区（跳过宿主弹窗探测并隐藏降级提示条，不启动多余宿主设置 `MutationObserver` 与输入框下一句监听）；优化原生设置侧栏 `Context Meter` 导航项为与原生条目一致的纯文本无图标样式、去除点击蓝框，并动态采样同级原生激活/未激活配色修复切页后残留高亮与选中态文本同步高亮，同时将右侧设置内容（`.ag-ns-page`）改为 `margin: 0 auto` 水平居中；Sidecar 诊断页同步对齐 `showTurnFooterStats` 默认开启与 `nextPromptEnabled` 开关；`live-host.js` `ALLOWED_ROUTES` 补齐 `/predict-next-prompt` 并修正 `next-prompt.js` 经由 `postLiveHttpEndpoint` 携带鉴权头请求；
  - **完整保留防卡滞错误自愈修复并修复设置落盘缺陷**：修复上游 `meter-collector.js` `savePluginSettings()` 漏定义 `validTopbarModes` / `validPanelDockModes` 导致「精简圆环 / 隐藏顶栏 / 停靠位置」无法写入磁盘并在更新后回退的缺陷，阻止旧 `dockPosition` 覆盖显式正交字段，补齐 `themeMode` 持久化与恢复，并在 `sidecar-live.js` `getBundleStamp()` 纳入 `meter-collector.js` / `live-host.js`；保留 `meter-core.js` / `meter-collector.js` / `src/renderer/main.js` 针对 `retryInfos` 成功重试恢复、非错工具步骤清错、活跃生成/压缩/重试优先于陈旧错误、以及慢扫描防覆盖新轮询与 `capturedAt`/`latestMetaMaxStep` 保护；
  - **完整保留 `2.35+` 内存优化与全部外观/直连增强**：保留独立子进程二进制扫描与磁盘缓存（Sidecar 常驻 ~64 MB）、`ANTIGRAVITY_LS_ADDRESS` 回环直连快路径、`i18n-runtime` 6ms `rAF` 分片遍历、Google AI Ultra `5x`/`20x` 自动识别、底栏最后 1 步纯吐字速度、`K/M · %` 紧凑胶囊与双圆环单色默认配色（`#b8b8c0` / `#52525b`）、CLI 按钮默认隐藏开关与免改盘中文热注入自愈。

---

## v0.9.2-1

基于上游 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer) **`v0.9.2`**（含 `v0.9.1`）完成全量合并，并完整保留与兼容本仓近期 Bug 修复、性能优化及全部改版特性：

- **上游 `v0.9.1` ~ `v0.9.2` 核心更新全量同步**：
  - **会话看板（Skyline 自由布局）与速度对比增强**：支持卡片缩放/拖动四边对齐参考线与双卡并排吸附、自定义多套个人布局管理、分屏窗格悬停定位与右键聚焦/批量关闭；「速度与成本」新增单次请求估算费用与缓存节省明细，并支持按今日 / 3 日 / 5 日 / 一周 / 近 30 天 / 全量 / 自定义范围对比模型速度折线。
  - **性能、更新安全与首装收敛**：隐藏历史子页按需延迟绘制、空闲会话降频轮询（`60s`）与按账号核对历史修订；`i18n-runtime` 预编译正则 + `WeakMap` + 悬停子树预算保护并移除周期全树 `setInterval`；应用内更新改用后台子进程解压，磁盘更新后提示重启；首装时可选增强模块默认保持关闭（提示词精简默认 `0` 档，中文标题默认 `false`），同时完整保留既有配置与实装识别；实时请求列表恢复 Antigravity 原版图标。
  - **Antigravity `2.34.0` 与代理启动链路加固**：显式代理配置优先合并登录 Shell 环境、代理凭据脱敏与自启动管理（`autostart.js`、`autostart-status` / `autostart:enable` / `autostart:disable`）。
- **完整保留与兼容本仓近期修复与增强特性**：
  - **Aux Pane Sidecar 全功能引擎与 `v0.9.2` 新版 UI 对齐（免 CDP / 免改盘）**：完整保留内嵌版 `meter-renderer`（`data-dock="sidecar"`、`plugin:` WebView 上下文支持）、进程内 `/api/live`、白名单 `/api/ls-rpc`、`/api/open-external`，以及内嵌稳态下的 `{ lightweight: true }` `25s` 轻量同步与 `15s` `queryLiveWindow()` TTL 缓存；针对 `v0.9.1`/`v0.9.2` 新增 Skyline 2D 看板重排（`relayoutForSidecar()` + `resize` 自适应）、宽表/费用子视图全宽自适应、径向悬浮球与桌面顶栏模式锁定隔离、内部跳页标签双向联动、简/繁/英三语同步，以及诊断页 `autostart` 状态与底栏/尾注开关同步；
  - **Antigravity `2.35.0` 内存瘦身与环境直连快路径**：
    - 将 [meter-context-unlock.js](meter-context-unlock.js)（`analyzeBinaryAsync`）与 [meter-enhance.js](meter-enhance.js)（`inspectSingleBinaryAsync`）对约 197 MB `language_server` 二进制的扫描改由独立临时 Node 子进程（`child_process.fork` + `ELECTRON_RUN_AS_NODE=1`）执行并在完成后立即退出回收物理内存，同时新增按 `size + mtimeMs + ctimeMs + ino` 键控的主线程记忆与磁盘签名缓存（`.unlock-inspect-cache-v1.json` / `.enhance-inspect-cache-v1.json`，兼容 Windows PE `BigInt` 偏移序列化），Sidecar 常驻 RSS 由 ~585–710 MB 降至 ~64 MB 级，缓存命中仅 ~8 ms；
    - 为 [meter-collector.js](meter-collector.js) 的 `_turnStateGmCountCache`、`transcriptFileCache`（512 条）及 `ledgerCacheByPath`（32 条）统一加上界 LRU 淘汰；
    - 在 [local-api.js](local-api.js) 与 [ui-server.js](sidecars/live-loader/ui-server.js) 接入 Antigravity `2.35.0+` 自动注入的 `ANTIGRAVITY_LS_ADDRESS` / `ANTIGRAVITY_CSRF_TOKEN` 严格同源回环快路径（带测试隔离守卫），免 CDP 场景无需轮询调试端口即可直接建立 RPC 连接；已完成 `2.35.0` 全部 27 个线上模型归桶/配额/计价与二进制探测实测。
  - **CDP 切换会话防卡顿专项优化**：将本仓 `i18n-runtime` 的 **6ms `rAF` 分片遍历（`translateElementBudgeted`）**、`MutationObserver` 受保护容器整批短路与队列上限早退融入上游 `v0.9.2` `WeakMap` / 预编译正则引擎；保留切会话后 `checkHostDomCompactionSignals()` 约 `1.5s` 延迟扫描 + 多层孙节点跳过、2000ms/路由变化避让节流、`hostDomObserver` $O(1)$ 早退、`renderComposerStatusBar()` 1200ms DOM 轮次缓存、`renderTurnFooterStats()` 脏检查，以及 `[hidden]` CSS 动画暂停与瞬时 CDP 超时隔离（`cdp_busy`）；
  - **Google AI Ultra `5x`/`20x` 自动识别与底栏最后 1 步纯吐字速度**：将 `g1-ultra-lite-tier`（`5x`，`$99.99/月`）/ `g1-ultra-tier`（`20x`，`$199.99/月`）自动识别与缓存 `子档未知` 自动升级对接上游 `v0.9.2` 零括号 `SUBSCRIPTION_TIER_SPECS` 二维定价矩阵；底栏 `#csb-speed-text` 保持显示当前会话最后 1 步纯吐字速度（不含 TTFT），顶栏保持当前会话平均纯吐字速度；
  - **全部自定义顶栏外观与多路发现特性**：保留 `K/M · %` 紧凑胶囊、双圆环单色风格、CLI 按钮默认隐藏开关、Sidecar 中文热注入开关、`authBootstrap` + `daemon/hub_*.json` + `main.log` 本地直连，以及 macOS `arm64` Mach-O 上下文解锁与 `ElectronAsarIntegrity` 预检。

---

## v0.9.0-2

基于 `v0.9.0-1`（上游 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer) **`v0.9.0`** 同步基线）推出 Aux Pane 全功能对齐与 CDP 运行时流畅度专项优化版本：

- **Aux Pane Sidecar 全功能引擎对齐（免 CDP / 免改盘 100% 功能一致）**：
  - 将完整渲染引擎（`meter-core.js` + `meter-renderer.js`，`data-dock="sidecar"`）直接嵌入右侧 Aux Pane（`sidecar://antigravity-context-viewer/live-loader/`），放行受信任的 Sidecar `plugin:` WebView 上下文（`__AGContextMeterSidecarEmbed`）；
  - `sidecars/live-loader/ui-server.js` 新增进程内 `POST /api/live`（复用 `live-host.js` 路由并拦截 `/shutdown`）、白名单 `POST /api/ls-rpc` 与 `POST /api/open-external`，无需开启 CDP 即可在侧边栏完整使用 4 行 Bento 会话工作台、模型/上下文解锁（Gate 3A/3B）、ELV-91 速度分析、系统增强中心、共享配额池与多账号切换、5 视图 Token 热力图、请求时间线、订阅费用估算与运行环境诊断。
- **CDP 切换会话卡顿与后台双轮询优化**：
  - **`i18n-runtime.js`**：为异步 `flushPendingNodes()` 引入真正按元素粒度的 **6ms `requestAnimationFrame` 分片让出机制**（`translateElementBudgeted`），切换长会话挂载大 DOM 树时不再单帧阻塞主线程；提取 $O(1)$ 后代隔离检查（`shouldIgnoreDescendant`）并复用文本父节点校验，免除递归过程中对每个节点的重复祖先链遍历；在 `MutationObserver` 中缓存 `target` 隔离结果、对 `markdown-body` / 代码块 / 思考内容等受保护容器整批短路，并在队列达到上限时提前中止遍历；
  - **`src/renderer/main.js`**：切换会话后将 `checkHostDomCompactionSignals()` 首次 1200 节点 DOM 扫描延后约 `1.5s` 避开 React 挂载峰值；`hostDomObserver` 节流定时器已激活且宿主已挂载时 $O(1)$ 早退；输入栏 `renderComposerStatusBar()` 对 DOM 轮次查询增加 `1.2s` 路由级缓存；合并 `scheduleImmediateRouteTick()` 重复的 `enforceMarketplaceAvoidance()` 调用；
  - **Sidecar `ui-server.js` / `app.js`**：内嵌引擎就绪且非「诊断」页签时启用 `{ lightweight: true }` 轻量同步与 `25s` 轮询间隔，并为 `queryLiveWindow()` 增加 `15s` TTL 缓存（手动强制刷新与热注入自动失效），消除 Sidecar 与顶栏渲染层并行的重复 CDP/全量采集开销。
- **速度统计与账号订阅档位修复**：
  - **输入栏底部状态条与顶栏分工明确**：底部 `#csb-speed-text` 改为展示当前会话**最后 1 步纯吐字速度**（不含 TTFT），顶栏 `#speed-amount` 保持当前会话平均纯吐字速度；
  - **恢复 Google AI Ultra `5x` / `20x` 自动子档识别**：恢复 `g1-ultra-lite-tier`（`5x`，`$99.99/mo`）与 `g1-ultra-tier`（`20x`，`$199.99/mo`）识别及缓存中 `子档未知` 记录自动升级逻辑。

---

## v0.9.0-1

基于上游 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer) **`v0.9.0`**（含 `2.34.0` 窗口锚点与鉴权兼容性升级）完成全量合并，并保留全部 `antigravity-plugins` 原生插件特性：

- **上游 `v0.9.0` 核心更新全量同步**：
  - **Antigravity `2.34.0` 适配与安全恢复（`install.js`、`host-recovery.js`、`local-api.js`、`cli.js`）**：新增 `loadHubWindowUrl` 加载锚点、`authBootstrap` 同源鉴权、宿主更新覆盖后的版本隔离 ASAR 备份恢复（`host-recovery.js`），以及 macOS `ElectronAsarIntegrity` 写前预检与 `node cli.js check` 检测。
  - **当前会话 4 行 Bento 工作台与深度诊断（`meter-core.js`、`src/renderer/*`）**：新增 9 维上下文构成拆分与残差核算、总量/Δ 与按步/按轮趋势图及键盘步进（`←`/`→`/`Esc`）、TTFT/流式/工具耗时环形图及并发墙钟 vs 累计时长对照、上下文事件/文件/命令/子 Agent 汇总，以及 `[hidden]` 蓝条与 Customizations / `/c/...` 归档路由避让修复。
  - **配额池、模型与汉化升级**：新增 Gemini 4 Neon 模型识别与统一 `shared_gemini_main` 配额池支持（PR #52）、`v2.34.0` 客户端汉化词典与 `THIRD_PARTY_NOTICES.md`、更新检查 beta 通道开关，以及移除预编译 `cli-window-helper.exe`（Windows 改为临时目录按需编译 `cli-window-helper.cs`）。
- **本仓改版与 Antigravity `2.34+` macOS 适配增强**：
  - **原生 Aux Pane Sidecar UI 与无 CDP 多路发现**：完整保留 `sidecars/live-loader`（`sidecar://antigravity-context-viewer/live-loader/`）及 `authBootstrap` + `daemon/hub_*.json` + `main.log` 多路本地探测，在 `2.34.0` 启用 `ElectronAsarIntegrity` 且默认关闭 CDP 时免改盘实时展示会话上下文、配额池与历史 Token；
  - **修复 `meter-collector.js` `collect()` 上游笔误**：将残余 `cachedHostUserStatus?.availableModelDetails` 修正为 `latestCachedStatus?.availableModelDetails`；
  - **合并语义版本与修订后缀解析（`meter-core.js`）**：`parseSemver` / `compareVersions` / `filterReleases` 同时兼容上游预发布标签（`0.9.0-beta.1 < 0.9.0`）与本仓插件修订后缀（`0.9.0 < 0.9.0-1`）；
  - **CDP 实时运行与 GPU 性能优化**：修复 `i18n-runtime.js` `applyBrandTitleToText()` 对非品牌文本触发同步重排（`getBoundingClientRect()` / `.closest()`）、过滤已隔离聊天/Markdown/编辑器及 `#composer-status-bar` 的 `MutationObserver`/`rAF` 投递、将悬停与保底巡检节流降至 `350ms` / `60s`；为 `checkHostDomCompactionSignals()` 增加 `1s`/`2.5s` 节流并跳过多层级容器；将 `hostDomObserver` 放宽至 `350ms` 并移除 `characterData` 监听、`renderTurnFooterStats()` 增设幂等脏检查、`[hidden]` 子树暂停 CSS 无限动画；Sidecar `ACTIVE_POLL_MS` 稳态退避至 `20s`，并隔离瞬时 CDP 评估超时（`cdp_eval_timeout` → `cdp_busy`）以消除假性 `cdp_disabled` 断连与 `bridge_refreshed` 循环重注；
  - **保留全部界面与增强防误触特性**：顶栏双圆环克制造型、紧致 `K/M + %` 上下文胶囊、CLI 按钮默认隐藏开关、Sidecar 热注入中文开关，以及严格默认关闭提示词/标题改写（`promptTier: null`、`chineseTitle: null`、`#chk-rec-prompt` / `#chk-rec-title` 默认不勾选）。

---

## v0.8.8-1

基于上游 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer) **`v0.8.8`**（发布展示标识 `0.8.8 α`）完成同步适配与升级，并继续加强 **Google Antigravity `2.33+` 免 CDP 原生兼容性**：

- **上游 `v0.8.8` 核心更新全量同步**：
  - **多账号用量隔离与共享池对照**（`meter-accounts.js`、`meter-collector.js`）：支持多账号账本隔离分区记录，历史未归属请求保留在未归属账本；新增按模型共享池与阈值的可控自动切号（默认关闭，含冷却/生成中等待/多窗口锁与失败回滚保护）。
  - **按模型每日堆叠统计与历史清洗**：支持 `7 天 / 30 天`、按模型 / 思考档位及桌面端 / CLI 来源筛选；新增 `Orchestrator`（Carbon / Argon）及后台 `worker` 映射与配色、对话 `.db` 缺失模型名回填、旧版归档按总量守恒重新归类清洗，以及 Windows 下 WSL 发行版用量采集。
  - **累计总量改版、混合对数刻度与 ELV-91 速度评分**：统一混合对数-幂律图表刻度（年度气泡 >1B 封顶 58px 并带发光外环），全新「累计总量」摘要卡片与比例时间带、缓存读取占比统计、按轮次可折叠请求时间线与 `elv91-v1` 速度体验评分（S/A/B/C/D）。
  - **多语言货币汇率、自研日期选择器与守护模式**：全面完善 `zh-CN` / `zh-TW` / `en` 三语言键完整性与日期选择器，CLI 新增 `node cli.js watch` / `stop-watch` 免改盘守护模式与 `runtime-check.js`，完善 Apple Silicon (`arm64`) Mach-O `fixed` / `dynamic` / `default` 上下文解锁与增强适配。
- **Antigravity `2.33+` Daemon 直连与 Aux Pane Sidecar 增强**：
  - `local-api.js` 与 `cli.js` 在无 `DevToolsActivePort` 时新增对 Antigravity `2.33+` **`~/.gemini/antigravity/daemon/hub_*.json`**（优先探测活跃 PID 与 `httpsPort`，回退 `httpPort` 与 `main.log`）的自动发现与本地直连；
  - `sidecars/live-loader/ui-server.js` 同步适配 `v0.8.8` 上下文解锁字段（`configuredMode` / `configuredLimitTokens`），在右侧 Aux Pane Sidecar（`sidecar://antigravity-context-viewer/live-loader/`）准确展示当前解锁模式与实时 `elv91-v1` 评分、配额及历史 Token；
  - 严格保持所有提示词/标题改写选项（`promptTier: null`、`chineseTitle: null`、`#chk-rec-prompt` / `#chk-rec-title`）**默认关闭**，并完整保留双圆环克制顶栏、紧致上下文胶囊、CLI 默认隐藏开关及中文热注入开关。

---

## v0.8.7-2

适配 **Google Antigravity `2.33+`** 默认关闭 `DevToolsActivePort` 导致的失效问题，并修复 `0.8.7-1` 回归缺陷：

- **新增原生 Aux Pane Sidecar 看板（免 CDP / 免改盘）**：
  - `sidecars/live-loader/sidecar.json` 开启 `has_web_ui: true`（`SIDECAR_UI_ENTRYPOINT_AUX_PANE`），由 `sidecar-live.js` 在检测到 `ANTIGRAVITY_SIDECAR_WEB_PORT` 时自动启动 `sidecars/live-loader/ui-server.js`（基于 `sidecar_sdk`）；
  - 直接在右侧 Aux Pane（`sidecar://antigravity-context-viewer/live-loader/`）提供 **会话上下文、配额监控、历史 Token 统计、环境诊断与设置** 四个页签，并附带 `2.33+` 顶栏恢复指引与一键复制命令。
- **免 CDP 直连宿主 Language Server 与 2.33 选择器兼容**：
  - `local-api.js` 在无 `DevToolsActivePort` 时自动从 `Antigravity/logs/main.log` 尾部探测仍在监听的本地 LS 端口与 CSRF Token；
  - `cli.js` 区分「未开启 CDP 的运行中客户端 (`cdp_disabled`)」与「未运行 (`client_not_running`)」，新增 `node cli.js launch [--port N] [--restart]` 优雅重启开启调试端口恢复顶栏热注入；
  - `sidecar-live.js` 修复相对路径 `../../sidecar-live.js` 校验误报，并在 `cdp_disabled` 时安静待命与清理过期桥接；
  - `src/renderer/main.js` 新增 2.33 Aux Pane 展开态选择器（`[data-aux-pane-open="true"]` / `[data-side-panel-open="true"]` / `[data-testid="toggle-aux-sidebar"][aria-expanded="true"]`），`meter-main.js` 跳过 `utils.isAuxWindow(win)` 辅窗；
  - `meter-context-unlock.js` 修复 macOS/Unix 下调用 GNU `ps -o etimes=` 报错及未回填进程路径，解决重启后状态持续误报 `patched_runtime_unconfirmed`（状态未确认）的问题；
  - 修复 `meter-collector.js` `collect()` 中残留 `cachedHostUserStatus` 导致的 `ReferenceError`。

---

## v0.8.7-1

基于上游 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer) `v0.8.7`（含 `v0.8.6`）完成合并升级：

- **上游 `v0.8.6` ~ `v0.8.7` 核心更新同步**：
  - **热加载全链路升级（`v0.8.7`）**：新增 `tryHotInjectDetailed`、`callBackendWithPriority`、`/runtime-info`、`/shutdown` 与应用内无痛热更新，支持保留未保存设置草稿、面板/抽屉展开态和滚动位置；多窗口原点隔离、跨屏混合 DPI 像素网格防发虚对齐（`snapToDevicePixel`）、回环请求绕过代理、`Worker` 空闲 `unref` 及下载限时重试诊断。
  - **套餐与权限校准（`v0.8.6`）**：原生集成 `teamsTier` 透传与 `buildAllowedTierMatchSet` 套餐匹配、装饰标签（`New`/`Beta` 等）剥离、账户切换隔离与待重启/缺桥接提示横幅。
  - **构建防截断守卫**：`scripts/build-renderer.js` 新增 `truncated for diff preview` 源码防误写检测与动态 `PROJECT_VERSION` 读取。
- **提示词改写相关配置严格默认关闭**：
  - 「一键推荐配置」中「系统提示词 4 档（极简防幻觉）」(`#chk-rec-prompt`) 与「自动中文会话标题」(`#chk-rec-title`) 均设为**默认不勾选**，`DEFAULT_CONFIG.modules.enhance` 与初始化状态保持 `promptTier: null` / `0`、`chineseTitle: null` / `false`，除非用户手动启用。
- **保留全部本仓改版特性**：
  - Google AI Ultra `5x` (`g1-ultra-lite-tier`, `$99.99/月`) / `20x` (`g1-ultra-tier`, `$199.99/月`) 自动子档识别、缓存自动升级及动态人民币折算；
  - 顶栏双圆环克制设计语言统一（`○ 22% · 5h` 与 `○ 261K · 33%`）及多插件顶栏共存自适应探测；
  - 原生 Sidecar CDP 自动挂载（`sidecars/live-loader`）、CLI 按钮默认隐藏开关、免改盘中文热注入（`/sidecar-chinese-toggle`）及 macOS `arm64` Mach-O (`tbnz_nop` + `codesign`) 上下文解锁。

### 上游 `v0.8.7` / `v0.8.6` 更新摘要
- `v0.8.7`：优化插件热加载与旧后台清理、热加载状态与滚动位置保留、减少不必要重启提示并补充重启入口、更新下载有限重试诊断、改善不同缩放比例下的文字清晰度。
- `v0.8.6`：修复部分 Ultra 账号有可用额度却显示无权限、保留模型实际访问限制、修复 `New` 标签覆盖真实不可用原因、完善账号切换缓存隔离。

---

## v0.8.5-3

- **支持自动识别 Google AI Ultra `5x` / `20x` 子档与对应参考定价**：
  - `parseUserPlanStatus` 通过 `userTier.id` 与描述字段精准识别 **`Google AI Ultra (5x)`**（`g1-ultra-lite-tier`，美区公开参考价 `$99.99/月`）与 **`Google AI Ultra (20x)`**（`g1-ultra-tier`，美区公开参考价 `$199.99/月`），同时保留无 `id` 时回退 `（子档未知）`。
  - `resolveEffectivePlanStatus` 与 `computeEffectiveQuotaView` 自动将本地旧缓存中的 `Google AI Ultra（子档未知）` 升级为对应 `5x` / `20x` 子档名与费率。
  - 修复 `renderPlanDetail` 中非 Pro 套餐公开参考价旁硬编码 `(≈ ¥134.3 CNY)` 的问题，改为按 `officialPriceMonthly * exchangeRateToCNY` 动态计算人民币折算。
- **统一顶栏双圆环视觉语言并增强多插件顶栏共存兼容**：
  - 纯 CSS 层将 `#badge-quota` 收敛为本仓克制原生风格（`○ 22% · 5h` 与 `○ 261K · 33%` 同款 `12px/500`、正常态银灰圆环与 `· ` 分隔副文、仅低额度/耗尽/无权限时亮起语义状态色），同时完全保留 `#quota-badge-tag` DOM 与 `textContent === '5h'` 以兼容上游后续同步。
  - 优化 `compact` 紧凑态与 `measureAvailableWidth` / `flushHostDomMutationCheck` 对右上角多插件按钮宽度的实时探测，确保与其他 Antigravity 插件共存不重叠。

---

## v0.8.5-2

基于上游 `v0.8.5`（对应本仓 `v0.8.5-1`）修复 Google AI Ultra / Plus 订阅用户模型额度误判问题：

- **修复 Google AI Ultra 订阅用户全模型误判「无权限 / 权限不足」**：
  - `parseUserPlanStatus` 补齐 `planInfo.teamsTier` 字段透传；
  - 重构 `classifyModelQuotaAvailability` 中的 `allowedTiers` 校验，支持套餐等级向下兼容（`Ultra > Pro > Plus > Free`、`Enterprise > Teams > Pro > Plus > Free`）、`TEAMS_TIER_*` / 对象条目解析并安全跳过未知枚举数字；当模型未被服务端明确禁用且已返回真实 `remainingFraction` 时，不再误触发 `tierBlocked`。
- **修复 `New` / `Beta` / `Preview` 装饰角标被误渲染为无权限原因或 Notice 文案**：
  - 在 `classifyModelQuotaAvailability`、`sanitizeCascadeModelConfig` 与渲染层产品聚合中过滤纯装饰标签，避免 `tagTitle: "New"` 出现在额度异常提示框中。
- **增强 Sidecar 热加载与旧主进程兼容**：
  - 渲染层 `computeEffectiveQuotaView` 在持有 `cascadeModelConfigs` 时自动纠偏旧主进程/桥接缓存返回的误判 `noPermission` 快照；
  - `sidecar-live.js` 检测到磁盘 bundle 更新后自动关闭并重载托管本地桥接（清除模块缓存），确保运行中窗口热更新后立即恢复真实额度百分比展示。

---

## v0.8.5-1

基于上游 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer) `v0.8.5` 完成合并升级（采用 `<上游版本>-<修订号>` 规则：`v0.8.5-1`）：

- **上游 `v0.8.3` ~ `v0.8.5` 全量功能与修复同步**：
  - 顶栏新增**模型剩余配额圆环**（5h / 周额度双窗口、共享额度池、低额度提醒与约剩余 Token 估算）。
  - 新增**分模型上下文预算设置**（官方默认 / 固定 `256K`·`512K`·`900K`·`983K`·`1M`·自定义整数 / 动态跟随模型），支持状态区分与 `agy` CLI 联动。
  - 新增**系统增强中心**（0~4 档系统提示词精简、防幻觉约束、自动中文标题、三态品牌显示、面板简/繁/英三语言切换）。
  - 同步 Gemini 4 Hydrogen 四档模型费率、后台 Worker 账本并发锁定、`v0.8.5` 配置损坏 fail-closed、SOCKS5/HTTP 代理更新与原位安全卸载。
- **保留并适配本仓改版增强特性**：
  - 原生插件化与 `sidecars/live-loader` 免改盘 CDP 自动挂载、`live-host.js` 托管桥接与 Sidecar 中文界面热注入自愈。
  - macOS `arm64` Mach-O (`tbnz_nop`) 上下文解锁与保留 entitlements 的 `codesign` 重签名支持。
  - 顶栏上下文胶囊紧致长度+比例显示、CLI 按钮默认隐藏开关、`parseSemver` 修订后缀 `-N` 兼容与跨平台单测修复（331 项 Node 单测与 9 项 Python 测试全部通过）。

---

# v0.8.5

本次主要修复配置保存. 更新下载. 卸载恢复和稳定性问题.

- 修复配置文件损坏后可能意外重新开启代理或汉化的问题. 自动保留损坏配置备份.
- 修复代理绕过列表清空后保存不正确或重启恢复旧值的问题.
- 统一代理地址检查. 支持省略默认端口.
- 更新下载支持 HTTP 和 SOCKS5 代理. 完善下载完整性校验和失败提示.
- 完善备份缺失或客户端升级后的安全卸载. 保留客户端其他文件和修改.
- 修复切换语言后再切回时仍提示重启的问题.
- 修复隐藏品牌标题后无法立即恢复的问题.
- 完善后台任务异常处理. 避免任务卡住后无法继续.
- 修复多个进程同时记录用量时可能丢失记录的问题.
- 修复 Windows 中文或空格路径下的终端启动问题. 减少更新解压时的窗口闪烁.
---

# v0.9.2（上游同期参考）

[English](#english)

### 性能与应用内更新

- 更新包解压在后台子进程执行，校验仍使用官方 SHA-256。桌面应用内更新写入磁盘后提示重启，避免当前窗口同时换渲染器和后台服务。
- 隐藏的历史子页等打开后再绘制，后台降低历史轮询和空闲会话扫描频率。历史更新按账号核对，避免用当前缓存覆盖切换后的账号。
- 宿主更新移除插件后，更新检查按磁盘实际状态识别旧安装记录。

### 首次安装

- 核心看板可从顶栏打开。汉化、中文标题、上下文解锁、压缩恢复、免 TUN、三个径向入口、输入框底栏、回复尾部统计和自动检查更新默认关闭。提示词增强默认 0 档。可在配置页按需手动启用。
- 首装不会挂载宿主汉化运行时。已有统一配置中的手动选择会随升级保留。
- 实时请求列表恢复 Antigravity 原版彩色图标。

感谢 [@ltppp](https://github.com/ltppp)、[@tihonovaaybeniz-code](https://github.com/tihonovaaybeniz-code)、[@Nymph-Beta](https://github.com/Nymph-Beta)、[@lllhhhh](https://github.com/lllhhhh) 和 [@Staaaying](https://github.com/Staaaying)。贡献来源和采纳范围见 [Contributors](https://github.com/elviscjn-cjn/antigravity-context-viewer/blob/v0.9.2/CONTRIBUTORS.md)。

Antigravity 界面汉化基于 Antigravity-Chinese-Localization，感谢 aabbWei 与 antigravity-cn-community 贡献者。

## English

- Update extraction runs in a child process. The desktop updater writes the verified package to disk and asks for a restart before loading the new version.
- Hidden history views render on demand. Idle sessions poll less often. History revisions are checked against the account, and stale installation records are ignored when the patch is missing.
- Optional modules and display extensions start off on first install. Host translation requires manual opt-in. Prompt enhancement starts at level 0. Explicit existing settings are preserved.
- Restored the original Antigravity icon in Live Requests.
