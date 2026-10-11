/**
 * Smoke: extract CompanionBrief from mock P1/P3 page_schema fences.
 * Run: pnpm exec tsx scripts/test-companion-brief.ts
 */

import assert from "node:assert/strict";

import { encodePageSchemaFence } from "@/lib/llm/pro/delivery/page-schema/render";
import { DELIVERY_PAGE_SCHEMA_MOCK_ZH } from "@/lib/llm/pro/delivery/page-schema/mock-preview-zh";
import { extractCompanionBrief, meansFocusForDay } from "@/lib/companion/extract-companion-brief";
import { addDaysKey } from "@/lib/companion/date-keys";
import {
  COMPANION_WINDOW_DAYS,
  CompanionDayCardsSchema,
} from "@/lib/companion/types";
import {
  buildCompanionEnergyDigest,
  sanitizeCompanionEvidenceMarkers,
} from "@/lib/companion/energy-digest";
import { gateCompanionBatch, companionTextSimilarity } from "@/lib/companion/batch-gate";
import { buildCompanionDailyPrompt } from "@/lib/companion/companion-daily-prompt";
import { normalizeCompanionLocale } from "@/lib/companion/locale-voice";
import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

const p1 = DELIVERY_PAGE_SCHEMA_MOCK_ZH.pages.direct_answer;
const p3 = DELIVERY_PAGE_SCHEMA_MOCK_ZH.pages.science_action;
assert.ok(p1 && p3);

const fullText = [
  "## Direct",
  encodePageSchemaFence(p1),
  "## Science",
  encodePageSchemaFence(p3),
].join("\n\n");

const brief = extractCompanionBrief({
  fullText,
  locale: "zh",
  originalQuestion: "海外一线怎么走",
});

assert.equal(brief.primary.role, "primary");
assert.equal(brief.backup.role, "backup");
assert.ok(brief.primary.means_excerpts.length >= 1);
assert.ok(brief.backup.means_excerpts.length >= 1);
/** means 仅存档；日更不再轮转，但抽取仍可用。 */
assert.ok(meansFocusForDay(brief.primary, 0));
assert.equal(addDaysKey("2026-10-10", COMPANION_WINDOW_DAYS - 1).length, 10);

const cards = CompanionDayCardsSchema.parse({
  today_is: "今日场域偏稳。",
  suitable: "适合守住主线边界。",
  unsuitable: "不宜仓促加码。",
  suggestion: "主线先稳住，备线只作低风险出口。",
  evidence: "今日 ⟦t:食神⟧ 与支持气口相连，宜守不宜冲。",
});
assert.ok(cards.suggestion.length > 0);

const cleaned = sanitizeCompanionEvidenceMarkers(
  "今天的⟦t:dayWeather⟧是ease、⟦t:Branch_Penalty⟧红信号，⟦t:shang_guan|想拆开看清⟧可用。",
);
assert.ok(!/dayWeather|ease|Branch_Penalty/i.test(cleaned));
assert.ok(cleaned.includes("⟦t:shang_guan|想拆开看清⟧"));

/** Adjacent days with same climate must still differ via ten-god / dayIndex. */
const baseSnap = {
  schemaVersion: 1 as const,
  asOf: {
    iso: "2026-10-11T12:00:00.000Z",
    timezone: "UTC",
    localDate: "2026-10-11",
    localTime: "12:00:00",
    baziDayDate: "2026-10-11",
    dayBoundaryPolicy: "zi_2300_local" as const,
  },
  cycles: {
    dayun: null,
    dayunIndex: null,
    liunian: { stem: "丙", branch: "午", ganzhi: "丙午" },
    liuyue: { stem: "戊", branch: "戌", ganzhi: "戊戌" },
    liuri: { stem: "戊", branch: "午", ganzhi: "戊午" },
  },
  dayMaster: {
    stem: "甲",
    strength: "strong" as const,
    yong_shen: "水",
    xi_shen: ["水"],
    ji_shen: ["火"],
  },
  relationToDayMaster: {
    tenGod: "伤官",
    dayStemElement: "土",
    dayBranchElement: "火",
    dayElementHelp: "mixed" as const,
    matchedXi: [],
    matchedJi: [],
  },
  interactions: [],
  energy: {
    climateTone: "supportive" as const,
    dayWeather: "ease" as const,
    overrideRule: {
      blockSprintNarrative: false,
      reasonCode: "none" as const,
    },
    focusSignals: [
      {
        cueCode: "Branch_HalfCombine",
        relationId: "a",
        weight: 8,
        polarity: "green" as const,
        source: "test",
      },
      {
        cueCode: "Branch_Penalty",
        relationId: "b",
        weight: 8,
        polarity: "red" as const,
        source: "test",
      },
    ],
    climateScore: 8,
    dayScore: 4,
  },
  activatedShenSha: [],
  yongshenSource: "heuristic_wuxing_scores" as const,
} satisfies AtmosEngineSnapshot;

