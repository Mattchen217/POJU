/**
 * W4 shelf face. Reader order is 01 → 02 → 04 → 05 → 06 → (07) → 08 → 03.
 *
 * Manual checklist (this script locks the same points):
 * 1. Default ids: cover, toc, 01, 02, 04, 05, 06, 08, 03. No 07. No v1 paper id.
 * 2. relationship / career_move / 迁移 / 合伙 / 亲密 / joint insert 07 between 06 and 08.
 * 3. general / null / 官禄 / career omit 07.
 * 4. Empty report waits on 01. 07 is absent unless the topic opens it, then it waits empty.
 * 5. 科学药方 + 东方谋略 fold into one 06. 风险预警 + 行动指引 fold into one 08.
 *    决策模式 stays on 02 and is not copied onto 04. 主策略 stays on 05.
 *    附录 is 03 at the package end.
 * 6. resolveDeliverySegmentKey: 06 → execution_guidance, 08 → validation_risk, 07 and 03 → null.
 * 7. DELIVERY_PIPELINE default stays legacy.
 *
 *   pnpm test:shelf-face-w4
 */
import { buildDeliverySlotMap } from "../lib/deliverables/fill-delivery";
import { resolveDeliverySegmentKey } from "../lib/llm/pro/delivery/delivery-schema";
import { resolveDecisionPage } from "../lib/llm/pro/delivery/decision-page-bridge";
import { shelfFaceDispatchKeys } from "../lib/llm/pro/delivery/dispatch/task-dag";
import { pageFeedFlags, shelfFaceFeed } from "../lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import { resolveDeliveryPipeline } from "../lib/llm/pro/delivery/pipeline-v3/flag";
import { ShelfFace06Schema } from "../lib/llm/pro/delivery/page-schema/shelf-face-schema";
import {
  buildDeliveryShelfSlots,
  DELIVERY_SHELF_SLOT_IDS,
  deliveryProsePageNumber,
  deliveryShelfSlotIds,
} from "../lib/poju/delivery-shelf-slots";

