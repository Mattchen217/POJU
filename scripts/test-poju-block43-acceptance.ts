/**
 * Block 43 — out-of-set shen_sha chat leak + opening anchor quality.
 * Run: pnpm exec tsx scripts/test-poju-block43-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { encodeTermMarker } from "@/lib/llm/sanitize/compliance-terms";
import { stripForbiddenShenSha } from "@/lib/llm/sanitize/term-marking";
import { buildChatShenShaGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const structuredWithSha = {
  day_master: "庚",
  pattern: "x",
  yong_shen: "水",
  xi_shen: [],
  ji_shen: [],
  strength: "balanced",
  four_pillars: { year: "庚午", month: "癸未", day: "辛卯", hour: "戊戌" },
  pillars_detail: {
    year: { ganzhi: "庚午", stem: "庚", branch: "午", ten_god: "x", hidden_stems: [], shen_sha: ["天乙贵人"] },
    month: { ganzhi: "癸未", stem: "癸", branch: "未", ten_god: "x", hidden_stems: [], shen_sha: ["驿马"] },
    day: { ganzhi: "辛卯", stem: "辛", branch: "卯", ten_god: "x", hidden_stems: [], shen_sha: [] },
    hour: { ganzhi: "戊戌", stem: "戊", branch: "戌", ten_god: "x", hidden_stems: [], shen_sha: [] },
  },
  da_yun: [],
  data_availability: { pillars_detail: true, da_yun: false, bazi_enrichment: false },
} as ProfileStructured;

function main(): void {
  console.log("\n=== Block 43 acceptance ===\n");

  const oriental = read("lib/llm/phases/oriental-prompt-context.ts");
  assert("chat system uses buildChatShenShaGuardBlock", oriental.includes("buildChatShenShaGuardBlock"));
  assert("chat system passes structured guard", oriental.includes("buildChatShenShaGuardBlock(structured)"));

  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("sanitizeResponse uses stripForbiddenShenSha", transport.includes("stripForbiddenShenSha"));
  assert("sanitizeResponse filters out_of_set hits", transport.includes('startsWith("out_of_set")'));
  assert("sanitizeResponse logs strip warn", transport.includes("[chat] 集外神煞已剥离"));

  const pojuBase = read("lib/llm/prompts/poju-base.ts");
  assert("opening requires chart anchor", pojuBase.includes("至少要有一处长在本盘结构上的具体判断"));
  assert("opening bans vague prose", pojuBase.includes("藤蔓找依附"));

  const guard = buildChatShenShaGuardBlock(structuredWithSha);
  assert("chat guard lists chart shen_sha", guard.includes("天乙贵人") && guard.includes("驿马"));
  assert("chat guard forbids 天喜", guard.includes("天喜"));

  const marker = encodeTermMarker("auxiliary_stars", "天喜", "训练集里的喜庆星");
  const leaked = `你盘里${marker}暗示喜事临近，再结合用神说话。`;
  const stripped = stripForbiddenShenSha(leaked);
  assert("strip removes out-of-set marker", !stripped.includes("天喜") && !stripped.includes("⟦t:"));
  assert("strip keeps allowed prose", stripped.includes("用神"));

  const bare = "天喜[···]暗示感情变动，先看日主强弱。";
  const bareStripped = stripForbiddenShenSha(bare);
  assert("strip removes bare 天喜", !bareStripped.includes("天喜"));
  assert("strip removes orphan brackets", !bareStripped.includes("[···]"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 43 checks passed.\n");
}

main();
