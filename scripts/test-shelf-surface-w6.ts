/**
 * W6. Face ids are canonical. 07 is a slice compose. alsoFeeds land.
 * Baseline lens lines are structural. Pipeline default stays legacy.
 *
 *   pnpm test:shelf-surface-w6
 */
import { getBlueprintPage, CANONICAL_FACE_BLUEPRINT } from "../lib/poju/report-blueprint";
import { resolveCanonicalDeliveryPage } from "../lib/llm/pro/delivery/decision-page-bridge";
import { resolveDeliverySegmentKey } from "../lib/llm/pro/delivery/delivery-schema";
import {
  equateDispatchTaskId,
  pageAssignId,
  pageFillId,
  pageFinalizeId,
  pageReadyId,
} from "../lib/llm/pro/delivery/dispatch/task-dag";
import { resolveDeliveryPipeline } from "../lib/llm/pro/delivery/pipeline-v3/flag";
import { composePage07Markdown, PAGE07_WRITE_ENTRY } from "../lib/llm/pro/delivery/page-07-face";
import type { PageFeedPacks } from "../lib/llm/pro/delivery/slice-for-page";
import { buildDeliveryShelfSlots } from "../lib/poju/delivery-shelf-slots";
import { baselineZiweiLensLines } from "../lib/ziwei/baseline-lens";
import type { ZiweiFactPack } from "../lib/ziwei/fact-pack";

