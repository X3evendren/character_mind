import React, { useState } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { DashboardHeader } from "./DashboardHeader";
import { Tab1_Overview } from "./dashboard/Tab1_Overview";
import { Tab2_Details } from "./dashboard/Tab2_Details";
import { Tab3_Relationships } from "./dashboard/Tab3_Relationships";

const TAB_LABELS = ["概览", "细节", "关系"];
const TAB_COUNT = TAB_LABELS.length;

export function Dashboard({ activeTab, onTabChange }: {
  activeTab?: number;
  onTabChange?: (tab: number) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const [internalTab, setInternalTab] = useState(0);
  const tab = activeTab ?? internalTab;

  const setTab = (t: number) => {
    if (onTabChange) onTabChange(t);
    else setInternalTab(t);
  };

  const renderTab = () => {
    switch (tab) {
      case 0: return React.createElement(Tab1_Overview, null);
      case 1: return React.createElement(Tab2_Details, null);
      case 2: return React.createElement(Tab3_Relationships, null);
      default: return React.createElement(Tab1_Overview, null);
    }
  };

  return React.createElement(Box, { flexDirection: "column", width: 32, flexShrink: 0, paddingRight: 1 },
    // Header
    React.createElement(DashboardHeader, null),

    React.createElement(Text, { color: theme.colors.textDim }, "─".repeat(30)),

    // Tab bar
    React.createElement(Box, { flexDirection: "row" },
      ...TAB_LABELS.map((label, i) =>
        React.createElement(Text, {
          key: label,
          color: i === tab ? theme.colors.secondary : theme.colors.textDim,
          bold: i === tab,
        }, i > 0 ? ` | ${label}` : ` ${label}`),
      ),
    ),
    React.createElement(Text, { color: theme.colors.textDim }, "─".repeat(30)),

    // Tab content
    renderTab(),
  );
}
