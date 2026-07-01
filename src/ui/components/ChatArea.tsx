import React from "react";
import { Box, Text } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { Message } from "./Message";
import type { ChatMessage } from "./Message";

export function ChatArea({ messages, maxVisible, onRetry, onEdit, onBranch, onCopy }: {
  messages: ChatMessage[];
  maxVisible?: number;
  onRetry?: (msgId: string) => void;
  onEdit?: (msgId: string, newText: string) => void;
  onBranch?: (msgId: string) => void;
  onCopy?: (msgId: string) => void;
}) {
  const theme = useThemeStore((s) => s.theme);

  // Show most recent messages up to maxVisible
  const limit = maxVisible ?? 50;
  const visible = messages.length <= limit ? messages : messages.slice(-limit);

  if (visible.length === 0) {
    return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingLeft: 1 },
      React.createElement(Text, { color: theme.colors.textDim }, "  开始对话..."),
    );
  }

  const lastIndex = visible.length - 1;

  return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingLeft: 1 },
    ...visible.map((msg, i) =>
      React.createElement(Message, {
        key: msg.id,
        msg,
        focused: i === lastIndex,
        onRetry: onRetry ? () => onRetry(msg.id) : () => console.log("[TODO] 重试"),
        onEdit: onEdit ? (newText: string) => onEdit(msg.id, newText) : (_newText: string) => console.log("[TODO] 编辑重发"),
        onBranch: onBranch ? () => onBranch(msg.id) : () => console.log("[TODO] 分支对话"),
        onCopy: onCopy ? () => onCopy(msg.id) : () => console.log("[TODO] 复制"),
      }),
    ),
  );
}