/**
 * 底座术语契约 + refs 脱敏 · 守卫（wave2: 自由传统词，不教打标）
 *   pnpm exec tsx scripts/test-base-layer-marker-contract.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildTermMarkingPromptBlock, forceSsotPlainInMarkers } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

function main(): void {
  console.log("\n===== 底座 · 自由传统词契约 (wave2) =====\n");

  const block = buildTermMarkingPromptBlock("zh", {
    principlesOnly: true,
    neutralBase: true,
    traditionalInventory: ["日主", "正印", "七杀", "用神"],
  });
  assert("底座档不提「会被丢弃」", !block.includes("会被丢弃"));
  assert("底座档不塞自造软译列", !block.includes("| **本元**"));
  assert("底座档无官方释义列", !/\|\s*官方释义/.test(block));
  assert("底座档有传统词表头", block.includes("| 可用传统词 |"));
  assert("底座档含真词日主", block.includes("日主"));
  assert("底座档教自由传统", /自由传统|传统真词/.test(block));
  assert("底座档禁止打标", /禁止.*打标|不要打标/.test(block));
  assert("底座档不教 ⟦t: 格式", !/格式[：:].*⟦t:/.test(block) && !/打成\s*`⟦t:/.test(block));

  const blockEn = buildTermMarkingPromptBlock("en", {
    neutralBase: true,
    traditionalInventory: ["日主", "正印"],
  });
  assert("EN 底座档标题自由传统", /free traditional/i.test(blockEn));
  assert("EN 底座档无中文 intro 旧打标", !blockEn.includes("凡在「依据与推理」中引用下表概念：认识真词后打成"));
  assert("EN 底座档禁止 markers", /No markers|never emit/i.test(blockEn));
  assert("EN 底座档无 Marking rules (neutral base) 旧标题", !blockEn.includes("## Marking rules (neutral base)"));

  // 代码层仍可填槽（兼容存量标记）
  const forced = forceSsotPlainInMarkers("依据:⟦t:zheng_yin|我瞎写的白话⟧。", "zh");
  assert("模型的白话被覆盖", !forced.includes("我瞎写的白话"));
  assert("填的是官方术语", forced.includes("供源"));
  assert("填的是官方软译/释义", forced.includes("供源") && /印星式|滋养|补给/.test(forced));
  const empty = forceSsotPlainInMarkers("依据:⟦t:life_linguan|⟧。", "zh");
  assert("空槽也填满", empty.includes("执掌") && empty.includes("能力全面成熟"));

  const gate = read("lib/base-analysis/stream-llm-with-gate.ts");
  assert("gate 之前就覆盖", gate.includes("forceSsotPlainInMarkers"));
  const v2Merge = read("lib/base-analysis-v2/orchestrate/run-report.ts");
  const v2Route = read("app/api/profile/base-analysis-v2/stream/route.ts");
  assert("v2 merge 填空槽", v2Merge.includes("forceSsotPlainInMarkers"));
  assert("v2 route 填空槽", v2Route.includes("forceSsotPlainInMarkers"));
  assert("v2 route 不因 gate failJob", !/failJob\([^)]*delivery_gate_failed/.test(v2Route));
  for (const f of [
    "lib/llm/deepseek/breakthrough-core.ts",
    "lib/llm/pro/final-delivery.ts",
    "lib/llm/pro/delivery/polish-marked-evidence.ts",
    "lib/llm/pro/delivery/merge-delivery-markdown.ts",
  ]) {
    assert(`${f} 没有误用 force(下游要贴题白话)`, !read(f).includes("forceSsotPlainInMarkers("));
  }

  const cj = read("lib/base-analysis/core-judgments.ts");
  assert("关系脱敏", cj.includes("desensitizeRelations"));
  assert("神煞脱敏", cj.includes("desensitizeShensha"));
  assert("神煞过黑名单", cj.includes("OUT_OF_SET_FORBIDDEN_HAN"));
  assert("refs 不再直吐 relation id", !/natal_relations:\s*relations\b/.test(cj));

  const gcj = read("lib/base-analysis/generate-core-judgments.ts");
  assert("黑话闸查黑名单神煞", gcj.includes("OUT_OF_SET_FORBIDDEN_HAN"));
  assert("正例没长回来", !gcj.includes("正例"));
  assert("照抄门禁还在", gcj.includes("looksCopiedFromPromptOrTemplate"));
  assert("预算还在 20000", /CORE_JUDGMENTS_MAX_TOKENS\s*=\s*20000/.test(gcj));

  console.log("\n" + (failures.length === 0 ? "✅ 全过。" : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`));
  if (failures.length) process.exit(1);
}

main();
