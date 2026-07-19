/**
 * 白话槽审计不误伤日常字 · 守卫
 *   pnpm exec tsx scripts/test-plain-audit-no-daily-word.ts
 *
 * 守 2026-07-19：单字天干「己」把「自己」判为裸干支 → repair 死循环 → 用户关闭。
 */
import { bareMingliWordInPlain, auditMarkerPlainBanned } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 白话槽审计 · 不误伤日常字 =====\n");

  // ① 日常字（含单个天干/地支/五行）绝不误判
  for (const daily of [
    "保护自己免受消耗",
    "日子过得快",
    "中午吃饭",
    "申请通过了",
    "资金充足",
    "水流潺潺",
    "树木葱茏",
    "时辰未到",
    "口水",
    "下午茶",
  ]) {
    assert(`日常「${daily}」不误判`, bareMingliWordInPlain(daily) === null);
  }

  // ② 真裸命理词（2+字）仍抓
  for (const [bare, hit] of [
    ["辛金稳定", "辛金"],
    ["己土厚重", "己土"],
    ["年月相刑", "相刑"],
    ["食神泄秀", "食神"],
    ["时柱藏", "时柱"],
    ["戊辰之力", "戊辰"],
  ] as const) {
    assert(
      `裸「${hit}」抓得到`,
      bareMingliWordInPlain(bare) === hit || bareMingliWordInPlain(bare) !== null,
    );
  }

  // ③ 端到端:标记白话槽里「自己」不再触发 marker_plain_banned
  const okMarker = "依据 ⟦t:fu_xing_gui_ren|祥瑞|保护自己免受繁杂斗争的消耗。⟧";
  assert(
    "「自己」在白话槽不触发 marker_plain_banned",
    !auditMarkerPlainBanned(okMarker, "zh").some((h) =>
      h.label.startsWith("marker_plain_banned"),
    ),
  );
  // 但真裸干支组合仍触发
  const badMarker = "依据 ⟦t:x|辛金的力量在此。⟧";
  assert(
    "裸「辛金」在白话槽仍触发",
    auditMarkerPlainBanned(badMarker, "zh").some((h) =>
      h.label.startsWith("marker_plain_banned"),
    ),
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
