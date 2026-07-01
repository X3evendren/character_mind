# Character Mind v3 — TUI 完全重构设计规范

**日期**: 2026-07-01
**状态**: 已批准
**参考**: Hermes TUI, OpenClaw TUI, lazygit

---

## 一、目标

将现有 257 行 Ink 基础 UI 彻底重构为多面板、可自定义、功能完整的终端界面。

### 核心原则
- 纯 TUI（Ink + React），不引入 Web 技术
- 左侧角色状态仪表盘 + 右侧对话区 + 底部增强输入
- 配置文件驱动 + 运行时命令 + 会话持久化
- 配色方案：紫藤蓝 #706CAA / 麦秆金 #F7DA94 / 玫瑰粉 #CC7EB1

---

## 二、组件树

```
<App>
  <ThemeProvider config={themeConfig}>
    <MainLayout>
      <LeftPanel width={32}>           {/* 可拖拽调整宽度 */}
        <DashboardHeader />            {/* 角色名 + 饱和度火花线 */}
        <DashboardTabs activeTab={tab}>
          <Tab1_Overview />             {/* 稳态变量条 + PAD坐标 + 情绪摘要 */}
          <Tab2_Details />             {/* 12D心境热力图 + 5驱力 + 防御/调节 */}
          <Tab3_Relationships />       {/* 记忆统计 + 关系状态 + 自我叙事 */}
        </DashboardTabs>
      </LeftPanel>
      <RightPanel flex={1}>
        <StatusBar />                  {/* turn数 · 延迟 · tokens · 通知铃 */}
        <ChatArea>                     {/* 可滚动的消息列表 */}
          <Message *>                  {/* 用户/AI/系统/工具消息 */}
            <MessageHeader />          {/* 角色名 · 时间戳 · 操作菜单 */}
            <MessageBody />            {/* Markdown渲染 */}
            <ToolCall />              {/* 内联工具调用卡片 */}
          </Message>
          <NotificationToast />       {/* 冷分析完成/记忆巩固/反思 */}
        </ChatArea>
        <InputArea>                   {/* 多行编辑器 */}
          <InputToolbar />            {/* @mention面板 · 补全弹出 */}
          <MultilineEditor />         {/* 主输入区 */}
        </InputArea>
      </RightPanel>
    </MainLayout>
  </ThemeProvider>
</App>
```

---

## 三、左侧面板 — 三层仪表盘

### Tab 1: 概览（Overview）

展示内容：
- 5 个稳态变量的偏差进度条（energy/arousal/safety/connection/mastery），格式 `████░░ current/setPoint`
- PAD 坐标条（Pleasure/Arousal/Dominance），格式 `████░░ value`
- 当前主导情绪名称 + 强度
- 异稳态负荷级别（normal/mild/moderate/severe）
- 饱和度数值 + 迷你火花线（最近 20 个 turn 的 s 值变化）

### Tab 2: 细节（Details）

展示内容：
- 12D 心境热力图（euthymic/irritable/anxious/vital/warm/confident/grateful/proud/curious/hopeful/awed/playful + paniGrief/fatigue），每项 `████ value`
- 5 驱力强度条（curiosity/helpfulness/achievement/connection/autonomy）
- BIS/BAS 双条对比（BIS ░░ bisActivation | BAS ██ basActivation）
- 当前情绪调节策略 + 压抑累积值
- Breakdown 状态（如有）

### Tab 3: 记忆 & 关系（Memory & Relationships）

展示内容：
- 5 级记忆容量统计（WM/STM/LTM/Core/Archive），格式 `WM 12/50`
- 最近巩固事件（上次 daydream/quickSleep/fullSleep 时间）
- 关系 5 维状态：trust/familiarity/avoidance/ambivalence/epistemicForagingRate
- 叙事主题强度：agency/communion/redemption/contamination/meaning

### 交互
- Tab / Shift+Tab 切换面板
- 面板间按优先级从 Agent 状态刷新（每 500ms）

---

## 四、右侧对话区

### 消息类型

**用户消息**
- 右对齐
- 暖色背景（surface + 2）
- 无 Markdown 渲染（纯文本）

**AI 消息**
- 左对齐
- 窄色左边框（primary 色，2字符宽）
- 完整 Markdown 渲染：粗体、斜体、代码块（dim 边框）、引用（`│ text`）、列表

**工具调用**
- 内联卡片，左边框（secondary 色）
- 格式：`↳ read_file path/to/file` + `✓ 200 lines read`
- 图标映射：read_file=`📄`, exec_command=`$`, search_files=`🔍`, write_file=`✎`, edit_file=`✐`, web_fetch=`🌐`, web_search=`🔎`

**系统通知**
- 居中、低调灰色
- 格式：`── 冷分析完成 · 0.8s ──`

### 消息操作
- 快捷键 `Ctrl+O`（当前消息）→ 弹出操作菜单：
  - 复制消息内容
  - 重新生成（仅 AI 消息，发送隐式 `/retry`）
  - 编辑并重发（仅用户消息）
  - 从此消息分支（创建对话分叉）
  - 删除后续消息

### 通知系统
- 右上角 `🔔` 铃铛（有新通知时变为金色）
- 浮动 Toast，3 秒淡出
- 事件类型：
  - 冷分析完成（L0-L3 各层）
  - 记忆巩固（daydream/quickSleep/fullSleep）
  - 深度反思触发
  - Breakdown 警告
  - 无聊提醒（explorationUrge > 0.7）
- 按 `Ctrl+N` 查看通知历史

---

## 五、Markdown→ANSI 渲染器

