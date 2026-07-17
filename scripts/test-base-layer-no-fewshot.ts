/**
 * 底座 · 正例清除 + 白话槽双闸 · 冒烟
 *   pnpm exec tsx scripts/test-base-layer-no-fewshot.ts
 */
import fs from "node:fs";
import path from "node:path";
import { rewriteMarkersWithSsotSoft } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

/** 铁律 #1 守卫：这些文件里不许再长出正例。 */
const PROMPT_FILES_NO_POSITIVE_EXAMPLES = [
  "lib/base-analysis/generate-core-judgments.ts",
  "lib/llm/prompts/base-analysis-stream-prompt.ts",
  "lib/llm/compliance/banned-terms.ts",
];

function main(): void {
  console.log("\n===== 底座 · 正例清除 + 白话槽 =====\n");

  // ① 全仓正例扫查
  for (const f of PROMPT_FILES_NO_POSITIVE_EXAMPLES) {
    const src = read(f);
    assert(`${f} 无「正例」段`, !src.includes("正例"));
    assert(`${f} 无「Good:」/「Good direction」`, !/Good:|Good direction/.test(src));
    // ✓ 后面直接跟内容句（不是规则符号）= 正例
    assert(`${f} 无 ✓ 内容示范句`, !/✓\s*[「"'`]/.test(src));
  }

  // ② core_judgments 六字段有定义
  const gcj = read("lib/base-analysis/generate-core-judgments.ts");
  for (const k of [
    "identity_anchor",
    "drive_mechanism",
    "structural_gap",
    "balance_anchor",
    "exchange_mode",
    "leverage_state",
  ]) {
    assert(`${k} 有定义（—— 读什么）`, new RegExp(`${k}\\s*——`).test(gcj));
  }
  assert("有照抄门禁", gcj.includes("looksCopiedFromPromptOrTemplate"));
  assert("有同参数重发", gcj.includes("MAX_ATTEMPTS"));
  assert("神煞/关系必须落地", gcj.includes("shensha_instances") && gcj.includes("natal_relations"));

  // ③ 白话槽闸：软译抄进白话槽 → 回落 SSOT
  const lazy = rewriteMarkersWithSsotSoft("⟦t:weak_self|需养⟧", "zh");
  assert("『需养』被判空", !/\|需养\|需养⟧/.test(lazy));
  assert("回落到 SSOT 定义", lazy.includes("内在能量敏感内敛"));

  const wrongSoft = rewriteMarkersWithSsotSoft("⟦t:yong_shen|润流⟧", "zh");
  assert("抄错别人的软译也被判空", !wrongSoft.includes("|润流⟧"));
  assert("锚元回落 SSOT", wrongSoft.includes("最能带来内在平衡与支持"));

  // ④ 真白话不许被误杀
  const good = rewriteMarkersWithSsotSoft("⟦t:day_master|如河畔垂柳般的柔韧核心⟧", "zh");
  assert("真贴题白话保留", good.includes("如河畔垂柳般的柔韧核心"));

  // ⑤ 空槽仍然回落（底座新格式）
  const empty = rewriteMarkersWithSsotSoft("⟦t:zheng_guan|⟧", "zh");
  assert("⟦t:slug|⟧ 回落 SSOT", empty.includes("代表内在秩序"));

  // ⑥ 底座提示词走 ssotPlainOnly
  const basePrompt = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert("底座启用 ssotPlainOnly", basePrompt.includes("ssotPlainOnly"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
