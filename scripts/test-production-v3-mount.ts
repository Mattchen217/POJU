/**
 * Production v3 mount. Unset env is v3. Legacy is explicit only.
 * A book without page schemas fails closed (no legacy fill).
 */
import assert from "node:assert/strict";

import {
  activeDeliveryJobMaxWallMs,
  DELIVERY_JOB_MAX_WALL_MS,
  PRODUCTION_V3_JOB_MAX_WALL_MS,
  PRODUCTION_V3_POLL_MAX_MS,
  PRODUCTION_V3_TAIL_GRACE_MS,
} from "../lib/llm/pro/delivery/delivery-retry-policy";
import {
  isProductionV3ClosedFailure,
  productionDeliveryUsesV3,
  resolveDeliveryPipeline,
} from "../lib/llm/pro/delivery/pipeline-v3/flag";
import { LAB_STEP_DEFS_V3 } from "../lib/llm/pro/delivery/lab/types-v3";
import { saveDeliveryLab } from "../lib/llm/pro/delivery/lab/store";
import {
  deliveryWallFuseDecision,
  productionV3LabId,
  resolveDeliveryWallFuse,
  v3CursorAwaitingShelfAssemble,
} from "../lib/llm/pro/delivery/pipeline-v3/wall-tail";
import {
  isProductionV3Task,
  isV3DispatchContinue,
  planProductionV3Book,
  productionPolishLocale,
  productionV3ContentKeys,
  PRODUCTION_V3_TASK_ID,
} from "../lib/llm/pro/delivery/pipeline-v3/production-run";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";
import { pageSchemaToArgumentBodies } from "../lib/llm/pro/delivery/page-schema/render";
import type { DeliveryPageData } from "../lib/llm/pro/delivery/page-schema/types";
import {
  FACE_DELIVERY_PAGE_KEYS,
  V1_DELIVERY_SEGMENT_KEYS,
  type V1DeliverySegmentKey,
} from "../lib/llm/pro/delivery/segment-key-alias";

const emptyEnv = {} as NodeJS.ProcessEnv;

assert.equal(productionDeliveryUsesV3(emptyEnv), true, "unset production path is v3");
assert.equal(
  productionDeliveryUsesV3({ DELIVERY_PIPELINE: "" } as unknown as NodeJS.ProcessEnv),
  true,
);
assert.equal(
  productionDeliveryUsesV3({ DELIVERY_PIPELINE: "v3_three_step" } as unknown as NodeJS.ProcessEnv),
  true,
);
assert.equal(
  productionDeliveryUsesV3({ DELIVERY_PIPELINE: "legacy" } as unknown as NodeJS.ProcessEnv),
  false,
  "explicit legacy is the only rollback",
);
assert.equal(resolveDeliveryPipeline(emptyEnv), "legacy", "Lab create flag stays legacy when unset");
assert.equal(isProductionV3ClosedFailure("v3_step_failed"), true);
assert.equal(isProductionV3ClosedFailure("interrupted"), false);
assert.equal(activeDeliveryJobMaxWallMs(emptyEnv), PRODUCTION_V3_JOB_MAX_WALL_MS);
assert.equal(
  activeDeliveryJobMaxWallMs({ DELIVERY_PIPELINE: "legacy" } as unknown as NodeJS.ProcessEnv),
  DELIVERY_JOB_MAX_WALL_MS,
);
assert.ok(PRODUCTION_V3_JOB_MAX_WALL_MS > DELIVERY_JOB_MAX_WALL_MS);

assert.equal(isProductionV3Task(PRODUCTION_V3_TASK_ID), true);
assert.equal(isProductionV3Task("p.01.assign"), false);
assert.equal(isV3DispatchContinue("soft_dispatch_continue"), true);
assert.equal(isV3DispatchContinue("polish_acceptance_continue"), true);
assert.equal(isV3DispatchContinue("body_acceptance_continue"), true);
assert.equal(isV3DispatchContinue("gate_polish_thin_synonym"), false);
assert.equal(isV3DispatchContinue("gate_p1_body_invented_number"), false);
assert.equal(isV3DispatchContinue("gate_body"), false);
assert.equal(productionPolishLocale("zh-CN"), "zh");
assert.equal(productionPolishLocale("en"), "en");
assert.equal(productionPolishLocale("fr"), "fr");
assert.equal(productionPolishLocale("es"), "es");

