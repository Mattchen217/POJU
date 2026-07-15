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
import {
  auditMetaphorBlacklist,
  detectComplianceViolations,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  auditMarkerCompleteness,
  auditOutOfSetTerms,
} from "@/lib/llm/sanitize/term-marking";
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
      { ganzhi: "戊午", start_age: 28, start_year: 2016 },
      { ganzhi: "己未", start_age: 38, start_year: 2026 },
    ],
    data_availability: {
      pillars_detail: false,
      da_yun: true,
      bazi_enrichment: false,
    },
  };
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
  assert("repair uses reasoning_effort off", repairSrc.includes('reasoning_effort: "off"'));
  assert("repair max_tokens >= 3000", /max_tokens:\s*3000/.test(repairSrc));
  assert("repair rewrites whole sentence", repairSrc.includes("整句") || repairSrc.includes("FULL sentence"));
  assert("repair forbids shortest fragment", repairSrc.includes("最短片段") || repairSrc.includes("shortest"));

  const banBlockSrc = fs.readFileSync(
    path.join(ROOT, "lib/llm/compliance/banned-terms.ts"),
    "utf8",
  );
  assert("ban block forbids negated mention", banBlockSrc.includes("否定式") && banBlockSrc.includes("你不是引擎"));
  assert("ban block forbids soft ganzhi", banBlockSrc.includes("软译本身也【不得】含裸干支") || banBlockSrc.includes("Ganzhi-free"));

  const stemSoftSrc = fs.readFileSync(
    path.join(ROOT, "lib/glossary/term-glossary-closed.ts"),
    "utf8",
  );
  assert("乙 soft is 柔韧攀援型", stemSoftSrc.includes('"柔韧攀援型"'));
  assert("no 乙木柔韧 soft", !stemSoftSrc.includes('"乙木柔韧"'));
  assert("no 甲木启发 soft", !stemSoftSrc.includes('"甲木启发"'));

  const softGanzhiHits = auditMarkerCompleteness("⟦t:stem_yi|乙木柔韧|plain⟧");
  assert(
    "marker soft with 乙木 fails",
    softGanzhiHits.some((h) => h.label === "marker_visible_ganzhi"),
  );
  const softCleanHits = auditMarkerCompleteness("⟦t:stem_yi|柔韧攀援型|借力生长⟧");
  assert(
    "marker soft vernacular ok",
    !softCleanHits.some((h) => h.label === "marker_visible_ganzhi"),
  );
  const inventHits = auditOutOfSetTerms("⟦t:da_yun|当前阶段|x⟧");
  assert(
    "invented slug da_yun rejected",
    inventHits.some((h) => h.label === "out_of_set_marker_id:da_yun"),
  );

  const metaNeg = auditMetaphorBlacklist("你不是一台靠自己燃烧的引擎。", "zh");
  assert("negated 引擎 still metaphor hit", metaNeg.some((h) => h.label === "metaphor_blacklist"));

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