const failures: string[] = [];
function assert(label: string, ok: boolean) {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

assert("assign 01", pageAssignId("decision_brief") === "p.01.assign");
assert("fill 01 alias", equateDispatchTaskId("p.decision_brief.fill") === pageFillId("decision_brief"));
assert("assign 02 primary", pageAssignId("situation_analysis") === "p.02.assign");
assert(
  "assign 02 folded",
  pageAssignId("personal_decision_patterns") === "p.02.personal_decision_patterns.assign",
);
assert("assign 06", pageAssignId("execution_guidance") === "p.06.assign");
assert(
  "assign 06-C",
  pageAssignId("self_regulation") === "p.06.self_regulation.assign",
);
assert("finalize 08 close", pageFinalizeId("validation_close") === "finalize.08.validation_close");
assert("ready 08", pageReadyId("validation_risk") === "p.08.ready");
assert("face id stays", equateDispatchTaskId("p.01.fill") === "p.01.fill");
assert("canonical 06", resolveCanonicalDeliveryPage("execution_guidance") === "06");
assert("canonical face passes through", resolveCanonicalDeliveryPage("08") === "08");
assert("paper alias 06", resolveDeliverySegmentKey("06") === "execution_guidance");
assert("paper alias 07", resolveDeliverySegmentKey("07") === null);

const faces = CANONICAL_FACE_BLUEPRINT.map((row) => row.faceId).join(",");
assert("blueprint face order", faces === "01,02,04,05,06,07,08,03");
assert("blueprint 06 is the principles paper", getBlueprintPage("06")?.id === "execution_guidance");
assert(
  "blueprint 06 holds both papers",
  CANONICAL_FACE_BLUEPRINT.find((row) => row.faceId === "06")
    ?.modules.map((page) => page.id)
    .join(",") === "execution_guidance,self_regulation",
);
assert(
  "blueprint 04 alsoFeeds patterns",
  CANONICAL_FACE_BLUEPRINT.find((row) => row.faceId === "04")
    ?.alsoFeeds.map((page) => page.id)
    .join(",") === "personal_decision_patterns",
);
assert(
  "blueprint 01 alsoFeeds strategy",
  CANONICAL_FACE_BLUEPRINT.find((row) => row.faceId === "01")
    ?.alsoFeeds.map((page) => page.id)
    .join(",") === "recommended_strategy",
);
assert(
  "blueprint 07 has no module",
  CANONICAL_FACE_BLUEPRINT.find((row) => row.faceId === "07")?.modules.length === 0,
);

const md = `# 封面

封面

## 决策简报

BRIEF_CANARY

## 决策模式

PATTERN_CANARY

## 主策略

STRATEGY_CANARY
`;
const shelf = buildDeliveryShelfSlots(md, { locale: "zh", complete: true });
const body = (id: string) => {
  const slot = shelf.find((item) => item.slotId === id);
  return slot?.kind === "ready" ? slot.page.body : "";
};
assert("alsoFeeds 01", body("01").includes("BRIEF_CANARY") && body("01").includes("STRATEGY_CANARY"));
assert("alsoFeeds 04", body("04").includes("PATTERN_CANARY"));
assert("pattern stays on 02", body("02").includes("PATTERN_CANARY"));

assert("07 entry", PAGE07_WRITE_ENTRY === "slice:07");
assert("07 omits without a topic", composePage07Markdown({ topic: "general", question: "今天如何" }) === null);
const plain = composePage07Markdown({ topic: "relationship", question: "要不要一起做" });
assert("07 writes A–C", Boolean(plain?.includes("### 场域判断") && plain.includes("### 关系/互动") && plain.includes("### 依据折叠")));
assert("07 skips D", Boolean(plain && !plain.includes("### 与 01/05 对齐")));
assert("07 keeps the question", Boolean(plain?.includes("要不要一起做")));

const composed = composePage07Markdown({
  topic: "合伙",
  question: "要不要合伙",
  packs: {
    zfp: {
      topicPalace: {
        palace: "仆役",
        heavenlyStem: "甲",
        earthlyBranch: "子",
        majorStars: ["天府"],
        oppositePalace: "官禄",
        oppositeMajorStars: ["廉贞"],
      },
      daxian: {
        palace: "夫妻",
        heavenlyStem: "乙",
        earthlyBranch: "丑",
        startAge: 23,
        endAge: 32,
        majorStars: ["七杀"],
        sihua: [],
      },
      otherChart: "对方盘结构已在",
    },
    cfp: { pathTags: "合伙" },
  } as unknown as PageFeedPacks,
});
assert("07 slice palace", Boolean(composed?.includes("仆役") && composed.includes("天府")));
assert("07 slice limit", Boolean(composed?.includes("七杀")));
assert("07 feeds an existing other chart", Boolean(composed?.includes("对方盘结构已在")));
assert("07 does not name the otherChart key", Boolean(composed && !composed.includes("otherChart")));
assert("07 section B holds the other chart", Boolean(composed?.split("### 关系/互动")[1]?.includes("对方盘结构已在")));

const lens = baselineZiweiLensLines({
  topicPalace: {
    role: "ming",
    palace: "命宫",
    heavenlyStem: "丙",
    earthlyBranch: "午",
    majorStars: ["紫微"],
    oppositePalace: "迁移",
    oppositeMajorStars: ["贪狼"],
  },
  mingShen: {
    soul: "破军",
    body: "文昌",
    mingBranch: "午",
    shenBranch: "寅",
    shenPalace: "官禄",
    fiveElementsClass: "木三局",
  },
  daxian: {
    palace: "夫妻",
    heavenlyStem: "丁",
    earthlyBranch: "卯",
    startAge: 23,
    endAge: 32,
    majorStars: ["七杀"],
    sihua: [],
    liunian: {
      year: 2026,
      heavenlyStem: "丙",
      earthlyBranch: "午",
      palace: "夫妻",
      sihua: [],
    },
  },
  sihua: [{ mutagen: "禄", star: "廉贞", palace: "官禄" }],
} as Pick<ZiweiFactPack, "topicPalace" | "mingShen" | "daxian" | "sihua">);
const lensText = lens.map((line) => `${line.label} ${line.value}`).join("\n");
// Phase 2: soft labels only — traditional stars/palaces must not leak.
assert("lens uses soft identity field", lensText.includes("核心定位域"));
assert("lens uses soft opposite field", lensText.includes("对照定位域"));
assert("lens blocks traditional major stars", !lensText.includes("紫微") && !lensText.includes("贪狼"));
assert("lens has the age band", lensText.includes("23–32") && lensText.includes("长周期段"));
assert("lens blocks traditional decadal star", !lensText.includes("七杀"));
assert("lens uses soft sihua mutagen", lensText.includes("四向转化") || lensText.includes("资源转化"));
assert("lens blocks traditional sihua star", !lensText.includes("廉贞") && !lensText.includes("官禄"));
assert("lens stays structural", !lensText.includes("必散") && !lensText.includes("倪"));

assert(
  "pipeline default stays legacy",
  resolveDeliveryPipeline({ ...process.env, DELIVERY_PIPELINE: "" }) === "legacy",
);

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("shelf surface W6 ok\n");
