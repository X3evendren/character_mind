import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

export type ToastType = "info" | "success" | "warning" | "error";

export const NotificationToast = React.memo(function NotificationToast({ message, type, visible }: {
  message: string;
  type?: ToastType;
  visible: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);

  if (!visible || !message) return null;

  const colorMap: Record<ToastType, string> = {
    info: theme.colors.secondary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };
  const iconMap: Record<ToastType, string> = {
    info: "i",
    success: "+",
    warning: "!",
    error: "x",
  };

  const color = colorMap[type ?? "info"];
  const icon = iconMap[type ?? "info"];

  return React.createElement(Box, {
    flexDirection: "row",
    alignSelf: "flex-end",
    marginTop: 0,
  },
    React.createElement(Text, { color, bold: true }, `[${icon}] `),
    React.createElement(Text, { color: theme.colors.text }, message),
  );
});
