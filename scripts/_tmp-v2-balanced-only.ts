/**
 * Finish missing balanced chart after interrupted 3-chart smoke.
 *   pnpm exec tsx scripts/_tmp-v2-balanced-only.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { runCompute } from "@/lib/base-analysis-v2/compute/compute-call";
import { SEGMENT_PATHS, type ReportComputed } from "@/lib/base-analysis-v2/report-schema";
import { STRUCTURED_BALANCED } from "./_v2-fixtures";

function loadEnvLocal(): void {
  const path = resolve(__dirname, "../.env.local");
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

function readSeg(rc: ReportComputed, path: string) {
  let cur: unknown = rc;
  for (const key of path.split(".")) {
    if (!cur || typeof cur !== "object") return { core_conclusion: "", bazi_basis: [] as string[] };
    cur = (cur as Record<string, unknown>)[key];
  }
  const seg = cur as { core_conclusion?: string; bazi_basis?: string[] };
  return { core_conclusion: seg.core_conclusion ?? "", bazi_basis: seg.bazi_basis ?? [] };
}

async function main() {
  loadEnvLocal();
  console.log(
    "start balanced",
    STRUCTURED_BALANCED.strength,
    STRUCTURED_BALANCED.day_master,
    "(expect 2-5 min silence between heartbeats)",
  );
  const r = await runCompute(STRUCTURED_BALANCED, "zh", "v2-smoke-balanced-only");
  if (!r.ok) {
    console.log("FAIL", r.reason, r.attempts);
    process.exit(1);
  }
  const lines: string[] = [`OK attempts ${r.attempts}`];
  for (const path of SEGMENT_PATHS) {
    const seg = readSeg(r.value, path);
    lines.push(`\n[${path}]`);
    lines.push(`  结论: ${seg.core_conclusion}`);
    lines.push(`  依据: ${seg.bazi_basis.join(" / ")}`);
  }
  lines.push(`\nsummary: ${JSON.stringify(r.value.summary, null, 2)}`);
  const out = lines.join("\n");
  writeFileSync(resolve(__dirname, "_tmp-v2-balanced-out.txt"), out, "utf8");
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
