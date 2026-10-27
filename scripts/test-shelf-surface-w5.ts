/**
 * W5 shelf surface. Topic gate, HTML face order, H2 fold.
 *
 *   pnpm test:shelf-surface-w5
 */
import { readFileSync } from "node:fs";
import { decisionReportSlotIds } from "../lib/deliverables/fill-delivery";
import { renderDecisionReportTemplate } from "../lib/deliverables/templates/decision-report";
import { PAGE07_WRITE_ENTRY, composePage07Markdown } from "../lib/llm/pro/delivery/page-07-face";
import { shelfFaceDispatchKeys } from "../lib/llm/pro/delivery/dispatch/task-dag";
import { groupDeliverySectionsByFace } from "../lib/llm/pro/delivery/shelf-face-map";
import {
  deliveryTopicFromSignals,
  page07Applies,
} from "../lib/llm/pro/delivery/slice-for-page";
import { resolveDeliveryPipeline } from "../lib/llm/pro/delivery/pipeline-v3/flag";
import { buildDeliverySlotMap } from "../lib/deliverables/fill-delivery";
import { splitSections } from "../lib/poju/delivery-report-v2-split";
import { buildDeliveryShelfSlots } from "../lib/poju/delivery-shelf-slots";

const failures: string[] = [];
function assert(label: string, ok: boolean) {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

assert(
  "question stem opens 07",
  deliveryTopicFromSignals({ question: "我要不要迁移去另一个城市" }) === "迁移",
);
assert(
  "事业换场 beats the shorter stem",
  deliveryTopicFromSignals({ question: "这是一次事业换场" }) === "事业换场",
);
assert(
  "官禄 alone stays shut",
  !page07Applies(deliveryTopicFromSignals({ question: "想看官禄", topic: "官禄" })),
);
assert(
  "joint signal opens 07",
  deliveryTopicFromSignals({ question: "一起做决定", joint: true }) === "joint",
);
assert(
  "dyad path opens 07",
  deliveryTopicFromSignals({ pivotChartPath: "dyad", question: "普通问题" }) === "joint",
);
assert(
  "partner present opens 07",
  deliveryTopicFromSignals({ partnerBazi: "present" }) === "joint",
);
assert(
  "solo general stays shut",
  deliveryTopicFromSignals({ topic: "general", pivotChartPath: "solo", question: "要不要换工作" }) ===
    "general",
);

const htmlDefault = decisionReportSlotIds(null);
assert(
  "html default order",
  htmlDefault.join(",") === "cover,01,02,04,05,06,08,03",
);
const htmlTopic = decisionReportSlotIds("relationship");
assert(
  "html topic order",
  htmlTopic.join(",") === "cover,01,02,04,05,06,07,08,03",
);
const blank = renderDecisionReportTemplate(null);
assert("blank omits 07 pane", !blank.includes('data-slot-pane="07"'));
assert("blank uses face 01", blank.includes('data-slot-pane="01"') && blank.includes("SLOT_BODY_06"));
const with07 = renderDecisionReportTemplate("合伙");
assert("topic template inserts 07 between 06 and 08", (() => {
  const i06 = with07.indexOf('data-slot-pane="06"');
  const i07 = with07.indexOf('data-slot-pane="07"');
  const i08 = with07.indexOf('data-slot-pane="08"');
  return i06 >= 0 && i06 < i07 && i07 < i08;
})());

const staticHtml = readFileSync("templates/deliverables/decision-report.template.html", "utf8");
assert("static template uses face 01", staticHtml.includes('data-slot="01"'));
assert("static template drops the six-pane ids", !staticHtml.includes("direct_answer") && !staticHtml.includes("SLOT_BODY_FOUNDATION"));
assert("static template leaves baseline alone", !staticHtml.includes("baseline-profile"));

const md = `# 封面

封面

## 目录

1. 本题

## 决策简报

BRIEF_CANARY

## 科学药方：策略与手段

EXEC_CANARY

## 东方谋略

RETUNE_CANARY

## 30天能量推进

RETIRED_CANARY

## 风险预警

RISK_CANARY
`;

const shelf = buildDeliveryShelfSlots(md, {
  locale: "zh",
  complete: true,
  topic: "我考虑迁移",
  question: "我考虑迁移，要不要走",
});
const body = (id: string) => {
  const slot = shelf.find((item) => item.slotId === id);
  return slot?.kind === "ready" ? slot.page.body : "";
};
assert("shelf 07 inserted from the question", shelf.some((slot) => slot.slotId === "07") && body("07").includes("场域与关系"));
assert("07 keeps the user question", body("07").includes("我考虑迁移，要不要走"));
assert("07 does not invent a second chart", !body("07").includes("otherChart"));
assert("06 still folds both papers", body("06").includes("EXEC_CANARY") && body("06").includes("RETUNE_CANARY"));
assert("retired heading stays off 02", !body("02").includes("RETIRED_CANARY"));
assert("no 07 when the gate is shut", !buildDeliveryShelfSlots(md, { locale: "zh", complete: true }).some((slot) => slot.slotId === "07"));

const grouped = groupDeliverySectionsByFace(splitSections(md), {
  topic: "迁移",
  question: "我考虑迁移",
});
const g06 = grouped.find((section) => section.id === "06");
const g07 = grouped.find((section) => section.id === "07");
assert("center 06 is one face", Boolean(g06?.body.includes("EXEC_CANARY") && g06.body.includes("RETUNE_CANARY")));
assert("center 07 follows the topic", g07?.id === "07" && grouped.indexOf(g07) < grouped.findIndex((section) => section.id === "08"));
assert(
  "center does not file the retired heading as 02",
  !grouped.some((section) => section.id === "02" && section.body.includes("RETIRED_CANARY")),
);
assert(
  "retired heading stays unmapped",
  grouped.some((section) => section.id.startsWith("unmapped") && section.body.includes("RETIRED_CANARY")),
);

const slots = buildDeliverySlotMap(md, "zh", { topic: "迁移", originalQuestion: "我考虑迁移" });
assert("download 01", slots.SLOT_BODY_01?.includes("BRIEF_CANARY") === true);
assert("download 06", slots.SLOT_BODY_06?.includes("RETUNE_CANARY") === true);
assert("download 07", slots.SLOT_BODY_07?.includes("场域与关系") === true);
assert("download without topic has no 07 slot key", buildDeliverySlotMap(md, "zh").SLOT_BODY_07 === undefined);

assert("07 write entry is the slice compose", PAGE07_WRITE_ENTRY === "slice:07");
assert("07 composer is silent without a topic", composePage07Markdown({ topic: "general" }) === null);
assert("07 still has no DAG task", shelfFaceDispatchKeys("07").length === 0);
assert("pipeline default stays legacy", resolveDeliveryPipeline({ ...process.env, DELIVERY_PIPELINE: "" }) === "legacy");

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("shelf surface W5 ok\n");
