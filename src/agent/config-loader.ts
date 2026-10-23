/** Config Loader — Parse config/*.md into typed TS objects. */
import { readFileSync } from "fs";
import { resolve, join } from "path";

export interface AssistantConfig {
  name: string;
  essence: string;
  traits: string;
  rules: string;
  rawText: string;
}

export function loadAssistantConfig(configDir: string): AssistantConfig {
  const fp = resolve(configDir, "assistant.md");
  try {
    const text = readFileSync(fp, "utf-8");
    const nameMatch = text.match(/名字[：:]\s*(.+)/);
    const name = nameMatch ? nameMatch[1].trim() : "林雨";
    const essenceMatch = text.match(/## 核心驱动\n\n([\s\S]*?)(?=\n##|\n---|\Z)/);
    const essence = essenceMatch ? essenceMatch[1].trim().replace(/\n/g, " ") : "";
    const traitsMatch = text.match(/## 人格\n\n([\s\S]*?)(?=\n##|\n---|\Z)/);
    const traits = traitsMatch ? traitsMatch[1].trim().replace(/\n/g, " ") : "";
    const rulesMatch = text.match(/## 行为准则\n\n([\s\S]*?)(?=\n##|\n---|\Z)/);
    const rules = rulesMatch ? rulesMatch[1].trim() : "";
    return { name, essence, traits, rules, rawText: text };
  } catch {
    return { name: "林雨", essence: "", traits: "", rules: "", rawText: "" };
  }
}

export interface ToolDefinition {
  name: string; description: string; riskLevel: string;
  concurrencySafe: boolean; readOnly: boolean; parameters: Record<string, unknown>;
}

export function loadToolDefinitions(configDir: string): ToolDefinition[] {
  const fp = resolve(configDir, "tools.md");
  try {
    const text = readFileSync(fp, "utf-8");
    const tools: ToolDefinition[] = [];
    const sections = text.split(/^## /m).filter(s => s.trim());
    for (const sec of sections) {
      const nameMatch = sec.match(/^(\w+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1];
      const descMatch = sec.match(/描述[：:]\s*(.+)/);
      const riskMatch = sec.match(/风险等级[：:]\s*(.+)/);
      const concurrencyMatch = sec.match(/并发安全[：:]\s*(.+)/);
      const readOnlyMatch = sec.match(/只读[：:]\s*(.+)/);
      tools.push({
        name,
        description: descMatch ? descMatch[1].trim() : "",
        riskLevel: riskMatch ? riskMatch[1].trim().toLowerCase() : "low",
        concurrencySafe: concurrencyMatch ? concurrencyMatch[1].trim() === "true" : true,
        readOnly: readOnlyMatch ? readOnlyMatch[1].trim() === "true" : true,
        parameters: {},
      });
    }
    return tools;
  } catch {
    return [];
  }
}

