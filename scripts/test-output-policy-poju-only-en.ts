/** Re-run POJU only */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { detectOutputPolicyViolations } from "@/lib/llm/compliance/audit-output";

const ROOT = resolve(__dirname, "..");
function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const { buildFinalDeliveryPrompt } = await import("@/lib/llm/pro/final-delivery");
  const { callLLM } = await import("@/lib/llm/router");
  const { createInitialAgentState } = await import("@/lib/poju/agent-state");
  const agent = createInitialAgentState({
    original_question: "Should I accept a lateral move that offers learning but less pay?",
  });
  agent.current_summary = null;
  const { system, user } = buildFinalDeliveryPrompt({
    agent_v2: agent,
    base_analysis: {
      structured: {
        core_nature: { element: "Metal", tone: "decisive" },
        balancing_element: "Water",
        life_cycle: { theme: "skill expansion" },
      },
      display_text: "Metal-like core nature; Water balances intensity.",
    },
    situation_analysis: { core_tension: "growth vs rent pressure in Toronto" },
    locale: "en",
    recent_user_messages: ["I value learning but worry about rent in Toronto."],
  });
  const result = await callLLM({
    call_type: "main_delivery",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 6000,
    thinking_effort: "medium",
  });
  const text = result.content;
  const dir = resolve(ROOT, ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "policy-poju-en.txt"), text, "utf8");
  const v = detectOutputPolicyViolations(text, "en").filter(
    (x) => x.category === "marriage_chart_term" || x.category === "supernatural_promise",
  );
  console.log(text);
  console.log("\nviolations:", v.length, v);
  process.exit(v.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