const failures: string[] = [];
function assert(label: string, ok: boolean) {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const DEFAULT = ["cover", "toc", "01", "02", "04", "05", "06", "08", "03"] as const;

assert("default shelf order", DELIVERY_SHELF_SLOT_IDS.join(",") === DEFAULT.join(","));
assert("null topic matches default", deliveryShelfSlotIds(null).join(",") === DEFAULT.join(","));
assert("general omits 07", !deliveryShelfSlotIds("general").includes("07"));
assert("官禄 omits 07", !deliveryShelfSlotIds("官禄").includes("07"));
assert("career omits 07", !deliveryShelfSlotIds("career").includes("07"));

for (const topic of ["relationship", "career_move", "迁移", "合伙", "亲密", "joint"]) {
  const ids = deliveryShelfSlotIds(topic);
  const i06 = ids.indexOf("06");
  const i07 = ids.indexOf("07");
  const i08 = ids.indexOf("08");
  assert(`${topic} inserts 07 between 06 and 08`, i06 >= 0 && i07 === i06 + 1 && i08 === i07 + 1);
}

assert("default 08 is prose 6", deliveryProsePageNumber("08") === 6);
assert("default 03 is prose 7", deliveryProsePageNumber("03") === 7);
const relOrder = deliveryShelfSlotIds("relationship");
assert("topic 07 is prose 6", deliveryProsePageNumber("07", relOrder) === 6);
assert("topic 08 is prose 7", deliveryProsePageNumber("08", relOrder) === 7);
assert("topic 03 is prose 8", deliveryProsePageNumber("03", relOrder) === 8);

const empty = buildDeliveryShelfSlots("", { locale: "zh", complete: false });
assert("empty waits on 01", empty[2]?.kind === "waiting" && empty[2].slotId === "01");
assert("empty default has no 07", !empty.some((slot) => slot.slotId === "07"));

const emptyTopic = buildDeliveryShelfSlots("", {
  locale: "zh",
  complete: false,
  topic: "relationship",
});
assert(
  "topic shelf order",
  emptyTopic.map((slot) => slot.slotId).join(",") === "cover,toc,01,02,04,05,06,07,08,03",
);
assert(
  "gated 07 is the schema face",
  emptyTopic.find((slot) => slot.slotId === "07")?.kind === "ready" &&
    bodyReady(emptyTopic, "07").includes("场域与关系"),
);

const md = `# 封面

封面说明。

## 目录

1. 本题

## 决策简报

BRIEF_CANARY 本题先稳住。

## 决策模式

PATTERN_CANARY 先问边界再答应。

## 主策略

STRATEGY_CANARY 主路是书面确认后再加码。

## 科学药方：策略与手段

EXEC_CANARY 近步是先写范围，做成什么样是边界确认。

## 东方谋略

RETUNE_CANARY 执行中先把节奏放慢。

## 风险预警

RISK_CANARY 七日内没有书面范围就停。

## 行动指引

CLOSE_CANARY 今晚只核对一件。

## 附录

APPENDIX_CANARY 名词对照。
`;

const folded = buildDeliveryShelfSlots(md, { locale: "zh", complete: false });
assert(
  "folded ids",
  folded.map((slot) => slot.slotId).join(",") === DEFAULT.join(","),
);
const bodyOf = (id: string) => {
  const slot = folded.find((item) => item.slotId === id);
  return slot?.kind === "ready" ? slot.page.body : "";
};
assert("01 keeps the brief", bodyOf("01").includes("BRIEF_CANARY"));
assert("01 does not take the strategy", !bodyOf("01").includes("STRATEGY_CANARY"));
assert("02 keeps the pattern", bodyOf("02").includes("PATTERN_CANARY"));
assert("04 does not copy the pattern", !bodyOf("04").includes("PATTERN_CANARY"));
assert("05 keeps the strategy", bodyOf("05").includes("STRATEGY_CANARY"));
assert(
  "06 is one face",
  bodyOf("06").includes("EXEC_CANARY") && bodyOf("06").includes("RETUNE_CANARY"),
);
assert(
  "08 is one face",
  bodyOf("08").includes("RISK_CANARY") && bodyOf("08").includes("CLOSE_CANARY"),
);
assert("03 is the appendix", bodyOf("03").includes("APPENDIX_CANARY"));
assert(
  "no v1 paper slot",
  !folded.some((slot) =>
    ["decision_brief", "self_regulation", "execution_guidance", "validation_close", "validation_risk"].includes(
      slot.slotId,
    ),
  ),
);

const missing = buildDeliveryShelfSlots(
  `# 封面\n\n封面\n\n## 目录\n\n1. 本题\n\n## 决策简报\n\n只有这一页。\n`,
  { locale: "zh", complete: false },
);
assert("missing page: 01 ready", missing[2]?.kind === "ready" && missing[2].slotId === "01");
assert("missing page: 02 waiting", missing[3]?.kind === "waiting" && missing[3].slotId === "02");
assert("missing page: no 07", !missing.some((slot) => slot.slotId === "07"));

const retired = buildDeliveryShelfSlots(
  `# 封面\n\n封面\n\n## 决策简报\n\nBRIEF_ONLY\n\n## 30天能量推进\n\nRETIRED_CANARY 不单独成纸。\n`,
  { locale: "zh", complete: false },
);
assert(
  "retired key has no own slot",
  !retired.some((slot) => (slot.slotId as string) === "thirty_day"),
);
assert(
  "retired key does not take a face",
  !retired.some((slot) => slot.kind === "ready" && slot.page.body.includes("RETIRED_CANARY")),
);

function bodyReady(
  slots: ReturnType<typeof buildDeliveryShelfSlots>,
  id: string,
): string {
  const slot = slots.find((item) => item.slotId === id);
  return slot?.kind === "ready" ? slot.page.body : "";
}

assert("segment 06", resolveDeliverySegmentKey("06") === "execution_guidance");
assert("segment 08", resolveDeliverySegmentKey("08") === "validation_risk");
assert("segment 01", resolveDeliverySegmentKey("01") === "decision_brief");
assert("segment 07", resolveDeliverySegmentKey("07") === null);
assert("segment 03", resolveDeliverySegmentKey("03") === null);
assert("preface alias stays", resolveDeliverySegmentKey("preface") === "decision_brief");
assert("page 01 resolves", resolveDecisionPage("01")?.pageId === "01");
assert("调频 still maps to 06", resolveDecisionPage("self_regulation")?.pageId === "06");

assert("06 feed is the principles page", pageFeedFlags("06", "body").science_means === true);
const face06 = shelfFaceFeed("06", "judgment");
assert(
  "06-C keeps qimen",
  face06.some((entry) => entry.key === "self_regulation" && entry.flags.qimen === true),
);
assert("06 face has two internals", face06.length === 2);
assert(
  "dispatch 06",
  shelfFaceDispatchKeys("06").join(",") === "execution_guidance,self_regulation",
);
assert(
  "dispatch 08",
  shelfFaceDispatchKeys("08").join(",") === "validation_risk,validation_close",
);
assert("dispatch 07 empty", shelfFaceDispatchKeys("07").length === 0);
assert("face zod accepts 06", ShelfFace06Schema.safeParse({ page: "06" }).success);
assert("face zod rejects a mismatched page", !ShelfFace06Schema.safeParse({ page: "05" }).success);
assert(
  "pipeline default stays legacy",
  resolveDeliveryPipeline({ ...process.env, DELIVERY_PIPELINE: "" }) === "legacy",
);

const htmlSlots = buildDeliverySlotMap(md, "zh");
assert("html pane still receives the brief", htmlSlots.SLOT_BODY_01?.includes("BRIEF_CANARY") === true);
assert("html pane 06 keeps 06-C", htmlSlots.SLOT_BODY_06?.includes("RETUNE_CANARY") === true);

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("shelf face W4 ok\n");
