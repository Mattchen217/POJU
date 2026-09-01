/**
 * Eastern concept SSOT matrix — shensha / dayun / tengod.
 * Run: pnpm exec tsx scripts/test-eastern-concept-ssot-matrix.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CLOSED_SHEN_SHA, CLOSED_TEN_GODS } from "../lib/glossary/term-closed-set";
import {
  assertShenshaSsotComplete,
  formatShenshaSemanticForPrompt,
  SHENSHA_SEMANTIC_SSOT,
  textHitsShenshaHorror,
} from "../lib/glossary/shensha-semantic-ssot";
import {
  DAYUN_PHASE_SSOT,
  formatDayunSemanticForPrompt,
  textHitsDayunProphecy,
} from "../lib/glossary/dayun-semantic-ssot";
import {
  assertTenGodSsotComplete,
  extractTenGodNamesFromText,
  formatTenGodPolicyForPrompt,
  formatTenGodSemanticForPrompt,
  TENGOD_SEMANTIC_SSOT,
  textHitsTenGodJiXiong,
} from "../lib/glossary/tengod-semantic-ssot";
import { findDeliveryProsePollution } from "../lib/llm/pro/delivery/delivery-body-purity";
import { buildChatShenShaGuardBlock } from "../lib/llm/prompts/shen-sha-guard";
import { buildUserFacingExpressionContractBlock } from "../lib/llm/prompts/user-facing-expression-contract";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";

assertShenshaSsotComplete();
assertTenGodSsotComplete();
assert.equal(CLOSED_SHEN_SHA.length, 24);
assert.equal(Object.keys(SHENSHA_SEMANTIC_SSOT).length, 24);
assert.equal(CLOSED_TEN_GODS.length, 10);
assert.equal(Object.keys(TENGOD_SEMANTIC_SSOT).length, 10);
assert.equal(Object.keys(DAYUN_PHASE_SSOT).length, 6);

for (const id of CLOSED_SHEN_SHA) {
  const row = SHENSHA_SEMANTIC_SSOT[id];
  assert.ok(row.frame.length > 4, `${id} frame`);
  assert.ok(row.user_facing_direction.length > 2, `${id} direction`);
  assert.ok(row.forbidden_claims.length >= 1, `${id} forbidden`);
  assert.ok(row.never.length > 2, `${id} never`);
}

for (const id of CLOSED_TEN_GODS) {
  const row = TENGOD_SEMANTIC_SSOT[id];
  assert.ok(row.drive.length > 2, `${id} drive`);
  assert.ok(row.load.length > 2, `${id} load`);
  assert.ok(row.forbidden_ji_xiong.length >= 1, `${id} ji_xiong`);
  assert.ok(row.whitelist_anchors.length >= 2, `${id} whitelist`);
}

assert.equal(textHitsShenshaHorror("你这盘恐有血光之灾"), "血光之灾");
assert.equal(textHitsShenshaHorror("贵人救命万事无忧"), "贵人救命");
assert.equal(textHitsShenshaHorror("保持边界与节奏即可"), null);

assert.equal(textHitsDayunProphecy("明年必发财"), "必发财");
assert.equal(textHitsDayunProphecy("这十年运势极好"), "这十年运势极好");
assert.ok(textHitsDayunProphecy("大运极好你躺赢"));
assert.equal(textHitsDayunProphecy("这一阶段宜少开新战场"), null);

assert.equal(textHitsTenGodJiXiong("伤官见官必败"), "伤官见官");
assert.equal(textHitsTenGodJiXiong("枭神夺食"), "枭神夺食");
assert.equal(textHitsTenGodJiXiong("高压下先设止损"), null);

assert.equal(
  findDeliveryProsePollution("这盘恐有血光之灾")?.label,
  "shensha_horror",
);
assert.equal(
  findDeliveryProsePollution("明年必发财")?.label,
  "dayun_prophecy",
);
assert.equal(
  findDeliveryProsePollution("伤官见官祸百端")?.label,
  "tengod_ji_xiong",
);

const shenPrompt = formatShenshaSemanticForPrompt(["天乙贵人", "飞刃", "羊刃"]);
assert.ok(shenPrompt.includes("天乙贵人"));
assert.ok(shenPrompt.includes("飞刃"));
assert.ok(shenPrompt.includes("安全防火墙"));
assert.ok(!shenPrompt.includes("本周请你"), "no plot few-shot");

const dayunPrompt = formatDayunSemanticForPrompt("印 水 藏");
assert.ok(dayunPrompt.includes("大运/阶段节奏"));
assert.ok(dayunPrompt.includes("收敛蓄力") || dayunPrompt.includes("禁预言"));

const tengodPrompt = formatTenGodSemanticForPrompt(["伤官", "正官"]);
assert.ok(tengodPrompt.includes("伤官"));
assert.ok(tengodPrompt.includes("正官"));
assert.ok(tengodPrompt.includes("动力"));

assert.deepEqual(extractTenGodNamesFromText("月柱伤官见正官"), ["伤官", "正官"]);
assert.ok(formatTenGodPolicyForPrompt().includes("共享禁"));

const structured = {
  pillars_detail: {
    year: { shen_sha: ["天乙贵人"] },
    month: { shen_sha: [] },
    day: { shen_sha: ["文昌"] },
    hour: { shen_sha: [] },
  },
} as unknown as ProfileStructured;
const guard = buildChatShenShaGuardBlock(structured);
assert.ok(guard.includes("天乙贵人"));
assert.ok(guard.includes("文昌"));
assert.ok(guard.includes("神煞语义 SSOT") || guard.includes("frame") || guard.includes("方向"));

const deliveryContract = buildUserFacingExpressionContractBlock({
  locale: "zh",
  preset: "delivery",
  tenGodNames: ["七杀"],
});
assert.ok(deliveryContract.includes("大运/阶段节奏"));
assert.ok(deliveryContract.includes("十神语义 SSOT"));
assert.ok(deliveryContract.includes("七杀"));

const openingContract = buildUserFacingExpressionContractBlock({
  locale: "zh",
  preset: "opening",
});
assert.ok(!openingContract.includes("大运/阶段节奏 SSOT"));
assert.ok(!openingContract.includes("十神语义 SSOT · 政策"));

const identity = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/prompts/poju-base.ts"),
  "utf8",
);
assert.ok(!identity.includes("shensha-semantic-ssot"));
assert.ok(!identity.includes("tengod-semantic-ssot"));
assert.ok(!identity.includes("dayun-semantic-ssot"));

const guardSrc = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/prompts/shen-sha-guard.ts"),
  "utf8",
);
assert.ok(guardSrc.includes("formatShenshaSemanticForPrompt"));

const spineSrc = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/pro/delivery/format-spine-for-finalize.ts"),
  "utf8",
);
assert.ok(spineSrc.includes("formatDayunSemanticForPrompt"));
assert.ok(spineSrc.includes("formatTenGodSemanticForPrompt"));

const puritySrc = fs.readFileSync(
  path.join(process.cwd(), "lib/llm/pro/delivery/delivery-body-purity.ts"),
  "utf8",
);
assert.ok(puritySrc.includes("textHitsShenshaHorror"));
assert.ok(puritySrc.includes("textHitsDayunProphecy"));
assert.ok(puritySrc.includes("textHitsTenGodJiXiong"));

console.log("test-eastern-concept-ssot-matrix: ok");
