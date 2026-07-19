/**
 * core_judgments 给下游原始真词 · 守卫
 *   pnpm exec tsx scripts/test-core-judgments-raw.ts
 */
import fs from "node:fs";
import path from "node:path";
import { hasCoreJudgmentsRedline } from "@/lib/base-analysis/generate-core-judgments";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== core_judgments 原始真词 =====\n");
  // 中性真词全放行（下游真算要它们）
  for (const w of [
    "喜神生身",
    "大运引动",
    "年月相刑",
    "日主偏弱",
    "食神泄秀",
    "天乙贵人主提携",
  ]) {
    assert(`中性真词「${w}」放行`, !hasCoreJudgmentsRedline(w));
  }
  // 恐吓宿命红线仍拦
  for (const w of ["十恶大败", "孤鸾煞", "空亡", "血刃"]) {
    assert(`恐吓红线「${w}」拦截`, hasCoreJudgmentsRedline(w));
  }
  // 提示词：板块化 + 不再禁中性真词
  const p = fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis/generate-core-judgments.ts"),
    "utf8",
  );
  assert(
    "提示词有『板块一/二/三/四』",
    ["板块一", "板块二", "板块三", "板块四"].every((b) => p.includes(b)),
  );
  assert("提示词不再禁裸干支/喜神（旧 :210 已删）", !p.includes("【禁止】裸干支"));
  assert(
    "提示词明确『只禁恐吓词』",
    p.includes("只拦一类") || p.includes("唯一不能写"),
  );
  assert("已删 softMarkInterpretiveFields", !p.includes("function softMarkInterpretiveFields"));
  assert("成功路径用原始 interpretive（不 marked）", p.includes("...(interpretive as"));
  assert("refs 不打标", p.includes("refs,") && !p.includes("softMarkCoreJudgmentsRefs(refs"));
  assert("导出 hasCoreJudgmentsRedline", p.includes("export function hasCoreJudgmentsRedline"));
  assert("旧名 Blackspeak 已删", !p.includes("hasCoreJudgmentsBlackspeak"));

  const ctx = fs.readFileSync(
    path.join(process.cwd(), "lib/llm/prompts/base-analysis-context.ts"),
    "utf8",
  );
  assert(
    "下游 softMarkJudgmentsForDownstream 透传",
    ctx.includes("return judgments") && ctx.includes("原始真词"),
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
