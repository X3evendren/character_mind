import React, { useState, useEffect } from "react";
import { Box, Text, useStdout, useInput } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useChatStore } from "../stores/chat-store";
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
  const turnCount = useChatStore((s) => s.turns.length);

  // Responsive breakpoints
  const showDashboard = cols >= 100 && theme.layout.showDashboard;
  const isCompact = cols < 80;

  const latestNotification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  // 滚动偏移:0 = 锁定底部(最新),>0 = 向上看历史
  const [scrollOffset, setScrollOffset] = useState(0);

  // 新 turn 到来时自动重置到底部
  useEffect(() => {
    setScrollOffset(0);
  }, [turnCount]);

  // Ctrl+↑ 向上看历史, Ctrl+↓ 回到底部, 不与 MultilineEditor 的 ↑↓ 冲突
  useInput((_input, key) => {
    if (key.upArrow && key.ctrl) {
      setScrollOffset(o => Math.min(o + 1, Math.max(0, turnCount - 1)));
    }
    if (key.downArrow && key.ctrl) {
      setScrollOffset(o => Math.max(0, o - 1));
    }
  });

  // 固定布局高度:StatusBar(1) + InputArea(边框2+编辑器1+footer1=4) + Notification(1)
  const inputHeight = 4;
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
          React.createElement(TurnList, { maxRows: chatHeight, scrollOffset }),
        ),

        // 滚动提示(仅当向上查看历史时显示)
        scrollOffset > 0
          ? React.createElement(Text, { color: theme.colors.textDim, dimColor: true },
              `  ↑ 查看历史(${scrollOffset}轮前) · Ctrl+↓ 回到底部`)
          : null,

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