{
  const keys = [...productionV3ContentKeys()];
  for (const k of FACE_DELIVERY_PAGE_KEYS) {
    assert.ok(keys.includes(k), `v3 content keys include face ${k}`);
  }
  assert.ok(keys.includes("07"), "v3 content keys include topic-gated 07");
  assert.equal(
    keys.length,
    new Set(keys).size,
    "v3 content keys unique",
  );
}

const lab = {
  steps: { "book.assemble": { status: "approved", attempts: [] } },
  artifacts: { by_page: {} },
} as unknown as DeliveryLabSession;

const missing = planProductionV3Book(lab);
assert.equal(missing.ok, false);
if (!missing.ok) {
  assert.match(missing.reason, /^v3_missing_page_schema:/);
}

const notAssembled = planProductionV3Book({
  steps: {},
  artifacts: { by_page: {} },
} as unknown as DeliveryLabSession);
assert.equal(notAssembled.ok, false);
if (!notAssembled.ok) assert.equal(notAssembled.reason, "v3_assemble_not_approved");

/**
 * Job fd_90a4af96… failed at book persist, not mid-triad.
 * `v3_empty_page` fires only after book.assemble is approved, and only when
 * pageSchemaToArgumentBodies returns []. patterns/bottleneck/options/strategy
 * had schemas (the triad writes them) but no converter case, so the first
 * unhandled key in V1 order — personal_decision_patterns — hard-stopped
 * before any segment checkpoint. A real empty why_cards list still stops.
 */
const patternCard = {
  page: "personal_decision_patterns",
  why_cards: [
    {
      title: "先收再问",
      surface: "窗口一窄就先把话说死",
      essence: "判断先于核对，所以补充信息来不及进这一轮",
      chart_anchors: ["食神"],
    },
  ],
} as unknown as DeliveryPageData;

const patternBodies = pageSchemaToArgumentBodies(patternCard);
assert.equal(patternBodies.length, 1);
assert.match(patternBodies[0]!.body, /先收再问/);
assert.match(patternBodies[0]!.body, /窗口一窄就先把话说死/);
assert.deepEqual(patternBodies[0]!.chart_anchors, ["食神"]);

assert.equal(
  pageSchemaToArgumentBodies({
    page: "personal_decision_patterns",
    why_cards: [],
  } as unknown as DeliveryPageData).length,
  0,
  "a patterns schema with no cards stays empty",
);

assert.equal(
  pageSchemaToArgumentBodies({
    page: "bottleneck_analysis",
    why_cards: [{ title: "卡", surface: "表", essence: "质", chart_anchors: [] }],
  } as unknown as DeliveryPageData).length,
  1,
);
assert.equal(
  pageSchemaToArgumentBodies({
    page: "strategic_options",
    options: [
      {
        name: "维持",
        summary: "先不改结构",
        upside: "少动",
        cost: "窗口继续收",
        risk: "被动",
        reversibility: "随时可改",
        chart_anchors: [],
      },
      {
        name: "改口",
        summary: "把条件写清再谈",
        upside: "可核对",
        cost: "慢一轮",
        risk: "对方不接",
        reversibility: "可退回维持",
        chart_anchors: [],
      },
    ],
  } as unknown as DeliveryPageData).length,
  2,
);
assert.equal(
  pageSchemaToArgumentBodies({
    page: "recommended_strategy",
    core_judgment: "主路先写清条件",
    primary: { name: "主", why: "条件在手", when: "本周", exit: "对方拒书面", chart_anchors: [] },
    backup: { name: "辅", why: "主路失效", when: "被拒后", exit: "不再加码", chart_anchors: [] },
  } as unknown as DeliveryPageData).length,
  3,
);

