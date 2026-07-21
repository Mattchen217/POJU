/**
 * Guards: no-retry sanitize policy + plain fallback + stripTimeAnchor.
 *   pnpm exec tsx scripts/test-v2-no-retry-sanitize.ts
 */
import { applyPlainFallbackToText } from "@/lib/base-analysis-v2/compute/plain-fallback-map";
import { sanitizeReportComputed } from "@/lib/base-analysis-v2/compute/report-sanitizer";
import { stripTimeAnchor } from "@/lib/base-analysis-v2/compute/strip-time-anchor";
import type { TenGodContext } from "@/lib/base-analysis-v2/compute/ten-god-context";
import {
  fillMissingSegments,
  validateReportComputed,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import { fillMissingSegmentTexts } from "@/lib/base-analysis-v2/segment-text";
import fs from "node:fs";
import path from "node:path";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const emptySeg = (): SegmentComputed => ({
  core_conclusion: "中立结论",
  bazi_basis: ["日主偏旺"],
});

function buildRc(): ReportComputed {
  return {
    energy_map: {
      day_master_nature: emptySeg(),
      wuxing_distribution: emptySeg(),
      cognitive_archetype: emptySeg(),
      regulator: emptySeg(),
    },
    work_style: {
      value_creation: emptySeg(),
      decision_style: emptySeg(),
      focus_drain: emptySeg(),
    },
    interpersonal: {
      comm_archetype: emptySeg(),
      friction_point: emptySeg(),
      synergy: emptySeg(),
    },
    phase_states: {
      baseline: emptySeg(),
      rest_phase: emptySeg(),
      peak_phase: emptySeg(),
      transition_phase: emptySeg(),
    },
    retune: {
      color: emptySeg(),
      space: emptySeg(),
      habits: emptySeg(),
      awareness: emptySeg(),
    },
    summary: {
      keywords: ["a", "b"],
      current_theme: "settling",
      dos: ["1", "2", "3"],
      donts: ["a", "b", "c"],
      card_basis: emptySeg(),
    },
  };
}

{
  assert(
    "合称平替 财官杀",
    applyPlainFallbackToText("见财官杀混杂").includes("【外部责任与挑战】"),
  );
  assert(
    "标记内不平替",
    applyPlainFallbackToText("因 ⟦t:qi_sha|⟧ 与官杀").includes("⟦t:qi_sha|⟧") &&
      applyPlainFallbackToText("因 ⟦t:qi_sha|⟧ 与官杀").includes("【外部挑战与压力】"),
  );
  assert(
    "正文单称平替",
    applyPlainFallbackToText("你的日主偏旺", { includeSingles: true }).includes("【内在本色】"),
  );
  assert(
    "真算默认不平替日主",
    applyPlainFallbackToText("日主偏旺", { includeSingles: false }).includes("日主"),
  );
}

{
  const ctx: TenGodContext = {
    hasZhengGuan: true,
    hasQiSha: false,
    hasShiShen: true,
    hasShangGuan: false,
    hasBiJian: false,
    hasJieCai: false,
    hasZhengYin: false,
    hasPianYin: false,
  };
  const rc = buildRc();
  rc.work_style.value_creation = {
    core_conclusion: "官杀混杂压力大",
    bazi_basis: ["官杀", "食伤生财", "财官"],
  };
  const cleaned = sanitizeReportComputed(rc, ctx);
  assert(
    "sanitize 官杀→正官",
    cleaned.work_style.value_creation.core_conclusion.includes("正官") &&
      !cleaned.work_style.value_creation.core_conclusion.includes("官杀"),
  );
  assert(
    "sanitize 财官→【】兜底",
    cleaned.work_style.value_creation.bazi_basis.some((b) => b.includes("【务实目标与责任】")),
  );
}

{
  assert(
    "时间锚转译",
    stripTimeAnchor("2026年进入丙午大运", "zh").includes("当前阶段") &&
      !stripTimeAnchor("2026年进入丙午大运", "zh").includes("2026"),
  );
  assert(
    "中性运势词保留",
    stripTimeAnchor("大运逢印，流年引动", "zh").includes("大运逢印"),
  );
}

{
  const partial = buildRc();
  delete (partial.energy_map as unknown as Record<string, unknown>).regulator;
  const v = validateReportComputed(partial);
  assert("个别缺段 soft", v.ok === false && v.severity === "soft");
  const filled = fillMissingSegments(partial);
  assert("占位后通过", validateReportComputed(filled).ok === true);
}

{
  const filled = fillMissingSegmentTexts({ energy_map: {} }, "narrative", "zh");
  assert(
    "正文缺 key 占位",
    typeof filled.energy_map.day_master_nature === "string" &&
      filled.energy_map.day_master_nature.includes("暂缺"),
  );
}

{
  const compute = fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis-v2/compute/compute-call.ts"),
    "utf8",
  );
  const narrative = fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis-v2/narrative/narrative-call.ts"),
    "utf8",
  );
  const evidence = fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis-v2/evidence/evidence-call.ts"),
    "utf8",
  );
  assert("compute 无 simp_leak continue", !/simp_leak[\s\S]{0,80}continue/.test(compute));
  assert("compute 无 time_anchor continue", !/time_anchor_leak[\s\S]{0,80}continue/.test(compute));
  assert(
    "compute MAX_TOKENS=16000",
    compute.includes("V2_OUTPUT_MAX_TOKENS") &&
      fs
        .readFileSync(path.join(process.cwd(), "lib/base-analysis-v2/v2-llm-budget.ts"), "utf8")
        .includes("V2_OUTPUT_MAX_TOKENS = 16_000"),
  );
  assert("compute 用 V2_HARD_MAX_ATTEMPTS", compute.includes("V2_HARD_MAX_ATTEMPTS"));
  assert("compute 硬重试含 json_parse", compute.includes("JSON 解析失败，硬重试"));
  assert("compute 无质量 retryHint", !compute.includes("retryHint"));
  assert("narrative 无 body_leak continue", !/body_leak[\s\S]{0,120}continue/.test(narrative));
  assert("evidence 无 evidence_leak continue", !/evidence_leak[\s\S]{0,120}continue/.test(evidence));
  assert("narrative 放行日志", narrative.includes("放行,不打回"));
  assert(
    "evidence 强制补救闭环",
    evidence.includes("强制补救") && evidence.includes("forceRemarkAndFallback"),
  );
  assert("evidence 无裸词静默放行", !evidence.includes("放行,不打回"));
  assert(
    "evidence polish 接关系词",
    evidence.includes("wrapBareRelations"),
  );
  assert(
    "evidence 平替 includeSingles",
    /includeSingles:\s*true/.test(evidence),
  );

  assert(
    "SSOT 派生平替覆盖柱位",
    applyPlainFallbackToText("月干透出", { includeSingles: true }).includes("【") &&
      !applyPlainFallbackToText("月干透出", { includeSingles: true }).includes("月干"),
  );
  assert(
    "通用字尾兜底",
    applyPlainFallbackToText("见孤鸾煞牵制", { includeSingles: true }).includes("【能量要素】") ||
      applyPlainFallbackToText("见孤鸾煞牵制", { includeSingles: true }).includes("【"),
  );
  assert("narrative 用 V2_HARD_MAX_ATTEMPTS", narrative.includes("V2_HARD_MAX_ATTEMPTS"));
  assert("evidence 用 V2_HARD_MAX_ATTEMPTS", evidence.includes("V2_HARD_MAX_ATTEMPTS"));
  assert("narrative 无 retryHint", !narrative.includes("retryHint"));
  assert("evidence 无 retryHint", !evidence.includes("retryHint"));
  assert(
    "evidence 单Task MAX=16000",
    evidence.includes("V2_OUTPUT_MAX_TOKENS") &&
      /EVIDENCE_TASK_MAX_TOKENS\s*=\s*V2_OUTPUT_MAX_TOKENS/.test(evidence),
  );
  assert("evidence 4-Task Promise.all", evidence.includes("EVIDENCE_TASKS") && /Promise\.all/.test(evidence));

  const translate = fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis-v2/translate/translate-call.ts"),
    "utf8",
  );
  const translatePrompt = fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis-v2/translate/translate-prompt.ts"),
    "utf8",
  );
  assert("translate 用 V2_HARD_MAX_ATTEMPTS", translate.includes("V2_HARD_MAX_ATTEMPTS"));
  assert("translate 无 retryHint", !translate.includes("retryHint"));
  assert("translate MAX=16000", translate.includes("V2_OUTPUT_MAX_TOKENS"));
  assert("translate-prompt 无纠错重译", !translatePrompt.includes("纠错"));
  assert("narrative-prompt 无纠错", !fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis-v2/narrative/narrative-prompt.ts"),
    "utf8",
  ).includes("纠错"));
  assert("evidence-prompt 无纠错", !fs.readFileSync(
    path.join(process.cwd(), "lib/base-analysis-v2/evidence/evidence-prompt.ts"),
    "utf8",
  ).includes("纠错"));
}

console.log(failures.length ? "❌ no-retry sanitize failed" : "✅ no-retry sanitize ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
