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

# v0.9.0 beta1 (上游同期摘要)

**简体中文** · [English](#v090-beta1-en)

<details open>
<summary><b>简体中文</b></summary>

### 当前会话交互式分析页与宽屏多栏重构
- 升级「当前会话」分页为 4 行响应式 Bento 工作台 (`wide >=860px` / `medium 540~859px` / `narrow <540px` 三档容器自适应，支持右侧辅助栏停靠与顶部原位浮层双模式同源交互).
- 严格区分单次上下文已用与会话累计 Token、单步缓存读取与累计缓存、插件配置预算与宿主确认窗口上限; 拆分 9 维上下文构成并如实标注宿主实报、本地估算与未归类残差 (`unaccountedTokens`).
- 上下文趋势支持总量/增量 Δ、按步/按轮切换、键盘方向键切步、`Esc` 返回最新与固定历史步骤对比 (`比前一步` / `比前一轮`); 缺乏压缩/剪枝证据的突降标为「占用下降，原因未知」.
- 耗时统计增加多色环形图与并发墙钟 vs 累计任务时长对照; 宿主未导出思考/正文/工具参数独立时间戳时仅展示 TTFT、模型流式与工具执行三段并如实注明边界.
- 工作台下端接入上下文事件、文件活动、命令执行与基于可核实父子关系的子 Agent 汇总，默认对路径与令牌脱敏.

### 界面修正与自定义扩展避让
- 修复正常未固定状态下「当前会话」`#ctx-ov-pinned-banner` 与「配置 → 外观与停靠」`#dock-fallback-note` / `#dock-open-feedback` 因 `[hidden]` CSS 优先级缺失导致的细长蓝色空框残留，仅在实际存在提示文本时显示并在状态解除后完整收起.
- 修复进入「自定义扩展 / 插件市场 / 插件详情页」的面板与右侧辅助栏避让回归，并防止无输入框的已归档历史会话 (`/c/...`) 被侧栏导航与全局后退按钮误锁.
- 实时请求列表 `Antigravity` 行改用 `antigravity-color.svg` 静态矢量图标（分发许可待核实，见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 第 3.4 节）; 保留 Claude/OpenAI 图标与统计口径.

### 兼容性、安装安全与 CLI 助手收尾
- 新增 Antigravity `2.34.0` 加载锚点 (`loadHubWindowUrl`) 与同源 `authBootstrap` 鉴权兼容，以及宿主更新覆盖后的隔离备份恢复与 macOS `ElectronAsarIntegrity` 写前预检 (`host-recovery.js`).
- 收尾 GitHub Issue #17 Windows CLI 窗口助手: 将预编译 `scripts/cli-window-helper.exe` 移出 Git 跟踪，Windows 打包与安装改为临时目录从 `scripts/cli-window-helper.cs` 现场编译并校验 SHA-256，保留标准控制台 (`cmd.exe /d /k`) 无助手回退路径与 `@riandycandra` 署名.
- 宿主界面汉化升级: Antigravity 界面汉化基于 Antigravity-Chinese-Localization，感谢 aabbWei 与 antigravity-cn-community 贡献者. 上游仓库 `<https://github.com/antigravity-cn-community/Antigravity-Chinese-Localization>`, 采用本地工具包 Release `v2.34.0`, 完整 MIT 许可与第三方声明见随包 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
### 贡献者致谢

- @Tswatery 将上下文取消归类为中性中断. [PR #38](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/38)
- @Kisaragi-Mio-0127 修复推荐配置复选框与磁盘状态不同步的问题. [PR #47](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/47)
- @feizaodemon 添加 Gemini 4 Neon 识别并适配 Antigravity 2.33 的统一 Gemini 配额池. [PR #52](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/52)
- @Tswatery 修复浅色主题下紫色热力图与图例方向相反的问题. [PR #53](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/53)
- @yuanyang749 过滤内置浏览器中的第三方本地预览页，并改进多 origin 连接容错. [PR #57](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/57)

#### 挂载与兼容性相关贡献

- @x1051445024 提供 2.34.0 窗口加载锚点与空 HTML 场景的鉴权方案. [PR #61](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/61)
- @Hirasawa8 提供 2.34.0 安装与桌面额度恢复方案. [PR #66](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/66)
- @shixin08052 提供 2.34.0 窗口加载与 Hub 同源会话适配. [PR #67](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/67)
- @Xuhang0607 协助解决 2.34.0 桌面额度鉴权失败. [PR #68](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/68)
- @Jemiking 提供 2.34.0 窗口加载与 bootstrap CSRF 兼容方案. [PR #69](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/69)
- @awu5425 提供安装器对新版 loadHubWindowUrl 锚点的适配. [PR #73](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/73)
- @LC9999216 独立提交同一窗口加载与鉴权问题的修复方案，与本版采用的方案重叠. [PR #65](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/65)
- @Nymph-Beta 协助定位 macOS 未开启 CDP 时的 live / watch 挂载问题，本版部分采用. [PR #43](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/43)

### macOS 使用反馈

用 macOS 的朋友请多反馈这个版本的使用情况. 安装、升级或日常使用遇到问题，请附上 macOS 和 Antigravity 的版本，以及出现问题的操作. 运行正常也可以留个反馈，方便我确认不同机型和系统版本的兼容性.

</details>

<details id="v090-beta1-en">
<summary><b>English</b></summary>

### Interactive Session Analysis & Responsive Bento Layout
- Upgraded the Session view into a 4-row responsive Bento workbench (`wide >=860px` / `medium 540-859px` / `narrow <540px`) shared across both right-sidebar dock and topbar popover modes.
- Separated single-call context occupancy vs session cumulative tokens, per-step cache vs cumulative cache, and user configured budget vs host-confirmed context window limit. Split 9 composition categories while preserving actual reported totals, visible estimates, and unattributed residuals.
- Added total/delta and per-step/per-turn trend toggles, keyboard step navigation (`Left`/`Right` and `Esc`), pinned step comparison, and conservative `unknown_drop` classification when compaction evidence is absent.
- Added timing breakdown donut with concurrent wall-clock vs cumulative task duration while explicitly noting that independent thinking/body/tool-arg streaming sub-timestamps are not exported by Antigravity 2.34.0.
- Integrated context change events, file activity filters, command execution telemetry, and verified parent-child subagent summaries with redacted paths and secrets.

### UI Fixes & Customizations Avoidance
- Fixed lingering thin blue empty bars (`#ctx-ov-pinned-banner` and `#dock-fallback-note` / `#dock-open-feedback`) caused by `[hidden]` CSS specificity overrides. Banners now collapse completely when hidden or empty and appear only with active message text.
- Fixed Customizations / Marketplace / plugin detail panel avoidance and prevented archived `/c/...` conversation routes without a composer from being mislocked.
- Updated `Antigravity` rows in the Live Requests table to render `antigravity-color.svg` (redistribution license pending verification in `THIRD_PARTY_NOTICES.md` §3.4) while keeping existing source text, models, and other icons unchanged.

### Host Compatibility, Recovery & Issue #17 Helper Closure
- Added Antigravity `2.34.0` window loader anchor (`loadHubWindowUrl`), same-origin `authBootstrap` fallback, version-isolated ASAR backup/recovery (`host-recovery.js`), and macOS `ElectronAsarIntegrity` preflight guards.
- Removed tracked prebuilt `scripts/cli-window-helper.exe` from Git. Windows local packaging and installation now compile from `scripts/cli-window-helper.cs` in a temporary directory with SHA-256 verification and automatic fallback to standard console (`cmd.exe /d /k`), preserving attribution to `@riandycandra`.
- Client UI localization upstream: Antigravity UI localization is based on Antigravity-Chinese-Localization (`v2.34.0`), thanks to aabbWei and antigravity-cn-community contributors (MIT License; see `THIRD_PARTY_NOTICES.md`).
### Contributors

- @Tswatery classified context cancellations as neutral interruptions. [PR #38](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/38)
- @Kisaragi-Mio-0127 fixed recommended settings checkboxes to reflect the saved configuration. [PR #47](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/47)
- @feizaodemon added Gemini 4 Neon detection and support for the unified Gemini quota pool in Antigravity 2.33. [PR #52](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/52)
- @Tswatery corrected the light-theme heatmap colors to match the legend. [PR #53](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/53)
- @yuanyang749 filtered third-party local previews in the built-in browser and made connections more resilient across origins. [PR #57](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/57)

#### Attachment and compatibility contributions

- @x1051445024 Proposed fixes for the 2.34.0 window loader and authentication when the HTML contains no token. [PR #61](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/61)
- @Hirasawa8 Proposed 2.34.0 installation and desktop quota fixes. [PR #66](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/66)
- @shixin08052 Proposed 2.34.0 window loading and same-origin Hub session support. [PR #67](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/67)
- @Xuhang0607 Helped address 2.34.0 desktop quota authentication failures. [PR #68](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/68)
- @Jemiking Proposed 2.34.0 window loader and bootstrap CSRF compatibility fixes. [PR #69](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/69)
- @awu5425 Proposed installer support for the new loadHubWindowUrl anchor. [PR #73](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/73)
- @LC9999216 Independently submitted an overlapping fix for the same window loading and authentication issue. [PR #65](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/65)
- @Nymph-Beta Helped diagnose macOS live / watch attachment without CDP, with parts of the proposal adopted. [PR #43](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/43)

### macOS Feedback

If you use macOS, please tell me how this release works for you. If you run into problems installing, updating, or using it, include your macOS and Antigravity versions and what you were doing when the issue occurred. Reports that everything works also help me confirm compatibility across Macs and macOS versions.

</details>