function markedTree(key: string) {
  return { [key]: [{ body: `${key} 依据` }] };
}

function bookLab(
  pages: Partial<Record<string, DeliveryPageData>>,
): DeliveryLabSession {
  const by_page: DeliveryLabSession["artifacts"]["by_page"] = {};
  for (const key of Object.keys(pages)) {
    const schema = pages[key];
    if (!schema) continue;
    const skipMarked = key === "decision_brief" || key === "01" || key === "03";
    by_page[key as keyof typeof by_page] = {
      page_schema: schema,
      marked: skipMarked ? undefined : markedTree(key),
    };
  }
  return {
    steps: { "book.assemble": { status: "approved", attempts: [] } },
    artifacts: { by_page },
  } as unknown as DeliveryLabSession;
}

/** Face-native book fixtures (planProductionV3Book reads FACE_DELIVERY_PAGE_KEYS). */
function faceChrome(face: string, title: string) {
  return {
    page: face,
    face,
    page_title: title,
    page_subtitle: "",
  };
}
const face01 = {
  ...faceChrome("01", "本题断语"),
  main_recommendation: "先写清条件再加码",
  conditions: "对方书面回应",
  not_choosing: "不跳步全投",
  evidence_pointer: "详见 02",
} as unknown as DeliveryPageData;
const face02 = {
  ...faceChrome("02", "为何如此"),
  destiny_reason: "用神承压窗口收窄",
  science_mechanism: "决策负荷偏高",
  convergence: "先收再问",
  verifiable_anchors: ["用神木", "府相朝垣", "cognitive_load"],
} as unknown as DeliveryPageData;
const face04 = {
  ...faceChrome("04", "真正卡点"),
  bottleneck_name: "条件未写清",
  manifestation: "口头加码",
  if_force_through: "承压抬升",
  evidence_fold: "岁运冲突",
} as unknown as DeliveryPageData;
const face05 = {
  ...faceChrome("05", "路径排序"),
  first_choice: "书面条件",
  second_choice: "暂守",
  caution_choice: "跳步",
  switch_or_stop: "被拒即停",
} as unknown as DeliveryPageData;
const face06 = {
  ...faceChrome("06", "怎么落地"),
  near_step_principle: "今晚写半页",
  stage_climate: "窗口仍在",
  self_retune: "慢半拍",
  rhythm_note: "先核对",
} as unknown as DeliveryPageData;
const face08 = {
  ...faceChrome("08", "自检清单"),
  red_lights: ["条件空转"],
  review_questions: ["书面了吗"],
  when_to_rerun: "窗口变了再跑",
} as unknown as DeliveryPageData;
const face03 = {
  ...faceChrome("03", "盘面附录"),
  bazi_slice: "日主庚金 · 用神木",
  ziwei_slice: "府相朝垣",
  contrast: "八字紫微同向",
} as unknown as DeliveryPageData;

const partialFaceBook = planProductionV3Book(
  bookLab({
    "01": face01,
    "02": face02,
  } as Partial<Record<string, DeliveryPageData>>),
);
assert.equal(partialFaceBook.ok, false);
if (!partialFaceBook.ok) {
  assert.match(
    partialFaceBook.reason,
    /^v3_missing_page_schema:/,
    "partial face book fails closed on first missing face",
  );
}

const emptyFace02 = planProductionV3Book(
  bookLab({
    "01": face01,
    "02": {
      ...faceChrome("02", "为何如此"),
      destiny_reason: "",
      science_mechanism: "",
      convergence: "",
      verifiable_anchors: [],
    } as unknown as DeliveryPageData,
    "04": face04,
    "05": face05,
    "06": face06,
    "08": face08,
    "03": face03,
  } as Partial<Record<string, DeliveryPageData>>),
);
assert.equal(emptyFace02.ok, false);
if (!emptyFace02.ok) {
  assert.match(
    emptyFace02.reason,
    /^v3_empty_page:02$/,
    "empty face 02 bodies hard-stop",
  );
}

