/**
 * Match v5 Step 6 — prompt + service + API static checks.
 * Run: pnpm exec tsx scripts/test-match-v5-step6.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildMatchPrompt } from "../lib/llm/prompts/match-deepseek-prompt";

const root = join(import.meta.dirname ?? __dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prompt = read("lib/llm/prompts/match-deepseek-prompt.ts");
const service = read("lib/llm/services/match-analysis-service.ts");
const route = read("app/api/match/analyze/route.ts");

assert(prompt.includes("buildMatchPrompt"), "buildMatchPrompt");
assert(prompt.includes("detectLanguage"), "uses detectLanguage");
assert(prompt.includes("analysis_a"), "5 sections in schema");
assert(prompt.includes("compatibility_level"), "compatibility_level");

assert(service.includes("generateMatchAnalysis"), "generateMatchAnalysis");
assert(service.includes("ensureBaseAnalysis"), "base analysis ensure");
assert(service.includes("highly_compatible"), "validates levels");
assert(service.includes('recordProfileUsage'), "records usage");

assert(route.includes("maxDuration = 180"), "maxDuration");
assert(route.includes("generateMatchAnalysis"), "API wired");

const zh = buildMatchPrompt({
  a_profile: null,
  a_base_analysis: null,
  b_profile: null,
  b_base_analysis: null,
  relationship_description: "我们是合作伙伴，考虑扩大生意",
  locale: "en",
});
assert(zh.detected_language.includes("Chinese"), "Chinese detection");
assert(zh.system.includes("合作伙伴"), "relationship in prompt");

const en = buildMatchPrompt({
  a_profile: null,
  a_base_analysis: null,
  b_profile: null,
  b_base_analysis: null,
  relationship_description: "My fiance and I plan to marry next year.",
  locale: "zh",
});
assert(en.detected_language === "English", "English detection despite zh locale");

console.log("Match v5 Step 6: static checks passed.");
console.log("detected (zh input):", zh.detected_language);
console.log("detected (en input):", en.detected_language);
