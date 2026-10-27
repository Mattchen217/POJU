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
  softRepairScienceAngleUserProse,
} from "../lib/llm/pro/delivery/thesis/third-party-agency";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
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
assert.ok(!residue.strategy.includes("对方"), residue.strategy);
assert.ok(!residue.strategy.includes("让对方"), residue.strategy);
assert.ok(!isScienceSoftRepairShell(residue.strategy), residue.strategy);

const pureNotes: string[] = [];
const pure = softRepairScienceAngleUserProse(
  "你要说服对方立刻同意。",
  ["把你的条件写下来，标出时间上限。"],
  pureNotes,
  "pure_agency",
);
assert.equal(pure.fail_reason, "science_strategy_collapsed_to_shell");

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

console.log("joint 06 frame + ICU hour 24 ok");
