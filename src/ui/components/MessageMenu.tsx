import React from "react";
import { Text, Box, useInput } from "ink";
import { useThemeStore } from "../stores/theme-store";

export function MessageMenu({ isUser, onRetry, onEdit, onBranch, onCopy, onClose }: {
  isUser: boolean;
  onRetry?: () => void;
  onEdit?: (newText: string) => void;
  onBranch?: () => void;
  onCopy?: () => void;
  onClose: () => void;
}) {
  const c = useThemeStore((s) => s.theme).colors;
  useInput((input, key) => {
    if (input === "1" && onRetry) onRetry();
    if (input === "2" && onEdit && isUser) onEdit("");
    if (input === "3" && onBranch) onBranch();
    if (input === "4" && onCopy) onCopy();
    if (input === "e" || key.escape) onClose();
  });

  const items = [
    { key: "1", label: "重试", available: !!onRetry },
    { key: "2", label: "编辑重发", available: isUser && !!onEdit },
    { key: "3", label: "分支对话", available: !!onBranch },
    { key: "4", label: "复制", available: !!onCopy },
  ].filter((i) => i.available);

  return React.createElement(Box, { flexDirection: "column", paddingLeft: 3 },
    React.createElement(Text, { color: c.secondary, bold: true }, "  消息操作:"),
    ...items.map((i) =>
      React.createElement(Text, { key: i.key, color: c.text }, `  ${i.key}. ${i.label}`),
    ),
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  Esc 关闭"),
  );
}