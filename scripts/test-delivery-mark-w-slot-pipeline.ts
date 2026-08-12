/**
 * Smoke: connective keeps ⟦w:⟧ → encode to ⟦t:⟧; slot gate rejects pure vernacular.
 */
import assert from "node:assert/strict";
import {
  countEvidenceWordSlots,
  encodeConnectiveEvidenceToTerms,
} from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { validateConnectiveWordSlots } from "@/lib/llm/pro/delivery/mark-evidence-call";

const input =
  "乙木日主⟦w:身弱⟧，忌神火土泄耗，命局需⟦w:正印⟧通关滋养，⟦w:天德贵人⟧利于换环境。";

assert.equal(countEvidenceWordSlots(input), 3, "input has 3 word slots");

{
  const ok = validateConnectiveWordSlots(input, input);
  assert.equal(ok.ok, true, "preserving slots passes");
}

{
  const dropped = validateConnectiveWordSlots(
    input,
    "你天生敏感需要滋养，当前环境在抽干你，所以必须换环境。",
  );
  assert.equal(dropped.ok, false, "pure vernacular fails");
  if (!dropped.ok) assert.match(dropped.reason, /mark_slots_lt2|mark_slots/);
}

{
  const thin = validateConnectiveWordSlots(input, "只有⟦w:身弱⟧一条。");
  assert.equal(thin.ok, false, "1 slot when input had 3 fails");
}

{
  const good =
    "你这种⟦w:身弱⟧需要补给的体质，最缺的是⟦w:正印⟧那种稳定滋养；同时⟦w:天德贵人⟧帮你更容易融入新环境。";
  const gate = validateConnectiveWordSlots(input, good);
  assert.equal(gate.ok, true, "3 slots with connective passes");
  const encoded = encodeConnectiveEvidenceToTerms(good, "zh");
  assert.match(encoded, /⟦t:/, "post-connective encodes to t:");
  assert.equal(countEvidenceWordSlots(encoded), 0, "w: slots consumed after encode");
  assert.match(encoded, /⟦t:weak_self|/, "身弱 → weak_self");
  assert.match(encoded, /⟦t:zheng_yin|/, "正印 → zheng_yin");
  // Connective vernacular must survive (not shredded into only markers)
  assert.match(encoded, /需要补给|稳定滋养|融入/, "connective prose kept");
}

{
  const withChengyu =
    "你这种⟦w:身弱⟧需要补给，但当前⟦w:正印⟧受压，形成官印相生却仍透支。";
  const gate = validateConnectiveWordSlots("⟦w:身弱⟧与⟦w:正印⟧", withChengyu);
  assert.equal(gate.ok, false, "命理四字格 in connective fails");
  if (!gate.ok) assert.match(gate.reason, /mark_mingli_chengyu:官印相生/);
}

{
  const plainOk =
    "你这种⟦w:身弱⟧需要补给的体质，最缺的是⟦w:正印⟧那种稳定滋养；规则与责任和补给连在一起时，压力才能转成养分。";
  assert.equal(
    validateConnectiveWordSlots("⟦w:身弱⟧与⟦w:正印⟧", plainOk).ok,
    true,
    "mechanism vernacular without 四字格 passes",
  );
}

console.log("test-delivery-mark-w-slot-pipeline: ok");