const fullFaceBook = planProductionV3Book(
  bookLab({
    "01": face01,
    "02": face02,
    "04": face04,
    "05": face05,
    "06": face06,
    "08": face08,
    "03": face03,
  } as Partial<Record<string, DeliveryPageData>>),
);
assert.equal(fullFaceBook.ok, true, fullFaceBook.ok ? "" : fullFaceBook.reason);
if (fullFaceBook.ok) {
  assert.match(fullFaceBook.narrative["02"]?.[0]?.body ?? "", /用神承压|命理/);
  assert.ok((fullFaceBook.marked["02"] ?? []).length > 0);
  assert.match(fullFaceBook.narrative["02"]?.[2]?.body ?? "", /先收再问/);
}

/**
 * Job fd_90a4af96…_fy33bq died in book persist:
 * v3_page_unreadable:execution_guidance:Cannot read properties of undefined (reading 'length').
 * Polish stores the model angle and only stamps chart_anchors, so hard_metrics
 * (zod default []) is often absent. Missing lists convert; a page with no angles
 * and no opening stays an empty-page hard stop.
 */
const guidanceMissingMetrics = pageSchemaToArgumentBodies({
  page: "execution_guidance",
  opening: "先把条件写下来",
  primary_toolkit: {
    title: "主轨",
    angles: [{ name: "书面条件", strategy: "先写清再谈", means: ["今晚半页"] }],
  },
  backup_toolkit: {
    title: "辅轨",
    angles: [{ name: "停手", strategy: "被拒即停" }],
  },
} as unknown as DeliveryPageData);
assert.equal(guidanceMissingMetrics.length, 3);
assert.match(guidanceMissingMetrics[1]!.body, /书面条件/);
assert.match(guidanceMissingMetrics[1]!.body, /今晚半页/);
assert.match(guidanceMissingMetrics[2]!.body, /被拒即停/);
assert.equal(guidanceMissingMetrics[2]!.body.includes("**行动:**"), false);

assert.equal(
  pageSchemaToArgumentBodies({
    page: "execution_guidance",
    primary_toolkit: { title: "主轨" },
    backup_toolkit: {},
  } as unknown as DeliveryPageData).length,
  0,
  "execution_guidance with no angles stays empty",
);

const regulationMissingMeans = pageSchemaToArgumentBodies({
  page: "self_regulation",
  dimensions: [{ name: "收势", strategy: "窗口未开先停" }],
} as unknown as DeliveryPageData);
assert.equal(regulationMissingMeans.length, 1);
assert.match(regulationMissingMeans[0]!.body, /窗口未开先停/);
assert.equal(
  pageSchemaToArgumentBodies({ page: "self_regulation" } as unknown as DeliveryPageData).length,
  0,
  "self_regulation with no dimensions stays empty",
);

const riskPartial = pageSchemaToArgumentBodies({
  page: "validation_risk",
  switch_to_backup: { narrative: "主路被拒就切辅", chart_anchors: [] },
} as unknown as DeliveryPageData);
assert.equal(riskPartial.length, 1);
assert.match(riskPartial[0]!.body, /主路被拒就切辅/);
assert.equal(
  pageSchemaToArgumentBodies({ page: "validation_risk" } as unknown as DeliveryPageData).length,
  0,
);

const closePartial = pageSchemaToArgumentBodies({
  page: "validation_close",
  identity_before: "先开口",
  identity_after: "先写条件",
  identity_shift: "把核对放在承诺前",
  quote: "条件没写清就不加码",
  quote_use: "定心",
  immediate_action: "今晚写半页",
  tonight_done_looks_like: "半页条件",
  tonight_why: "窗口还在",
} as unknown as DeliveryPageData);
assert.ok(closePartial.length >= 3);
assert.match(closePartial.map((a) => a.body).join("\n"), /今晚写半页/);
assert.equal(
  pageSchemaToArgumentBodies({ page: "validation_close" } as unknown as DeliveryPageData).length,
  0,
  "validation_close shell stays empty",
);

