/**
 * BookJudgmentPack · quota reverse + dual-track + density + segment gate.
 * Run: pnpm exec tsx scripts/test-book-judgment-pack.ts
 */
import assert from "node:assert/strict";
import type { BirthInfo } from "../lib/profile/types";
import { isBookJudgmentPackEnabled } from "../lib/llm/pro/delivery/book-judgment/flag";
import {
  BOOK_FACE_IDS,
  BOOK_JUDGMENT_PACK_VERSION,
  classifyMeansPrescription,
  indexBookJudgmentByFace,
  isWeakScienceAnchor,
  MEANS_PRESCRIPTION_CLASS_NAMES,
  softRepairFaceDualTrack,
  validateBookJudgmentPack,
  type BookJudgmentPack,
  type BookJudgmentSegmentId,
  type BookJudgmentUnit,
  type MeansPrescriptionClassName,
} from "../lib/llm/pro/delivery/book-judgment/schema";
import {
  buildBookJudgmentQuotaFromBlueprint,
  formatQuotaTableForPrompt,
  quotaPromptHasMeansDutyLeak,
} from "../lib/llm/pro/delivery/book-judgment/quota-from-blueprint";
import {
  deepEvidencePlanFromBookPack,
  formatBookJudgmentPackBlock,
  sliceBookJudgmentForFace,
  bookJudgmentTraceSummary,
  unitsForFace,
} from "../lib/llm/pro/delivery/book-judgment/slice";
import { hashChartFactPackText, hashZiweiFactPack } from "../lib/llm/pro/delivery/book-judgment/hash";
import { buildZiweiFactPack } from "../lib/ziwei/fact-pack";
import {
  buildLabStepDefsV3,
  labStepDefsV3,
} from "../lib/llm/pro/delivery/lab/types-v3";
import {
  BOOK_BODY_PACK_TRACK_DROP_RULE,
  BOOK_BODY_PACK_UNIT_MISS_RULE,
  BOOK_BODY_QUESTION_RESTATE_RULE,
  gateBookJudgmentBodyConsume,
} from "../lib/llm/pro/delivery/pipeline-v3/gate-book-judgment-body";
import { buildV3BodyPrompt } from "../lib/llm/pro/delivery/pipeline-v3/body-prompt";

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

const quota = buildBookJudgmentQuotaFromBlueprint();

/** Quota table from blueprint covers all faces + segment slots */
{
  assert.ok(quota.total_min_units >= 24, `total_min=${quota.total_min_units}`);
  assert.equal(quota.faces.length, BOOK_FACE_IDS.length);
  for (const face of BOOK_FACE_IDS) {
    const row = quota.faces.find((f) => f.faceId === face);
    assert.ok(row, `quota face ${face}`);
    assert.ok(row!.min_units >= 3, `${face} min_units`);
    assert.ok(row!.segment_slots.length >= 1, `${face} segments`);
    assert.ok(
      row!.segment_slots.some((s) => s.needs_unit),
      `${face} needs_unit slot`,
    );
  }
  const prompt = formatQuotaTableForPrompt(quota);
  assert.match(prompt, /批断配额表/);
  assert.match(prompt, /Face 04/);
  assert.match(prompt, /Face 02/);
}

function unit(
  partial: Omit<BookJudgmentUnit, "serves_face"> & {
    serves_face?: BookJudgmentUnit["serves_face"];
  },
): BookJudgmentUnit {
  return {
    serves_face: partial.serves_face ?? ["01"],
    ...partial,
  };
}

