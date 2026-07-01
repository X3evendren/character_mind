import React, { useState } from "react";
import { Text, Box } from "ink";
import { useTheme } from "../theme/context";
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

export function Message({ msg, onRetry, onEdit, onBranch }: {
  msg: ChatMessage;
  onRetry?: () => void;
  onEdit?: (newText: string) => void;
  onBranch?: () => void;
}) {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const time = new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  if (msg.role === "system") {
    return React.createElement(Text, { color: theme.colors.textDim }, `  -- ${msg.content}`);
  }
  if (msg.role === "tool" && msg.toolCall) {
    return React.createElement(ToolCallCard, { ...msg.toolCall });
  }

  const isUser = msg.role === "user";
  const prefix = isUser ? ">" : "|";
  const prefixColor = isUser ? theme.colors.accent : theme.colors.primary;
  const align = isUser ? "flex-end" : "flex-start";
  const roleLabel = isUser ? "你" : (msg.role === "assistant" ? "林雨" : msg.role);

  return React.createElement(Box, { flexDirection: "column", alignItems: align, marginBottom: 1 },
    // Header row: prefix + role + time + menu hint
    React.createElement(Box, { flexDirection: "row" },
      React.createElement(Text, { color: prefixColor, bold: true }, `${prefix} `),
      React.createElement(Text, { color: theme.colors.secondary }, roleLabel),
      React.createElement(Text, { color: theme.colors.textDim }, ` ${time}`),
      !isUser
        ? React.createElement(Text, { color: theme.colors.textDim, dimColor: !menuOpen },
            "  Alt+M",
          )
        : null,
    ),
    // Content row
    React.createElement(Box, { paddingLeft: 2, flexDirection: "column" },
      isUser
        ? React.createElement(Text, { color: theme.colors.text }, msg.content)
        : React.createElement(Text, null,
            ...renderMarkdown(msg.content).map((s, i) =>
              React.createElement(Text, { key: i }, s.ansi),
            ),
          ),
    ),
    // Menu (conditionally rendered)
    menuOpen && React.createElement(MessageMenu, {
      isUser,
      onRetry,
      onEdit,
      onBranch,
      onClose: () => setMenuOpen(false),
    }),
  );
}
