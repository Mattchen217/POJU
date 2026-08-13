/**
 * Smoke: adjacent gold / short jargon reject + soft-gloss echo strip.
 */
import assert from "node:assert/strict";
import { validateConnectiveWordSlots } from "@/lib/llm/pro/delivery/mark-evidence-call";
import {
  findConnectiveShortJargonOutsideSlots,
  hasAdjacentWordSlotsWithoutVernacular,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { stripSoftGlossEchoAfterMarkers } from "@/lib/llm/pro/delivery/polish-marked-evidence";

const input = "⟦w:身弱⟧与⟦w:正印⟧与⟦w:天德贵人⟧";

{
  const stuck = "当前⟦w:身弱⟧⟦w:正印⟧再加⟦w:天德贵人⟧";
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(stuck), true);
  const gate = validateConnectiveWordSlots(input, stuck);
  assert.equal(gate.ok, false, "adjacent golds rejected");
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
    "你这种⟦w:身弱⟧需要补给，但当前制杀太重，⟦w:正印⟧也难稳，⟦w:天德贵人⟧只是缓一缓。";
  assert.equal(findConnectiveShortJargonOutsideSlots(jargon), "制杀");
  const gate = validateConnectiveWordSlots(input, jargon);
  assert.equal(gate.ok, false, "短词 制杀 rejected");
  if (!gate.ok) assert.match(gate.reason, /mark_plain_jargon:制杀/);
}

{
  const chengyu =
    "你这种⟦w:身弱⟧需要补给，但火局泄木太重，⟦w:正印⟧难稳，⟦w:天德贵人⟧也救不了。";
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
