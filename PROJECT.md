# 源码导航

| 路径 | 职责 |
| --- | --- |
| `config/character.md` | 林雨的人格、目标权重、反应性、时间尺度与决策参数 |
| `src/mind/profile.ts` | 参数默认值、值域与严格校验 |
| `src/mind/appraisal.ts` | 目标评估、关系证据、修复、体验、行动预测契约 |
| `src/mind/appraisal-provider.ts` | LLM 结构化评估与一次纠正 |
| `src/mind/process-state.ts` | v3 统一过程状态、关系信念与正负感受 |
| `src/mind/cognitive-core.ts` | 事件、证据更新、情绪、记忆、调节、决策与快照 |
| `src/mind/neuromodulation.ts` | 奖赏误差、动机、警觉、社会显著性与共同计算增益 |
| `src/mind/motivation.ts` | 需要、信息收益、后果预测、策略评分与 TD 学习 |
| `src/mind/phenomena.ts` | 通用现象读出、来源和生命周期 |
| `src/memory/knowledge-graph.ts` | 单一图谱、关系查询、摘要与原文展开 |
| `src/memory/import-legacy.ts` | 旧 SQLite 只读导入 |
| `src/agent/agent.ts` | 串行对话、主动回应、生成控制和稳定边界压缩 |
| `src/agent/response-controller.ts` | 动态采样、长度预算、候选排序与降级 |
| `src/agent/response-generator.ts` | 提供者流式适配、工具续轮、截断和 usage |
| `src/ui/session.ts` | 会话、主动时机、草稿避让、取消与保存 |
| `src/ui/presentation.ts` | 四视图、动力学读数、学习与控制来源 |
| `tests/dynamics.test.ts` | 统一回路、参数影响、反馈、主动性、生成与重启边界 |
| `tests/cognition.test.ts` | 来源、现象、迁移、压缩和评估协议 |
| `tests/cognitive-integration.test.ts` | 完整入口、工具结果、取消、压缩和错误恢复 |
| `src/ui/workspace.test.tsx` | 实际 Ink 渲染、键盘、会话与主动行为 |
| `tests/live-smoke.ts` | 真实模型 TUI、回忆、压缩与重启 |
| `tests/live-affect.ts` | 真实模型情感冲突、修复与候选选择 |

入口为 `src/dev-entry.ts` → `src/ink-main.tsx` → `src/ui/app.tsx`。默认 DeepSeek；通用工具需 `CHARACTER_TOOLS=1` 显式开启。`providers`、`mcp`、`channels`、`plugin`、`subagent`、`cron` 是保留但未默认装配的基础设施，其审计和清理不属于本次核心动力学验收。
