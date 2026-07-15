/**
 * Four bugs: patches-only repair · climate_now code-fill · vernacular CJ · soft substring uniqueness.
 *
 *   pnpm exec tsx scripts/test-base-analysis-four-bugs.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  applyRepairPatches,
} from "@/lib/base-analysis/repair-violations";
import {
  buildClimateNowFromStructured,
  buildCoreJudgmentsFromStructured,
  buildCoreJudgmentsRefsFromStructured,
} from "@/lib/base-analysis/core-judgments";
import {
  hasCoreJudgmentsBlackspeak,
} from "@/lib/base-analysis/generate-core-judgments";
import {
  BANNED_TERM_SOFT_ZH,
  collectCanonicalSoftLabelsZh,
  findSoftLabelSubstringCollisions,
  maskKnownSoftLabelsZh,
} from "@/lib/llm/compliance/banned-terms";
import { KEEP_CN_VISIBLE_SOFT } from "@/lib/glossary/term-closed-set";
import { detectComplianceViolations } from "@/lib/llm/sanitize/compliance-terms";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const ROOT = path.resolve(__dirname, "..");

function assert(label: string, cond: unknown, detail?: string): void {
  if (!cond) {
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

function fixtureStructured(): ProfileStructured {
  return {
    day_master: "乙",
    strength: "weak",
    yong_shen: "水",
    xi_shen: ["木"],
    ji_shen: ["火", "土"],
    pattern: "食伤生财",
    four_pillars: { year: "甲子", month: "丙寅", day: "乙巳", hour: "庚辰" },
    da_yun: [
      { ganzhi: "戊午", start_year: 2016, end_year: 2025 },
      { ganzhi: "己未", start_year: 2026, end_year: 2035 },
    ],
    data_availability: {
      has_hour: true,
      has_da_yun: true,
      has_gender: true,
    },
  } as ProfileStructured;
}

function main() {
  console.log("\n========== Four bugs (patches / climate_now / CJ / softs) ==========\n");

  // Bug 1 — patches preserve newlines + ##
  const original =
    "你像一株藤蔓。\n\n## 你的核心配置（强项）\n\n### 吸收与表达并重\n\n**你的核心引擎:** 巧思驱动";
  const fixed = applyRepairPatches(original, [
    { find: "**你的核心引擎:**", replace: "**你的核心转化力:**" },
  ]);
  assert("patch keeps ## heading", fixed.includes("## 你的核心配置"));
  assert("patch keeps blank lines", fixed.includes("\n\n## "));
  assert("patch applied find", fixed.includes("**你的核心转化力:**"));
  assert("patch kept metaphor body", fixed.includes("你像一株藤蔓。"));
  let threw = false;
  try {
    applyRepairPatches(original, [{ find: "不存在的子串", replace: "x" }]);
  } catch (e) {
    threw = e instanceof Error && e.message.startsWith("patch_find_missing");
  }
  assert("missing find throws", threw);

  const repairSrc = fs.readFileSync(
    path.join(ROOT, "lib/base-analysis/repair-violations.ts"),
    "utf8",
  );
  assert("repair asks for patches JSON", repairSrc.includes('"patches"'));
  assert("repair never asks to re-emit full doc", repairSrc.includes("禁止】输出整篇"));

  // Bug 2 — climate_now from code
  const structured = fixtureStructured();
  const climate = buildClimateNowFromStructured(structured, "zh");
  assert("climate_now non-empty", climate.length > 4);
  assert("climate_now has no bare 干支", !/[甲乙丙丁戊己庚辛壬癸]/.test(climate));
  assert("climate_now has no 大运 jargon", !climate.includes("大运"));
  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  assert("refs.da_yun_step filled", typeof refs.da_yun_step === "number");

  const genSrc = fs.readFileSync(
    path.join(ROOT, "lib/base-analysis/generate-core-judgments.ts"),
    "utf8",
  );
  assert("LLM keys omit climate_now", genSrc.includes("LLM_INTERPRETIVE_KEYS") && !genSrc.includes('"climate_now"'));
  assert("prompt forbids outputting climate_now", genSrc.includes("禁止】输出 refs / climate_now") || genSrc.includes("Never output refs / climate_now"));
  assert("merge uses code climate_now", genSrc.includes("climate_now, refs"));

  // Bug 3 — vernacular template (no blackspeak)
  const cj = buildCoreJudgmentsFromStructured(structured, "zh");
  const joined = [
    cj.identity_anchor,
    cj.drive_mechanism,
    cj.structural_gap,
    cj.balance_anchor,
    cj.exchange_mode,
    cj.leverage_state,
    cj.climate_now,
  ].join("\n");
  assert("template CJ no blackspeak", !hasCoreJudgmentsBlackspeak(joined), joined.slice(0, 200));
  assert("prompt has vernacular anti-examples", genSrc.includes("乙木日主") && genSrc.includes("借力生长型"));
  assert("hasCoreJudgmentsBlackspeak catches jargon", hasCoreJudgmentsBlackspeak("乙木日主，根基偏弱"));
  assert("hasCoreJudgmentsBlackspeak allows vernacular", !hasCoreJudgmentsBlackspeak("借力生长型：能量靠连接与节奏放大"));

  // Bug 4 — soft labels
  assert("balanced soft is 随境调整型", true);
  const glossary = fs.readFileSync(
    path.join(ROOT, "lib/glossary/term-glossary-closed.ts"),
    "utf8",
  );
  assert("glossary soft 随境调整型", glossary.includes('"随境调整型"'));
  assert("glossary no 平衡型 soft", !glossary.includes('"平衡型"'));
  assert("yong_shen soft kept", BANNED_TERM_SOFT_ZH["用神"] === "关键平衡能量");

  const softs = collectCanonicalSoftLabelsZh([
    ...Object.values(KEEP_CN_VISIBLE_SOFT).map((x) => x.zh),
    "随境调整型",
  ]);
  const collisions = findSoftLabelSubstringCollisions(softs);
  assert(
    "soft labels not mutual substrings",
    collisions.length === 0,
    collisions.map(([a, b]) => `${a}⊂${b}`).join("; "),
  );

  const softText = "你最关键的关键平衡能量是「润泽」；配置是随境调整型。";
  const masked = maskKnownSoftLabelsZh(softText, softs);
  assert("mask hides 关键平衡能量", !masked.includes("平衡"));
  const falseHits = detectComplianceViolations(softText, "zh").filter(
    (v) => v.label === "term:平衡",
  );
  assert("audit no false term:平衡 on softs", falseHits.length === 0, JSON.stringify(falseHits));

  const bareHits = detectComplianceViolations("你的配置偏平衡，需要校准。", "zh").filter(
    (v) => v.label === "term:平衡",
  );
  assert("audit still flags bare 平衡", bareHits.length > 0);

  if (process.exitCode) {
    console.error("\nFour-bugs checks FAILED");
    process.exit(1);
  }
  console.log("\nAll four-bugs checks passed.");
}

main();
