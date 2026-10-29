/**
 * P0/P4 contract: BookJudgmentPack dual-track + by_face + ZFP patternHits + flag + slice.
 * Run: pnpm exec tsx scripts/test-book-judgment-pack.ts
 */
import assert from "node:assert/strict";
import type { BirthInfo } from "../lib/profile/types";
import { isBookJudgmentPackEnabled } from "../lib/llm/pro/delivery/book-judgment/flag";
import {
  BOOK_FACE_IDS,
  BOOK_JUDGMENT_PACK_VERSION,
  indexBookJudgmentByFace,
  validateBookJudgmentPack,
  type BookJudgmentPack,
  type BookJudgmentUnit,
} from "../lib/llm/pro/delivery/book-judgment/schema";
import {
  deepEvidencePlanFromBookPack,
  sliceBookJudgmentForFace,
  bookJudgmentTraceSummary,
} from "../lib/llm/pro/delivery/book-judgment/slice";
import { hashChartFactPackText, hashZiweiFactPack } from "../lib/llm/pro/delivery/book-judgment/hash";
import { buildZiweiFactPack } from "../lib/ziwei/fact-pack";
import {
  buildLabStepDefsV3,
  labStepDefsV3,
} from "../lib/llm/pro/delivery/lab/types-v3";

const GOLDEN_BIRTH: BirthInfo = {
  year: 2000,
  month: 8,
  day: 16,
  hour: 4,
  minute: 30,
  hour_period: "yin",
  gender: "F",
  timezone: "Asia/Shanghai",
};

const ziwei = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: "2026-10-27" });
assert.ok(ziwei.patternHits.length > 0, "golden patternHits");

const chartText = [
  "日主：庚金",
  "用神：木",
  "喜神：水",
  "忌神：金土",
  "当前大运：甲申",
].join("\n");

function unit(
  partial: Omit<BookJudgmentUnit, "serves_face"> & { serves_face?: BookJudgmentUnit["serves_face"] },
): BookJudgmentUnit {
  return {
    serves_face: partial.serves_face ?? ["01"],
    ...partial,
  };
}

/** Cover every face with at least one destiny+science pair shared. */
function coveringUnits(): BookJudgmentUnit[] {
  const pattern = ziwei.patternHits[0]!.name;
  const units: BookJudgmentUnit[] = [];
  for (const face of BOOK_FACE_IDS) {
    units.push(
      unit({
        id: `d_${face}`,
        track: "destiny",
        serves_face: [face],
        claim: `${face} 命理张力：用神承压窗口收窄`,
        anchors: [pattern, "用神木", "大运甲申"],
      }),
      unit({
        id: `s_${face}`,
        track: "science",
        serves_face: [face],
        claim: `${face} 科学：决策负荷偏高需外部分解`,
        anchors: ["cognitive_load", "decision_hygiene"],
      }),
    );
  }
  return units;
}

function basePack(over: Partial<BookJudgmentPack> = {}): BookJudgmentPack {
  const units = coveringUnits();
  return {
    version: BOOK_JUDGMENT_PACK_VERSION,
    locale: "zh",
    thesis_ref: "thesis_v1",
    cfp_hash: hashChartFactPackText(chartText),
    zfp_hash: hashZiweiFactPack(ziwei),
    zfpOmitted: false,
    shot_mode: "one",
    created_at: new Date().toISOString(),
    units,
    by_face: indexBookJudgmentByFace(units),
    pattern_hits_used: [ziwei.patternHits[0]!.name],
    science_tags_used: ["cognitive_load"],
    ...over,
  };
}

/** PASS dual-track */
{
  const v = validateBookJudgmentPack(basePack());
  assert.equal(v.ok, true, v.ok ? "" : v.reason);
  if (v.ok) {
    const sum = bookJudgmentTraceSummary(v.pack);
    assert.equal(sum.shot_mode, "one");
    assert.ok(sum.unit_counts.destiny >= 8);
    assert.ok(sum.unit_counts.science >= 8);
    assert.equal(sum.zfpOmitted, false);
    assert.ok(sum.pattern_hits_used.length > 0);
    for (const face of BOOK_FACE_IDS) {
      assert.ok((sum.by_face_coverage[face] ?? 0) >= 1, `cover ${face}`);
    }
  }
}