自研轻量转换器 `src/ui/markdown.ts`：

| Markdown | ANSI 产出 |
|----------|----------|
| `**bold**` | `\x1b[1m...\x1b[22m` |
| `*italic*` | `\x1b[3m...\x1b[23m` |
| `` `code` `` | `\x1b[2m\x1b[48;5;236m...\x1b[0m` |
| `> quote` | `│ ` 前缀 + dim |
| `- list` | `  • ` 前缀 |
| `1. ordered` | `  1. ` 前缀 |
| `# heading` | `\x1b[1m\x1b[4m` + 下划线分隔 |

---

## 六、输入区

### 多行编辑器
- Enter → 发送
- Alt+Enter → 换行
- 最大显示高度 6 行，超出滚动
- 光标：标准行内编辑（左右箭头、Home/End、Ctrl+A/E）
- 选中文本：Shift+方向键，Ctrl+C 复制选中

### 语法高亮
- `/command` → secondary 色（麦秆金）
- `@file` `@mem` `@tool` → primary 色（紫藤蓝）
- 代码块 `\`\`\`` → dim 色

### 自动补全（以下字符触发弹出面板）
- `/` → 命令列表：help/stats/model/dream/think/quit/theme/retry/clear
- `@file ` → 最近读取文件列表（从 agent.toolRegistry 历史）
- `@mem ` → 最近激活记忆（从 agent.workingMemory）
- `@tool ` → 可用工具列表（从 agent.toolRegistry）
- 上下箭头选择，Enter/→ 确认，Esc 取消

### 内联预览
- 粘贴 URL → 自动 fetch 标题 → 显示 `🔗 标题 (url)` 在输入区上方

### 历史
- Ctrl+R → 搜索历史（弹出搜索框）
- Ctrl+P / ↑（空输入时）→ 上一条
- Ctrl+N / ↓（空输入时）→ 下一条
- 历史持久化至 `~/.character_mind_history`（已有）

---

## 七、主题系统

### 配置文件
`config/theme.yaml`：
```yaml
theme:
  name: "default"
  colors:
    primary: "#706CAA"
    secondary: "#F7DA94"
    accent: "#CC7EB1"
    background: "#1A1A2E"
    surface: "#242442"
    text: "#E8E8F0"
    textDim: "#8888A0"
    success: "#80C080"
    warning: "#F7DA94"
    error: "#E08080"
  layout:
    leftPanelWidth: 32
    showDashboard: true
    dashboardDefaultTab: 0
  typography:
    roleNameBold: true
    timestampFormat: "HH:mm"
  animation:
    streaming: true
    progressBars: true
    sparkline: true
```

### 预设主题
- `default` — 上述配色
- `dark` — 纯黑白灰，无色彩
- `warm` — 暖色系（棕/橙/奶油）
- `forest` — 绿色系

### 运行时命令
- `/theme dark|light|warm|forest` → 切换预设
- `/theme color primary "#XXXXXX"` → 实时改色
- `/theme save [name]` → 保存到 `config/theme.yaml`
- `/theme load [name]` → 加载已保存主题
- `/theme reset` → 恢复默认

### 实现
- ThemeContext（React Context）持当前主题
- 所有颜色通过 `useTheme()` hook 获取
- 主题变更即时重渲染，无需重启

---

## 八、文件结构

```
src/ui/
├── app.tsx                  # App 入口（重写）
├── theme/
│   ├── context.tsx          # ThemeContext + ThemeProvider
│   ├── types.ts            # ThemeConfig 类型
│   ├── presets.ts          # 4 个预设主题
│   └── loader.ts          # YAML 加载/保存
├── components/
│   ├── MainLayout.tsx      # 左右面板 Flex 布局
│   ├── StatusBar.tsx       # 顶部状态栏
│   ├── ChatArea.tsx        # 消息列表（可滚动）
│   ├── Message.tsx         # 单条消息（用户/AI/系统/工具）
│   ├── MessageMenu.tsx     # 消息操作弹出菜单
│   ├── NotificationToast.tsx # 通知 toast
│   ├── InputArea.tsx       # 底部输入区
│   ├── MultilineEditor.tsx # 多行编辑器
│   ├── Autocomplete.tsx    # 自动补全弹出面板
│   ├── Dashboard.tsx       # 左侧仪表盘容器
│   ├── DashboardHeader.tsx # 角色名 + 火花线
│   ├── dashboard/
│   │   ├── Tab1_Overview.tsx   # 概览面板
│   │   ├── Tab2_Details.tsx    # 细节面板
│   │   └── Tab3_Relationships.tsx # 记忆/关系面板
│   └── widgets/
│       ├── ProgressBar.tsx     # ████░░ 进度条
│       ├── Sparkline.tsx       # 迷你火花线
│       ├── Heatmap.tsx         # 热力图
│       └── ToolCallCard.tsx    # 工具调用内联卡片
├── markdown.ts             # Markdown → ANSI 渲染器
├── span-renderer.ts       # SpanState（保留，重构）
├── stream-renderer.ts     # StreamRenderer（保留作为降级）
└── history.ts             # HistoryStore（保留，增强搜索）
```

---

## 九、验证标准

- `tsc --noEmit` 零错误
- `vitest run` 现有测试全部通过
- 新组件：100% TypeScript 类型覆盖（strict 模式对 ui/ 目录）
- 终端宽度 ≥80 列时正常渲染
- 终端宽度 ≥100 列时显示左侧面板
- <80 列时自动切换到纯对话模式（隐藏左侧面板）
- 配色在所有 256 色终端中一致
