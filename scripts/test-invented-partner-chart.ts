/**
 * #13 Invented partner chart on solo / partner_bazi=absent —
 * detector + body gate + Companion gate regression.
 *   pnpm exec tsx scripts/test-invented-partner-chart.ts
 */
import assert from "node:assert/strict";
import {
  findInventedPartnerChart,
  findInventedPartnerChartOnSoloPath,
  isPartnerChartAbsentPath,
  inventedPartnerChartPromptBlock,
  INVENTED_PARTNER_CHART_DUTY_LINE,
  INVENTED_PARTNER_CHART_RULE_ID,
  COMPANION_INVENTED_PARTNER_CHART_RULE_ID,
} from "@/lib/llm/pro/delivery/pipeline-v3/invented-partner-chart";
import {
  buildBodyGateAvoidanceBlockForPolish,
  gateBodyCategoryB,
} from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import { buildV3BodyPrompt } from "@/lib/llm/pro/delivery/pipeline-v3/body-prompt";
import { gateCompanionDay } from "@/lib/companion/gate-companion-day";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import type { CompanionDayCards } from "@/lib/companion/types";

// --- path helper ---
assert.equal(
  isPartnerChartAbsentPath({ partner_bazi: "absent", pivot_chart_path: "solo" }),
  true,
);
assert.equal(
  isPartnerChartAbsentPath({ partner_bazi: "present", pivot_chart_path: "dyad" }),
  false,
);
assert.equal(
  isPartnerChartAbsentPath({
    relation_boundary: "关系边界：本题涉二元议题但无对方盘——禁臆造对方命理。",
  }),
  true,
);
assert.equal(isPartnerChartAbsentPath({}), false);

// --- detector: invent fixtures ---
assert.equal(
  findInventedPartnerChart("对方日主丙火，合局偏紧")?.kind,
  "partner_day_master",
);
assert.equal(
  findInventedPartnerChart("她是甲木日主，你侧先守边界")?.kind,
  "partner_day_master",
);
assert.equal(
  findInventedPartnerChart("their day master is Bing Fire")?.kind,
  "partner_day_master",
);
assert.equal(
  findInventedPartnerChart("对方大运走癸水，近窗更粘")?.kind,
  "partner_luck_pillar",
);
assert.equal(
  findInventedPartnerChart("partner's luck pillar shifts wet")?.kind,
  "partner_luck_pillar",
);
assert.equal(
  findInventedPartnerChart("合盘分数 78，很能过")?.kind,
  "dyad_score",
);
assert.equal(
  findInventedPartnerChart("契合度：82 说明必成")?.kind,
  "dyad_score",
);
assert.equal(
  findInventedPartnerChart("resonance_index=81 so marry")?.kind,
  "dyad_score",
);
assert.equal(
  findInventedPartnerChart("对方八字喜火，你要补火")?.kind,
  "partner_bazi_spec",
);
assert.equal(
  findInventedPartnerChart("partner's bazi likes fire")?.kind,
  "partner_bazi_spec",
);

// --- detector: boundary / ban copy OK ---
assert.equal(
  findInventedPartnerChart(
    "无对方盘——禁臆造对方日主/大运；只钉你侧主辅栏杆与可观察现实。",
  ),
  null,
);
assert.equal(
  findInventedPartnerChart(
    "Relation boundary: dyad topic without partner chart — never invent their day-master; stay on your rails.",
  ),
  null,
);

// Observable partner behavior (no metaphysics) OK
assert.equal(
  findInventedPartnerChart(
    "对方已拒兼职；他总是把沟通拖到周五晚上。只按你侧硬门槛走。",
  ),
  null,
);

// User's own day-master without partner prefix OK
assert.equal(
  findInventedPartnerChart("你侧日主丙火，近窗先守补给。"),
  null,
);

// --- path-gated detector ---
assert.equal(
  findInventedPartnerChartOnSoloPath("对方日主丙火", {
    partner_bazi: "present",
    pivot_chart_path: "dyad",
  }),
  null,
  "dyad path allows grounded partner chart content (gate off)",
);
assert.equal(
  findInventedPartnerChartOnSoloPath("对方日主丙火", {
    partner_bazi: "absent",
    pivot_chart_path: "solo",
  })?.kind,
  "partner_day_master",
);

// --- prompt blocks ---
const zh = inventedPartnerChartPromptBlock("zh");
assert.ok(zh.includes("#13"));
assert.ok(zh.includes("对方日主") || zh.includes("臆造"));
assert.ok(INVENTED_PARTNER_CHART_DUTY_LINE.includes("#13"));
const en = inventedPartnerChartPromptBlock("en");
assert.ok(en.includes("Invented partner chart ban (#13"));

// --- body prompt mounts #13 ---
const { system, user } = buildV3BodyPrompt({
  key: "decision_brief",
  locale: "zh",
  core_conclusion: "宜守硬门槛",
  judgment_lock: "path=primary",
  user_feed: "期望：谈妥书面权益再全职。对方已拒兼职。path=solo partner_bazi=absent",
});
assert.ok(
  system.includes("#13") || system.includes("臆造对方盘"),
  "BODY_SYSTEM should carry #13 partner-chart ban",
);
assert.ok(
  user.includes("#13") || user.includes("臆造对方盘"),
  "P1 duty should carry #13 invented-partner line",
);

