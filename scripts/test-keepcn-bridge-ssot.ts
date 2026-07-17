/**
 * 双层桥 · 守卫（白话 → 金字）
 *   pnpm exec tsx scripts/test-keepcn-bridge-ssot.ts
 */
import fs from "node:fs";
import path from "node:path";
import { BANNED_TERM_SOFT_ZH } from "@/lib/llm/compliance/banned-terms";
import { wrapBareKeepCnSoftTerms } from "@/lib/llm/sanitize/term-marking";
import { pojuTermByTraditional } from "@/lib/glossary/pojulife-terms";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

/** 桥当前接的 4 个 keep_cn slug —— 扩覆盖时同步改这里。 */
const BRIDGED: ReadonlyArray<[string, string]> = [
  ["大运", "decade"],
  ["日主", "day_master"],
  ["流年", "year"],
  ["用神", "yong_shen"],
];

function main(): void {
  console.log("\n===== 双层桥 · 白话 → 金字 =====\n");

  // ① 桥必须认得 scrub 的实际产出（decade 曾抄成「当前阶段气候」，scrub 实产「当前这个阶段」）
  // lookbehind 要求 label 前不是汉字 —— 用句首触发。
  for (const [trad, slug] of BRIDGED) {
    const plain = BANNED_TERM_SOFT_ZH[trad];
    assert(`BANNED_TERM_SOFT_ZH 有「${trad}」`, Boolean(plain));
    if (!plain) continue;
    const out = wrapBareKeepCnSoftTerms(`${plain}里。`, "zh");
    assert(`「${trad}」→「${plain}」能升成金字`, out.includes("⟦t:"));
    assert(`「${trad}」升成的是 ${slug}`, out.includes(`⟦t:${slug}`));
  }

  // ② 桥里不许再出现手抄字面量
  const src = read("lib/llm/sanitize/term-marking.ts");
  const start = src.indexOf("function keepCnBridgeLabel");
  const bridge = src.slice(start, src.indexOf("const parts = text.split", start));
  assert("桥从 BANNED_TERM_SOFT_ZH 取值", bridge.includes('keepCnBridgeLabel("'));
  assert("桥不再手抄「当前阶段气候」", !bridge.includes("当前阶段气候"));
  assert("桥不再手抄「你的核心特质」", !bridge.includes("你的核心特质"));

  // ③ 提示词不许再手写第二套软译
  const basePrompt = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert("底座提示词不再手写「燃料容易跟不上」", !basePrompt.includes("燃料容易跟不上"));
  assert("底座提示词不再手写「deep fuel reserves」", !basePrompt.includes("deep fuel reserves"));

  // ④ 两层不许混用：正文白话表里的值，不许等于任何金字
  const golds = new Map<string, string>();
  for (const trad of Object.keys(BANNED_TERM_SOFT_ZH)) {
    const t = pojuTermByTraditional(trad, "bazi") ?? pojuTermByTraditional(trad);
    if (t) golds.set(t.term.zh, trad);
  }
  const mixed = Object.entries(BANNED_TERM_SOFT_ZH).filter(([, v]) => golds.has(v));
  assert(
    `正文白话表未混入金字（发现 ${mixed.length} 处：${mixed.map(([k, v]) => `${k}→${v}`).join(" ")}）`,
    mixed.length === 0,
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
