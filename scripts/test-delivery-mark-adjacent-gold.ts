/**
 * Smoke: adjacent gold / thin-gap reject + soft-gloss echo strip.
 * Gap between ⟦w:⟧ slots must have ≥ MIN_ADJACENT_VERNACULAR_HAN Han chars.
 */
import assert from "node:assert/strict";
import { validateConnectiveWordSlots } from "@/lib/llm/pro/delivery/mark-evidence-call";
import {
  findConnectiveShortJargonOutsideSlots,
  hasAdjacentWordSlotsWithoutVernacular,
  MIN_ADJACENT_VERNACULAR_HAN,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { stripSoftGlossEchoAfterMarkers, repairAdjacentWordSlotGaps } from "@/lib/llm/pro/delivery/polish-marked-evidence";

const input = "⟦w:身弱⟧与⟦w:正印⟧与⟦w:天德贵人⟧";

assert.ok(MIN_ADJACENT_VERNACULAR_HAN >= 4);

{
  const stuck = "当前⟦w:身弱⟧⟦w:正印⟧再加⟦w:天德贵人⟧";
  const repaired = repairAdjacentWordSlotGaps(stuck);
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(repaired), false);
  assert.equal(validateConnectiveWordSlots(input, repaired).ok, true);
}

{
  const thin = "你这种⟦w:身弱⟧的⟦w:正印⟧与⟦w:天德贵人⟧缓一缓。";
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(thin), true, "虚字缝 rejected");
  const gate = validateConnectiveWordSlots(input, thin);
  assert.equal(gate.ok, false, "thin 的/与 gap rejected");
  if (!gate.ok) assert.equal(gate.reason, "mark_adjacent_gold");
}

{
  const spaced =
    "你这种⟦w:身弱⟧需要补给的体质，最缺的是⟦w:正印⟧那种稳定滋养；同时⟦w:天德贵人⟧帮你换环境。";
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(spaced), false);
  assert.equal(validateConnectiveWordSlots(input, spaced).ok, true);
}

{
  const jargon =
    "你这种⟦w:身弱⟧需要补给的体质，但当前制杀太重，⟦w:正印⟧那种滋养也难稳住，⟦w:天德贵人⟧只是缓一缓。";
  assert.equal(findConnectiveShortJargonOutsideSlots(jargon), "制杀");
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(jargon), false);
  const gate = validateConnectiveWordSlots(input, jargon);
  assert.equal(gate.ok, false, "短词 制杀 (no plain-fallback) still rejected → LLM retry");
  if (!gate.ok) assert.match(gate.reason, /mark_plain_jargon:制杀/);
}

{
  const known =
    "你这种⟦w:身弱⟧需要补给的体质，但忌神太重，⟦w:正印⟧那种滋养也难稳住，⟦w:天德贵人⟧只是缓一缓。";
  const gate = validateConnectiveWordSlots(input, known);
  assert.equal(gate.ok, true, "忌神 auto-repaired via plain-fallback (no LLM retry)");
  if (gate.ok) {
    assert.ok(gate.auto_repaired?.includes("忌神"));
    assert.match(gate.evidence, /干扰能量|【干扰能量】/);
    assert.equal(gate.evidence.includes("忌神"), false, "slot-outside 忌神 removed");
    assert.match(gate.evidence, /⟦w:身弱⟧/, "word-slots preserved");
  }
}

{
  const chengyu =
    "你这种⟦w:身弱⟧需要补给的体质，但火局泄木太重，⟦w:正印⟧那种滋养难稳住，⟦w:天德贵人⟧也救不了。";
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(chengyu), false);
  const gate = validateConnectiveWordSlots(input, chengyu);
  assert.equal(gate.ok, false, "火局泄木 rejected");
  if (!gate.ok) assert.match(gate.reason, /mark_mingli_chengyu:火局泄木/);
}

{
  const echoed = "结构⟦t:weak_self|需养|身弱⟧需养，所以先稳住。";
  const stripped = stripSoftGlossEchoAfterMarkers(echoed);
  assert.equal(stripped.includes("⟧需养"), false, "echo after marker removed");
  assert.match(stripped, /⟦t:weak_self\|需养\|身弱⟧/);
  assert.match(stripped, /所以先稳住/);
}

console.log("test-delivery-mark-adjacent-gold: ok");
