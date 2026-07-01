import React, { useState } from "react";
import { Text, Box, useInput } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { renderMarkdown } from "../markdown";
import { ToolCallCard } from "../widgets/ToolCallCard";
import { MessageMenu } from "./MessageMenu";

export type MessageRole = "user" | "assistant" | "system" | "tool";
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCall?: {
    tool: string;
    args: Record<string, unknown>;
    success: boolean;
    outputPreview: string;
    durationMs: number;
  };
}

export function Message({ msg, onRetry, onEdit, onBranch, onCopy, focused }: {
  msg: ChatMessage;
  onRetry?: () => void;
  onEdit?: (newText: string) => void;
  onBranch?: () => void;
  onCopy?: () => void;
  focused?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const c = theme.colors;
  const [menuOpen, setMenuOpen] = useState(false);
  const [monologueExpanded, setMonologueExpanded] = useState(false);

  // Bind Alt+M only when this message is the focused one. useInput must be
  // called unconditionally (hooks rules), so it lives above any early returns.
  useInput((input, key) => {
    if (!focused) return;
    if (input === "m" && key.meta) {
      setMenuOpen(!menuOpen);
    }
  });

  const isMonologue = msg.role === "system" && msg.content.startsWith("[内心独白]");
  const time = new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  // 内心独白消息：折叠块（默认折叠）
  if (isMonologue) {
    return React.createElement(Box, { flexDirection: "column", paddingLeft: 3, marginTop: 1 },
      React.createElement(Text, {
        color: c.textDim,
        dimColor: true,
      }, `${monologueExpanded ? "[-]" : "[+]"} 内心独白`),
      monologueExpanded
        ? React.createElement(Text, { color: c.textDim, dimColor: true }, `  ${msg.content.slice(7)}`)
        : null,
    );
  }

  if (msg.role === "system") {
    return React.createElement(Text, { color: c.textDim }, `  -- ${msg.content}`);
  }
  if (msg.role === "tool" && msg.toolCall) {
    return React.createElement(ToolCallCard, { ...msg.toolCall });
  }

  const isUser = msg.role === "user";
  const prefix = isUser ? ">" : "|";
  const prefixColor = isUser ? c.accent : c.primary;
  const align = isUser ? "flex-end" : "flex-start";
  const roleLabel = isUser ? "你" : (msg.role === "assistant" ? "林雨" : msg.role);

  return React.createElement(Box, { flexDirection: "column", alignItems: align, marginBottom: 1 },
    // Header row: prefix + role + time + menu hint
    React.createElement(Box, { flexDirection: "row" },
      React.createElement(Text, { color: prefixColor, bold: true }, `${prefix} `),
      React.createElement(Text, { color: c.secondary }, roleLabel),
      React.createElement(Text, { color: c.textDim }, ` ${time}`),
      !isUser
        ? React.createElement(Text, { color: c.textDim, dimColor: !menuOpen },
            "  Alt+M",
          )
        : null,
    ),
    // Content row
    React.createElement(Box, { paddingLeft: 2, flexDirection: "column" },
      isUser
        ? React.createElement(Text, { color: c.text }, msg.content)
        : React.createElement(Box, { flexDirection: "column", paddingLeft: 0 },
            ...renderMarkdown(msg.content, theme).map((node, i) =>
              React.createElement(Box, { key: i }, node),
            ),
          ),
    ),
    // Menu (conditionally rendered)
    menuOpen && React.createElement(MessageMenu, {
      isUser,
      onRetry,
      onEdit,
      onBranch,
      onCopy,
      onClose: () => setMenuOpen(false),
    }),
  );
}