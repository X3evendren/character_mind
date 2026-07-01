import React from "react";
import { Text, Box } from "ink";
import { useTheme } from "../theme/context";

export interface AutocompleteItem {
  label: string;
  detail?: string;
  category?: string;
}

export function Autocomplete({
  items,
  selectedIndex,
  visible,
  category,
}: {
  items: AutocompleteItem[];
  selectedIndex: number;
  visible: boolean;
  category?: string;
}) {
  const theme = useTheme();

  if (!visible || items.length === 0) return null;

  const startIdx = Math.max(0, Math.min(selectedIndex - 2, items.length - 5));
  const visibleItems = items.slice(startIdx, startIdx + 5);
  const clampedSelected = selectedIndex - startIdx;

  return React.createElement(Box, {
    flexDirection: "column",
    borderStyle: "single" as const,
    borderColor: theme.colors.secondary,
    paddingLeft: 1,
    paddingRight: 1,
  },
    category
      ? React.createElement(Text, { bold: true, color: theme.colors.secondary }, ` ${category} `)
      : null,
    ...visibleItems.map((item, i) => {
      const isSelected = i === clampedSelected;
      return React.createElement(Box, { key: `${item.label}_${i}`, flexDirection: "row" },
        React.createElement(Text, { color: theme.colors.textDim }, isSelected ? "> " : "  "),
        React.createElement(Text, {
          color: isSelected ? theme.colors.primary : theme.colors.text,
          bold: isSelected,
        }, item.label),
        item.detail
          ? React.createElement(Text, { color: theme.colors.textDim }, `  ${item.detail}`)
          : null,
      );
    }),
    items.length > 5
      ? React.createElement(Text, { color: theme.colors.textDim },
          `  ... ${items.length} 项, Up/Down 选择, Enter 确认, Esc 取消`,
        )
      : React.createElement(Text, { color: theme.colors.textDim },
          "  Up/Down 选择, Enter 确认, Esc 取消",
        ),
  );
}
