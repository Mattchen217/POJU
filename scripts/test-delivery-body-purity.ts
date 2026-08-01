/**
 * Delivery body purity — detect + warn only (no Phase-4 STOP).
 *
 *   pnpm exec tsx scripts/test-delivery-body-purity.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  findDeliveryProsePollution,
  isDeliveryProseClean,
} from "@/lib/llm/pro/delivery/delivery-body-purity";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== Delivery body purity ==========\n");

  assert(
    "clean vernacular passes",
    isDeliveryProseClean(
      "融资创业这件事充满高压。你不是不努力，而是在一个持续抽干你的环境里硬撑。",
    ),
  );
  assert(
    "### heading + plain body passes",
    isDeliveryProseClean("### 过去几年的工作模式是最大消耗源\n\n融资创业这件事，充满了高压。"),
  );
  assert(
    "bare 判决 is clean (vernacular)",
    isDeliveryProseClean("你收到的不是判决。它是一个视角。"),
  );

  const dirty =
    "需养，生于寅月得根，但全局火金不弱，喜水木为用。岁环供源浮见贴身。";
  const hit = findDeliveryProsePollution(dirty);
  assert("polluted basis dump detected", hit != null);
  assert(
    "detects soft gloss or jargon",
    Boolean(hit && (hit.label === "soft_gloss" || hit.label === "basis_jargon" || hit.label === "branch_month")),
  );
  assert("detects 锚元", findDeliveryProsePollution("你的锚元是水")?.label === "soft_gloss");
  assert("detects 用神", findDeliveryProsePollution("用神是水木")?.label === "banned_term");
  assert("detects 命运", findDeliveryProsePollution("这是你的命运")?.label === "banned_term");
  assert("detects marker", findDeliveryProsePollution("⟦t:day_master||x⟧")?.label === "term_marker");
  assert("detects ganzhi pair", findDeliveryProsePollution("甲子那一年你开始撑")?.label === "ganzhi_pair");
  assert("detects 淬炼 jargon", findDeliveryProsePollution("坐在淬炼之上")?.label === "basis_jargon");

  const finalize = read("lib/llm/pro/delivery/finalize-call.ts");
  const narrative = read("lib/llm/pro/delivery/narrative-evidence-call.ts");
  const purity = read("lib/llm/pro/delivery/delivery-body-purity.ts");
  const narrPrompt = read("lib/llm/pro/delivery/narrative-prompt.ts");
  const finPrompt = read("lib/llm/pro/delivery/finalize-prompt.ts");
  const mark = read("lib/llm/pro/delivery/mark-evidence-prompt.ts");

  assert("no HARD_FAIL switch (warn-only policy)", !purity.includes("DELIVERY_PURITY_HARD_FAIL"));
  assert("warn helpers exist", purity.includes("warnDeliveryProsePollution"));
  assert("finalize warn-only", finalize.includes("warnDeliveryProsePollution"));
  assert("finalize never rejects pollution", !finalize.includes("core_mingli_pollution"));
  assert("narrative warn-only", narrative.includes("warnPollutedBodiesInTree"));
  assert("narrative never rejects pollution", !narrative.includes("body_mingli_pollution"));
  assert("finalize prompt has 命运红线", finPrompt.includes("命运红线"));
  assert("narrative prompt has 命运红线", narrPrompt.includes("命运红线"));
  assert("mark still neutralBase", mark.includes("neutralBase: true"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All delivery-body-purity checks passed.\n");
}

main();
