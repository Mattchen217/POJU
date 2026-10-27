/**
 * Joint 06: co-decision frames stay on the page.
 * Causative “说服对方” with no joint frame still collapses.
 * ICU hour token "24" is civil 00, so Chicago true-solar time stays a real date.
 *
 * Does not call the model.
 * Run: pnpm test:joint-06-frame
 */
import assert from "node:assert/strict";

import {
  calculateTrueSolarTime,
  getTimezoneOffsetMinutes,
  getZonedCalendarParts,
  normalizeIcuHourToken,
} from "../lib/calendar/true-solar-time";
import {
  detectKnownThirdPartyAgency,
  isScienceSoftRepairShell,
  JOINT_CHART_STAMP,
  SCIENCE_QUERENT_OPENING_HINT,
  softRepairScienceAngleUserProse,
  softRepairThirdPartyAgencyProse,
  textHasJointChartStamp,
} from "../lib/llm/pro/delivery/thesis/third-party-agency";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
import { buildFillDuty as buildP2 } from "../lib/llm/pro/delivery/page-prompts/p2-foundation";
import { buildFillDuty as buildP3 } from "../lib/llm/pro/delivery/page-prompts/p3-science-action";
import { hourToHourPeriod } from "../lib/profile/birth-info-utils";
import type { BirthInfo } from "../lib/profile/types";
import { birthInfoToIztroArgs } from "../lib/ziwei/birth-clock";

const JOINT_STRATEGY =
  "对方盘没有接入。你先写清自己能不能和对方一起拍板的条件，不替对方做主。先把时间、底线和你这一侧先写的范围定下来，再决定这一步要不要一起走。";

function angle(name: string, strategy: string, means: string[], anchor: string) {
  return {
    name,
    strategy,
    means,
    chart_anchors: [anchor],
    hard_metrics: [] as string[],
  };
}

const jointPage = sanitizePageJson("execution_guidance", {
  page: "execution_guidance",
  page_title: "一起拍板前先写你这一侧的条件",
  page_subtitle: "另一侧材料不在时，先定时间、底线和范围",
  primary_toolkit: {
    role: "primary",
    title: "先写你这一侧的拍板条件",
    angles: [
      angle(
        "拍板条件",
        JOINT_STRATEGY,
        [
          "先写下你能投入的时段，以及不能空窗的底线。",
          "把能不能一起拍板收成你这一侧的三条条件。",
        ],
        "当前大运：庚午",
      ),
      angle(
        "近步范围",
        "这一步只处理你已经能核对的范围。先把时间盒和完成样貌写清，再决定要不要把这一步做完。",
        [
          "用一页纸写下这一周能完成的一件事，以及做完后能出示的样貌。",
          "把不能并行的两头收成先后，只保留先做的那一头。",
        ],
        "当前大运：庚午",
      ),
      angle(
        "停手线",
        "先写明哪一个数字或日期出现时，这一步就停。停手线写在你这边，不靠别人点头才成立。",
        [
          "写下一条停手线：投入超过你定的上限，或空窗超过你不能接受的天数。",
          "每周核对一次这条线，用记录决定继续还是停下。",
        ],
        "当前大运：庚午",
      ),
    ],
  },
  backup_toolkit: {
    role: "backup",
    title: "先单独走完你这一侧",
    angles: [
      angle(
        "单独核对",
        "材料只有你这一侧时，先把你能核对的事实写完，再决定要不要进入共同步骤。",
        ["列出三件只有你能核对的事实。", "标出哪一件必须等更多材料才动。"],
        "大限：夫妻",
      ),
      angle(
        "时间盒",
        "给这一步一个你能守住的时间盒。时间到了就停，不把未完成解释成必须继续。",
        ["设定一个结束时刻。", "到点只记录完成了什么。"],
        "大限：夫妻",
      ),
      angle(
        "完成样貌",
        "完成样貌写成你能拿出来看的东西，而不是情绪上的答应。",
        ["写下一句做完后能看见的结果。", "对照这句结果决定这一步算不算做完。"],
        "大限：夫妻",
      ),
    ],
  },
  evidence: [],
});

assert.equal(
  jointPage.ok,
  true,
  jointPage.ok ? "" : `${jointPage.reason} :: ${jointPage.notes.join(" | ")}`,
);
if (jointPage.ok) {
  const page = jointPage.page as {
    primary_toolkit: { angles: Array<{ strategy: string; means: string[] }> };
  };
  const kept = page.primary_toolkit.angles[0]!.strategy;
  assert.equal(detectKnownThirdPartyAgency(kept, ["对方"]), null);
  assert.ok(kept.includes("对方盘没有接入"), kept);
  assert.ok(!isScienceSoftRepairShell(kept), kept);
  assert.ok(
    !jointPage.notes.some((note) => note.includes("primary_toolkit_angle_0") && note.includes("collapsed_to_shell")),
    jointPage.notes.join(" | "),
  );
}

