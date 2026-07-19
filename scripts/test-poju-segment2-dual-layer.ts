/**
 * 第2段双层呈现 · 冒烟验收
 *
 *   pnpm exec tsx scripts/test-poju-segment2-dual-layer.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  autoMarkBareTerms,
  collapseDuplicatedSoftPrefix,
  degradeMarkersToPlain,
} from "@/lib/llm/sanitize/term-marking";
import {
  prepareBodyTextForGlossaryRender,
  prepareTextForGlossaryRender,
} from "@/lib/llm/sanitize/compliance-terms";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n===== POJU 第2段 · 双层呈现 =====\n");

  // ① 「平衡」不再被镀金（实测症状：需要重新调整平衡 → …均势[···]）
  const balance = autoMarkBareTerms("卡住你的不是同事，而是你的系统需要重新调整平衡。", "zh");
  assert("『平衡』不再 auto-mark", !balance.includes("⟦t:balanced_self"));
  assert("『平衡』原词保留", balance.includes("调整平衡"));

  // ② 真术语仍然镀金（不能矫枉过正）
  assert("『壬水』仍 auto-mark", autoMarkBareTerms("日主见壬水偏旺。", "zh").includes("⟦t:"));
  assert("『孤鸾煞』仍 auto-mark", autoMarkBareTerms("盘里有孤鸾煞牵制。", "zh").includes("⟦t:"));

  // ③ 双字病
  assert("当前当前 折叠", collapseDuplicatedSoftPrefix("当前当前岁环引动") === "当前岁环引动");
  assert("你的你的 折叠", collapseDuplicatedSoftPrefix("你的你的本元") === "你的本元");
  assert("正常句不动", collapseDuplicatedSoftPrefix("当前岁环很关键") === "当前岁环很关键");

  // ④ 正文层零金字
  const bodyIn = "你需要的是⟦t:yong_shen|一段没人打扰的清晨⟧，不是硬撑。";
  const bodyOut = prepareBodyTextForGlossaryRender(bodyIn, "zh");
  assert("body 层剥掉标记", !bodyOut.includes("⟦t:"));
  assert("body 层留下贴题白话", bodyOut.includes("一段没人打扰的清晨"));
  assert("body 层不吐软译金字", !bodyOut.includes("锚元"));

  // ⑤ 正文层的合规网没撤（裸词 → 白话，不是 → 金字）
  const leak = prepareBodyTextForGlossaryRender("你今年走大运。", "zh");
  assert("body 层裸『大运』被替换", !leak.includes("大运"));
  assert("body 层裸词不镀金", !leak.includes("⟦t:"));

  // ⑥ 依据层仍然镀金
  const ev = prepareTextForGlossaryRender("你今年走大运。", "zh");
  assert("evidence/legacy 层仍 auto-mark", ev.includes("⟦t:"));

  // ⑦ 降级器只吐白话
  assert(
    "degradeMarkersToPlain 取第3格",
    degradeMarkersToPlain("⟦t:shi_shen|流展|你擅长把想法讲出来⟧", "zh") === "你擅长把想法讲出来",
  );

  // ⑧ 接线（防止漏改）
  const glossary = read("components/cross-product/GlossaryText.tsx");
  const rich = read("components/cross-product/RichReadingText.tsx");
  const chat = read("components/poju/PojuChat.tsx");
  const core = read("lib/llm/deepseek/breakthrough-core.ts");
  assert(
    "GlossaryText 有 layer",
    glossary.includes('layer = "legacy"') &&
      glossary.includes("MAX_PAREN_MARKS_EVIDENCE = Number.POSITIVE_INFINITY"),
  );
  assert("GlossaryText 保留旧常量(老测试断言)", glossary.includes("MAX_PAREN_MARKS_PER_PARAGRAPH = 2"));
  assert("RichReadingText 有 dualLayer", rich.includes("dualLayer") && rich.includes('layer="evidence"'));
  assert("PojuChat 打开 dualLayer", /<RichReadingText[\s\S]{0,240}dualLayer/.test(chat));
  assert("breakthrough-core 有 scrubBodyField", core.includes("scrubBodyField"));
  assert("AGENDA_BRIDGE 不再许可打标", !core.includes("# 打标要点（仅对 first_question）"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
