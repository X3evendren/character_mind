import React from "react";
import { Box, Text } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { Message } from "./Message";
import type { ChatMessage } from "./Message";

export function ChatArea({ messages, maxVisible, onRetry, onEdit, onBranch }: {
  messages: ChatMessage[];
  maxVisible?: number;
  onRetry?: (msgId: string) => void;
  onEdit?: (msgId: string, newText: string) => void;
  onBranch?: (msgId: string) => void;
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

  return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingLeft: 1 },
    ...visible.map((msg) =>
      React.createElement(Message, {
        key: msg.id,
        msg,
        onRetry: onRetry ? () => onRetry(msg.id) : undefined,
        onEdit: onEdit ? (newText: string) => onEdit(msg.id, newText) : undefined,
        onBranch: onBranch ? () => onBranch(msg.id) : undefined,
      }),
    ),
  );
}