/** Dense dual-track covering pack (meets per-face + total quota). */
function coveringUnits(): BookJudgmentUnit[] {
  const pattern = ziwei.patternHits[0]!.name;
  const units: BookJudgmentUnit[] = [];
  for (const face of BOOK_FACE_IDS) {
    const faceQuota = quota.faces.find((f) => f.faceId === face)!;
    const needed = faceQuota.segment_slots.filter((s) => s.needs_unit);
    const slots =
      needed.length >= faceQuota.min_units
        ? needed
        : [
            ...needed,
            ...Array.from({ length: faceQuota.min_units - needed.length }, (_, i) => ({
              segmentId: (["A", "B", "C", "D", "E"] as BookJudgmentSegmentId[])[
                Math.min(i, 4)
              ]!,
              preferred_track: "any" as const,
            })),
          ];
    for (let i = 0; i < faceQuota.min_units; i++) {
      const slot = slots[i] ?? slots[0]!;
      const pref = "preferred_track" in slot ? slot.preferred_track : "any";
      const track =
        pref === "science"
          ? "science"
          : pref === "convergence"
            ? "convergence"
            : pref === "destiny"
              ? "destiny"
              : i % 3 === 1
                ? "science"
                : i % 3 === 2
                  ? "convergence"
                  : "destiny";
      units.push(
        unit({
          id: `${track[0]}_${face}_${i}`,
          track,
          serves_face: [face],
          serves_segment: slot.segmentId,
          claim: `${face}${slot.segmentId} ${track}：配额反推批断`,
          anchors:
            track === "science"
              ? ["cognitive_load", "decision_hygiene"]
              : [pattern, "用神木"],
        }),
      );
    }
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

/** PASS dense dual-track */
{
  const pack = basePack();
  assert.ok(pack.units.length >= quota.total_min_units, `n=${pack.units.length}`);
  const v = validateBookJudgmentPack(pack, quota);
  assert.equal(v.ok, true, v.ok ? "" : `${v.reason}:${v.detail}`);
  if (v.ok) {
    const sum = bookJudgmentTraceSummary(v.pack, {
      quota,
      pattern_hits_available: ziwei.patternHits.map((h) => h.name),
    });
    assert.equal(sum.shot_mode, "one");
    assert.ok(sum.unit_counts.destiny >= 8);
    assert.ok(sum.unit_counts.science >= 8);
    assert.equal(sum.under_density, false);
    assert.ok(sum.face_matrix.every((r) => !r.missing_science));
    assert.ok(sum.face_matrix.every((r) => !r.under_density));
    /** face_matrix exclusive tracks must match JSON unit.track（d+s+c === face total） */
    for (const row of sum.face_matrix) {
      assert.equal(
        row.destiny + row.science + row.convergence,
        row.total,
        `face ${row.faceId} track sum`,
      );
    }
    assert.equal(sum.unit_counts.total, pack.units.length);
  }
}

/** FAIL missing science track (book-level) */
{
  const units = BOOK_FACE_IDS.flatMap((face) => [
    unit({
      id: `only_d_${face}`,
      track: "destiny",
      serves_face: [face],
      serves_segment: "A",
      claim: "只有命理",
      anchors: ["用神木"],
    }),
    unit({
      id: `only_d2_${face}`,
      track: "destiny",
      serves_face: [face],
      serves_segment: "B",
      claim: "仍只有命理",
      anchors: ["大运甲申"],
    }),
    unit({
      id: `only_d3_${face}`,
      track: "destiny",
      serves_face: [face],
      serves_segment: "C",
      claim: "第三命理",
      anchors: [ziwei.patternHits[0]!.name],
    }),
  ]);
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [ziwei.patternHits[0]!.name],
    }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "missing_science_track");
}

/** FAIL face 04 missing science (density ok, dual-track broken on 04) */
{
  const pattern = ziwei.patternHits[0]!.name;
  const units = coveringUnits().filter((u) => !u.serves_face.includes("04"));
  const face04Quota = quota.faces.find((f) => f.faceId === "04")!;
  for (let i = 0; i < face04Quota.min_units; i++) {
    units.push(
      unit({
        id: `d_only_04_${i}`,
        track: "destiny",
        serves_face: ["04"],
        serves_segment: (["A", "B", "C", "D"] as BookJudgmentSegmentId[])[i] ?? "A",
        claim: `04 纯命理 ${i}`,
        anchors: [pattern, "用神木"],
      }),
    );
  }
  assert.ok(
    !units.some(
      (u) =>
        u.serves_face.includes("04") &&
        (u.track === "science" || u.track === "convergence"),
    ),
  );
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [pattern],
    }),
    quota,
  );
  assert.equal(v.ok, false, v.ok ? "expected fail" : "");
  if (!v.ok) {
    assert.equal(v.reason, "face_missing_science");
    assert.match(v.detail ?? "", /04/);
  }
}

