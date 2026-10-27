/**
 * P0: 02 empty why-card anchors and 06 string toolkits sanitize
 * from the page slice. Does not call the model.
 */
import assert from "node:assert/strict";

import { buildFillDuty as buildP2 } from "../lib/llm/pro/delivery/page-prompts/p2-foundation";
import { buildFillDuty as buildP3 } from "../lib/llm/pro/delivery/page-prompts/p3-science-action";
import { buildFillDuty as buildP1 } from "../lib/llm/pro/delivery/page-prompts/p1-direct-answer";
import { buildFillDuty as buildP5 } from "../lib/llm/pro/delivery/page-prompts/p5-risk-guard";
import { replayObservedP0Shapes } from "../lib/llm/pro/delivery/page-schema/p0-fill-shape-replay";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
import {
  chartFactPackFromText,
  pageSliceAnchorLines,
} from "../lib/llm/pro/delivery/slice-for-page";
import { textHitsScareRedline } from "../lib/llm/compliance/audit-output";

const chartText = [
  "日主：癸水（身弱）",
  "用神：水",
  "喜神：金",
  "忌神：火",
  "当前大运：庚午（28岁起）",
  "四柱 年甲子 月乙丑 日丙寅 时丁卯",
].join("\n");

const lines02 = pageSliceAnchorLines("02", { chart: chartFactPackFromText(chartText) });
const lines06 = pageSliceAnchorLines("06", { chart: chartFactPackFromText(chartText) });

assert.ok(lines02.some((line) => line.includes("日主")), "02 keeps day master");
assert.ok(lines02.some((line) => line.startsWith("用神")), "02 keeps yong");
assert.ok(lines02.length <= 6, "02-D cap");
assert.ok(!lines02.join("\n").includes("四柱"), "02 does not dump pillars");
assert.ok(lines06.some((line) => line.startsWith("当前大运")), "06 keeps dayun");
assert.ok(!lines06.some((line) => line.startsWith("用神")), "06 stays on its allowlist");

const replay = replayObservedP0Shapes(chartText);
assert.equal(replay.situation.ok, true, replay.situation.reason);
assert.equal(replay.execution.ok, true, replay.execution.reason);
assert.ok(
  replay.situation.notes.some((note) => note.startsWith("stamped_slice_anchors:why_cards")),
);
assert.ok(
  replay.execution.notes.some((note) => note.includes("promoted_string_toolkit")),
);
assert.ok(
  replay.execution.notes.some((note) => note.startsWith("stamped_slice_anchors:primary_toolkit")),
);

const objectToolkit = sanitizePageJson(
  "execution_guidance",
  {
    page_title: "近步原则",
    page_subtitle: "完成样貌与调频",
    primary_toolkit: {
      title: "主轨",
      angles: [1, 2, 3].map((index) => ({
        name: `原则${index}`,
        strategy: "先定原则，再写做成什么样。",
        means: ["完成样貌是一个能核对的结果"],
        chart_anchors: [],
      })),
    },
    backup_toolkit: {
      title: "辅轨",
      angles: [1, 2, 3].map((index) => ({
        name: `退路${index}`,
        strategy: "条件变了就换轨，不改成清单。",
        means: ["完成样貌是边界还在"],
        chart_anchors: [],
      })),
    },
  },
  { sliceAnchorLines: lines06 },
);
assert.equal(objectToolkit.ok, true, objectToolkit.ok ? "" : objectToolkit.reason);
if (objectToolkit.ok && objectToolkit.page.page === "execution_guidance") {
  const angle = objectToolkit.page.primary_toolkit.angles[0];
  assert.ok(angle && angle.chart_anchors.length >= 1, "object toolkit angles get slice anchors");
}

const p2 = `${buildP2("归因", { plain_judgment: true })}\n${buildP2("归因")}`;
const p3 = buildP3("落地");
assert.equal(p2.includes("留空"), false);
assert.equal(p3.includes("可留空"), false);
assert.equal(p3.includes("必须是对象"), true);
assert.ok(buildP1("断语").includes("chart_anchors"));
assert.ok(buildP5("自检").includes("chart_anchors"));
assert.equal(textHitsScareRedline("这段关系必散"), true);
assert.equal(textHitsScareRedline("本题更宜先稳住，条件是范围写清。"), false);

console.log("p0 slice anchor stamp ok");