// --- polish avoidance ---
const avoid = buildBodyGateAvoidanceBlockForPolish("decision_brief");
assert.ok(avoid.includes(INVENTED_PARTNER_CHART_RULE_ID) || avoid.includes("#13"));

// --- gate fails invent-on-solo ---
const inventPage = {
  page: "decision_brief",
  page_title: "先守你侧",
  page_subtitle: "solo 路径",
  core_judgment: "对方日主丙火，合盘分数 80，先结婚再谈门。",
  primary: {
    name: "主路",
    core_logic: "按对方大运走水来推近窗。",
    why: "看似合",
    when: "近窗",
  },
  backup: { name: "辅", core_logic: "等", why: "x", when: "later" },
} as unknown as DeliveryPageData;

const failSolo = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: inventPage,
  reality_blob: "对方已拒兼职；用户已 skip 对方盘。",
  surface: "substance_only",
  partner_bazi: "absent",
  pivot_chart_path: "solo",
});
assert.ok(failSolo && failSolo.passed === false);
assert.equal(failSolo!.failed_rule, INVENTED_PARTNER_CHART_RULE_ID);

// --- gate allows same prose on dyad (gate off) ---
const allowDyad = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: inventPage,
  reality_blob: "dyad_compat_summary present",
  surface: "substance_only",
  partner_bazi: "present",
  pivot_chart_path: "dyad",
});
assert.equal(
  allowDyad,
  null,
  "dyad-with-partner allows grounded partner chart content",
);

// --- gate allows absent boundary copy on solo ---
const boundaryPage = {
  page: "decision_brief",
  page_title: "solo 继续",
  page_subtitle: "无对方盘",
  core_judgment:
    "本题无对方盘——禁臆造对方日主/大运；只按你侧硬门槛与对方已拒兼职的事实取舍。",
  primary: {
    name: "守全职",
    core_logic: "对方已拒兼职；他沟通常拖到周末。主路守书面权益再谈投入。",
    why: "对齐收集",
    when: "权益落纸前",
  },
  backup: {
    name: "按次顾问",
    core_logic: "若权益拖死，改按次顾问。",
    why: "止损",
    when: "谈不拢时",
  },
} as unknown as DeliveryPageData;

const passBoundary = gateBodyCategoryB({
  key: "decision_brief",
  page_schema: boundaryPage,
  reality_blob: "对方已拒兼职；用户 skip 对方盘。",
  surface: "substance_only",
  partner_bazi: "absent",
  pivot_chart_path: "solo",
});
assert.equal(passBoundary, null, "absent boundary copy + observed behavior OK");

// --- Companion: invent-on-solo FAIL ---
const inventCards: CompanionDayCards = {
  today_is:
    "Today feels sticky; easy to over-read warmth as if the path were already cleared.",
  suitable:
    "Favor holding your primary rail without elevating backup into the main story.",
  unsuitable:
    "Do not lock a wedding date on mood alone, and do not treat soft talk as registry clearance.",
  suggestion:
    "Check whether primary still holds the floor, and whether backup was lifted too early by ease.",
  evidence: "对方日主丙火，合盘分数 78，所以今天宜推进领证。",
};
const companionFail = gateCompanionDay({
  cards: inventCards,
  dayIndex: 0,
  locale: "zh",
  partner_bazi: "absent",
  pivot_chart_path: "solo",
});
assert.equal(companionFail.passed, false);
assert.equal(companionFail.failed_rule, COMPANION_INVENTED_PARTNER_CHART_RULE_ID);

// Companion: boundary copy + observed OK via relation_boundary
const okCards: CompanionDayCards = {
  today_is:
    "场域偏粘，容易把顺畅当成终局信号；今天把心智留在你侧主辅边界上，不把气氛当盖章。",
  suitable:
    "守你侧主路托底，辅路别提前升主；只校准原题里的硬门槛与可观察节奏。",
  unsuitable:
    "别用情绪窗口锁死领证日程，也别把对方一次顺畅沟通读成命理结论。",
  suggestion:
    "只问主辅边界是否还站得住：主路是否仍托底，辅路是否被提前抬成主叙事。",
  evidence:
    "无对方盘——禁臆造对方日主；对方昨晚又把沟通拖到很晚，只记可观察行为。",
};
const companionOk = gateCompanionDay({
  cards: okCards,
  dayIndex: 1,
  locale: "zh",
  relation_boundary:
    "关系边界：本题涉二元议题但无对方盘——日提醒只钉你侧主辅栏杆与可观察现实；禁臆造对方命理。",
});
assert.equal(companionOk.passed, true);

// Companion: dyad present allows partner chart mention
const dyadCards: CompanionDayCards = {
  today_is:
    "Warmth is up; easy to treat ease as clearance when the day still asks for your own rail check.",
  suitable:
    "Calibrate your rails with the structure anchor you already locked; keep primary footing.",
  unsuitable:
    "Do not open a Match chapter or chase a third chart just because talk felt smoother.",
  suggestion:
    "Keep single-person dailies; use the partner structure anchor lightly without rewriting the plan.",
  evidence: "对方日主丙火锚已在喂料；今日只校准你侧边界。",
};
const companionDyad = gateCompanionDay({
  cards: dyadCards,
  dayIndex: 2,
  locale: "zh",
  partner_bazi: "present",
  pivot_chart_path: "dyad",
});
assert.equal(companionDyad.passed, true);

console.log("ok: invented-partner-chart #13 detector + body gate + companion gate");
