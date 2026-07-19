/**
 * SSOT soft 桥 · 守卫（scrub 软译 ≡ POJU_TERMS → 升成标记）
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
  console.log("\n===== SSOT soft 桥 · scrub → 标记 =====\n");

  // ① scrub 软译 = SSOT term.zh；桥必须能把裸软译升成标记
  for (const [trad, slug] of BRIDGED) {
    const plain = BANNED_TERM_SOFT_ZH[trad];
    const gold = pojuTermByTraditional(trad, "bazi") ?? pojuTermByTraditional(trad);
    assert(`BANNED_TERM_SOFT_ZH 有「${trad}」`, Boolean(plain));
    assert(`「${trad}」软译 === SSOT「${gold?.term.zh}」`, plain === gold?.term.zh);
    if (!plain) continue;
    const out = wrapBareKeepCnSoftTerms(`${plain}里。`, "zh");
    assert(`「${trad}」→「${plain}」能升成标记`, out.includes("⟦t:"));
    assert(`「${trad}」升成的是 ${slug}`, out.includes(`⟦t:${slug}`));
  }

  // ② 桥函数本身不许再手抄字面量（legacy 别名可留在 wrapBare 列表）
  const src = read("lib/llm/sanitize/term-marking.ts");
  const start = src.indexOf("function keepCnBridgeLabel");
  const end = src.indexOf("export function wrapBareKeepCnSoftTerms", start);
  const bridge = src.slice(start, end > 0 ? end : start + 800);
  assert("桥从 BANNED_TERM_SOFT_ZH 取值", bridge.includes("BANNED_TERM_SOFT_ZH[traditional]"));
  assert("桥不再手抄「当前阶段气候」", !bridge.includes("当前阶段气候"));
  assert("桥不再手抄「你的核心特质」", !bridge.includes("你的核心特质"));

  // ③ 提示词不许再手写第二套软译
  const basePrompt = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert("底座提示词不再手写「燃料容易跟不上」", !basePrompt.includes("燃料容易跟不上"));
  assert("底座提示词不再手写「deep fuel reserves」", !basePrompt.includes("deep fuel reserves"));

  // ④ 禁词软译必须从 SSOT 派生（与金字同一事实源）
  const drift: string[] = [];
  for (const [trad, soft] of Object.entries(BANNED_TERM_SOFT_ZH)) {
    const t = pojuTermByTraditional(trad, "bazi") ?? pojuTermByTraditional(trad);
    if (!t) continue; // fate lexicon / out-of-set — no SSOT row
    if (soft !== t.term.zh) drift.push(`${trad}→${soft}≠${t.term.zh}`);
  }
  assert(
    `术语软译与 SSOT 对齐（漂移 ${drift.length}：${drift.slice(0, 6).join(" ")}）`,
    drift.length === 0,
  );

  // ⑤ 提示词禁词块不再塞第二套白话对照
  const bannedSrc = read("lib/llm/compliance/banned-terms.ts");
  assert("禁词块不再手写旧白话软译表", !bannedSrc.includes("大运→当前") && !bannedSrc.includes("当前这个阶段"));
  assert("禁词块声明只认 SSOT", bannedSrc.includes("只走 SSOT") || bannedSrc.includes("只认 SSOT"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
