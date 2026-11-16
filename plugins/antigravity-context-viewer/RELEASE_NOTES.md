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
