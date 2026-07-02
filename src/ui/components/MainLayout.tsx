import React from "react";
import { Box, Text, useStdout } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { Dashboard } from "./Dashboard";
import { StatusBar } from "./StatusBar";
import { TurnList } from "./TurnList";
import { InputArea } from "./InputArea";
import { NotificationToast } from "./NotificationToast";

export function MainLayout({
  notifications,
  onSubmit,
  disabled,
  agentName,
}: {
  notifications: Array<{ id: string; message: string; type: "info" | "success" | "warning" | "error" }>;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  agentName: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;

  // Responsive breakpoints
  const showDashboard = cols >= 100 && theme.layout.showDashboard;
  const isCompact = cols < 80;

  const latestNotification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  // 固定布局高度:StatusBar(1) + InputArea(边框2+编辑器1+footer1=4) + Notification(1)
  // 聊天区 = 终端高度 - 固定区域
  const inputHeight = 4; // 圆角边框(2) + 编辑器(1) + footer提示(1)
  const notificationHeight = latestNotification ? 1 : 0;
  const chatHeight = Math.max(3, rows - 1 - inputHeight - notificationHeight);

  return React.createElement(
    Box,
    { flexDirection: "column", height: rows },
    // Status bar at top (fixed 1 row)
    React.createElement(Box, { flexShrink: 0 },
      React.createElement(StatusBar, {
        agentName,
        notificationCount: notifications.length,
      }),
    ),

    // Main content area: chat + side panel (optional)
    React.createElement(
      Box,
      { flexDirection: "row", flexGrow: 1, overflow: "hidden" },
      // Left: chat (fixed height) + input (fixed bottom)
      React.createElement(
        Box,
        { flexDirection: "column", flexGrow: 1, overflow: "hidden" },
        // Chat area — 固定高度，超出部分隐藏，TurnList 内部做窗口滚动
        React.createElement(Box, { height: chatHeight, flexShrink: 0, overflow: "hidden" },
          React.createElement(TurnList, { maxRows: chatHeight }),
        ),

        // Notification toast
        latestNotification
          ? React.createElement(NotificationToast, {
              message: latestNotification.message,
              type: latestNotification.type,
              visible: true,
            })
          : null,

        // Input area at bottom (fixed, never pushed off screen)
        React.createElement(
          Box,
          { flexShrink: 0 },
          React.createElement(InputArea, {
            onSubmit,
            disabled,
            placeholder: isCompact ? "输入..." : "输入消息... (Enter 发送, Alt+Enter 换行)",
          }),
        ),
      ),

      // Separator + right dashboard panel (only when width >= 100)
      showDashboard
        ? React.createElement(Box, { flexShrink: 0, width: 1, height: "100%" },
            React.createElement(Text, { color: theme.colors.textDim }, "│"),
          )
        : null,
      showDashboard
        ? React.createElement(Dashboard, null)
        : null,
    ),
  );
}
