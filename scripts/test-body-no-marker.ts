/**
 * 正文零标记 · 守卫
 *   pnpm exec tsx scripts/test-body-no-marker.ts
 *
 * 守 2026-07-19：模型在正文打了 ⟦t:fire|⟧ → 空槽 → 裸标记穿透 / 降成"发散"不通顺。
 * 守 2026-07-19：白话「平衡」被审计当裸术语 → repair 死循环。
 */
import fs from "node:fs";
import path from "node:path";
import { prepareBodyTextForGlossaryRender } from "@/lib/llm/sanitize/compliance-terms";
import { bareMingliWordInPlain } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 正文零标记 =====\n");

  // ① 正文空槽标记 → 不残留裸标记、不冒出软译突兀词
  const body = "你像一团被安置在陶罐里的 ⟦t:fire|⟧ ——天生温热。";
  const rendered = prepareBodyTextForGlossaryRender(body, "zh");
  assert("正文无裸 marker", !rendered.includes("⟦t:"));
  assert("正文无残留 t:fire", !rendered.includes("t:fire"));
  assert("空槽不降成软译发散", !rendered.includes("发散"));

  // ② 带白话原字的 3-slot 标记 → 保留白话（兼容老格式）
  const withPlain = "你像一团 ⟦t:fire|发散|温暖扩散⟧ 的能量。";
  const r2 = prepareBodyTextForGlossaryRender(withPlain, "zh");
  assert("3-slot 保留白话原字", !r2.includes("⟦t:") && r2.includes("温暖扩散"));

  // ③ 提示词:只反例无正例 + 有判断标准
  const p = fs.readFileSync(
    path.join(process.cwd(), "lib/llm/prompts/base-analysis-stream-prompt.ts"),
    "utf8",
  );
  const start = p.indexOf("正文零标记 · 硬错");
  const seg = start >= 0 ? p.slice(start, start + 600) : "";
  assert("提示词有反例叉号", seg.includes("✗"));
  assert("提示词无正例勾号", !seg.includes("✓"));
  assert("提示词有判断标准不通顺", seg.includes("不通顺"));
  assert("提示词覆盖开篇身份锚", seg.includes("开篇身份锚"));

  // ④ 「平衡」是日常词：白话里出现不判违规（2026-07-19 死循环根因）
  console.log("\n===== 日常词豁免 · 平衡 =====\n");
  assert(
    "白话「在收放之间找到平衡」放行",
    bareMingliWordInPlain("在收放之间找到一种精微的平衡") === null,
  );
  assert(
    "白话「需要调整平衡」放行",
    bareMingliWordInPlain("你需要重新调整平衡") === null,
  );
  assert("真术语「相刑」仍抓", bareMingliWordInPlain("年月相刑的张力") !== null);
  assert("真术语「食神」仍抓", bareMingliWordInPlain("食神泄秀") !== null);

  const tm = fs.readFileSync(
    path.join(process.cwd(), "lib/llm/sanitize/term-marking.ts"),
    "utf8",
  );
  assert("豁免表已导出为公共", tm.includes("export const DAILY_WORD_EXEMPT_HAN"));
  assert(
    "审计读同一张豁免表",
    /SSOT_BARE_TERMS_ZH[\s\S]{0,400}DAILY_WORD_EXEMPT_HAN/.test(tm),
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "全过。"
        : `${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
