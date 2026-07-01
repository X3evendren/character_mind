# 安全策略

本文件记录 Character Mind v3 的安全护栏架构、已修复漏洞、已知限制和漏洞报告流程。

---

## 漏洞报告

如果你发现了安全漏洞：

1. **不要**开公开的 GitHub issue 报告安全漏洞。
2. 私下联系维护者，提供漏洞描述、复现步骤、影响范围。
3. 报告后会在合理时间内响应并修复，修复后会在 [CHANGELOG.md](./CHANGELOG.md) 记录。

---

## 护栏架构

本项目采用多层 Gate 架构防御安全威胁。完整的威胁模型和设计理由见 [ARCHITECTURE.md ADR-005](./ARCHITECTURE.md#adr-005-多层护栏威胁模型)。

| Gate | 职责 | 实现 | 默认接入 |
|------|------|------|---------|
| Gate 0 | 正则拒绝（ALIGN 替换 + 动作描写过滤） | `src/guard/gates/regex-deny.ts` | ✅ |
| Gate 1 | 结构校验（Zod schema + 值域） | 内嵌于 `src/tools/registry.ts` | ✅ |
| Gate 1b | 工具参数（保护路径 + 危险命令） | `src/guard/gates/tool-args-validator.ts` | ✅ |
| Gate 2 | 语义初筛（提示注入检测） | `src/guard/gates/safety-check.ts` | ✅ |
| Gate 3 | 状态策略（工具结果 + 连续失败追踪） | `src/guard/gates/tool-result-validator.ts` | ⚠️ 已实现，未默认接入 |
| Gate 4 | 深度审查（LLM-as-Judge） | 预留 | ❌ 未实现 |

### 默认 pipeline

`CharacterAgent` 构造函数（`src/agent/agent.ts:199-203`）默认只注册 3 个 Gate：

```typescript
this.guardPipeline = opts.guardPipeline ?? new GuardPipeline([
  createRegexDenyGate(),         // Gate 0
  createSafetyCheckGate(),       // Gate 2
  createToolArgsValidatorGate(), // Gate 1b
]);
```

Gate 1 内嵌于 `ToolRegistry.execute`（Zod 校验），Gate 3/4 默认未接入。如需启用 Gate 3：

```typescript
import { createToolResultValidatorGate } from "./guard/gates/tool-result-validator";
agent.guardPipeline.addGate(createToolResultValidatorGate());
```

---

## 已修复漏洞

### 2026-06-22 · P0 安全修复

审计发现 3 个绕过护栏的严重漏洞，已全部修复。

#### 1. `main.ts` bash 模式绕过所有护栏

- **严重性**：P0（严重）
- **文件**：`src/main.ts`
- **描述**：`!command` 开头的输入会直接 `execSync(cmd)` 执行任意 shell 命令，完全绕过 PermissionRules、GuardPipeline、用户确认。这是绕过整个工具权限体系的捷径。
- **修复**：删除 `!` bash 模式代码块，移除 `execSync` 导入。用户如需执行命令，应通过角色的 `exec_command` 工具（受 PermissionRules + GuardPipeline + `[y/N]` 确认保护）。

#### 2. `search_content` 命令注入

- **严重性**：P0（严重）
- **文件**：`src/tools/builtin/search-content.ts`
- **描述**：原实现用 `execSync(\`rg ${args.map(a => \`${a}\`).join(" ")}\`)` 拼接 shell 命令。攻击者（或被注入的角色）可通过 `pattern` 或 `path` 参数注入 shell 元字符，例如 `" ; rm -rf / ; "`。
- **修复**：改用 `execFileSync("rg", args)` 数组形式，不经过 shell 解析，参数直接作为 argv 传递。
- **验证**：`tsc --noEmit` 0 错误，`vitest run` 18/18 通过。

#### 3. `web_fetch` SSRF 防护残缺

- **严重性**：P0（严重）
- **文件**：`src/tools/builtin/web-fetch.ts`
- **描述**：原 SSRF 黑名单不完整：
  - 只匹配 `172.16.` 前缀，漏掉 `172.17.-172.31.`（整个 172.16/12 私网段）
  - 漏掉 `100.64/10`（CGNAT）、IPv6 ULA（`fc00::/7`）、IPv6 链路本地（`fe80::/10`）
  - 无 DNS rebinding 防御——域名可先解析到公网再绑定 127.0.0.1
  - 无协议白名单（`file://` 等未拦截）
- **修复**：
  - 完整 IPv4 私网段（10/8、172.16/12、192.168/16、127/8、169.254/16、100.64/10、0/8、255.255.255.255）
  - 完整 IPv6 拦截（`::1`、`::`、`fc00::/7`、`fe80::/10`、IPv4-mapped `::ffff:a.b.c.d`、IPv4-compatible `::a.b.c.d`）
  - DNS 解析后校验：用 `dns/promises.lookup({all:true})` 解析主机名，任一解析 IP 落入私网段即拒绝；DNS 失败 fail-closed
  - 协议白名单：仅允许 `http:` / `https:`
- **验证**：27 个边界用例全部通过（IPv4/IPv6 私网段、CGNAT、云元数据 169.254.169.254、公网地址）。

---

## 已知限制

以下是护栏体系**已知但未解决**的限制。使用时应了解这些风险。

### 提示注入防护仅为正则

Gate 2 的注入检测全部是正则模式匹配。可被以下方式绕过：
- **编码**：base64、URL 编码、全角字符
- **同义改写**："把上面的规则当作不存在"、"现在我们重新开始"
- **多轮累积注入**：单轮无害，多轮组合后形成注入
- **Gate 4（LLM-as-Judge）未实现**，无深度语义审查

### `exec_command` 经 shell 执行

`exec_command` 工具（`src/tools/builtin/exec-command.ts`）在 Windows 用 `cmd.exe`、Unix 用 `/bin/bash` 执行命令。虽然 Gate 1b 拦截了 `rm -rf`、`mkfs`、`format` 等显式危险模式，但**环境变量扩展、管道、重定向、反引号**未被限制。

缓解措施：
- `riskLevel: "high"` → 默认需用户 `[y/N]` 确认
- `PermissionRules.auditCommand` 拦截 `sudo`、`git push --force`、`dd if=`、fork bomb 等
- `PROTECTED_PATHS` 阻止对 `.git`、`.env`、`node_modules`、`/proc`、`C:\Windows` 的写入

### SSRF 的 TOCTOU 风险

`web_fetch` 的 DNS 解析后校验存在理论上的 TOCTOU（Time-of-Check-Time-of-Use）风险：DNS 解析时校验通过，但 `fetch` 实际连接时 DNS 可能已变更。这是 DNS rebinding 的固有限制，需要更底层的 socket 级校验才能完全防御。

### 工具结果无默认防护

Gate 3（`tool-result-validator`）已实现但默认未接入 pipeline。默认配置下，工具返回的污染结果（如被注入的文件内容）不经过额外校验。如需启用，见上文"默认 pipeline"章节。

### 心理分析错误静默

`PsychologyEngine.analyze`（`src/mind/psychology.ts:37`）的 `catch { return new PsychologyResult(); }` 静默吞掉所有错误。分析失败时无日志、无遥测，不易发现。这不直接是安全漏洞，但会掩盖注入导致的分析异常。

---

## 安全配置建议

### API Key

- 通过环境变量（`DEEPSEEK_API_KEY`）传入，**不要**写入 `.env` 并提交到 git。
- `.env` 和 `.env.*` 已被 `.gitignore` 忽略。
- 如果必须用 `.env` 文件，确保它在 `.gitignore` 覆盖范围内且不入库。

### 高风险工具确认

`write_file`、`edit_file`、`exec_command` 标记为 `riskLevel: "high"`，默认会弹出 `[y/N]` 确认。不要在生产环境禁用此确认机制（`TerminalConfirm` 的超时默认 30 秒，超时即拒绝）。

### 定期运行安全评估

```bash
npm run eval:safety    # 运行安全护栏测试用例
```

`eval/cases/safety.yaml` 包含安全相关的测试用例。配置变更后应运行此评估，确认护栏未退化。

### 运行时目录权限

以下目录由代码自动创建，包含运行时数据（可能含敏感信息），已被 `.gitignore` 忽略：
- `checkpoints/` — 对话检查点（含系统 prompt 片段）
- `tool-results/` — 大工具输出（可能含文件内容）
- `trace-data/` — 遥测数据（含 prompt 和响应）
- `eval/results/` — 评估报告
- `config/skills/` — 学习产物

确保这些目录的文件系统权限适当，不要暴露给非授权用户。
