/**
 * Wave 0 smoke: L383 remnant gate + toxic pad leak + no 【五行】 fallback.
 * Run: pnpm exec tsx scripts/test-evidence-remnant-gate.ts
 */
import assert from "node:assert/strict";
import {
  assertEvidenceRemnantClean,
  findEvidenceRemnant,
} from "@/lib/llm/pro/delivery/evidence-remnant-gate";
import {
  findTemplateLeakPhrase,
  findToxicPadPhrase,
  MARK_TEMPLATE_LEAK_PHRASES,
  repairAdjacentWordSlotGaps,
} from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { encodeTraditionalWordSlots } from "@/lib/llm/sanitize/term-marking";
import { validateConnectiveWordSlots } from "@/lib/llm/pro/delivery/mark-evidence-call";

const THREE =
  "⟦w:身弱⟧与⟦w:正印⟧与⟦w:天德贵人⟧";

{
  const l383 =
    "岁环由此先带动这一层变化岁环带来的由此先带动这一层变化【火】特质正在大量消耗你的【水:水】资源";
  const hit = findEvidenceRemnant(l383);
  assert.ok(hit, "L383 must hit remnant gate");
  assert.match(hit!.reason, /evidence_remnant_/);
  assert.equal(assertEvidenceRemnantClean(l383).ok, false);
}

{
  const doublePad =
    "先由此先带动这一层变化再说，再由此先带动这一层变化托住后面。";
  const hit = findEvidenceRemnant(doublePad);
  assert.ok(hit);
  assert.equal(hit!.reason, "evidence_remnant_toxic_pad");
}

{
  assert.ok(
    MARK_TEMPLATE_LEAK_PHRASES.some((p) => p.includes("由此先带动")),
    "toxic pads must be template leaks",
  );
  assert.ok(findToxicPadPhrase("这里由此先带动这一层变化一下"));
  assert.ok(findTemplateLeakPhrase("这里由此先带动这一层变化一下"));
}

{
  const stuck = "当前⟦w:身弱⟧⟦w:正印⟧再加⟦w:天德贵人⟧";
  const repaired = repairAdjacentWordSlotGaps(stuck);
  assert.ok(!repaired.includes("由此先带动这一层变化"));
  assert.ok(!repaired.includes("再托住后面这一段节奏"));
  assert.equal(findToxicPadPhrase(repaired), null);
}

{
  const slotted = encodeTraditionalWordSlots("见⟦w:官星⟧压力与⟦w:孕育⟧节奏。");
  assert.ok(slotted.unresolved.length >= 1);
  assert.ok(slotted.text.includes("⟦w:"), "unresolved keep word-slot");
  assert.ok(!slotted.text.includes("【官星】"));
  assert.ok(!slotted.text.includes("【孕育】"));
}

{
  const withFire =
    "你这种⟦w:身弱⟧需要补给，但【火】过旺，⟦w:正印⟧与⟦w:天德贵人⟧也难托住。";
  const gate = validateConnectiveWordSlots(THREE, withFire);
  assert.equal(gate.ok, false, "【火】 must fail mark remnant");
  if (!gate.ok) assert.match(gate.reason, /evidence_remnant_bracket|mark_template_leak/);
}

{
  const withPad =
    "你这种⟦w:身弱⟧由此先带动这一层变化⟦w:正印⟧再连⟦w:天德贵人⟧。";
  const gate = validateConnectiveWordSlots(THREE, withPad);
  assert.equal(gate.ok, false, "toxic pad must hard-fail");
  if (!gate.ok) assert.match(gate.reason, /mark_template_leak/);
}

{
  const clean =
    "你这种⟦w:身弱⟧需要补给的体质，最缺的是⟦w:正印⟧那种稳定滋养；同时⟦w:天德贵人⟧帮你换环境。";
  assert.equal(assertEvidenceRemnantClean(clean).ok, true);
  assert.equal(validateConnectiveWordSlots(THREE, clean).ok, true);
}

console.log("test-evidence-remnant-gate: ok");
