// Debug: test cold analyzer layer by layer with Ollama
import { OpenAICompatProvider } from "./src/character/integration/provider";
import { FourLayerColdAnalyzer } from "./src/character/integration/cold-analyzer";
import { MindState } from "./src/character/mind/mind-state";
import { DriveState } from "./src/character/drive/desires";

const BASE = "http://localhost:11434/v1";
const MODEL = "lfm2.5-thinking:latest";
const KEY = "ollama";

async function main() {
  const p = new OpenAICompatProvider(MODEL, KEY, BASE, 0);

  // Quick test: basic chat works?
  console.log("🧪 Testing basic chat...");
  try {
    const r = await p.chat([{ role: "user", content: "用一句话回复：你好吗？" }], 0.3, 100);
    console.log(`   response: "${r.content?.slice(0, 100)}"`);
    console.log(`   ✅ Basic chat works`);
  } catch (e: any) {
    console.error(`   ❌ Basic chat FAILED:`, e.message);
    return;
  }

  // Test cold analyzer
  console.log("\n🧪 Testing FourLayerColdAnalyzer...");
  const analyzer = new FourLayerColdAnalyzer(p, p);

  const ms = new MindState();
  const ds = new DriveState();
  const params = {
    input: "今天天气真好",
    response: "是啊，阳光让人心情好",
    taskMode: false,
    mindState: ms,
    drives: ds.toDict(),
    assistantConfig: { name: "林雨" },
    previousResidueVector: { warmth: 0.2, weight: 0.3, clarity: 0.2, tension: 0.1 },
    previousRetention: { emotionDominant: "neutral", emotionIntensity: 0.3, unfinished: false },
    timeSinceLastTurn: 10,
    selfNarrative: "刚开始和用户互动",
    growthLog: [],
    snapshot: "",
  };

  try {
    const start = Date.now();
    const cache = await analyzer.analyze(params);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`   [${elapsed}s] ✅ Cold analysis completed`);
    console.log(`   L0 底色: "${cache.affectiveResidueText?.slice(0, 80)}"`);
    console.log(`   L1 时间: "${cache.temporalHorizonText?.slice(0, 80)}"`);
    console.log(`   L2 情绪: ${cache.emotion?.dominant} (${((cache.emotion?.intensity ?? 0) * 100).toFixed(0)}%)`);
    console.log(`   L2 内心: "${cache.innerMonologue?.slice(0, 80)}"`);
    console.log(`   L3 叙事: "${cache.selfNarrativeText?.slice(0, 80)}"`);
  } catch (e: any) {
    console.error(`   ❌ Cold analysis FAILED:`, e.message);
    console.error(e.stack?.split("\n").slice(0, 5).join("\n"));
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
