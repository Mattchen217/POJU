/**
 * core_judgments 预算 + 重发层数 · 守卫
 *   pnpm exec tsx scripts/test-core-judgments-budget.ts
 *
 * 守的是 2026-07 那次事故:删示范句 → 模型真推导 → reasoning 吃光 max_tokens(900)
 * → finish_reason=length → 空 content → 传输层重发 3 次 × 外层 3 次 = 9 次 → 页面卡死。
 */
import fs from "node:fs";
import path from "node:path";
import { MAX_EMPTY_CONTENT_RESEND } from "@/lib/llm/openrouter-retry";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

function main(): void {
  console.log("\n===== core_judgments · 预算与重发层数 =====\n");
  const src = read("lib/base-analysis/generate-core-judgments.ts");

  // ① 预算必须够真推导(900 是照抄时代的数)
  const m = src.match(/CORE_JUDGMENTS_MAX_TOKENS\s*=\s*([\d_]+)/);
  const budget = m ? Number(m[1]!.replace(/_/g, "")) : 0;
  assert(`max_tokens 常量存在(实得 ${budget})`, budget > 0);
  assert(`max_tokens ≥ 3000(reasoning 计入预算)`, budget >= 3000);
  assert("函数里不再硬写 max_tokens: 900", !/max_tokens:\s*900/.test(src));

  // ⑧ 超时是兜底不是预算 —— 45s 曾经掐死过一次完全合格的输出
  const t = src.match(/CORE_JUDGMENTS_TOTAL_TIMEOUT_MS\s*=\s*([\d_]+)/);
  const ms = t ? Number(t[1]!.replace(/_/g, "")) : 0;
  assert(`总超时 ≥ 150s(实测单次 ~80s，实得 ${ms}ms)`, ms >= 150_000);

  // ② 不许两层重发相乘
  assert("外层遇 empty_after_resend 不再重试", src.includes("isEmptyResponseError"));
  assert("catch 里有 break(终态)", /isEmptyResponseError[\s\S]{0,400}break;/.test(src));
  console.log(`  · 传输层内层重发 = ${MAX_EMPTY_CONTENT_RESEND} 次(openrouter-retry.ts)——外层不得再乘`);

  // ③ 确定性失败必须响亮
  assert('finish_reason=length 有告警', src.includes('finish_reason === "length"'));
  assert("parse 失败时把 finish_reason 一起打出来", /parse failed[\s\S]{0,160}finish_reason/.test(src));

  // ④ 不许拖住叙事流
  assert("有总超时", src.includes("CORE_JUDGMENTS_TOTAL_TIMEOUT_MS"));
  assert("超时用 AbortController 硬中止", src.includes("ctrl.abort"));

  // ⑤ 上一份补丁不能被这次改坏
  assert("照抄门禁还在", src.includes("looksCopiedFromPromptOrTemplate"));
  assert("六字段定义还在", /identity_anchor\s*——/.test(src));
  assert("示范句没长回来", !src.includes("正例") && !/Good:/.test(src));

  console.log(
    "\n" + (failures.length === 0 ? "✅ 全过。" : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