const residueNotes: string[] = [];
const residue = softRepairScienceAngleUserProse(
  "对方盘没有接入，所以仍要让对方同意一起做这个决定。",
  ["先写下你能投入的时段，以及不能空窗的底线。"],
  residueNotes,
  "joint_residue",
);
assert.equal(residue.fail_reason, null, residueNotes.join(" | "));
assert.ok(residue.strategy.includes("对方盘没有接入"), residue.strategy);
assert.ok(!residue.strategy.includes("让对方"), residue.strategy);
assert.ok(!textHasJointChartStamp(residue.strategy), residue.strategy);
assert.ok(!isScienceSoftRepairShell(residue.strategy), residue.strategy);

const pureNotes: string[] = [];
const pure = softRepairScienceAngleUserProse(
  "你要说服对方立刻同意。",
  ["把你的条件写下来，标出时间上限。"],
  pureNotes,
  "pure_agency",
);
assert.equal(pure.fail_reason, "science_strategy_collapsed_to_shell");
assert.ok(!textHasJointChartStamp(pure.strategy));
assert.ok(!textHasJointChartStamp(pure.means.join("")));

assert.equal(normalizeIcuHourToken("24"), "00");
assert.equal(normalizeIcuHourToken("06"), "06");
const rawHour24 = new Date("1985-01-27T24:00:00Z").getTime();
const civilMidnight = new Date("1985-01-27T00:00:00Z").getTime();
assert.ok(Number.isNaN(rawHour24) || rawHour24 !== civilMidnight);
assert.equal(
  new Date(`1985-01-27T${normalizeIcuHourToken("24")}:00:00Z`).getTime(),
  civilMidnight,
);

const chicago = new Date("1985-01-27T12:20:00Z");
const offset = getTimezoneOffsetMinutes("America/Chicago", chicago);
assert.ok(Number.isFinite(offset), String(offset));
const tst = calculateTrueSolarTime({
  localTime: chicago,
  longitude: -87.6298,
  timezone: "America/Chicago",
});
assert.ok(Number.isFinite(tst.diffMinutes));
assert.ok(!Number.isNaN(tst.trueSolarTime.getTime()));
const parts = getZonedCalendarParts(tst.trueSolarTime, "America/Chicago");
assert.ok(parts.hour >= 0 && parts.hour <= 23, String(parts.hour));

const birth: BirthInfo = {
  year: 1985,
  month: 1,
  day: 27,
  hour: 6,
  minute: 20,
  hour_period: hourToHourPeriod(6),
  gender: "M",
  timezone: "America/Chicago",
  birth_location: {
    name: "Chicago",
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: "America/Chicago",
    use_defaults: false,
  },
};
const iztro = birthInfoToIztroArgs(birth);
assert.ok(Number.isFinite(iztro.timeIndex), String(iztro.timeIndex));
assert.equal(iztro.solarDate, "1985-1-27");

