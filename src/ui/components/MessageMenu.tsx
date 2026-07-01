import React from "react";
import { Text, Box } from "ink";
import { useTheme } from "../theme/context";

export function MessageMenu({ isUser, onRetry, onEdit, onBranch, onClose }: {
  isUser: boolean;
  onRetry?: () => void;
  onEdit?: (newText: string) => void;
  onBranch?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const items: Array<{ label: string; key: string; action?: () => void }> = [];

  if (!isUser && onRetry) {
    items.push({ label: "r  重试", key: "r", action: onRetry });
  }
  if (onBranch) {
    items.push({ label: "b  分支", key: "b", action: onBranch });
  }
  if (!isUser && onEdit) {
    items.push({ label: "e  编辑", key: "e", action: () => onEdit("") });
  }
  items.push({ label: "Esc 关闭", key: "escape", action: onClose });

  return React.createElement(Box, {
    flexDirection: "column",
    borderStyle: "round" as const,
    borderColor: theme.colors.secondary,
    paddingLeft: 1,
    paddingRight: 1,
    marginTop: 0,
  },
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, " 操作 "),
    React.createElement(Text, { color: theme.colors.textDim }, "-----------"),
    ...items.map((item) =>
      React.createElement(Text, { key: item.key, color: theme.colors.textDim },
        ` ${item.label}`,
      ),
    ),
  );
}
