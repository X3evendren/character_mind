// Raw test: what does Ollama lfm2.5-thinking actually return?
const BASE = "http://localhost:11434/v1";

async function main() {
  const body = {
    model: "lfm2.5-thinking:latest",
    messages: [{ role: "user", content: "请用1句话中文回复：今天天气真好" }],
    temperature: 0.3,
    max_tokens: 200,
  };

  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  const msg = j.choices?.[0]?.message;
  console.log("content:", JSON.stringify(msg?.content));
  console.log("reasoning_content:", JSON.stringify(msg?.reasoning_content));
  console.log("all message keys:", Object.keys(msg || {}));
  console.log("full message:", JSON.stringify(msg).slice(0, 500));
}

main().catch(e => console.error(e));
