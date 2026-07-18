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

  // ① 提示词不许再出现实现细节
  const block = buildTermMarkingPromptBlock("zh", { principlesOnly: true, neutralBase: true });
  assert("底座档不提「会被丢弃」", !block.includes("会被丢弃"));
  assert("底座档不提 SSOT/系统会填", !/SSOT|系统.{0,4}填/.test(block));
  assert("底座档告诉模型标记会渲染成什么", block.includes("官方释义"));
  assert("底座档明确禁止在正文重复解释", block.includes("不要在正文里再解释"));

  // ② 表必须让模型看见术语和释义(上一版撤掉了这两列 → 它瞎标)
  assert("底座档表头有官方术语列", /\|\s*官方术语/.test(block));
  assert("底座档表头有官方释义列", /\|\s*官方释义/.test(block));

  // ③ 代码无条件覆盖(这是唯一知道 SSOT 的地方)
  const forced = forceSsotPlainInMarkers("依据:⟦t:zheng_yin|我瞎写的白话⟧。", "zh");
  assert("模型的白话被覆盖", !forced.includes("我瞎写的白话"));
  assert("填的是官方术语", forced.includes("供源"));
  assert("填的是官方释义", forced.includes("无条件的稳定滋养"));
  const empty = forceSsotPlainInMarkers("依据:⟦t:life_linguan|⟧。", "zh");
  assert("空槽也填满", empty.includes("执掌") && empty.includes("能力全面成熟"));

  // ④ 底座路径接上了,且只接底座
  const gate = read("lib/base-analysis/stream-llm-with-gate.ts");
  assert("gate 之前就覆盖", gate.includes("forceSsotPlainInMarkers"));
  for (const f of ["lib/llm/deepseek/breakthrough-core.ts", "lib/llm/pro/final-delivery.ts"]) {
    assert(`${f} 没有误用 force(下游要贴题白话)`, !read(f).includes("forceSsotPlainInMarkers"));
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
