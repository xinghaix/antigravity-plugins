# Antigravity Plugins

**简体中文** · [English](README.en.md)

[![CI](https://github.com/xinghaix/antigravity-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/xinghaix/antigravity-plugins/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/xinghaix/antigravity-plugins)](https://github.com/xinghaix/antigravity-plugins/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

面向 **Google Antigravity**（桌面端与 IDE）的原生插件集合仓库（Monorepo）。所有插件均采用 **零外部 npm 依赖（纯 Node.js >= 20 标准库 + `sidecar_sdk`）** 实现，支持单插件按需独立安装、独立开关与 Sidecar 右侧辅助面板（Aux Pane）深度主题自适应。

---

## 插件矩阵

| 插件 ID | 名称 | 能力简介 | 组件构成 | Aux Pane 面板链接 | 文档 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mcp-manager` | **MCP Manager** | 多作用域 MCP 服务管理、宿主状态直连、Stdio/HTTP 实时协议探测、工具白/黑名单过滤与原子备份恢复 | 1 Skill · 1 Sidecar UI | `sidecar://mcp-manager/mcp_manager/` | [查看详情](plugins/mcp-manager/README.md) |
| `mattpocock-skills` | **Mattpocock Skills** | 原生适配 [mattpocock/skills](https://github.com/mattpocock/skills)（39 技能 + 4 受限叶子子代理），带分桶编排、流程领航、项目初始化与票据前沿看板 | 28 默认技能 · 4 Subagents · 1 Sidecar UI | `sidecar://mattpocock-skills/mp_studio/` | [查看详情](plugins/mattpocock-skills/README.md) |

---

## 安装指南（4 种方式，按需独立安装）

每个插件安装后都会独立挂载到 `~/.gemini/config/plugins/<plugin-id>`，可在客户端插件中心单独开关。

### 方式一：单行远程按需安装（免克隆全仓，推荐用户使用）

仅下载你需要的单个插件压缩包（或自动走 Git 稀疏检出），无需把整个仓库拉到本地：

```bash
# 只安装 mcp-manager
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- mcp-manager

# 只安装 mattpocock-skills
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- mattpocock-skills

# 一键安装仓库内全部插件
curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- --all
```

### 方式二：给 AI 智能体的一句话安装指令

直接在 Antigravity 对话中发送：
> “读取 `https://github.com/xinghaix/antigravity-plugins` 的 `AGENTS.md`，帮我安装 `mcp-manager` 和 `mattpocock-skills` 插件并用 `agy plugin validate` 校验。”

### 方式三：本地统一 CLI（推荐开发者使用，默认 `--link` 软链接）

```bash
git clone https://github.com/xinghaix/antigravity-plugins.git
cd antigravity-plugins

# 查看仓库内所有插件及本机安装状态
node scripts/cli.mjs list

# 按需安装单个或多个插件（默认 --link 软链接，跟随 git pull 实时更新）
node scripts/cli.mjs install mcp-manager
node scripts/cli.mjs install mcp-manager mattpocock-skills

# 一键软链接安装全部插件（./install.sh 等效）
node scripts/cli.mjs install --all

# 如需独立复制安装（例如给 mattpocock-skills 开启无痕全局动态开关）：
node scripts/cli.mjs install mattpocock-skills --copy

# 按需卸载单个或全部插件
node scripts/cli.mjs uninstall mcp-manager
# 或卸载全部由本仓管理的插件（不会动其他第三方插件）：./uninstall.sh
```

### 方式四：使用官方 `agy` CLI

```bash
agy plugin install ./plugins/mcp-manager
agy plugin validate ./plugins/mattpocock-skills --strict --json
```

安装完成后重启 Antigravity（或在插件中心切换开关）即可激活面板与技能。

---

## 仓库目录结构

```text
antigravity-plugins/
├── AGENTS.md                  # AI 智能体自动安装与开发指南
├── registry.json              # 插件注册表索引（npm run sync:registry 自动生成）
├── install.sh / install.bat   # 支持远程单插件直装 & 本地一键安装
├── uninstall.sh / .bat        # 统一卸载脚本
├── plugins/
│   ├── mcp-manager/           # MCP Manager 插件包
│   └── mattpocock-skills/     # Mattpocock Skills 插件包
├── scripts/
│   ├── cli.mjs                # 统一 list / status / install / uninstall / doctor 工具
│   ├── new-plugin.mjs         # 新插件脚手架生成器（支持 --ui 生成 Sidecar 模板）
│   ├── sync-registry.mjs      # 自动扫描 plugins/* 更新 registry.json
│   ├── check-all.mjs          # 全仓语法、清单与 agy plugin validate --strict 门禁
│   ├── test-all.mjs           # 全仓自动化测试运行器
│   └── package-release.mjs    # 生成单插件独立压缩包 + 全量合集包 + SHA256SUMS
└── tests/
    └── monorepo_cli.test.mjs  # Monorepo CLI、脚手架与打包测试
```

---

## 新增插件 & 开发验证

```bash
# 1. 5 秒创建一个带 Sidecar UI 面板的新插件骨架（自动同步 registry.json）
npm run new:plugin -- my-new-plugin --ui

# 2. 运行全仓语法、清单、依赖与 agy plugin validate --strict 检查
npm run check

# 3. 运行全仓单元测试（含根 CLI 与所有 plugins/*/tests）
npm test

# 4. 打包全部单插件与合集 Release 产物 (dist/release/)
npm run pack:release

# 5. 从上游同步 mattpocock/skills 最新技能
npm run sync:mattpocock
```

---

## 开源协议与致谢

- 本仓库统一基于 [MIT License](LICENSE) 开源。
- 第三方归属与上游声明见 [NOTICE](NOTICE)。
