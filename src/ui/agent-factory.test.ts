import { describe, it, expect } from "vitest";
import { selectProviderSpec } from "./agent-factory";

describe("selectProviderSpec", () => {
  it("detects deepseek by API key prefix", () => {
    const spec = selectProviderSpec({ apiKey: "sk-deepseek-xxx", baseUrl: "", model: "deepseek-chat" });
    expect(spec?.name).toBe("deepseek");
  });

  it("detects anthropic by API key prefix", () => {
    const spec = selectProviderSpec({ apiKey: "sk-ant-xxx", baseUrl: "", model: "claude-3" });
    expect(spec?.name).toBe("anthropic");
  });

  it("detects by base URL keyword", () => {
    const spec = selectProviderSpec({ apiKey: "", baseUrl: "https://openrouter.ai/api/v1", model: "" });
    expect(spec?.name).toBe("openrouter");
  });

  it("detects by model name keyword", () => {
    const spec = selectProviderSpec({ apiKey: "fake", baseUrl: "", model: "gpt-4o" });
    expect(spec?.name).toBe("openai");
  });

  it("returns undefined for unknown", () => {
    const spec = selectProviderSpec({ apiKey: "", baseUrl: "", model: "" });
    expect(spec).toBeUndefined();
  });
});