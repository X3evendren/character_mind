# 情绪与记忆重构 · 2026-10-23

- 将情绪体验、记忆共鸣、闪回样再体验、解离样疏离统一为可扩展现象推断；底层过程不再保存闪回／解离参数。
- 新增带依据的可选体验观察、现象强度与支持度、发生／减弱／消退生命周期和持久 episode ID；不再从低可控性直接推出解离。
- 图谱保存事件 → 评估 → 过程 → 现象及关系来源；压缩请求携带全部关联，重启保留现象快照，旧记录保留并有限迁移。
- TUI 改为通用现象展示与独立过程展示；删除没有调用者的旧 ACT-R／倒 U 衰减函数和过时迁移脚本、架构图。
- 修复快照保存失败重试时重复追加节点，增加出边索引避免反复全边扫描。
- 统一事件图谱、主观评估、有限状态信念过滤、情绪与决策流程。
- 支持有来源的情绪闪回、解离共存、LLM 结构化判断，以及可展开的按需压缩。
- 删除旧冷热分析、五层晋升、重复心理模块及其过时设计文档。
- 旧 SQLite 只读导入，原文件保留；删除无用依赖，终端宽度计算和控制序列处理使用显式依赖。
- 修复回应与压缩遗漏生成模型配置、显示回调异常导致对话锁未释放、输出检查期间取消仍提交回应的问题；截断摘要拒绝进入压缩视图。
- 定时器回归测试改用可控时钟，避免高负载下错过短时间窗口，并保证失败时清理调度器。
- 重构整个 TUI：四视图、可滚动命令输出、Unicode 编辑、多行粘贴、取消、压缩排队与安全退出；删除旧布局、旧编辑器、失效提及补全、动画和通知组件等 20 个源文件/测试文件。
- 工具授权并入 Ink，实际工具开始/结束事件接入回合；修复错误边界缓存旧 children、启动重试、保存失败重试及旧主题配置问题。
- 核心与入口测试 37 项、Vitest 142 项（含 TUI 14 项）以及类型检查通过；新现象模型已通过真实 DeepSeek 5 轮对话、回忆、压缩、展开、退出与现象重启恢复验证。

---

# 变更记录

