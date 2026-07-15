/**
 * Base-analysis repair + climate_now + vernacular CJ + soft uniqueness + line-locate.
 *
 *   pnpm exec tsx scripts/test-base-analysis-four-bugs.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  applyLineRepairs,
  applyRepairPatches,
  compactForLineMatch,
  locateViolationLine,
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
  console.log("\n========== Four bugs (line-repair / climate_now / CJ / softs) ==========\n");

  // Line locate + replace (core Fix A) — softVisible snippet lacks **
  const draft = [
    "你像一株温室植物。",
    "",
    "## 你的核心配置（强项）",
    "",
    "> **你的价值引擎:** 你的价值不来自蛮干，而来自吸收与转化。",
    "",
    "**秩序与表达的平衡:** 两端互哺。",
  ].join("\n");

  const softSnippet = "你的价值引擎: 你的价值不来自蛮干，而来自吸收与转化。";
  const lineIdx = locateViolationLine(draft, {
    label: "metaphor_blacklist",
    snippet: softSnippet,
  });
  assert("locate line despite missing ** in snippet", lineIdx === 4, `got ${lineIdx}`);
  assert(
    "located line keeps bold markers",
    draft.split("\n")[lineIdx]!.includes("**你的价值引擎:**"),
  );

  const byNeedle = locateViolationLine(draft, {
    label: "metaphor_blacklist",
    snippet: "引擎在空转",
  });
  assert("locate by needle 引擎", byNeedle === 4);

  const rewritten = "> **你的价值转化力:** 你的价值不来自蛮干，而来自吸收与转化。";
  const after = applyLineRepairs(draft, [{ lineIdx, rewritten }]);
  assert("line replace keeps ##", after.includes("## 你的核心配置"));
  assert("line replace keeps blank lines", after.includes("\n\n## "));
  assert("line replace applied", after.includes("**你的价值转化力:**"));
  assert("other lines untouched", after.includes("**秩序与表达的平衡:**"));
  assert("opening untouched", after.includes("温室植物"));

  // Legacy find/replace still available for string tests
  const original =
    "你像一株藤蔓。\n\n## 你的核心配置（强项）\n\n### 吸收与表达并重\n\n**你的核心引擎:** 巧思驱动";
  const fixed = applyRepairPatches(original, [
    { find: "**你的核心引擎:**", replace: "**你的核心转化力:**" },
  ]);
  assert("legacy patch keeps ##", fixed.includes("## 你的核心配置"));

  const repairSrc = fs.readFileSync(
    path.join(ROOT, "lib/base-analysis/repair-violations.ts"),
    "utf8",
  );
  assert("repair uses line locate", repairSrc.includes("locateViolationLine"));
  assert("repair uses rewriteViolationLine", repairSrc.includes("rewriteViolationLine"));
  assert("repair does not ask model for find JSON", !repairSrc.includes('"patches":[{"find"'));
  assert("repair uses reasoning_effort off", repairSrc.includes('reasoning_effort: "off"'));
  assert("repair max_tokens 800 for line", /max_tokens:\s*800/.test(repairSrc));
  assert("repair logs FAILED loudly", repairSrc.includes("patch application FAILED"));

  const streamSrc = fs.readFileSync(
    path.join(ROOT, "lib/base-analysis/stream-llm-with-gate.ts"),
    "utf8",
  );
  assert("stream has onRepairFail", streamSrc.includes("onRepairFail"));
  assert("stream logs regen after miss", streamSrc.includes("补丁未命中"));

  const routeSrc = fs.readFileSync(
    path.join(ROOT, "app/api/profile/base-analysis/stream/route.ts"),
    "utf8",
  );
  assert("route sends repair_failed event", routeSrc.includes("repair_failed"));
  assert("route annotates miss note", routeSrc.includes("本次为整篇重生成（补丁未命中）"));

  assert("compact strips markdown stars", compactForLineMatch("**你的价值引擎:**") === "你的价值引擎:");

  const banBlockSrc = fs.readFileSync(
    path.join(ROOT, "lib/llm/compliance/banned-terms.ts"),
    "utf8",
  );
  assert("ban block forbids negated mention", banBlockSrc.includes("否定式") && banBlockSrc.includes("你不是引擎"));

  const stemSoftSrc = fs.readFileSync(
    path.join(ROOT, "lib/glossary/term-glossary-closed.ts"),
    "utf8",
  );
  assert("乙 soft is 柔韧攀援型", stemSoftSrc.includes('"柔韧攀援型"'));
  assert("no 乙木柔韧 soft", !stemSoftSrc.includes('"乙木柔韧"'));

  const softGanzhiHits = auditMarkerCompleteness("⟦t:stem_yi|乙木柔韧|plain⟧");
  assert(
    "marker soft with 乙木 fails",
    softGanzhiHits.some((h) => h.label === "marker_visible_ganzhi"),
  );
  const inventHits = auditOutOfSetTerms("⟦t:da_yun|当前阶段|x⟧");
  assert(
    "invented slug da_yun rejected",
    inventHits.some((h) => h.label === "out_of_set_marker_id:da_yun"),
  );
  const liuHits = auditOutOfSetTerms("⟦t:liu_chong|正面冲撞|plain⟧");
  assert(
    "generic liu_chong marker rejected",
    liuHits.some((h) => h.label === "out_of_set_marker_id:liu_chong"),
  );

  const metaNeg = auditMetaphorBlacklist("你不是一台靠自己燃烧的引擎。", "zh");
  assert("negated 引擎 still metaphor hit", metaNeg.some((h) => h.label === "metaphor_blacklist"));

  const promptSrc = fs.readFileSync(
    path.join(ROOT, "lib/llm/prompts/base-analysis-stream-prompt.ts"),
    "utf8",
  );
  assert("prompt bans relation markers", promptSrc.includes("关系类【不打标】") || promptSrc.includes("No relation markers"));

  // climate_now + CJ
  const structured = fixtureStructured();
  const climate = buildClimateNowFromStructured(structured, "zh");
  assert("climate_now non-empty", climate.length > 4);
  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  assert("refs.da_yun_step filled", typeof refs.da_yun_step === "number");

  const genSrc = fs.readFileSync(
    path.join(ROOT, "lib/base-analysis/generate-core-judgments.ts"),
    "utf8",
  );
  assert("LLM keys omit climate_now", genSrc.includes("LLM_INTERPRETIVE_KEYS") && !genSrc.includes('"climate_now"'));

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

  // soft labels — 平衡 everyday is skipped, not false-fired as strength jargon
  assert("glossary soft 随境调整型", stemSoftSrc.includes('"随境调整型"'));
  assert("glossary no 平衡型 soft", !stemSoftSrc.includes('"平衡型"'));
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
  const falseHits = detectComplianceViolations(
    '**秩序与表达的平衡:** 两端互哺。',
    "zh",
  ).filter((v) => v.label === "term:平衡");
  assert("everyday 平衡 lead not audited", falseHits.length === 0, JSON.stringify(falseHits));

  if (process.exitCode) {
    console.error("\nFour-bugs checks FAILED");
    process.exit(1);
  }
  console.log("\nAll four-bugs checks passed.");
}

main();
