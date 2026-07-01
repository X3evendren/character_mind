import React from "react";
import { Box, Text, useStdout } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { Dashboard } from "./Dashboard";
import { StatusBar } from "./StatusBar";
import { ChatArea } from "./ChatArea";
import { InputArea } from "./InputArea";
import { NotificationToast } from "./NotificationToast";
import type { ChatMessage } from "./Message";

export function MainLayout({
  messages,
  notifications,
  onSubmit,
  disabled,
  agentName,
  statusText,
}: {
  messages: ChatMessage[];
  notifications: Array<{ id: string; message: string; type: "info" | "success" | "warning" | "error" }>;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  agentName: string;
  statusText?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;

  // Responsive breakpoints
  const showDashboard = cols >= 100 && theme.layout.showDashboard;
  const isCompact = cols < 80;

  const latestNotification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  return React.createElement(
    Box,
    { flexDirection: "column", height: "100%" },
    // Status bar at top
    React.createElement(StatusBar, {
      agentName,
      notificationCount: notifications.length,
    }),

    // Main content area: side panel (optional) + chat
    React.createElement(
      Box,
      { flexDirection: "row", flexGrow: 1 },
      // Left dashboard panel (only when width >= 100)
      showDashboard
        ? React.createElement(Dashboard, null)
        : null,

      // Right: chat + input
      React.createElement(
        Box,
        { flexDirection: "column", flexGrow: 1 },
        // Chat area
        React.createElement(ChatArea, {
          messages,
          maxVisible: isCompact ? 10 : undefined,
        }),

        // Notification toast (right-aligned, inside chat column)
        React.createElement(NotificationToast, {
          message: latestNotification?.message ?? "",
          type: latestNotification?.type ?? "info",
          visible: latestNotification !== null,
        }),

        // Status line (per-turn phase info)
        statusText
          ? React.createElement(Text, { color: theme.colors.textDim }, `  ${statusText}`)
          : null,

        // Input area at bottom
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
    ),
  );
}