const consentPage = sanitizePageJson("execution_guidance", {
  page: "execution_guidance",
  page_title: "一起拍板前先写你这一侧的条件",
  page_subtitle: "另一侧材料不在时，先定时间、底线和范围",
  primary_toolkit: {
    role: "primary",
    title: "先写你这一侧的拍板条件",
    angles: [
      angle(
        "核对步骤",
        "先写下你能投入的时段，再决定要不要一起走，不要让对方同意才算数。",
        [
          "先写下你能投入的三个时段，让对方同意后再做。",
          "把不能空窗的天数写成一条底线，说服对方接受这个决定。",
        ],
        "当前大运：庚午",
      ),
      angle(
        "近步范围",
        "这一步只处理你已经能核对的范围。先把时间盒和完成样貌写清，再决定要不要把这一步做完。",
        [
          "用一页纸写下这一周能完成的一件事，以及做完后能出示的样貌。",
          "把不能并行的两头收成先后，只保留先做的那一头。",
        ],
        "当前大运：庚午",
      ),
      angle(
        "停手线",
        "先写明哪一个数字或日期出现时，这一步就停。停手线写在你这边，不靠别人点头才成立。",
        [
          "写下一条停手线：投入超过你定的上限，或空窗超过你不能接受的天数。",
          "每周核对一次这条线，用记录决定继续还是停下。",
        ],
        "当前大运：庚午",
      ),
    ],
  },
  backup_toolkit: {
    role: "backup",
    title: "先单独走完你这一侧",
    angles: [
      angle(
        "单独核对",
        "材料只有你这一侧时，先把你能核对的事实写完，再决定要不要进入共同步骤。",
        ["说服对方先表态。", "列出三件只有你能核对的事实。"],
        "大限：夫妻",
      ),
      angle(
        "时间盒",
        "给这一步一个你能守住的时间盒。时间到了就停，不把未完成解释成必须继续。",
        ["设定一个结束时刻。", "到点只记录完成了什么。"],
        "大限：夫妻",
      ),
      angle(
        "完成样貌",
        "完成样貌写成你能拿出来看的东西，而不是情绪上的答应。",
        ["写下一句做完后能看见的结果。", "对照这句结果决定这一步算不算做完。"],
        "大限：夫妻",
      ),
    ],
  },
  evidence: [],
});
assert.equal(
  consentPage.ok,
  true,
  consentPage.ok ? "" : `${consentPage.reason} :: ${consentPage.notes.join(" | ")}`,
);
if (consentPage.ok) {
  const page = consentPage.page as {
    primary_toolkit: { angles: Array<{ strategy: string; means: string[] }> };
    backup_toolkit: { angles: Array<{ strategy: string; means: string[] }> };
  };
  const blob = [
    page.primary_toolkit.angles[0]!.strategy,
    ...page.primary_toolkit.angles[0]!.means,
    ...page.backup_toolkit.angles[0]!.means,
  ].join("\n");
  assert.equal(detectKnownThirdPartyAgency(blob, ["对方"]), null);
  assert.ok(!/让对方|说服对方/.test(blob), blob);
  assert.ok(!textHasJointChartStamp(blob), blob);
  assert.ok(page.primary_toolkit.angles[0]!.means.some((mean) => mean.includes("三个时段")), blob);
  assert.ok(page.primary_toolkit.angles[0]!.means.some((mean) => mean.includes("底线")), blob);
  assert.equal(page.primary_toolkit.angles.length, 3);
}

const resign = softRepairScienceAngleUserProse(
  "先把三个月能核对的收入底线写下来，不要说服对方留下。",
  ["先写下三个月能核对的收入底线，不要说服对方留下。"],
  [],
  "resign",
);
assert.equal(resign.fail_reason, null, resign.strategy);
assert.ok(resign.strategy.includes("收入底线"), resign.strategy);
assert.ok(resign.means[0]?.includes("收入底线"));
assert.ok(!textHasJointChartStamp(`${resign.strategy}\n${resign.means.join("\n")}`));

const migration = softRepairScienceAngleUserProse(
  "把搬迁日期和能接受的空窗写下来。。",
  ["把搬迁日期和能接受的空窗写下来，让对方同意后再订票。"],
  [],
  "migration",
);
assert.equal(migration.fail_reason, null);
assert.ok(migration.means[0]?.includes("搬迁日期"), migration.means.join(" | "));
assert.ok(!migration.means[0]?.includes("让对方"));
assert.ok(!textHasJointChartStamp(migration.means.join("\n")));
assert.ok(!migration.strategy.includes("。。"), migration.strategy);

const punct = softRepairThirdPartyAgencyProse("先写你的底线。。再核对这一周。", []);
assert.equal(punct, "先写你的底线。再核对这一周。");
assert.ok(!punct.includes(JOINT_CHART_STAMP));

const general = softRepairScienceAngleUserProse(
  "先写下这一周你自己能完成的一件事。另一侧的盘不在这份材料里，你先写清自己能不能一起拍板的时间、底线和范围。",
  ["把停手线写成一个日期。。不要让对方同意才继续。"],
  [],
  "general",
);
assert.equal(general.fail_reason, null, general.strategy);
assert.ok(general.strategy.includes("这一周"), general.strategy);
assert.ok(!textHasJointChartStamp(general.strategy), general.strategy);
assert.ok(general.means[0]?.includes("停手线"), general.means.join(" | "));
assert.ok(!general.means[0]?.includes("让对方"));
assert.ok(!general.means[0]?.includes("。。"));
assert.ok(!textHasJointChartStamp(general.means.join("\n")));

