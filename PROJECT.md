# 项目导航

当前设计以 [ARCHITECTURE.md](./ARCHITECTURE.md) 为准，启动和验证方式见 [README.md](./README.md)。

| 路径 | 职责 |
| --- | --- |
| `src/memory/knowledge-graph.ts` | 实体、事件、关系、过程、现象、决策和摘要的单一图谱，检索与展开 |
| `src/memory/import-legacy.ts` | 只读导入旧 SQLite 记录 |
| `src/mind/cognitive-core.ts` | 证据去重、情境信念、过程动力学、记忆激活、策略评分与持久化 |
| `src/mind/process-state.ts` | 底层连续过程与有来源的记忆激活契约 |
| `src/mind/phenomena.ts` | 统一现象推断接口、证据、强度与生命周期 |
| `src/mind/appraisal-provider.ts` | LLM 结构化情境评估适配器 |
| `src/agent/agent.ts` | 串行认知流程与稳定边界压缩 |
| `src/agent/response-generator.ts` | 回应生成与工具结果回传 |
| `src/ui/components/MainLayout.tsx` | 四视图布局、Unicode 输入、按键、滚动与缩放 |
| `src/ui/presentation.ts` | 对话、心智、图谱与来源的行视图 |
| `src/ui/session.ts` | 回合取消、命令、压缩排队与退出保存 |
| `src/ui/tool-confirmation.ts` | Ink 内工具授权与取消处理 |
| `src/commands/builtin/memory.ts` | `/compress` 与 `/expand` |
| `tests/cognition.test.ts` | 核心状态、来源、压缩、迁移、LLM 结构化契约测试 |
| `tests/cognitive-integration.test.ts` | 真实入口结合模拟提供者的集成测试 |
| `src/ui/workspace.test.tsx` | 实际 Ink 渲染、输入、取消、工具确认与生命周期测试 |
| `tests/live-smoke.ts` | 使用真实模型验证 TUI、记忆、压缩和重启的显式测试 |

`guard`、`tools`、`providers`、`channels`、`mcp`、`plugin`、`subagent`、`cron`、`eval`、`telemetry` 保留各自基础设施职责。当前运行入口为 `src/dev-entry.ts` → `src/ink-main.tsx` → `src/ui/app.tsx`。

旧五层存储、冷热分析、自发意识流控制器、重复心理参数系统、未调用的 ACT-R／倒 U 情绪衰减工具和旧 readline 入口已移除。旧设计与当前实现的对应关系见架构文档。