/** FAIL missing science track */
{
  const units = BOOK_FACE_IDS.map((face) =>
    unit({
      id: `only_d_${face}`,
      track: "destiny",
      serves_face: [face],
      claim: "只有命理",
      anchors: ["用神木"],
    }),
  );
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [ziwei.patternHits[0]!.name],
    }),
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "missing_science_track");
}

/** FAIL zfpOmitted=false without pattern_hits_used */
{
  const v = validateBookJudgmentPack(
    basePack({ pattern_hits_used: [], zfpOmitted: false }),
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "missing_pattern_hits");
}

/** FAIL empty face */
{
  const units = coveringUnits().filter((u) => !u.serves_face.includes("02"));
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
    }),
  );
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.equal(v.reason, "empty_face");
    assert.match(v.detail ?? "", /02/);
  }
}

/** convergence alone covers dual-track */
{
  const units = BOOK_FACE_IDS.map((face) =>
    unit({
      id: `c_${face}`,
      track: "convergence",
      serves_face: [face],
      claim: "交汇：格局承压对齐决策负荷",
      anchors: [ziwei.patternHits[0]!.name, "cognitive_load"],
    }),
  );
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [ziwei.patternHits[0]!.name],
    }),
  );
  assert.equal(v.ok, true, v.ok ? "" : `${v.reason}:${v.detail}`);
}

/** slice + deepEvidencePlan share formatPageSliceFeed path */
{
  const v = validateBookJudgmentPack(basePack());
  assert.ok(v.ok);
  if (!v.ok) throw new Error("pack");
  const slice = sliceBookJudgmentForFace({
    pack: v.pack,
    faceId: "02",
    chartText,
    ziwei,
    question: "要不要换工作",
  });
  assert.ok(slice);
  assert.ok(slice!.units.length >= 2);
  assert.match(slice!.pack_block, /禁再发明批断/);
  assert.match(slice!.pack_block, /d_02|s_02/);
  assert.ok(slice!.fact_block);
  assert.match(slice!.fact_block!, /patternHits/);
  assert.match(slice!.fact_block!, /紫微|格局|府相|火贪|铃贪|日月|紫微入命/);

  const plan = deepEvidencePlanFromBookPack(v.pack, "02");
  assert.ok(plan?.units.length);
  assert.ok(plan!.units.some((u) => u.path.includes("d_02") || u.calc_cite?.includes("d_02")));
  assert.ok(
    plan!.units.some((u) => /科学|交汇/.test(u.evidence ?? "")),
    "02 plan has science/convergence evidence",
  );
}

/** Flag default ON; explicit 0 off */
{
  assert.equal(isBookJudgmentPackEnabled({} as NodeJS.ProcessEnv), true);
  assert.equal(
    isBookJudgmentPackEnabled({ BOOK_JUDGMENT_PACK: "0" } as NodeJS.ProcessEnv),
    false,
  );
  assert.equal(
    isBookJudgmentPackEnabled({ BOOK_JUDGMENT_PACK: "off" } as NodeJS.ProcessEnv),
    false,
  );
}

/** Step table switches by flag — no half-mix */
{
  const packSteps = buildLabStepDefsV3({ bookJudgmentPack: true });
  const legacySteps = buildLabStepDefsV3({ bookJudgmentPack: false });
  assert.ok(packSteps.some((d) => d.step_key === "book.judgment"));
  assert.ok(packSteps.some((d) => d.step_key === "book.gate_judgment"));
  assert.ok(
    !packSteps.some((d) => d.kind === "content_judgment"),
    "pack mode hides per-page judgment",
  );
  assert.ok(legacySteps.some((d) => d.kind === "content_judgment"));
  assert.ok(!legacySteps.some((d) => d.step_key === "book.judgment"));
  assert.ok(packSteps.some((d) => d.step_key === "02.content.body"));
  assert.ok(legacySteps.some((d) => d.step_key === "02.content.body"));

  const viaEnvOff = labStepDefsV3({
    BOOK_JUDGMENT_PACK: "0",
  } as NodeJS.ProcessEnv);
  assert.ok(viaEnvOff.some((d) => d.kind === "content_judgment"));
}

console.log("book-judgment-pack ok", {
  faces: BOOK_FACE_IDS.length,
  pattern: ziwei.patternHits[0]?.name,
  cfp_hash: hashChartFactPackText(chartText),
});
