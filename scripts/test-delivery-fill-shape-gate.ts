/**
 * Gate 0 / Gate F — fill shape isolation + reality constraints smoke.
 *
 * Run: pnpm exec tsx scripts/test-delivery-fill-shape-gate.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPageSchemaFillPrompt } from "../lib/llm/pro/delivery/page-schema/fill-prompt";
import {
  pageSchemaFillMaxAttempts,
  resolveDeliveryFillShapeMode,
} from "../lib/llm/pro/delivery/page-schema/fill-shape-mode";
import { fillShapeSkeletonForKey } from "../lib/llm/pro/delivery/page-schema/fill-shape-skeleton";
import { DELIVERY_SEGMENT_KEYS } from "../lib/llm/pro/delivery/delivery-schema";
import {
  buildRealityConstraintsBlock,
  extractAgendaMonthHints,
  noteAgendaMonthConflicts,
} from "../lib/llm/pro/delivery/reality-constraints";
import { deliverySlotUiCopy } from "../lib/llm/pro/delivery/delivery-slot-ui-copy";
import { buildFillDuty } from "../lib/llm/pro/delivery/page-prompts/p4-metaphysics-action";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const root = process.cwd();
const fillPromptSrc = readFileSync(
  join(root, "lib/llm/pro/delivery/page-schema/fill-prompt.ts"),
  "utf8",
);
assert(
  !/from\s+["']\.\/mock-fixture["']/.test(fillPromptSrc),
  "fill-prompt.ts must not import ./mock-fixture (use fill-shape-legacy-fewshot)",
);
assert(
  /fill-shape-skeleton/.test(fillPromptSrc),
  "fill-prompt.ts must import fill-shape-skeleton",
);

assert(resolveDeliveryFillShapeMode({} as NodeJS.ProcessEnv) === "mock", "default mode mock");
assert(
  resolveDeliveryFillShapeMode({
    DELIVERY_FILL_SHAPE_MODE: "skeleton",
  } as unknown as NodeJS.ProcessEnv) === "skeleton",
  "skeleton mode",
);
assert(pageSchemaFillMaxAttempts("skeleton") === 3, "skeleton attempts=3");
assert(pageSchemaFillMaxAttempts("mock") === 2, "mock attempts=2");

for (const key of DELIVERY_SEGMENT_KEYS) {
  if (key === "thirty_day") continue;
  const sk = fillShapeSkeletonForKey(key);
  assert(sk, `skeleton missing for ${key}`);
  const blob = JSON.stringify(sk);
  assert(!/two-month|两个月|深蓝|东南/.test(blob), `skeleton narrative leak: ${key}`);
}

const skPrompt = buildPageSchemaFillPrompt("metaphysics_action", {
  locale: "zh",
  core_conclusion: "test",
  shape_mode: "skeleton",
  eastern_calc_slice: "color_anchors: 米白\npreferred_dirs: 北",
  reality_constraints: buildRealityConstraintsBlock(
    [{ label: "积蓄", answer: "6-12个月" }],
    { original_question: "要不要离职" },
  ),
});
assert(skPrompt.shape_mode === "skeleton", "shape_mode skeleton");
assert(!/Few-shot|two-month|两个月现金|深蓝\/墨系/.test(skPrompt.system), "skeleton system clean");
assert(/形状锚/.test(skPrompt.system), "skeleton header");
assert(/本案硬约束/.test(skPrompt.user), "reality on user");
assert(skPrompt.system.length < 80_000, "skeleton system not huge");

const mockPrompt = buildPageSchemaFillPrompt("science_action", {
  locale: "en",
  core_conclusion: "test",
  shape_mode: "mock",
});
assert(/Few-shot|legacy/.test(mockPrompt.system), "mock still has legacy few-shot");

const p4Duty = buildFillDuty("东方调频");
assert(/color_anchors|preferred_dirs/.test(p4Duty), "P4 duty cites calc fields");
assert(!/深蓝\/墨系|东南\/正东/.test(p4Duty), "P4 duty no hard-coded color/dir examples");

const zhCopy = deliverySlotUiCopy("zh");
assert(!zhCopy.angleGloss?.trim(), "zh angleGloss empty");
assert(!zhCopy.dimensionGloss?.trim(), "zh dimensionGloss empty");

const months = extractAgendaMonthHints([{ label: "runway", answer: "6-12个月" }]);
assert(months.includes(6) && months.includes(12), "agenda months");
const conflicts = noteAgendaMonthConflicts("先攒2个月现金缓冲", months);
assert(conflicts.some((n) => n.includes("2")), "conflict note for invented 2 months");

// Prompt size table (Gate A budget smoke)
const keys = ["direct_answer", "foundation", "science_action", "metaphysics_action"] as const;
console.log("\n[fill prompt size · skeleton vs mock]");
for (const key of keys) {
  const a = buildPageSchemaFillPrompt(key, {
    locale: "zh",
    core_conclusion: "x".repeat(200),
    shape_mode: "skeleton",
    reality_constraints: buildRealityConstraintsBlock([
      { label: "积蓄", answer: "6-12个月缓冲" },
      { label: "经历", answer: "大厂组织调优8年" },
    ]),
  });
  const b = buildPageSchemaFillPrompt(key, {
    locale: "zh",
    core_conclusion: "x".repeat(200),
    shape_mode: "mock",
  });
  const sa = a.system.length + a.user.length;
  const sb = b.system.length + b.user.length;
  console.log(
    `  ${key}: skeleton=${sa} mock=${sb} delta=${sa - sb} (~tokens≈${Math.round((sa - sb) / 4)})`,
  );
}

console.log("\nok: test-delivery-fill-shape-gate");