const missing08 = planProductionV3Book(
  bookLab({
    "01": face01,
    "02": face02,
    "04": face04,
    "05": face05,
    "06": face06,
    "03": face03,
  } as Partial<Record<string, DeliveryPageData>>),
);
assert.equal(missing08.ok, false);
if (!missing08.ok) {
  assert.equal(
    missing08.reason,
    "v3_missing_page_schema:08",
    "missing face must not throw v3_page_unreadable",
  );
}

const asmIdx = LAB_STEP_DEFS_V3.findIndex((d) => d.step_key === "book.assemble");
const prevKey = LAB_STEP_DEFS_V3[asmIdx - 1]!.step_key;
assert.equal(prevKey, "03.body_polish");
assert.ok(LAB_STEP_DEFS_V3.some((d) => d.step_key === "book.judgment"));
assert.equal(
  v3CursorAwaitingShelfAssemble({ cursor_index: asmIdx, steps: {}, pipeline: "v3_three_step" }),
  true,
);
assert.equal(
  v3CursorAwaitingShelfAssemble({
    cursor_index: asmIdx - 1,
    pipeline: "v3_three_step",
    steps: { [prevKey]: { status: "approved" } },
  }),
  true,
);
assert.equal(
  v3CursorAwaitingShelfAssemble({
    cursor_index: 4,
    pipeline: "v3_three_step",
    steps: { "02.content.body": { status: "approved" } },
  }),
  false,
);
assert.equal(
  v3CursorAwaitingShelfAssemble({
    cursor_index: asmIdx,
    pipeline: "legacy",
    steps: {},
  }),
  false,
);

const wall = PRODUCTION_V3_JOB_MAX_WALL_MS;
assert.equal(
  deliveryWallFuseDecision({ created_at: 0, now_ms: wall + 1, shelfTailReady: false }).tripped,
  true,
  "mid-book still dies at 120m",
);
assert.equal(
  deliveryWallFuseDecision({ created_at: 0, now_ms: wall + 1, shelfTailReady: true }).tripped,
  false,
  "assemble tail is inside the grace",
);
assert.equal(
  deliveryWallFuseDecision({
    created_at: 0,
    now_ms: wall + PRODUCTION_V3_TAIL_GRACE_MS + 1,
    shelfTailReady: true,
  }).tripped,
  true,
  "grace is finite",
);
assert.equal(
  deliveryWallFuseDecision({
    created_at: 0,
    now_ms: wall + 1,
    shelfTailReady: true,
    env: { DELIVERY_PIPELINE: "legacy" } as unknown as NodeJS.ProcessEnv,
  }).tripped,
  true,
  "legacy wall does not gain the v3 tail",
);
assert.equal(PRODUCTION_V3_POLL_MAX_MS, wall + PRODUCTION_V3_TAIL_GRACE_MS);

async function assertTailGraceLoadsLab(): Promise<void> {
  const tailJob = "fd_tail_grace";
  const created = 1_000;
  await saveDeliveryLab({
    version: 1,
    lab_id: productionV3LabId(tailJob),
    pipeline: "v3_three_step",
    cursor_index: asmIdx,
    steps: { "book.assemble": { status: "idle" } },
  } as unknown as import("../lib/llm/pro/delivery/lab/types").DeliveryLabSession);
  const inside = await resolveDeliveryWallFuse({
    job_id: tailJob,
    created_at: created,
    stage: "segments",
    now_ms: created + wall + 60_000,
  });
  assert.equal(inside.tripped, false);
  assert.equal(inside.limit_ms, wall + PRODUCTION_V3_TAIL_GRACE_MS);
  const midBook = await resolveDeliveryWallFuse({
    job_id: "fd_no_lab",
    created_at: created,
    stage: "segments",
    now_ms: created + wall + 60_000,
  });
  assert.equal(midBook.tripped, true);
  assert.equal(midBook.limit_ms, wall);
}

void assertTailGraceLoadsLab().then(
  () => {
    console.log("production v3 mount ok");
  },
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
