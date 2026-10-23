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
  showDashboard: boolean;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  layout: ThemeLayout;
}
