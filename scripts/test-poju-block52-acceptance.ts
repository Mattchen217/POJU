/**
 * Block 52 — prompt de-overfit + opening ceiling + compliance SaaS labels
 *
 *   pnpm exec tsx scripts/test-poju-block52-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { auditDeliveredText } from "@/lib/llm/sanitize/compliance-terms";
import { POJU_V6_OPENING_DUTY, POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import { POJU_V6_OPENING_PHASE_RULES } from "@/lib/llm/phases/opening-phase-v6";
import { KEEP_CN_SLUGS, KEEP_CN_VISIBLE_SOFT } from "@/lib/glossary/term-closed-set";
import {
  OPENING_MAX_SUBSTANTIVE_TURNS,
  shouldForceConverge,
} from "@/lib/poju/state-machine";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function assertNoOverfit(label: string, text: string, needles: string[]): void {
  for (const n of needles) {
    assert(`${label} lacks "${n}"`, !text.includes(n));
  }
}

function main(): void {
  console.log("\n=== Block 52 acceptance ===\n");

  const overfitNeedles = [
    "藤蔓找依附",
    "火旺水少",
    "还没上线",
    "第一批付费",
    "你把链条说清楚了",
    "这两个词恰恰是",
    "金舆",
    "国印",
    "十恶大败",
    "空亡/国印",
  ];

  assertNoOverfit("opening-phase-v6", POJU_V6_OPENING_PHASE_RULES, overfitNeedles);
  assertNoOverfit("poju-base-v6 static", POJU_V6_STATIC_SYSTEM, [
    "你把链条说清楚了",
    "这两个词恰恰是",
  ]);
  assertNoOverfit("shen-sha-guard", read("lib/llm/prompts/shen-sha-guard.ts"), [
    "金舆",
    "国印",
    "空亡/国印",
    "天喜/红鸾",
  ]);

  assert("opening duty macro block present", POJU_V6_OPENING_DUTY.includes("主问题") || POJU_V6_OPENING_DUTY.includes("核心困境"));
  assert(
    "opening-phase imports duty",
    read("lib/llm/phases/opening-phase-v6.ts").includes("POJU_V6_OPENING_DUTY"),
  );
  assert(
    "opening dynamic pace: clear vs multi-issue",
    POJU_V6_OPENING_PHASE_RULES.includes("动态节奏") &&
      POJU_V6_OPENING_PHASE_RULES.includes("清晰包") &&
      POJU_V6_OPENING_PHASE_RULES.includes("多议题") &&
      POJU_V6_OPENING_PHASE_RULES.includes("禁止模型替他敲定"),
  );
  assert(
    "opening multi-issue response thickness",
    POJU_V6_OPENING_PHASE_RULES.includes("多议题首包") &&
      POJU_V6_OPENING_PHASE_RULES.includes("分面点名") &&
      POJU_V6_OPENING_PHASE_RULES.includes("不上屏"),
  );
  assert(
    "opening duty: user-stated wedge",
    POJU_V6_OPENING_DUTY.includes("不替用户敲定") &&
      POJU_V6_OPENING_DUTY.includes("轮次跟清晰度走"),
  );
  assert(
    "anchor principle (structure-grounded)",
    POJU_V6_OPENING_PHASE_RULES.includes("真实的结构") ||
      POJU_V6_OPENING_PHASE_RULES.includes("结构化个人底色") ||
      read("lib/llm/prompts/poju-base-v6.ts").includes("真实的结构数据上"),
  );

  assert("OPENING_MAX = 5", OPENING_MAX_SUBSTANTIVE_TURNS === 5);
  assert(
    "shouldForceConverge at max-1 turns when base ready",
    shouldForceConverge(OPENING_MAX_SUBSTANTIVE_TURNS - 1, true) === true,
  );
  assert(
    "shouldForceConverge false before ceiling-1",
    shouldForceConverge(OPENING_MAX_SUBSTANTIVE_TURNS - 2, true) === false,
  );
  assert(
    "force converge block wired",
    read("lib/llm/phases/oriental-prompt-context-v6.ts").includes(
      "【控制面指令 · 本轮必须收敛】",
    ),
  );

  assert(
    "decade soft = SSOT 纪元",
    KEEP_CN_VISIBLE_SOFT.decade?.zh === "纪元",
  );
  assert(
    "year soft = SSOT 岁环",
    KEEP_CN_VISIBLE_SOFT.year?.zh === "岁环",
  );
  assert("decade not keep_cn", !KEEP_CN_SLUGS.has("decade"));
  assert("year not keep_cn", !KEEP_CN_SLUGS.has("year"));

  const jixiongHit = auditDeliveredText("这段分析不涉及吉凶定论。", "zh");
  assert(
    "audit blocks 吉凶 in user text",
    jixiongHit.some((v) => v.label.includes("compliance_redline") || v.label.includes("jixiong")),
  );

  const bareGz = auditDeliveredText("你当前处于丙午阶段。", "zh");
  assert(
    "audit blocks bare stem-branch",
    bareGz.some(
      (v) =>
        v.label.includes("stem_branch") ||
        v.label.includes("bazi_term") ||
        v.label.includes("bare_ganzhi"),
    ),
  );

  assert(
    "shen-sha guard uses instance inventory principle",
    read("lib/llm/prompts/shen-sha-guard.ts").includes("本盘实例清单里实际算出"),
  );

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 52 checks passed.\n");
}

main();
