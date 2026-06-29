/**
 * Block 42 — breakthrough-core shen_sha guard at user prompt tail.
 * Run: pnpm exec tsx scripts/test-poju-block42-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  buildBreakthroughCorePrompt,
} from "@/lib/llm/deepseek/breakthrough-core";
import { extractChartShenSha } from "@/lib/llm/prompts/shen-sha-guard";
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
  console.log("\n=== Block 42 acceptance ===\n");

  const src = read("lib/llm/prompts/shen-sha-guard.ts");
  assert("extractChartShenSha exported", src.includes("export function extractChartShenSha"));
  assert("buildShenShaGuardBlock", src.includes("export function buildShenShaGuardBlock"));

  const btSrc = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("guard before task", btSrc.includes("${shenShaGuard}\n\n【任务】"));

  const names = extractChartShenSha(structuredWithSha);
  assert("extract dedupes pillars", names.includes("天乙贵人") && names.includes("驿马"));

  const { user } = buildBreakthroughCorePrompt({
    base_analysis: { structured: structuredWithSha },
    agent_v2: null,
    original_question: "什么时候再婚",
    locale: "zh-CN",
  });
  assert("user has hard guard", user.includes("【本盘神煞 · 硬约束"));
  assert("user lists chart shen_sha", user.includes("天乙贵人") && user.includes("驿马"));
  assert("guard before task in user", user.indexOf("【本盘神煞") < user.indexOf("【任务】"));

  const emptyPd = { ...structuredWithSha, pillars_detail: undefined } as ProfileStructured;
  const { user: emptyUser } = buildBreakthroughCorePrompt({
    base_analysis: { structured: { ...emptyPd, pillars_detail: {
      year: { ganzhi: "a", stem: "a", branch: "a", ten_god: "x", hidden_stems: [], shen_sha: [] },
      month: { ganzhi: "b", stem: "b", branch: "b", ten_god: "x", hidden_stems: [], shen_sha: [] },
      day: { ganzhi: "c", stem: "c", branch: "c", ten_god: "x", hidden_stems: [], shen_sha: [] },
      hour: { ganzhi: "d", stem: "d", branch: "d", ten_god: "x", hidden_stems: [], shen_sha: [] },
    } } },
    agent_v2: null,
    original_question: "test",
    locale: "zh-CN",
  });
  assert("empty chart forbids all shen_sha", emptyUser.includes("一个神煞名都不许出现"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 42 checks passed.\n");
}

main();