本文件记录 Character Mind v3 的版本变更，遵循 [Keep a Changelog](https://keepachangelog.com/) 风格。

类型说明：`Added`（新增）/ `Changed`（变更）/ `Fixed`（修复）/ `Removed`（移除）/ `Security`（安全）。

---

## [Unreleased]

### Security

- **修复 `main.ts` bash 模式绕过护栏**：删除 `!command` 直接 `execSync` 的代码块，移除 `execSync` 导入。该模式完全绕过 PermissionRules、GuardPipeline、用户确认，是绕过整个工具权限体系的捷径。([SECURITY.md](./SECURITY.md#1-maints-bash-模式绕过所有护栏))
- **修复 `search_content` 命令注入**：`execSync(\`rg ${args}\`)` 字符串拼接改为 `execFileSync("rg", args)` 数组形式，避免 shell 元字符注入。([SECURITY.md](./SECURITY.md#2-search_content-命令注入))
- **补全 `web_fetch` SSRF 防护**：完整 IPv4/IPv6 私网段拦截 + DNS 解析后校验（防 rebinding）+ 协议白名单。原黑名单漏掉 172.17-31、CGNAT、IPv6 ULA 等。([SECURITY.md](./SECURITY.md#3-web_fetch-ssrf-防护残缺))

### Removed

- 删除 `_fix_sql.py`：Bun→better-sqlite3 迁移脚本残留，引用的 `src/character/memory/*.ts` 路径已不存在，项目无任何 bun 痕迹。

### Changed

- 更新 `.gitignore`：追加 `checkpoints/`、`tool-results/`、`eval/results/`、`config/skills/`、`trace-data/`、`.env`、`.env.*`；删除过时的 `bun.lock` 行。

### Added

- 新建 `README.md`：项目门面、快速开始、斜杠命令速查、配置说明、项目状态、文档索引。
- 新建 `ARCHITECTURE.md`：10 个架构决策记录（ADR-001 ~ ADR-010）+ 技术债登记（TC-001 ~ TC-010）。
- 新建 `SECURITY.md`：安全策略、护栏架构、已修复漏洞、已知限制、漏洞报告流程、安全配置建议。
- 新建 `CHANGELOG.md`（本文件）。

### Changed（文档同步）

- 同步 `PROJECT.md` 与代码现状：
  - 修正源文件数 96→98、子系统数 19→27、各目录文件数（agent 7→9、mind 16→18、memory 8→9、guard 6→7、tools 13→15、commands 10→11）
  - 修正核心数据流：反映冷热路径分离（当轮不再调用 PsychologyEngine，改为异步 `scheduleColdAnalysis`）
  - 修正护栏章节：标注各 Gate 的实际接入状态（Gate 3 未默认接入、Gate 4 预留未实现）
  - 修正升级阈值：STM→LTM `>3`→`>=3`、LTM→Core 补写 `recall_count>=5` 复合条件、Core→Archive 标注未实现
  - 新增"安全""测试现状""相关文档"三个小节

---

## [3.0.0-ts] — 2026-06-17

### Fixed

- `fix: vitest setup + generator error handling + provider tools fix` (`527f2a3`)
  - 配置 vitest 测试框架
  - 生成器错误处理改进
  - Provider 工具调用修复

---

## [冷热分离 v4] — 2026-06-10

### Added

- `feat: cold-hot separation v4 — 4-layer cascaded cold analysis + full constraint injection` (`1cd2b1a`)
  - 四层级联冷分析：L0 情感底色 → L1 时间感受 → L2 心理学分析 → L3 叙事自我
  - 全约束注入：GroundTruth 硬约束 + 情感底色弱约束 + 关系/动机/内心强约束
  - 当轮不再调用 PsychologyEngine，改为异步冷路径（详见 [ARCHITECTURE.md ADR-001](./ARCHITECTURE.md#adr-001-冷热路径分离)）

---

## [结构重组] — 2026-05-13

### Added

- `docs: complete project structure reference (PROJECT.md)` (`8798a51`)：完整项目结构文档
- `feat: Agent Loop 工具集成 (Phase 5)` (`fff024c`)：后台循环调用工具
- `feat: 8 core tools implemented (Phase 2-3)` (`8fe994b`)：8 个内置工具实现
- `feat: 工具系统基础设施 (Phase 1)` (`6036e0f`)：工具注册、权限、执行框架
- `feat: Skills 淘汰机制 (Phase 5)` (`d5c4ef0`)：技能库的演化与清理
- `feat: 跨事件模式提取 — PatternExtraction in fullSleep (Phase 4)` (`1cc60af`)：睡眠时的模式涌现
- `feat: ContextNoiseDetector — 噪音检测 (Phase 3)` (`7b63408`)
- `feat: ArchiveMemory — 归档层 (Phase 2)` (`d21d439`)
- `feat: 记忆类型 + 信心度 + superseded + 渐进退化 (Phase 1)` (`bdd9698`)

### Changed

- `refactor: deep restructure — 16 dirs, 0 errors, dead code removed` (`5844ed4`)：深度重组为 16 目录，0 编译错误，删除死代码

### Fixed

- `fix: tool calls, span interleaving, hallucination — 5 root-cause fixes` (`c92dc67`)：工具调用、span 交错、幻觉的 5 个根因修复
- `fix: spacer pushes messages to bottom — latest near input` (`87780db`)
- `fix: restore clean layout — messages scroll above fixed input` (`ee64cbd`)
- `fix: merge input into conversation flow — unified scrolling` (`77e16b1`)
- `fix: escape Chinese quotes causing TS parse error` (`0713ff5`)
- `fix: anti-hallucination — strengthened self-model + first-turn awareness` (`037ba7f`)：强化自我模型 + 首轮感知，对抗幻觉
- `fix: restore sentence buffering — tokens grouped at 。！？\n boundaries` (`6647560`)：恢复句子缓冲
- `fix: reasoning_content passthrough + fast-glob import + relative path resolution` (`e48ca24`)

### Removed

- `chore: 删除所有来源注释 (1:1 from/Copied from/nanobot/Claude Code)` (`f7e0b10`)

### Changed（审计清理）

- `chore: 审计修复 — 删除死代码 + 实现未接入功能 + 修正帮助` (`0fa7caa`)
- `chore: 代码审计清理 — 删除死代码 + 修复不一致` (`7a24516`)

---

## [现象学动力架构] — 2026-05-12

### Added

- `feat: 情调-揭示 — PsychologyEngine accepts affective context (Phase D)` (`e11a070`)：心理分析接受情感底色上下文
- `feat: TemporalHorizon — retention + protention (Phase C)` (`1cbf9da`)：时间视域——滞留与前摄
- `feat: DriveSublimator + SelfModel闭环 (Phase B)` (`614d088`)：驱力升华 + 自我模型闭环
- `feat: AffectiveResidue — passive emotional sediment layer (Phase A)` (`43766ec`)：情感残渣——被动情感沉积层
- `feat: Interrupt + Repack + Restart — turn-level generation continuity` (`cb8767d`)：中断 + 重打包 + 重启（GenerationController，注：现为孤儿代码，见 [ARCHITECTURE.md TC-001](./ARCHITECTURE.md#tc-001-generationcontroller-孤儿代码严重)）

### Fixed

- `fix: correct DeepSeek base URL + error propagation in streamTokens` (`1ddba26`)

### Added（设计文档）

- `docs: 现象学动力架构完整设计 — 四层模型 + 五个模块` (`990bf96`)：现象学动力架构的完整设计文档
