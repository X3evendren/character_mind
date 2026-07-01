export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textDim: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeLayout {
  leftPanelWidth: number;
  showDashboard: boolean;
  dashboardDefaultTab: number;
}

export interface ThemeTypography {
  roleNameBold: boolean;
  timestampFormat: string;
}

export interface ThemeAnimation {
  streaming: boolean;
  progressBars: boolean;
  sparkline: boolean;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  layout: ThemeLayout;
  typography: ThemeTypography;
  animation: ThemeAnimation;
}
