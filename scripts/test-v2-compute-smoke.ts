/**
 * v2 第1次真算 · 三盘冒烟
 *   pnpm exec tsx scripts/test-v2-compute-smoke.ts
 *
 * Requires OPENROUTER_API_KEY in .env.local
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runCompute } from "@/lib/base-analysis-v2/compute/compute-call";
import { SEGMENT_PATHS, type ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  STRUCTURED_BALANCED,
  STRUCTURED_STRONG,
  STRUCTURED_WEAK,
} from "./_v2-fixtures";

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

// 简称抽查(采纳朋友优化2:加 杀印/财官杀/枭印)
const SIMP = ["比劫", "官杀", "食伤", "印枭", "财官", "杀印", "财官杀", "枭印"];
const TIME =
  /(19|20)\d{2}|[一二三四五六七八九〇零]{2,4}年|[1-9]\d?\s*(岁|周岁|虚岁)|第.+步?大运|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\s*(大运|流年|年|运)|交运|起运/;

function readSeg(rc: ReportComputed, path: string): { core_conclusion: string; bazi_basis: readonly string[] } {
  const parts = path.split(".");
  let cur: unknown = rc;
  for (const key of parts) {
    if (!cur || typeof cur !== "object") {
      return { core_conclusion: "", bazi_basis: [] };
    }
    cur = (cur as Record<string, unknown>)[key];
  }
  const seg = cur as { core_conclusion?: string; bazi_basis?: readonly string[] };
  return {
    core_conclusion: seg.core_conclusion ?? "",
    bazi_basis: seg.bazi_basis ?? [],
  };
}

function keywordCount(keywords: string | readonly string[]): number {
  if (Array.isArray(keywords)) return keywords.length;
  return String(keywords)
    .split(/[,，、/\s]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

async function oneChart(name: string, structured: ProfileStructured) {
  console.log(`\n===== 盘:${name} =====`);
  console.log(
    `  meta: strength=${structured.strength} dm=${structured.day_master} yong=${structured.yong_shen} pillars=${JSON.stringify(structured.four_pillars)}`,
  );
  const r = await runCompute(structured, "zh", `v2-compute-smoke-${name}`);
  if (!r.ok) {
    console.log(`❌ 失败:${r.reason} (attempts=${r.attempts})`);
    return;
  }
  const rc = r.value;
  for (const path of SEGMENT_PATHS) {
    const seg = readSeg(rc, path);
    console.log(`\n[${path}]`);
    console.log(`  结论: ${seg.core_conclusion}`);
    console.log(`  依据: ${seg.bazi_basis.join(" / ")}`);
    const timeLeak =
      TIME.test(seg.core_conclusion) || seg.bazi_basis.some((b) => TIME.test(b));
    const simpLeak = seg.bazi_basis.some((b) => SIMP.some((s) => b.includes(s)));
    const tooLong = [...seg.core_conclusion].length > 90;
    if (timeLeak) console.log(`  ⚠️ 时间锚泄漏!`);
    if (simpLeak) console.log(`  ⚠️ 简称泄漏!`);
    if (tooLong) console.log(`  ⚠️ 结论超长(${[...seg.core_conclusion].length}字)`);
  }
  console.log(
    `\n  summary: keywords=${keywordCount(rc.summary.keywords)} dos=${rc.summary.dos.length} donts=${rc.summary.donts.length} (dos/donts应各=3)`,
  );
  console.log(`  keywords: ${JSON.stringify(rc.summary.keywords)}`);
  console.log(`  current_theme: ${rc.summary.current_theme}`);
  console.log(`  dos: ${rc.summary.dos.join(" | ")}`);
  console.log(`  donts: ${rc.summary.donts.join(" | ")}`);
}

async function main() {
  loadEnvLocal();
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("missing OPENROUTER_API_KEY — add to .env.local");
    process.exit(1);
  }

  await oneChart("偏强", STRUCTURED_STRONG);
  await oneChart("偏弱", STRUCTURED_WEAK);
  await oneChart("均衡", STRUCTURED_BALANCED);
  console.log(
    "\n人工验收:三盘每段结论应【各不相同】;无时间锚/简称泄漏;结论≤80字;dos/donts各3条。",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