/** FAIL under_density */
{
  const thin = coveringUnits().slice(0, 10);
  const v = validateBookJudgmentPack(
    basePack({
      units: thin,
      by_face: indexBookJudgmentByFace(thin),
    }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "under_density");
}

/** 配额 prompt 无手段 duty 泄漏 */
{
  const prompt = formatQuotaTableForPrompt(quota);
  assert.equal(
    quotaPromptHasMeansDutyLeak(prompt),
    false,
    "quota prompt must not leak means duty labels",
  );
  assert.match(prompt, /机制\/偏差\/负荷|命理判断|交汇张力|复盘问句/);
}

/** FAIL means_prescription · 闭集每 className ≥2 合成句 + 跨轨 */
{
  const fixtures: Record<MeansPrescriptionClassName, [string, string]> = {
    imperative_yi: ["宜以客位进取开创", "不宜在主业外摊开试点"],
    redlight_stop: [
      "红灯信号：完美主义替代外部反馈抬高切换成本",
      "绿灯信号：负荷回落可加码",
    ],
    stop_loss_ops: ["四小时完整块被打断就停下并退回", "窗口收窄后停下来改节奏停损"],
    next_action: [
      "下一步动作类型是只做不离开主业的轻量推进",
      "动作类型改为推进可核对",
    ],
    ops_checklist: [
      "连续两个完整时段未出现付费时，不再加大投入。",
      "当三个陌生人付费时，转为加大投入。",
    ],
    timebox_block: [
      "试点被压缩到每周一个四小时块做验证",
      "不把试点摊成四周任务",
    ],
    billable_min: [
      "以最小可收费承诺作为验证单元再开口",
      "交付能直接使用的小成品换反馈",
    ],
    low_commit_sample: [
      "做一个低承诺小样验证再开口",
      "低承诺小样验证后观察窗口收窄",
    ],
  };
  for (const name of MEANS_PRESCRIPTION_CLASS_NAMES) {
    assert.ok(fixtures[name], `fixture for ${name}`);
  }
  const passClaims = [
    "完美主义替代外部反馈抬高切换成本",
    "用神木受制于忌神火，开口窗口收窄",
    "岁运忌神与损失厌恶同向放大开口成本",
    "工作记忆负荷偏高导致切换成本上升",
  ];
  for (const ok of passClaims) {
    assert.equal(
      classifyMeansPrescription(ok),
      null,
      `pure mechanism must PASS classify: ${ok}`,
    );
  }

  const sci = coveringUnits().find((u) => u.track === "science");
  const destiny = coveringUnits().find((u) => u.track === "destiny");
  const conv = coveringUnits().find((u) => u.track === "convergence");
  assert.ok(sci && destiny && conv);

  for (const className of MEANS_PRESCRIPTION_CLASS_NAMES) {
    const [a, b] = fixtures[className];
    assert.equal(classifyMeansPrescription(a), className, a);
    assert.equal(classifyMeansPrescription(b), className, b);
    const trackCases: Array<{ trackUnit: BookJudgmentUnit; claim: string }> = [
      { trackUnit: sci!, claim: a },
      { trackUnit: destiny!, claim: b },
    ];
    for (const { trackUnit, claim } of trackCases) {
      const units = coveringUnits().map((u) =>
        u.id === trackUnit.id ? { ...u, claim } : u,
      );
      const v = validateBookJudgmentPack(
        basePack({
          units,
          by_face: indexBookJudgmentByFace(units),
        }),
        quota,
      );
      assert.equal(
        v.ok,
        false,
        `${className} on ${trackUnit.track}: expected FAIL got ${v.ok ? "PASS" : v.reason}`,
      );
      if (!v.ok) {
        assert.equal(v.reason, "means_prescription");
        assert.match(v.detail ?? "", new RegExp(trackUnit.id));
        assert.match(v.detail ?? "", new RegExp(`@${trackUnit.track}/${className}`));
      }
    }
  }

  const multi = coveringUnits().map((u) => {
    if (u.id === destiny!.id) {
      return { ...u, claim: fixtures.low_commit_sample[0] };
    }
    if (u.id === conv!.id) {
      return { ...u, claim: fixtures.next_action[0] };
    }
    if (u.id === sci!.id) {
      return { ...u, claim: fixtures.ops_checklist[0] };
    }
    return u;
  });
  const mv = validateBookJudgmentPack(
    basePack({ units: multi, by_face: indexBookJudgmentByFace(multi) }),
    quota,
  );
  assert.equal(mv.ok, false);
  if (!mv.ok) {
    assert.equal(mv.reason, "means_prescription");
    assert.match(mv.detail ?? "", /means_prescription ×/);
    assert.match(mv.detail ?? "", new RegExp(destiny!.id));
    assert.match(mv.detail ?? "", new RegExp(sci!.id));
  }
}

/** FAIL weak science anchor */
{
  assert.equal(isWeakScienceAnchor("科学维3"), true);
  assert.equal(isWeakScienceAnchor("科学维2/格局·十神主矛盾"), true);
  assert.equal(isWeakScienceAnchor("cognitive_load"), false);
  const units = coveringUnits();
  const sci = units.find((u) => u.track === "science");
  assert.ok(sci, "need a science unit");
  const poisoned = units.map((u) =>
    u.id === sci!.id ? { ...u, anchors: ["科学维2"] } : u,
  );
  const v = validateBookJudgmentPack(
    basePack({
      units: poisoned,
      by_face: indexBookJudgmentByFace(poisoned),
    }),
    quota,
  );
  assert.equal(v.ok, false, v.ok ? "expected weak_science_anchor fail" : "");
  if (!v.ok) assert.equal(v.reason, "weak_science_anchor");
}

/** FAIL zfpOmitted=false without pattern_hits_used */
{
  const v = validateBookJudgmentPack(
    basePack({ pattern_hits_used: [], zfpOmitted: false }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "missing_pattern_hits");
}

/** FAIL empty face 02 (pad density on other faces) */
{
  const pattern = ziwei.patternHits[0]!.name;
  const units = coveringUnits().filter((u) => !u.serves_face.includes("02"));
  while (units.length < quota.total_min_units) {
    units.push(
      unit({
        id: `pad_${units.length}`,
        track: "destiny",
        serves_face: ["01"],
        serves_segment: "A",
        claim: "密度垫片",
        anchors: [pattern],
      }),
    );
  }
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [pattern],
    }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.equal(v.reason, "empty_face");
    assert.match(v.detail ?? "", /02/);
  }
}

