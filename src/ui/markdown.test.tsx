import { describe, it, expect } from "vitest";
import React from "react";
import { renderMarkdown } from "./markdown";
import { DEFAULT_THEME } from "./theme/presets";

describe("renderMarkdown", () => {
  it("renders heading as bold Text", () => {
    const nodes = renderMarkdown("# 标题", DEFAULT_THEME);
    expect(nodes.length).toBeGreaterThan(0);
    const first = nodes[0];
    expect(React.isValidElement(first)).toBe(true);
    if (React.isValidElement(first)) {
      expect(first.props).toHaveProperty("bold", true);
    }
  });

  it("renders bold inline", () => {
    const nodes = renderMarkdown("这是 **加粗** 文本", DEFAULT_THEME);
    // 搜索所有节点（含嵌套）找 bold prop
    function hasBoldProp(el: React.ReactNode): boolean {
      if (!React.isValidElement(el)) return false;
      const props = el.props as any;
      if (props.bold === true) return true;
      const children = React.Children.toArray(props.children);
      return children.some(hasBoldProp);
    }
    expect(nodes.some(hasBoldProp)).toBe(true);
  });

  it("renders code block with backgroundColor", () => {
    const nodes = renderMarkdown("```\ncode here\n```", DEFAULT_THEME);
    const hasCodeBg = nodes.some(
      (n) => React.isValidElement(n) && (n.props as any).backgroundColor != null,
    );
    expect(hasCodeBg).toBe(true);
  });

  it("renders blockquote as dim", () => {
    const nodes = renderMarkdown("> 引用文字", DEFAULT_THEME);
    function hasDimDeep(el: React.ReactNode): boolean {
      if (!React.isValidElement(el)) return false;
      if ((el.props as any).dimColor === true) return true;
      const children = React.Children.toArray((el.props as any).children);
      return children.some(hasDimDeep);
    }
    expect(nodes.some(hasDimDeep)).toBe(true);
  });
});