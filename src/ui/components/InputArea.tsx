import React, { useState, useCallback, useMemo } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { MultilineEditor } from "./MultilineEditor";
import { Autocomplete } from "./Autocomplete";
import type { AutocompleteItem } from "./Autocomplete";
import { getCommandNames } from "../../commands/registry";

/**
 * Chinese descriptions for known commands. Commands registered in the
 * registry without an entry here simply show an empty detail.
 */
const COMMAND_DETAILS: Record<string, string> = {
  "/dream": "进入梦境模式",
  "/think": "触发深度思考",
  "/model": "切换模型",
  "/stats": "查看状态统计",
  "/help": "显示帮助",
  "/quit": "退出",
  "/theme": "切换主题",
  "/clear": "清空对话",
};

/** Build autocomplete items dynamically from the command registry. */
function getCommandItems(): AutocompleteItem[] {
  return getCommandNames().map((name) => ({
    label: name,
    detail: COMMAND_DETAILS[name] ?? "",
    category: "命令",
  }));
}

/**
 * Detect autocomplete trigger from current text.
 * Returns the trigger type and the partial text after the trigger.
 */
function detectAutocomplete(text: string): {
  category: string;
  prefix: string;
  partial: string;
} | null {
  // Check for command trigger at start of line
  const cmdMatch = text.match(/(?:^|\s)(\/\w*)$/);
  if (cmdMatch && text.trimStart()[0] === "/") {
    return {
      category: "命令",
      prefix: cmdMatch[0],
      partial: cmdMatch[1].slice(1).toLowerCase(),
    };
  }

  // Check for @ triggers
  const atMatch = text.match(/(?:^|\s)(@(?:file|mem|tool)?\w*)$/);
  if (atMatch) {
    const partial = atMatch[1];
    if (partial.startsWith("@file")) {
      return { category: "文件", prefix: "@file", partial: partial.slice(5).toLowerCase() };
    }
    if (partial.startsWith("@mem")) {
      return { category: "记忆", prefix: "@mem", partial: partial.slice(4).toLowerCase() };
    }
    if (partial.startsWith("@tool")) {
      return { category: "工具", prefix: "@tool", partial: partial.slice(5).toLowerCase() };
    }
    return { category: "提及", prefix: "@", partial: partial.slice(1).toLowerCase() };
  }

  return null;
}

/** Filter autocomplete items by partial text match */
function filterItems(items: AutocompleteItem[], partial: string): AutocompleteItem[] {
  if (!partial) return items;
  const lower = partial.toLowerCase();
  return items.filter(item =>
    item.label.toLowerCase().includes(lower) ||
    (item.detail?.toLowerCase().includes(lower) ?? false),
  );
}

export function InputArea({
  onSubmit,
  disabled = false,
  placeholder = "输入消息... (Enter 发送, Alt+Enter 换行)",
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const [text, setText] = useState("");
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const trigger = useMemo(() => detectAutocomplete(text), [text]);

  const commandItems = useMemo(() => getCommandItems(), []);

  const filteredItems = useMemo(() => {
    if (!trigger) return commandItems;
    switch (trigger.category) {
      case "命令": return filterItems(commandItems, trigger.partial);
      case "文件": return filterItems([
        { label: "@file config", detail: "配置文件" },
        { label: "@file memory", detail: "记忆文件" },
        { label: "@file log", detail: "日志文件" },
      ], trigger.partial);
      case "记忆": return filterItems([
        { label: "@mem recent", detail: "最近记忆" },
        { label: "@mem search", detail: "搜索记忆" },
        { label: "@mem core", detail: "核心记忆" },
      ], trigger.partial);
      case "工具": return filterItems([
        { label: "@tool read_file", detail: "读取文件" },
        { label: "@tool write_file", detail: "写入文件" },
        { label: "@tool exec_command", detail: "执行命令" },
        { label: "@tool web_search", detail: "搜索网页" },
      ], trigger.partial);
      default: return [];
    }
  }, [trigger]);

  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    const t = detectAutocomplete(newText);
    setAutocompleteVisible(t !== null);
    setSelectedIndex(0);
  }, []);

  const handleSubmit = useCallback((submittedText: string) => {
    onSubmit(submittedText);
    setText("");
    setAutocompleteVisible(false);
    setSelectedIndex(0);
  }, [onSubmit]);

  return React.createElement(Box, { flexDirection: "column" },
    // Autocomplete panel (shown above input area)
    React.createElement(Autocomplete, {
      items: filteredItems,
      selectedIndex,
      visible: autocompleteVisible,
      category: trigger?.category,
    }),

    // True bordered input box (rounded corners, primary-colored frame)
    React.createElement(Box, {
      borderStyle: "round" as const,
      borderColor: theme.colors.primary,
      flexDirection: "column",
      paddingX: 1,
    },
      React.createElement(MultilineEditor, {
        onSubmit: handleSubmit,
        onTextChange: handleTextChange,
        maxLines: 5,
        placeholder,
        disabled,
      }),
    ),

    // Footer hint (below border, dim)
    React.createElement(Text, { color: theme.colors.textDim, dimColor: true },
      "  Enter 发送 · Alt+Enter 换行"),
  );
}
