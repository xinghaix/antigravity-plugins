# Antigravity 对话上下文查看器与 Token 用量看板（改版增强版 `v0.9.3-1`）

**简体中文** · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

> **上游与版本说明**：本插件基于开源上游仓库 [`elviscjn-cjn/antigravity-context-viewer`](https://github.com/elviscjn-cjn/antigravity-context-viewer)（MIT License，当前同步基线 **`v0.9.3`**）进行二次改版与增强，版本号采用 `<上游版本>-<插件修订号>` 规则（如 **`v0.9.3-1`**）：
> 1. **原生 Aux Pane Sidecar UI + Daemon / CDP 双模适配（兼容 Antigravity `2.33+` / `2.34+` / `2.35.1+`）**（`sidecars/live-loader` + `sidecar-live.js` + `local-api.js`）：Antigravity `2.33+` ~ `2.35.1+` 默认关闭 `DevToolsActivePort`，且 macOS 启用了 `ElectronAsarIntegrity` 签名完整性校验。插件自动通过 `authBootstrap`、`ANTIGRAVITY_LS_ADDRESS`、`~/.gemini/antigravity/daemon/hub_*.json` 与 `main.log` 免改盘直连本地 Language Server，在原生侧边栏 `sidecar://antigravity-context-viewer/live-loader/` 展示实时上下文用量、生成速度、配额、历史 Token 与解锁诊断（并通过独立子进程扫描与磁盘签名缓存控制 Sidecar 常驻内存）；同时完整保留 CDP 自动热注入、`node cli.js watch` 免改盘守护模式、`node cli.js launch --restart` 与显式 `--force-mac-asar` 支持。
> 2. **渲染器界面、原生设置页与状态同步增强**（`src/renderer/*`、`meter-renderer.js`、`install.js`、`live-host.js`）：完整同步上游 `v0.9.3` Antigravity `2.35.1` 原生设置侧栏同级独立页、统一下拉与候选开关视觉、顶层原生重启弹窗、复用原生模型菜单与可选下一句预测建议（默认关闭）、四项收敛自动切号与提示去重，以及 `v0.9.0`–`v0.9.2` 4 行响应式 Bento/Skyline 工作台、Gemini 4 Neon 统一配额池；同时完整保留本仓顶栏胶囊紧致上下文长度+比例双显示、克制双圆环风格、默认隐藏 CLI 启动按钮、免改盘中文热注入自愈、防卡滞错误自愈与底栏最后 1 步纯吐字速度（提示词与标题改写默认严格关闭）。
> 3. **多平台上下文加长解锁、完整性预检与 CLI 增强**（`meter-context-unlock.js`、`host-recovery.js`、`macos-binary-utils.js`、`cli.js`）：支持 macOS `ElectronAsarIntegrity` 写前预检与 Apple Silicon (`arm64`) Mach-O `fixed` / `dynamic` / `default` + `codesign` 上下文解锁、`watch` / `stop-watch` 与独立 `sidecar:*` 生命周期管理。

在 Google Antigravity 2.x 顶栏查看当前对话用了多少上下文、模型生成有多快、当前模型剩余配额，以及桌面端和 CLI 一共用了多少 Token。

## 安装（通过 `antigravity-plugins` 原生插件）

### 方式一：单行远程安装（免克隆全仓）
```bash
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- antigravity-context-viewer
```

### 方式二：Monorepo 本地软链接安装（默认 `--link`）
```bash
git clone https://github.com/xinghaix/antigravity-plugins.git
cd antigravity-plugins
node scripts/cli.mjs install antigravity-context-viewer
```

安装完成后重启 Antigravity（或在插件中心启用 `antigravity-context-viewer`），`live-loader` Sidecar 会在后台自动完成 CDP 热注入；如需传统 `app.asar` 持久化补丁、代理直连、系统增强或后端上下文解锁，仍可在插件目录内使用 `node cli.js install` / `node cli.js unlock` / `node cli.js enhance`。

## 功能

- **当前会话交互式 Bento 工作台与上下文监控**：升级「当前会话」分页为 4 行响应式 Bento 工作台（`wide` / `medium` / `narrow` 三档容器自适应），区分单次上下文已用与累计 Token、9 维上下文构成与估算/残差、TTFT 与并发墙钟耗时环形图、上下文事件/文件/命令/子 Agent 活动以及总量/Δ/按步/按轮趋势联动。
- **模型额度与列表联动**：顶栏圆环展示剩余额度，展开查看共享额度池（含 Antigravity 2.33+ / 2.34+ 统一 Gemini 配额池与 Gemini 4 Neon）、5 小时及每周额度、重置倒计时与低额度提醒，并在设置上下文时直接查看各模型余量。
- **Token 历史与 API 参考费用**：汇总本地可读取的桌面端、CLI 与 WSL 用量，提供日历热力图、周/月/年/累计视图、多账号对比及地区参考价/人民币折算（估算仅供参考，不代表实际账单）。
- **模型设置与上下文调整**：按模型产品管理上下文偏好（官方默认 / 固定档位 / 动态跟随），区分“按模型保存的偏好”与“宿主共用上限”，支持桌面端与 `agy` CLI 联动改写与备份还原（说明：模型选择器仅查看配置，**不代为切换聊天模型**）。
- **系统增强中心**：提供 0~4 档系统提示词精简、自动中文会话标题、客户端简体中文/英文切换、三态品牌显示及免 TUN 本地代理配置（需可用本地代理），正常安装默认不启用提示词与标题改写。
- **外观、CLI 与更新**：顶栏随空间自动收敛，支持深浅主题、热力图预设、逐档配色与面板繁/简/英三语言，可按需开启顶栏 CLI 启动按钮，并在面板内检查更新（支持 beta 通道开关）。

### Antigravity `2.34.0` 与 macOS 完整性边界

- **`2.34.0` 窗口加载锚点 (`loadHubWindowUrl`) 与鉴权 (`authBootstrap`)**：已同步适配并集成进无 CDP 直连、Sidecar UI 与安装包升级恢复流程（`host-recovery.js`）。
- **macOS `ElectronAsarIntegrity` 与免改盘模式**：macOS 签名版 `Antigravity.app` (`2.34.0`) 启用了 `Info.plist` 中的 `ElectronAsarIntegrity` 校验与 Hardened Runtime。直接修改磁盘 `app.asar` 可能导致启动完整性校验失败或破坏原有权限；因此 `node cli.js check` 会先预检完整性，`node cli.js install` 默认拦截受保护的 macOS 包，建议直接使用**原生 Sidecar 面板（`sidecar://antigravity-context-viewer/live-loader/`）**或免改盘 **`node cli.js watch`**（`open -a Antigravity --args --remote-debugging-port=58321`），仅自签场景可通过 `--force-mac-asar` 显式覆盖。

## 界面语言

- **插件面板三语言**：面板内置 **简体中文**、**繁體中文**、**English** 即时切换与持久保存，覆盖全部页签、图表、价格账单与系统增强页（`src/renderer/i18n.js`）。
- **客户端语言与授权说明**：桌面端界面语言支持切换 **简体中文** 或 **英文原版**. Antigravity 界面汉化基于 [Antigravity-Chinese-Localization](https://github.com/antigravity-cn-community/Antigravity-Chinese-Localization)（采用本地工具包 Release `v2.34.0`）, 感谢 aabbWei 与 antigravity-cn-community 贡献者. 完整 MIT 许可证与版权声明见随包附带的 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). 因外部繁体词典仓库 `qqxpee/antigravity2-cn` 未声明开源许可证, 本版本未内置客户端繁體词典, 繁體中文选项仅作用于插件自身面板.

---

## 🤖 给 AI 智能体的一键安装指令 (For AI Agents)

如果在 Antigravity 插件环境下使用，AI 助手可直接读取本插件 [SKILL.md](skills/context-viewer/SKILL.md) 与 [README.md](README.md)；**注意：macOS `2.34.0` 启用了 `ElectronAsarIntegrity`，切勿直接对官方签名包运行 `node cli.js install` 改盘**（优先使用原生 Sidecar 看板或 `node cli.js watch` / `launch --restart`）。在允许改盘的环境升级主进程/预加载模块（如 `0.9.2-1`）后需完全重启客户端：

```bash
# 1. 持久化写入 ASAR 与全部插件模块
node cli.js install

# 2. 完全退出所有 Antigravity 窗口（含系统托盘图标中的“退出”）并重新打开

# 3. 重启后验证安装与模块运行状态
node cli.js status
```

> [!IMPORTANT] **AI 智能体执行与验证边界规范**：
> - **零外部依赖**：内置原生 Node.js ASAR 解包/封包引擎（[`asar-engine.js`](asar-engine.js)），无需执行 `npm install`。
> - **`node cli.js live` 验证范围说明**：CDP 免改盘热注入（以及安装器附带的热挂载）**仅能加载前端渲染层，用来检查 UI 排版与静态/渲染文案**；无法更新运行中进程的主进程钩子 (`meter-main.js`)、预加载桥接接口 (`preload`) 或新后台模块 (`meter-enhance.js`)，切勿把 `live` 热注入当作完整升级验收。
> - **严禁在对话内强杀宿主进程**：在 Antigravity 会话内执行时，切勿关闭或杀死 `Antigravity.exe`；持久化安装后需由用户手动完全退出并重启客户端后再核查 `status`。
> - **汉化与上下文边界**：安装器检查未修改文件的 SHA-256，以检测对其他补丁内容的意外修改。显示预算变更与补丁加载均不等于真实超长请求已被服务端通过。

---

## 🚀 快速开始 (Quick Start)

### 方式一：一键脚本（适合日常手动安装）

- **Windows**：
  - 安装 / 更新：双击运行 [`install.bat`](install.bat)
  - 卸载 / 还原：双击运行 [`uninstall.bat`](uninstall.bat)
- **macOS / Linux**：
  - 安装 / 更新：`./install.sh`
  - 卸载 / 还原：`./uninstall.sh`

### 方式二：CLI 命令行管理器

```bash
# 1. 环境健康预检（自动探测 Node、Antigravity 安装路径、CDP 端口与 Python）
node cli.js check

# 2. 一键安装（ASAR 持久化注入 + 当前运行窗口 CDP 即时热生效）
node cli.js install

# 3. 仅对当前运行窗口进行 CDP 免改盘热挂载（客户端未运行时支持自动带调试端口拉起；v2.33.0+ 已裸开时外置终端支持 --relaunch 优雅重开）
node cli.js live
node cli.js live --relaunch

# 3b. 免改盘后台守护模式（macOS 推荐，保留官方原始签名；随窗口刷新自动重挂，关闭后自动退出）
node cli.js watch
node cli.js stop-watch

# 4. 查看当前安装状态与实时会话上下文用量
node cli.js status

# 5. 一键无损还原安装前的原始 app.asar
node cli.js restore

# 6. 指定自定义客户端路径安装
node cli.js install --path "<path-to-app.asar>"

# 7. 查看 / 应用 / 还原系统增强（提示词档位、中文标题、客户端语言与品牌展示）
node cli.js enhance-status
node cli.js enhance --tier 3 --chinese-title on --brand-title english
node cli.js enhance-restore
```

---

## 🧪 自动化测试 (Testing)

```bash
npm test
```

测试覆盖 Token 去重、服务端超限、会话切换、存储失败、代理配置、订阅设置与渲染层状态. 附件扫描测试可单独运行 `python -m unittest attachment_scan_test.py`. 单测不替代宿主客户端中的安装与界面验证.

---

## 📁 仓库结构 (Repository Structure)

```text
antigravity-context-viewer/
├── assets/                                 # 界面实拍截图
│   ├── panel-context-main.png              # 实拍 1：会话上下文与生成监控主视图
│   ├── panel-context-audit-expanded.png    # 实拍 2：会话上下文全展开：外观调色与底层审计
│   ├── capsule-speed-and-tooltip.png       # 实拍 3：顶栏环形胶囊、实时速度与原生气泡提示
│   └── panel-token-heatmap-customizer.png  # 实拍 4：Token 用量总览与 5 档热力图逐格独立自定义
├── asar-engine.js                          # 零外部依赖的纯原生 Node.js ASAR 打包/解包引擎
├── cli.js                                  # 统一命令行接口 (install / live / status / check / restore / enhance*)
├── install.js                              # ASAR 注入与运行时热挂载调度器
├── restore.js                              # 原始备份校验与无损还原调度器
├── meter-main.js                           # Electron 主进程窗口钩子与只读 IPC 通道
├── meter-core.js                           # 上下文估算、Token 统计与分词引擎
├── meter-context-unlock.js                 # 桌面端/CLI 上下文长度模式改写与安全还原引擎
├── meter-enhance.js                        # 系统提示词 0~4 档、防幻觉与中文标题等长替换引擎
├── i18n/                                   # 客户端简体中文化词典与运行时 (zh-CN.json / i18n-runtime.js)
├── unlock/                                 # PR #3 跨平台解锁工具与文档 (language-server & agy-cli)
├── meter-renderer.js                       # 渲染层构建产物 (0.9.2-1)
├── src/renderer/                           # 渲染层源码
├── sidecars/live-loader/                   # Aux Pane 原生面板与自动热挂载 Sidecar
├── scripts/                                # 构建、发布打包与基准测试
├── meter-collector.js                      # 本地会话归档读取与附件提取收集器
├── attachment_scan.py                      # 全格式附件只读分析核心脚本 (Office / PDF / Code)
├── install.bat / install.sh                # 一键安装入口脚本
└── uninstall.bat / .sh                     # 一键卸载与还原入口脚本
```

---

## 🛡️ 安全说明与原生窗口辅助程序 (Security & Transparency)

- **用途说明**：Windows 发布包中的可选组件 `scripts/cli-window-helper.exe`（唯一源码 [scripts/cli-window-helper.cs](scripts/cli-window-helper.cs)）仅用于在从插件弹窗一键启动 `agy` CLI 时定位新控制台窗口、按当前工作区居中并激活前台焦点，不包含任何联网、持久化或后台驻留逻辑。
- **构建来源可追溯（Git 零预编译二进制）**：源码仓库已将预编译 `scripts/cli-window-helper.exe` 移出 Git 跟踪。发布产物中的二进制仅通过以下两种途径从 `scripts/cli-window-helper.cs` 现场构建并做 SHA-256 校验：
  1. GitHub Actions（`.github/workflows/release.yml`）在 `windows-latest` 运行器上使用 `.NET Framework 4.0` 现场编译并生成 `.sha256` 校验文件，跨作业校验一致后打入 Windows ZIP 包；
  2. 本地运行 `node scripts/package-release.js` 或从源码工作树执行 `node cli.js install` 时，直接调用本地 `csc.exe` 将源码编译到系统临时目录（不写入工作树、不使用残留 `.exe`）。
- **工具链与手动重编命令**：基于 Windows 自带 `.NET Framework 4.0` 编译，可随时自行审计源码并本地重编：
  ```powershell
  C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:exe /platform:anycpu /optimize+ /out:scripts\cli-window-helper.exe scripts\cli-window-helper.cs
  ```
- **常见安全软件检测说明**：由于该程序是约 15 KB 的未数字签名原生辅助二进制且调用了 `keybd_event`、`AttachThreadInput`、`AllowSetForegroundWindow`、`CreateToolhelp32Snapshot` 与 `Process.Start("cmd.exe")`，部分杀毒引擎可能报启发式可疑告警（注：CI 现场编译旨在确保构建来源可追溯，但**不代表所有杀软引擎一定会停止触发告警**）。
- **无需关闭杀软的可选降级**：如果您不希望保留任何 `.exe` 或其被安全软件拦截，无需关闭安全软件，也无需购买签名证书，可直接删除 `cli-window-helper.exe`（位于安装目录 `scripts/cli-window-helper.exe` 或 `%LOCALAPPDATA%\AntigravityContextMeter\cli-window-helper.exe`）。`meter-cli-launcher.js` 检测到 helper 缺失或失败时会自动降级为直接启动标准 Windows 控制台 `cmd.exe /d /k`，CLI 启动与对话能力完全正常（仅不再自动居中或强制置顶窗口）。

---

## 🤝 社区、贡献署名与支持 (Community & Acknowledgements)

- **[LINUX DO](https://linux.do/)**：本项目支持并认可 LINUX DO 社区，欢迎各位社区佬友交流探讨。
- **上下文解锁原方案**：感谢 **Linux.do @23375** 公布的上下文长度限制分析与修补思路（<https://linux.do/t/topic/3117832>）。
- **PR #3（多模式上下文解锁 & agy CLI 工具链）**：感谢 **[@anyu0804](https://github.com/anyu0804)** 贡献 `ORIG / CONST / DYN` 模式、实验覆盖门禁分析、`cli_serializer_max_ctx` 对齐及跨平台 `unlock/` 工具与文档。
- **PR #4（系统增强中心与防幻觉提示词）**：感谢 **[@Jia131313](https://github.com/Jia131313)** 贡献系统提示词 `0~4` 档位精简、防幻觉约束、中文会话标题、品牌展示与推荐配置体系。
- **PR #7 / #12（模型剩余配额圆环、双窗口与主题/Opt-in 保护）**：感谢 **[@Azreal2021](https://github.com/Azreal2021)** 与 **[@Andrew-liu](https://github.com/Andrew-liu)**。
- **PR #9（2.31+ 模型计价、共享池匹配与三源账本实时同步）**：感谢 **[@MoiraToki](https://github.com/MoiraToki)**。
- **PR #11（沙箱 Preload 汉化配置门禁安全读取）**：感谢 **[@yinshengphy](https://github.com/yinshengphy)**。
- **PR #13（弹窗动态锚点定位与展开防抖动）**：感谢 **[@nocoo](https://github.com/nocoo)**。
- **PR #14（macOS 兼容适配评估参考）**：感谢 **[@nokiy](https://github.com/nokiy)**。
- **Issue #17（`cli-window-helper` VirusTotal 检测溯源、文档透明度与 Windows CI 源码构建建议）**：感谢 **[@riandycandra](https://github.com/riandycandra)**。
- **PR #21（繁体中文面板译文精细优化）**：感谢 **[@U1tr0n-Lee](https://github.com/U1tr0n-Lee)**。
- **Issue #22（GitHub API 限流时官方 Atom/Web 更新回退方案）**：感谢 **[@zhao33079-zhao](https://github.com/zhao33079-zhao)**。
- **v0.9.0 代码合入贡献者**：感谢 **[@Tswatery](https://github.com/Tswatery)**（[PR #38](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/38) · [PR #53](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/53) · [PR #32](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/32)）、**[@Kisaragi-Mio-0127](https://github.com/Kisaragi-Mio-0127)**（[PR #47](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/47) · [Issue #46](https://github.com/elviscjn-cjn/antigravity-context-viewer/issues/46)）、**[@feizaodemon](https://github.com/feizaodemon)**（[PR #52](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/52) · [PR #72](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/72)）与 **[@yuanyang749](https://github.com/yuanyang749)**（[PR #57](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/57)）。
- **v0.9.0 采纳方案与兼容性贡献者**：感谢 **[@JYPYYy](https://github.com/JYPYYy)**（[PR #35](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/35) · [PR #36](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/36) · [PR #37](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/37)）、**[@Nymph-Beta](https://github.com/Nymph-Beta)**（[Issue #42](https://github.com/elviscjn-cjn/antigravity-context-viewer/issues/42) · [PR #43](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/43) · [PR #48](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/48) · [PR #71](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/71)）、**[@Staaaying](https://github.com/Staaaying)**（[PR #70](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/70) · [PR #74](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/74) · [PR #79](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/79)）、**[@paojiaoleshenghuo](https://github.com/paojiaoleshenghuo)**（[PR #27](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/27)）、**[@Fengsuid](https://github.com/Fengsuid)**（[PR #55](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/55)）、**[@1-pluto1](https://github.com/1-pluto1)**（[PR #60](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/60)）、**[@lllhhhh](https://github.com/lllhhhh)**（[PR #63](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/63)）、**[@unie774](https://github.com/unie774)**（[PR #64](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/64)）、**[@XiangZheng2283](https://github.com/XiangZheng2283)**（[Issue #75](https://github.com/elviscjn-cjn/antigravity-context-viewer/issues/75) · [PR #76](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/76)）、**[@BetterThanAny](https://github.com/BetterThanAny)**（[Issue #77](https://github.com/elviscjn-cjn/antigravity-context-viewer/issues/77)）、**[@jinyue806](https://github.com/jinyue806)**（[Issue #78](https://github.com/elviscjn-cjn/antigravity-context-viewer/issues/78)）、**[@Jeffgithub0029](https://github.com/Jeffgithub0029)**（[Issue #80](https://github.com/elviscjn-cjn/antigravity-context-viewer/issues/80)）、**[@x1051445024](https://github.com/x1051445024)**（[PR #61](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/61) · [Issue #50](https://github.com/elviscjn-cjn/antigravity-context-viewer/issues/50)）、**[@Hirasawa8](https://github.com/Hirasawa8)**（[PR #66](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/66)）、**[@shixin08052](https://github.com/shixin08052)**（[PR #67](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/67)）、**[@Xuhang0607](https://github.com/Xuhang0607)**（[PR #68](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/68)）、**[@Jemiking](https://github.com/Jemiking)**（[PR #69](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/69)）与 **[@awu5425](https://github.com/awu5425)**（[PR #73](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/73)），以及 **[@MoiraToki](https://github.com/MoiraToki)**（[PR #34](https://github.com/elviscjn-cjn/antigravity-context-viewer/pull/34)）。
- **客户端界面汉化上游**：Antigravity 界面汉化基于 [Antigravity-Chinese-Localization](https://github.com/antigravity-cn-community/Antigravity-Chinese-Localization)（Release `v2.34.0`）, 感谢 aabbWei 与 antigravity-cn-community 贡献者. 许可与版权声明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## 作者

上游原作者：[ELVISCHEN](https://github.com/elviscjn-cjn).
