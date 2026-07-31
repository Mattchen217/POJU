/**
 * 底座打标契约 + refs 脱敏 · 守卫
 *   pnpm exec tsx scripts/test-base-layer-marker-contract.ts
 *
 * 守的是 2026-07-17 那次事故:提示词说"白话写了也会被丢弃" → 模型失去载体
 * → 把术语解释挪进正文(「正印生身,食神泄秀」)→ 服务端清洗器管不了十神
 * → 门禁拦住 → 重生成 → 耗尽 → 底座「准备失败」。
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
  console.log("\n===== 底座 · 打标契约 =====\n");

  // ① 提示词不许再出现实现细节；词典只给 slug|真词（不给自造软译/整句释义）
  const block = buildTermMarkingPromptBlock("zh", { principlesOnly: true, neutralBase: true });
  assert("底座档不提「会被丢弃」", !block.includes("会被丢弃"));
  assert("底座档不提 SSOT/系统会填", !/SSOT|系统.{0,4}填/.test(block));
  assert("底座档不塞渲染/释义话术", !block.includes("官方释义") && !block.includes("渲染成"));
  assert("底座档不塞自造软译列", !block.includes("| **本元**"));
  assert("底座档有 slug|真词 表头", block.includes("| slug | 这个代号指的命理概念 |"));
  assert("底座档含真词日主", /\|\s*`day_master`\s*\|\s*日主\s*\|/.test(block));
  assert("底座档无整句释义列", !/\|\s*官方释义/.test(block));
  assert("底座档明确标记代替真词", block.includes("标记是用来【代替】那个词的"));

  // ①b EN 打标块跟随 locale（避免中文 intro 带偏英文依据）
  const blockEn = buildTermMarkingPromptBlock("en", { neutralBase: true });
  assert("EN 底座档标题英文", blockEn.includes("# Term marking"));
  assert("EN 底座档 intro 英文", blockEn.includes("When referencing a concept below"));
  assert("EN 底座档无中文 intro", !blockEn.includes("凡在「依据与推理」"));
  assert("EN 底座档表头两列真词", blockEn.includes("real term this code refers to"));
  assert("EN 底座档无 official gloss 列", !blockEn.includes("official gloss"));
  assert("EN 底座档规则英文", blockEn.includes("## Marking rules (neutral base)"));
  assert("EN 底座档标记代替术语", blockEn.includes("A marker REPLACES the term"));

  // ③ 代码无条件覆盖(这是唯一知道 SSOT 的地方)
  const forced = forceSsotPlainInMarkers("依据:⟦t:zheng_yin|我瞎写的白话⟧。", "zh");
  assert("模型的白话被覆盖", !forced.includes("我瞎写的白话"));
  assert("填的是官方术语", forced.includes("供源"));
  assert("填的是官方释义", forced.includes("无条件的稳定滋养"));
  const empty = forceSsotPlainInMarkers("依据:⟦t:life_linguan|⟧。", "zh");
  assert("空槽也填满", empty.includes("执掌") && empty.includes("能力全面成熟"));

  // ④ 底座路径接上了,且只接底座（含 v2 merge + route）
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

  // ⑤ refs 脱敏
  const cj = read("lib/base-analysis/core-judgments.ts");
  assert("关系脱敏", cj.includes("desensitizeRelations"));
  assert("神煞脱敏", cj.includes("desensitizeShensha"));
  assert("神煞过黑名单", cj.includes("OUT_OF_SET_FORBIDDEN_HAN"));
  assert("refs 不再直吐 relation id", !/natal_relations:\s*relations\b/.test(cj));

  // ⑥ 黑话闸补了神煞
  const gcj = read("lib/base-analysis/generate-core-judgments.ts");
  assert("黑话闸查黑名单神煞", gcj.includes("OUT_OF_SET_FORBIDDEN_HAN"));

  // ⑦ 前几批不能被改坏
  assert("正例没长回来", !gcj.includes("正例"));
  assert("照抄门禁还在", gcj.includes("looksCopiedFromPromptOrTemplate"));
  assert("预算还在 4000", /CORE_JUDGMENTS_MAX_TOKENS\s*=\s*4000/.test(gcj));

  console.log("\n" + (failures.length === 0 ? "✅ 全过。" : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`));
  if (failures.length) process.exit(1);
}

main();