const d0 = buildCompanionEnergyDigest(baseSnap, "zh", 0);
const d1 = buildCompanionEnergyDigest(
  {
    ...baseSnap,
    asOf: { ...baseSnap.asOf, baziDayDate: "2026-10-12", localDate: "2026-10-12" },
    cycles: {
      ...baseSnap.cycles,
      liuri: { stem: "己", branch: "未", ganzhi: "己未" },
    },
    relationToDayMaster: {
      ...baseSnap.relationToDayMaster,
      tenGod: "食神",
    },
  },
  "zh",
  1,
);
assert.notEqual(d0.diff_plain, d1.diff_plain);
assert.ok(d0.ten_god_plain?.includes("拆开"));
assert.ok(d1.ten_god_plain?.includes("消化"));
assert.equal(d0.ten_god_slug, "shang_guan");
assert.equal(d1.ten_god_slug, "shi_shen");

assert.equal(normalizeCompanionLocale("en-US"), "en");
assert.equal(normalizeCompanionLocale("fr"), "fr");
assert.ok(companionTextSimilarity("外松内紧想通错觉对齐盖章", "外松内紧想通错觉对齐盖章") >= 0.99);

import { gateCompanionDay } from "@/lib/companion/gate-companion-day";

const stripped = sanitizeCompanionEvidenceMarkers(
  "今日绿32红8，外界有托底。对齐多于刺点。",
);
assert.ok(!/绿\s*\d+|红\s*\d+/.test(stripped));

const day15Bad = gateCompanionDay({
  dayIndex: 14,
  locale: "zh",
  cards: {
    today_is:
      "今天是陪伴第15天，信号偏“对齐”：适合把几条线慢慢并拢，但还不是盖章定案。",
    suitable: "适合分线。",
    unsuitable: "不宜拍板。",
    suggestion: "主线先问清愿不愿意继续。",
    evidence: "信号平衡见摘要。",
  },
});
assert.equal(day15Bad.passed, false);
assert.ok(
  day15Bad.failed_rule === "companion_today_is_align_stamp_skeleton" ||
    day15Bad.failed_rule === "companion_mid_window_suggestion_missing",
);

const cloneCards = {
  today_is: "今天外松内紧，容易产生已经想通的错觉，不是盖章时刻。",
  suitable: "适合分线巩固边界。",
  unsuitable: "不宜趁热拍板加码。",
  suggestion: "先检验前段边界是否还站得住。",
  evidence: "顺向重于刺点，禁冲刺。",
};
const near = gateCompanionBatch(
  [
    { day_index: 0, cards: cloneCards },
    { day_index: 1, cards: { ...cloneCards, today_is: cloneCards.today_is } },
  ],
  { require_full_window: false },
);
assert.equal(near.passed, false);
assert.equal(near.failed_rule, "companion_adjacent_today_is_near_dup");

const promptEn = buildCompanionDailyPrompt({
  brief,
  snapshot: baseSnap,
  dayIndex: 0,
  locale: "en",
  priorFingerprints: ["Yesterday felt like false clarity under outer ease."],
});
assert.ok(promptEn.system.includes("American native"));
assert.ok(promptEn.user.includes("Output language: English"));
assert.ok(promptEn.user.includes("Neighbor today_is fingerprints"));
assert.ok(promptEn.user.includes("P1 PRIMARY rail"));
assert.ok(promptEn.system.includes("Write 1–2 day reminders"));

console.log("ok companion-brief", {
  primary: brief.primary.name,
  backup: brief.backup.name,
  means: brief.primary.means_excerpts.length,
  cards_keys: Object.keys(cards),
});
