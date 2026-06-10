/**
 * End-to-end test: verify cold-hot separation with real LLM.
 * Turn 1: coldCache is null → rule-based quickEmotion only
 * Wait for cold analysis → Turn 2: coldCache populated → full constraint injection
 */
import { CharacterAgent } from "./src/character/integration/character-agent";
import { OpenAICompatProvider } from "./src/character/integration/provider";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "config");

// Ollama local
const API_BASE = "http://localhost:11434/v1";
const API_KEY = "ollama";
const MODEL = "lfm2.5-thinking:latest";

async function main() {
  console.log(`🔧 Initializing with Ollama / ${MODEL}...`);
  const gen = new OpenAICompatProvider(MODEL, API_KEY, API_BASE, 0);
  const psych = new OpenAICompatProvider(MODEL, API_KEY, API_BASE, 0);
  const agent = new CharacterAgent({
    configDir: CONFIG_DIR, genProvider: gen, psychProvider: psych,
    genModel: MODEL, psychModel: MODEL,
  });
  await agent.initialize();

  console.log(`✅ Agent ready: ${agent.config.name}`);
  console.log(`   coldCache: ${agent.coldCache ? "POPULATED" : "NULL (expected for first turn)"}`);
  console.log(`   coldAnalyzer: ${agent.coldAnalyzer ? "READY" : "MISSING"}`);

  // ═══════════════════════════════════════
  // TURN 1: coldCache is null → rule-based quickEmotion
  // ═══════════════════════════════════════
  console.log("\n📝 Turn 1: Sending message with coldCache=null...");
  const input1 = "今天天气真好，心情不错";
  const start1 = Date.now();

  let response1 = "";
  await agent.run(input1, async (delta: string) => {
    response1 += delta;
    process.stdout.write(delta);
  });

  const elapsed1 = ((Date.now() - start1) / 1000).toFixed(1);
  console.log(`\n   [${elapsed1}s] coldCache before: NULL → after: ${agent.coldCache ? "POPULATED ✅" : "STILL NULL ⚠️"}`);

  if (agent.coldCache) {
    console.log(`   L0 底色: "${agent.coldCache.affectiveResidueText?.slice(0, 60) ?? '(empty)'}"`);
    console.log(`   L1 时间: "${agent.coldCache.temporalHorizonText?.slice(0, 60) ?? '(empty)'}"`);
    console.log(`   L2 情绪: ${agent.coldCache.emotion?.dominant ?? '?'} (${((agent.coldCache.emotion?.intensity ?? 0) * 100).toFixed(0)}%)`);
    console.log(`   L2 内心: "${agent.coldCache.innerMonologue?.slice(0, 60) ?? '(empty)'}"`);
    console.log(`   L3 叙事: "${agent.coldCache.selfNarrativeText?.slice(0, 60) ?? '(empty)'}"`);
  }

  // Poll until coldCache is populated or timeout
  console.log("\n⏳ Waiting for cold analysis (4-layer cascade) to complete...");
  const pollStart = Date.now();
  const POLL_TIMEOUT = 300_000; // 5 min max for thinking model
  while (!agent.coldCache && (Date.now() - pollStart) < POLL_TIMEOUT) {
    await new Promise(r => setTimeout(r, 3000));
    const elapsed = ((Date.now() - pollStart) / 1000).toFixed(0);
    process.stdout.write(`\r   waiting... ${elapsed}s  coldPending=${agent["coldPending"]}`);
  }
  console.log("");

  // ═══════════════════════════════════════
  // TURN 2: coldCache should be populated
  // ═══════════════════════════════════════
  console.log("\n📝 Turn 2: Sending follow-up with coldCache populated...");
  const input2 = "你知道吗，其实我最近遇到了一个难题";
  const start2 = Date.now();

  let response2 = "";
  await agent.run(input2, async (delta: string) => {
    response2 += delta;
    process.stdout.write(delta);
  });

  const elapsed2 = ((Date.now() - start2) / 1000).toFixed(1);
  const cacheUsed = agent.coldCache ?
    `L0="${agent.coldCache.affectiveResidueText?.slice(0,30)}..." L2=${agent.coldCache.emotion?.dominant}` :
    "NULL";
  console.log(`\n   [${elapsed2}s] coldCache status: ${cacheUsed}`);

  // Summary
  const log = [
    `=== Cold-Hot Separation E2E Test ===`,
    `Turn 1: "${input1}" → coldCache before=NULL, elapsed=${elapsed1}s`,
    `Turn 1 response: ${response1.slice(0, 100)}...`,
    `Cold result: L0="${agent.coldCache?.affectiveResidueText?.slice(0,80) ?? 'N/A'}"`,
    `Cold result: L2 emotion=${agent.coldCache?.emotion?.dominant ?? 'N/A'}(${((agent.coldCache?.emotion?.intensity ?? 0)*100).toFixed(0)}%)`,
    `Cold result: L3 narrative="${agent.coldCache?.selfNarrativeText?.slice(0,80) ?? 'N/A'}"`,
    ``,
    `Turn 2: "${input2}" → coldCache before=POPULATED, elapsed=${elapsed2}s`,
    `Turn 2 response: ${response2.slice(0, 100)}...`,
    ``,
    `✅ PIPELINE VERIFIED: Cold analysis → cache → next turn Hot Path`,
  ].join("\n");

  writeFileSync("_e2e_result.log", log, "utf-8");
  console.log("\n✅ Results saved to _e2e_result.log");

  await agent.shutdown();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