/** softRepair is noop (no forward-fill) */
{
  const thin = coveringUnits().filter((u) => u.id !== "s_04");
  const repaired = softRepairFaceDualTrack(thin);
  assert.equal(repaired.length, thin.length, "softRepair must not clone-fill");
}

/** slice + deepEvidencePlan */
{
  const v = validateBookJudgmentPack(basePack(), quota);
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
  assert.match(slice!.pack_block, /USER_FEED∩prompt/);
  assert.match(slice!.pack_block, /required_unit_ids:/);
  assert.match(slice!.pack_block, /禁复述题面/);
  assert.ok(slice!.fact_block);
  assert.match(slice!.fact_block!, /patternHits/);

  const plan = deepEvidencePlanFromBookPack(v.pack, "02");
  assert.ok(plan?.units.length);
}

/** Body USER_FEED ↔ prompt pack alignment + 01 consume gate */
{
  const v = validateBookJudgmentPack(basePack(), quota);
  assert.ok(v.ok);
  if (!v.ok) throw new Error("pack");
  const face01 = unitsForFace(v.pack, "01");
  assert.ok(face01.length >= 1);
  const packBlock = formatBookJudgmentPackBlock(v.pack, "01");
  assert.match(packBlock, /tracks: destiny=/);
  assert.match(packBlock, /science=/);
  const prompt = buildV3BodyPrompt({
    key: "01",
    locale: "zh",
    user_feed: `${packBlock}\n\n## PageFeedMatrix allowlist\nsci: no`,
    book_judgment_pack_block: packBlock,
    judgment_lock: "",
  });
  assert.match(prompt.user, /批断包装配令/);
  assert.match(prompt.user, /USER_FEED/);
  assert.match(prompt.user, /required_unit_ids:/);
  assert.match(prompt.system, /Pack 正写/);
  // Pack JSON appears once in user (via USER_FEED), not duplicated as second full block.
  const packHdrHits = prompt.user.split("## 本页批断包切片").length - 1;
  assert.equal(packHdrHits, 1, "pack slice must live once in USER_FEED");

  const q = "先不裸辞，做三个月业余试点再决定";
  const restated = gateBookJudgmentBodyConsume({
    key: "01",
    pack_units: face01,
    question: q,
    page_schema: {
      page: "01",
      face: "01",
      page_title: "断",
      page_subtitle: "",
      main_recommendation: "先不裸辞，做三个月业余试点再决定",
      conditions: "看情况",
      not_choosing: "立刻裸辞",
      evidence_pointer: "依据见 02（d01、d03）",
    },
  });
  assert.equal(restated?.passed, false);
  assert.equal(restated?.failed_rule, BOOK_BODY_QUESTION_RESTATE_RULE);

  const dropSci = gateBookJudgmentBodyConsume({
    key: "01",
    pack_units: [
      {
        id: "d01",
        track: "destiny",
        serves_face: ["01"],
        claim: "庚金日主承压偏高",
        anchors: ["庚金"],
      },
      {
        id: "d02",
        track: "science",
        serves_face: ["01"],
        claim: "现状与目标偏差拉大认知负荷",
        anchors: ["cognitive_load"],
      },
      {
        id: "d03",
        track: "convergence",
        serves_face: ["01"],
        claim: "命理承压与负荷同向",
        anchors: ["庚金", "cognitive_load"],
      },
    ],
    question: q,
    page_schema: {
      page: "01",
      face: "01",
      page_title: "断",
      page_subtitle: "",
      main_recommendation: "先守补给窗口，业余试点验证负荷是否回落",
      conditions: "三个月内能量画像承压不恶化",
      not_choosing: "立刻切断主收入",
      evidence_pointer: "依据见 02（d01、d03）",
    },
  });
  assert.equal(dropSci?.passed, false);
  assert.ok(
    dropSci?.failed_rule === BOOK_BODY_PACK_UNIT_MISS_RULE ||
      dropSci?.failed_rule === BOOK_BODY_PACK_TRACK_DROP_RULE,
  );

  const ok01 = gateBookJudgmentBodyConsume({
    key: "01",
    pack_units: [
      {
        id: "d01",
        track: "destiny",
        serves_face: ["01"],
        claim: "庚金日主承压偏高",
        anchors: ["庚金"],
      },
      {
        id: "d02",
        track: "science",
        serves_face: ["01"],
        claim: "现状与目标偏差拉大认知负荷",
        anchors: ["cognitive_load"],
      },
      {
        id: "d03",
        track: "convergence",
        serves_face: ["01"],
        claim: "命理承压与负荷同向",
        anchors: ["庚金", "cognitive_load"],
      },
    ],
    question: q,
    page_schema: {
      page: "01",
      face: "01",
      page_title: "断",
      page_subtitle: "",
      main_recommendation: "先守补给窗口，业余试点验证负荷是否回落",
      conditions: "三个月内能量画像承压不恶化",
      not_choosing: "立刻切断主收入",
      evidence_pointer: "依据见 02（d01、d02、d03）",
    },
  });
  assert.equal(ok01?.passed, true, ok01?.detail);
}

/** Flag + step table */
{
  assert.equal(isBookJudgmentPackEnabled({} as unknown as NodeJS.ProcessEnv), true);
  assert.equal(
    isBookJudgmentPackEnabled({ BOOK_JUDGMENT_PACK: "0" } as unknown as NodeJS.ProcessEnv),
    false,
  );
  const packSteps = buildLabStepDefsV3({ bookJudgmentPack: true });
  const legacySteps = buildLabStepDefsV3({ bookJudgmentPack: false });
  assert.ok(packSteps.some((d) => d.step_key === "book.judgment"));
  assert.ok(!packSteps.some((d) => d.kind === "content_judgment"));
  assert.ok(legacySteps.some((d) => d.kind === "content_judgment"));
  const viaEnvOff = labStepDefsV3({
    BOOK_JUDGMENT_PACK: "0",
  } as unknown as NodeJS.ProcessEnv);
  assert.ok(viaEnvOff.some((d) => d.kind === "content_judgment"));
}

console.log("book-judgment-pack ok", {
  faces: BOOK_FACE_IDS.length,
  total_min: quota.total_min_units,
  pattern: ziwei.patternHits[0]?.name,
  dense_units: coveringUnits().length,
});
