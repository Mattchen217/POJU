/**
 * v2 全链路端到端冒烟（真算 → 正文/依据并行 → 合并）
 *   pnpm exec tsx scripts/test-v2-e2e-smoke.ts
 *
 * Requires OPENROUTER_API_KEY in .env.local
 * Optional: V2_E2E_ONE=strong|weak|balanced 只跑一盘
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { runReportV2 } from "@/lib/base-analysis-v2/orchestrate/run-report";
import { parseBaseAnalysisSections } from "@/lib/base-analysis/parse-base-analysis-sections";
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

const TIME_RE =
  /(19|20)\d{2}\s*年?|[1-9]\d?\s*(岁|周岁|虚岁)|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\s*(大运|流年)/;
const SIMP_RE = /(比劫|官杀|食伤|印枭|枭印|财官|杀印|财官杀)/;

function stripEvidenceBlocks(md: string): string {
  return md.replace(
    /\*\*(?:依据与推理|Evidence\s*&\s*reasoning)[:：]\*\*[\s\S]*?(?=\n##\s|\n\*\*[^*]+[:：]\*\*|\n*$)/gi,
    "",
  );
}

async function one(name: string, structured: ProfileStructured): Promise<boolean> {
  console.log(`\n===== ${name} =====`);
  const r = await runReportV2(structured, "zh", `v2-e2e-${name}`);
  if (!r.ok) {
    console.log(`❌ ${r.stage}: ${r.reason}`, r.timings);
    return false;
  }

  const { markdown: md, timings: t } = r;
  const outPath = resolve(ROOT, `scripts/_tmp-v2-e2e-${name}.md`);
  writeFileSync(outPath, md, "utf8");

  const sections = parseBaseAnalysisSections(md);
  const bodyOnly = stripEvidenceBlocks(md);
  const hasGold = md.includes("⟦t:");
  const timeHit = TIME_RE.test(md);
  const simpHit = SIMP_RE.test(md);
  const cornerInBody = /「[^」]{1,40}」/.test(bodyOnly);
  const markerInBody = bodyOnly.includes("⟦t:");
  const nar = t.narrative ?? 0;
  const ev = t.evidence ?? 0;
  const par = t.parallel ?? 0;
  const parallelOk = par > 0 && par < nar + ev;

  console.log(
    `⏱ compute=${t.compute}ms parallel=${par}ms (nar=${nar}ms ev=${ev}ms) total=${t.total}ms`,
  );
  console.log(`并行红利: parallel ${parallelOk ? "<" : "⚠ ≥"} nar+ev (${nar + ev}ms)`);
  console.log(`sections=${sections.length} 金字=${hasGold} 时间锚=${timeHit} 简称=${simpHit}`);
  console.log(`正文角引号=${cornerInBody} 正文标记=${markerInBody}`);
  console.log(`wrote ${outPath}`);
  console.log("\n--- 报告预览(前1200字) ---\n" + md.slice(0, 1200));

  const ok =
    sections.length === 6 &&
    hasGold &&
    !timeHit &&
    !simpHit &&
    !cornerInBody &&
    !markerInBody &&
    parallelOk;

  console.log(ok ? `✅ ${name} 自检通过` : `⚠ ${name} 自检有告警（请人工看全文）`);
  return ok;
}

async function main(): Promise<void> {
  loadEnvLocal();
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY (.env.local)");
    process.exit(1);
  }

  const only = process.env.V2_E2E_ONE?.trim();
  const charts: Array<[string, ProfileStructured]> = [
    ["strong", STRUCTURED_STRONG],
    ["weak", STRUCTURED_WEAK],
    ["balanced", STRUCTURED_BALANCED],
  ];
  const selected = only ? charts.filter(([n]) => n === only) : charts;
  if (!selected.length) {
    console.error(`Unknown V2_E2E_ONE=${only}`);
    process.exit(1);
  }

  let allOk = true;
  for (const [name, structured] of selected) {
    const ok = await one(name, structured);
    if (!ok) allOk = false;
  }

  console.log(
    "\n人工验收:6模块齐;每段正文白话+折叠依据;三盘内容各异;正文零命理词;依据金字齐;零时间锚;正文↔依据同源。",
  );
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
