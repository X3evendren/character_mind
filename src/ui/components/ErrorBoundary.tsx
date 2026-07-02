/**
 * ErrorBoundary — 捕获组件树渲染错误，防止一处崩溃导致整屏白屏。
 */
import React, { Component } from "react";
import { Text, Box } from "ink";

export class ErrorBoundary extends Component<{ children: React.ReactNode; area?: string }> {
  state = { hasError: false, error: null as Error | null };
  private _area = "";
  private _kids: React.ReactNode = null;

  constructor(props: { children: React.ReactNode; area?: string }) {
    super(props);
    this._area = props.area ?? "";
    this._kids = props.children;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary${this._area ? `:${this._area}` : ""}]`, error.message);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement(Box, {
        flexDirection: "column",
        borderStyle: "single",
        borderColor: "red",
        paddingX: 1,
      },
        React.createElement(Text, { color: "red", bold: true },
          `✗ ${this._area || "渲染"}错误: ${this.state.error?.message ?? "未知错误"}`),
        React.createElement(Text, { dimColor: true }, "  重启或刷新终端恢复"),
      );
    }
    return this._kids;
  }
}