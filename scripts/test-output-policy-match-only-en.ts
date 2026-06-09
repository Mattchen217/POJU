/** Re-run Match only */
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
  const { calculateProfile } = await import("@/lib/calculations");
  const { buildMatchPrompt } = await import("@/lib/llm/prompts/match-deepseek-prompt");
  const { calculateCompatibilityMatrix } = await import("@/lib/match/calculate-compatibility");
  const { wrapProfileForMatrix } = await import("@/lib/match/parse-profile-for-matrix");
  const { callLLM } = await import("@/lib/llm/router");
  const profileA = await calculateProfile({
    year: 1988, month: 3, day: 12, hour_period: "mao", gender: "F", timezone: "America/New_York",
  });
  const profileB = await calculateProfile({
    year: 1985, month: 11, day: 8, hour_period: "wu", gender: "M", timezone: "America/New_York",
  });
  const matrix = calculateCompatibilityMatrix({
    profileA: wrapProfileForMatrix(profileA, null),
    profileB: wrapProfileForMatrix(profileB, null),
  });
  const { system, user } = buildMatchPrompt({
    a_profile: profileA,
    b_profile: profileB,
    relationship_description:
      "We are co-founders deciding how to split responsibilities after a tense quarter.",
    locale: "en",
    compatibilityMatrix: matrix,
  });
  const result = await callLLM({
    call_type: "match_report",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 8000,
    thinking_effort: "medium",
    response_format: "json",
  });
  const text = result.content;
  const dir = resolve(ROOT, ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "policy-match-en.txt"), text, "utf8");
  const v = detectOutputPolicyViolations(text, "en");
  console.log(text);
  console.log("\nviolations:", v.filter((x) => x.category === "marriage_chart_term" || x.category === "supernatural_promise"));
}

main().catch((e) => { console.error(e); process.exit(1); });
