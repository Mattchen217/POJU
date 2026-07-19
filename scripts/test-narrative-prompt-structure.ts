/**
 * 叙事提示词 6 块结构 · 守卫
 *   pnpm exec tsx scripts/test-narrative-prompt-structure.ts
 */
import fs from "node:fs";
import path from "node:path";

const p = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/prompts/base-analysis-stream-prompt.ts"),
  "utf8",
);
const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 叙事提示词 6 块结构 =====\n");
  // 六块常量都在
  for (const c of [
    "BASE_ANALYSIS_IDENTITY_ZH",
    "BASE_ANALYSIS_OUTPUT_SECTIONS_ZH",
    "BASE_ANALYSIS_BODY_RULES_ZH",
    "BASE_ANALYSIS_EVIDENCE_RULES_ZH",
    "BASE_ANALYSIS_NEUTRAL_CLOSEDSET_ZH",
    "BASE_ANALYSIS_LAYOUT_ZH",
    "BASE_ANALYSIS_IDENTITY_EN",
    "BASE_ANALYSIS_OUTPUT_SECTIONS_EN",
    "BASE_ANALYSIS_BODY_RULES_EN",
    "BASE_ANALYSIS_EVIDENCE_RULES_EN",
    "BASE_ANALYSIS_NEUTRAL_CLOSEDSET_EN",
    "BASE_ANALYSIS_LAYOUT_EN",
  ]) {
    assert(`常量 ${c} 存在`, p.includes(`const ${c}`));
  }
  // 输入真词保证在
  assert(
    "块1/块4 含『输入里你会看到真词』",
    p.includes("输入里你会看到真词") || p.includes("输入真词"),
  );
  assert(
    "块4 含『输入真词 → 输出必打标』",
    p.includes("输出必打标") || p.includes("绝不裸露"),
  );
  // 旧散块已删
  for (const old of [
    "BASE_ANALYSIS_NARRATIVE_BREVITY_ZH",
    "BASE_ANALYSIS_BLOCK_SPACING_ZH",
    "BASE_ANALYSIS_BULLET_RULE_ZH",
    "BASE_ANALYSIS_BINDING_RULES",
    "BASE_ANALYSIS_NATAL_RELATION_ANCHOR_ZH",
    "BASE_ANALYSIS_NEUTRALITY_RULES_ZH",
    "BASE_ANALYSIS_LEAD_LABEL_RULE_ZH",
  ]) {
    assert(`旧散块 ${old} 已删`, !p.includes(`const ${old}`));
  }
  // 正例已清（关系锚那个）
  assert(
    "关系锚正例已删（源自相刑示范）",
    !p.includes("彼此消耗的拉扯（源自相刑）"),
  );
  // 无正文角引号正例、无 ✓
  assert("无 ✓ 正例", !p.includes("✓"));
  // 禁逐柱只剩收敛表述
  assert("『逐柱』表述收敛（≤3 处）", (p.match(/逐柱/g) ?? []).length <= 3);
  // 组装顺序：共享块仍在
  assert("组装含 buildForbiddenTermsPromptBlock", p.includes("buildForbiddenTermsPromptBlock(lang)"));
  assert("组装含 buildDualLayerDeliveryPromptBlock", p.includes("buildDualLayerDeliveryPromptBlock(lang)"));
  assert("组装含 buildTermMarkingPromptBlock", p.includes("buildTermMarkingPromptBlock(lang"));
  assert("组装含 READING_LAYOUT_CONTRACT", p.includes("READING_LAYOUT_CONTRACT"));
  assert("组装含 ORIENTAL_SHARED_GUARDRAILS", p.includes("ORIENTAL_SHARED_GUARDRAILS"));
  assert("组装含 plainspeak", p.includes("buildPlainspeakVoiceSections"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
