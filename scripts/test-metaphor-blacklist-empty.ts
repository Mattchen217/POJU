/**
 * 比喻黑名单已清空 · 守卫
 *   pnpm exec tsx scripts/test-metaphor-blacklist-empty.ts
 *
 * 守 2026-07-17：藤蔓被误列黑名单 → 每个乙木盘烧 2 次 repair。
 * 病根(示范句)已切，禁词表清空。这个测试确保它不被悄悄填回来。
 */
import fs from "node:fs";
import path from "node:path";
import {
  METAPHOR_BLACKLIST_ZH,
  METAPHOR_BLACKLIST_EN,
  metaphorBlacklistForLocale,
} from "@/lib/llm/compliance/banned-terms";
import { applyComplianceSanitize } from "@/lib/llm/sanitize/compliance-terms";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 比喻黑名单 · 已清空 =====\n");

  // ① 表是空的
  assert("ZH 黑名单空", METAPHOR_BLACKLIST_ZH.length === 0);
  assert("EN 黑名单空", METAPHOR_BLACKLIST_EN.length === 0);
  assert("locale getter 也空", metaphorBlacklistForLocale("zh").length === 0);

  // ② 藤蔓不再是违规（乙木盘不再烧 repair）
  const vine = applyComplianceSanitize("你像一株柔韧的藤蔓，随风而动却根深蒂固。", "zh");
  assert(
    "藤蔓不触发 metaphor_blacklist",
    !vine.violationsAfter.some((v) => v.label === "metaphor_blacklist"),
  );
  assert("藤蔓原文保留（不被改写）", vine.text.includes("藤蔓"));

  // ③ 机制还在（门禁 hook 未被误删）
  const bt = read("lib/llm/compliance/banned-terms.ts");
  assert("门禁 hook 仍在（isBaseAnalysisGateFailure）", bt.includes('label === "metaphor_blacklist"'));
  assert("提示词改为『主比喻·现定』", bt.includes("主比喻·现定") || bt.includes("主比喻必须由"));

  // ④ 提示词没把黑名单渲染成空的 join 残骸
  assert("提示词不含空 join 残骸『黑名单】 →』", !/黑名单】\s*\n/.test(bt));

  // ⑤ rule 7 扩到 balance_anchor
  const g = read("lib/base-analysis/generate-core-judgments.ts");
  assert(
    "balance_anchor 也要锚条目",
    g.includes("balance_anchor") && /structural_gap、leverage_state、balance_anchor/.test(g),
  );

  // ⑥ 底座依据开 dualLayer
  const v = read("components/base-analysis/BaseAnalysisDeliveryView.tsx");
  assert("底座 RichReadingText 开 dualLayer", /RichReadingText[\s\S]{0,120}dualLayer/.test(v));

  // ⑦ 前几批没被改坏
  assert("正例仍为 0", !g.includes("正例"));
  assert("超时仍 180s", /180_000/.test(g));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
