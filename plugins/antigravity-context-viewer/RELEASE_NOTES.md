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