const leverage = softRepairThirdPartyAgencyProse(
  "技术方案让对方无法绕开。用稳定输出让对方不得不重视你的价值。",
  [],
);
assert.ok(leverage.includes("无法绕开"), leverage);
assert.ok(!textHasJointChartStamp(leverage), leverage);

const shellOnly = softRepairScienceAngleUserProse(
  SCIENCE_QUERENT_OPENING_HINT,
  [SCIENCE_QUERENT_OPENING_HINT],
  [],
  "shell_only",
);
assert.equal(shellOnly.fail_reason, "science_strategy_collapsed_to_shell");

const mingliEssence =
  "从命理上看，外部催促会压过你自己的节奏。窗口被占用之后，第二天还要用硬扛把缺口补上，循环下去连最小的一步也开不了，整周都会停在原地。";
assert.ok(mingliEssence.length >= 60);
const mingliPage = sanitizePageJson("situation_analysis", {
  page: "situation_analysis",
  page_title: "一起决定时你这一侧的结构",
  page_subtitle: "现象从这张盘的结构来",
  why_cards: [0, 1, 2, 3].map((i) => ({
    title: `结构卡${i}`,
    surface: "眼前这一步总要等别人点头，自己的时间盒一直空着。",
    essence: i === 0
      ? mingliEssence
      : "内在节奏被外部催促打断后，恢复窗口一次次后移，第二天只能用硬扛补上缺口，循环下去连最小的一步也开不了，整周都会停在原地。",
    chart_anchors: ["当前大运：丁丑"],
  })),
  evidence: [],
}, { fillMode: "full" });
assert.equal(
  mingliPage.ok,
  true,
  mingliPage.ok ? "" : `${mingliPage.reason} :: ${mingliPage.notes.join(" | ")}`,
);
if (mingliPage.ok) {
  const essence = (mingliPage.page as { why_cards: Array<{ essence: string }> }).why_cards[0]!.essence;
  assert.ok(!essence.includes("命理"), essence);
  assert.ok(essence.includes("能量画像"), essence);
  assert.ok(
    mingliPage.notes.some((note) => /compress_body_(?:mingli|jargon)_auto_repaired:命理/.test(note)),
    mingliPage.notes.join(" | "),
  );
}

const p2 = buildP2("归因");
const p2plain = buildP2("归因", { plain_judgment: true });
assert.ok(p2.includes("不要写出「命理」"));
assert.ok(p2plain.includes("不要写出「命理」"));
const p3 = buildP3("执行");
assert.ok(p3.includes("让对方同意 / 说服对方"));
assert.ok(p3.includes("self_retune"));
assert.ok(p3.includes("06-C"));
assert.ok(p3.includes("必须是对象"));

const RETUNE = {
  title: "自己的节奏",
  body: "做这一步时先守住你自己的停手线：时间到了就停，不把没写完当成必须继续。",
};
const withRetune = sanitizePageJson(
  "execution_guidance",
  {
    page: "execution_guidance",
    page_title: "落地时稳住自己的节奏",
    page_subtitle: "近步原则和完成样貌",
    self_retune: RETUNE,
    primary_toolkit: consentPage.ok
      ? (consentPage.page as { primary_toolkit: unknown }).primary_toolkit
      : null,
    backup_toolkit: consentPage.ok
      ? (consentPage.page as { backup_toolkit: unknown }).backup_toolkit
      : null,
    evidence: [],
  },
  { requireSelfRetune: true },
);
assert.equal(
  withRetune.ok,
  true,
  withRetune.ok ? "" : `${withRetune.reason} :: ${withRetune.notes.join(" | ")}`,
);
if (withRetune.ok) {
  const retune = (withRetune.page as { self_retune?: { body: string } }).self_retune;
  assert.ok(retune?.body.includes("停手线"), retune?.body ?? "");
  assert.ok(!textHasJointChartStamp(retune?.body ?? ""));
}
const missingRetune = sanitizePageJson(
  "execution_guidance",
  {
    page: "execution_guidance",
    page_title: "落地时稳住自己的节奏",
    page_subtitle: "近步原则和完成样貌",
    primary_toolkit: consentPage.ok
      ? (consentPage.page as { primary_toolkit: unknown }).primary_toolkit
      : null,
    backup_toolkit: consentPage.ok
      ? (consentPage.page as { backup_toolkit: unknown }).backup_toolkit
      : null,
    evidence: [],
  },
  { requireSelfRetune: true },
);
assert.equal(missingRetune.ok, false);
if (!missingRetune.ok) assert.equal(missingRetune.reason, "missing_06c_self_retune");

console.log("joint 06 frame + ICU hour 24 ok");
