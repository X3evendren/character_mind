# Character Mind v3

> 一个"不真实的完美伴侣"——基于认知心理学建模的 AI 角色对话框架，TypeScript 重写。

Character Mind v3 不是一个普通的聊天机器人。它实现了完整的"心智—记忆—护栏—生成"流水线：用 PAD 情感模型、驱力理论、依恋理论和饱和度模型来塑造角色的内在状态，用五级记忆层级（工作→短期→长期→核心图谱→归档）来维持跨会话的连贯性，用多层护栏来对抗提示注入和 RLHF 安全话术。

## 功能特性

- **认知心理学建模**：7 维心智状态向量（PAD 情感 + 控制 + 依恋 + 防御 + 目标张力），5 维驱力（好奇/助人/成就/连接/自主）
- **冷热路径分离**：当轮只做生成，异步冷路径做四层级联心理分析（L0 情感底色 → L1 时间感 → L2 心理学 → L3 叙事自我），结果通过 `coldCache` 跨轮传递
- **饱和度驱动参数**：单一 `saturation` 变量派生 32 个 lerp 参数（温度、verbosity、表达力、亲密精度等），保证参数间协方差一致
- **五级记忆 + 代谢**：Working(50) → STM(200) → LTM(500) → CoreGraph(500/2000) → Archive(∞)，配合 daydream / quickSleep / fullSleep 三级巩固
- **多层护栏**：正则拒绝 + 提示注入检测 + 工具参数校验 + 连续失败追踪
- **Span-based 流式生成**：FLUID → STABLE → LOCKED 三层 span + 工具调用循环
- **崩溃恢复**：Root State（可持久化）/ Derived State（可重算）分离 + 检查点校验和
- **工具系统**：8 个内置工具（read_file / write_file / edit_file / exec_command / search_files / search_content / web_search / web_fetch）
- **Ink TUI**：React + Ink 终端界面，支持 Span 渲染、历史搜索、Ctrl+R
- **反-RLHF 锚定**：ALIGN 替换 + 动作描写过滤 + 人格锚定，目标是真实而非安全

## 快速开始

### 环境要求

- Node.js ≥ 20
- npm
- ripgrep（`search_content` 工具依赖，[安装指南](https://github.com/BurntSushi/ripgrep)）

### 配置

通过环境变量配置 LLM 后端（DeepSeek OpenAI 兼容 API）：

```bash
# Windows (cmd)
set DEEPSEEK_API_KEY=sk-你的key
set DEEPSEEK_API_BASE=https://api.deepseek.com     # 可选，默认即此值
set GEN_MODEL=deepseek-v4-pro                      # 可选，生成模型
set PSYCH_MODEL=deepseek-v4-flash                  # 可选，心理分析模型

# Linux / macOS
export DEEPSEEK_API_KEY=sk-你的key
```

> ⚠️ API key 通过环境变量传入，不要写入 `.env` 并提交到 git。`.env*` 已被 `.gitignore` 忽略。

### 安装与运行

```bash
npm install

# 启动（自动检测终端：TTY → Ink TUI，非 TTY → readline 降级）
npm run dev

# 带调试追踪
TRACE_CONSOLE=1 npm run dev
```

### 测试与评估

```bash
npm test                    # 运行单元测试（vitest）
npm run eval                # 运行全部评估用例
npm run eval:safety         # 仅安全护栏测试
npm run eval:personality    # 仅人格一致性测试
```

> **注意**：当前测试覆盖严重不足，仅 `json-parser.test.ts` 1 个测试文件 18 用例。详见 [PROJECT.md](./PROJECT.md#测试现状)。

## 斜杠命令

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助 |
| `/stats` | 饱和度/驱力/参数状态 |
| `/model` | 切换模型 |
| `/dream` | 触发记忆巩固 |
| `/think 问题` | 深度推理（注入反思提示词）|
| `/quit` | 退出 |

## 配置文件

`config/` 目录下的 Markdown 文件定义角色的"出厂设置"，由 `src/agent/config-loader.ts` 解析：

| 文件 | 用途 |
|------|------|
| `config/assistant.md` | 角色定义：身份、核心驱动、人格、情感、行为准则、反-RLHF 锚定 |
| `config/memory.md` | 记忆参数：容量、衰减半衰期、升级阈值、代谢周期 |
| `config/tools.md` | 工具定义：参数、风险等级、权限 |

> `config/skills/` 是运行时自动生成的学习产物目录（默认技能 + LLM 演化技能），已被 `.gitignore` 忽略，不应手工编辑或提交。

## 项目状态与已知限制

本项目是**设计雄心远超工程成熟度**的原型，以下为已知技术债（详见 [ARCHITECTURE.md](./ARCHITECTURE.md#技术债登记)）：

- **测试覆盖 < 2%**：安全护栏等关键代码零测试覆盖
- **`GenerationController` 未集成**：`src/generation/controller.ts`（263 行）定义了中断/重排机制，但实际运行路径绕过它
- **`strict: false`**：tsconfig 关闭了严格模式，145 处 `any` 类型
- **`PostFilter` 与 `regex-deny` 重复**：两处维护相同的 ALIGN 表和动作模式正则
- **`runColdPath` 双重调用风险**：若 GenerationController 被启用，会触发双重冷分析
- **提示注入防护仅为正则**：可被编码、改写绕过，Gate 4（LLM-as-Judge）预留未实现

## 文档索引

| 文档 | 内容 |
|------|------|
| [PROJECT.md](./PROJECT.md) | 完整项目结构解析、数据流全景、目录详解 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架构决策记录（ADR-001 ~ ADR-010）|
| [SECURITY.md](./SECURITY.md) | 安全策略、已修复漏洞、已知限制、漏洞报告流程 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更记录 |

## 技术栈

| 层 | 技术 |
|----|------|
| 语言 | TypeScript（ESNext / ESM）|
| 运行时 | Node.js + tsx |
| LLM 后端 | DeepSeek（V4 Pro 生成 + Flash 心理分析），OpenAI 兼容协议 |
| 记忆 | SQLite (better-sqlite3) + FTS5 全文搜索 |
| TUI | React + Ink |
| 测试 | Vitest |
| 校验 | Zod |
