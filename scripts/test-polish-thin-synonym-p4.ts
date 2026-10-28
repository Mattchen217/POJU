/**
 * P4 polish thickness is keep-if-ready. P3 still demands relative growth.
 * Production may schedule one acceptance continue; Lab must not.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { polishThicknessMayRetryOnce } from "../lib/llm/pro/delivery/pipeline-v3/acceptance-retry";
import { gateBodyPolishThickness } from "../lib/llm/pro/delivery/pipeline-v3/body-polish";
import type { DeliveryPageData } from "../lib/llm/pro/delivery/page-schema/types";

const READY_STRATEGY =
  "这扇窗口还没有熟，先不要跟着对方放出的虚高往前冲。先把你自己的底线收住，再看对方下一步是不是真的落到行动上。";
const READY_MEANS =
  "站在房间里侧，把今晚的重大决定先放下，因为气还太燥，此刻拍板容易被推着走。";
const EN_STRATEGY =
  "Hold your line until the other side shows a real move, and do not chase an offer that is still only talk.";
const EN_MEANS =
  "Stand to the side and hold the big decision, because the moment is still too hot to settle it.";

function p4(strategy: string, means: string): DeliveryPageData {
  return {
    page: "self_regulation",
    dimensions: [{ name: "局势", strategy, means: [means] }],
  } as unknown as DeliveryPageData;
}

function p3(strategy: string, means: string): DeliveryPageData {
  return {
    page: "execution_guidance",
    primary_toolkit: {
      title: "主",
      angles: [{ name: "主", strategy, means: [means] }],
    },
    backup_toolkit: { title: "辅", angles: [] },
  } as unknown as DeliveryPageData;
}

const ready = p4(READY_STRATEGY, READY_MEANS);

const sameLength = gateBodyPolishThickness({
  key: "self_regulation",
  draft: ready,
  polished: p4(READY_STRATEGY, READY_MEANS),
});
assert.equal(sameLength, null, "complete P4 polish that keeps mass passes");

const english = gateBodyPolishThickness({
  key: "self_regulation",
  draft: ready,
  polished: p4(EN_STRATEGY, EN_MEANS),
});
assert.equal(
  english,
  null,
  "one full English sentence of an already-complete P4 draft passes",
);

const collapsed = gateBodyPolishThickness({
  key: "self_regulation",
  draft: ready,
  polished: p4("先旁观。再看一步。", "先停。"),
});
assert.equal(collapsed?.passed, false);
assert.equal(collapsed?.failed_rule, "gate_polish_thin_synonym");
assert.ok(collapsed?.notes?.some((n) => n.startsWith("strategy[")));

const telegram = gateBodyPolishThickness({
  key: "self_regulation",
  draft: p4("先旁观。", "旁观。"),
  polished: p4("先看着。", "看着。"),
});
assert.equal(telegram?.failed_rule, "gate_polish_thin_synonym");
assert.ok(
  telegram?.notes?.includes("strategy[0]"),
  "telegram synonym swap still fails",
);

const p3Same = gateBodyPolishThickness({
  key: "execution_guidance",
  draft: p3(READY_STRATEGY, READY_MEANS),
  polished: p3(READY_STRATEGY, READY_MEANS),
});
assert.equal(p3Same?.failed_rule, "gate_polish_thin_synonym");
assert.ok(p3Same?.notes?.includes("strategy[0]"), "P3 still rejects ungrown polish");

assert.equal(
  polishThicknessMayRetryOnce({
    ops_user: "production",
    acceptance_armed: false,
    failed_rule: "gate_polish_thin_synonym",
  }),
  true,
);
assert.equal(
  polishThicknessMayRetryOnce({
    ops_user: "production",
    acceptance_armed: true,
    failed_rule: "gate_polish_thin_synonym",
  }),
  false,
);
assert.equal(
  polishThicknessMayRetryOnce({
    ops_user: "ops",
    acceptance_armed: false,
    failed_rule: "gate_polish_thin_synonym",
  }),
  false,
);
assert.equal(
  polishThicknessMayRetryOnce({
    ops_user: "production",
    acceptance_armed: false,
    failed_rule: "gate_p4_body_visible_jargon",
  }),
  false,
);

const step = readFileSync(
  new URL("../lib/llm/pro/delivery/lab/run-step-v3.ts", import.meta.url),
  "utf8",
);
assert.match(step, /polishThicknessMayRetryOnce/);
assert.match(step, /POLISH_ACCEPTANCE_CONTINUE_RULE/);

console.log("test-polish-thin-synonym-p4: ok");
