/**
 * Smoke: adjacent gold / thin-gap reject + soft-gloss echo strip + soft-layer / template leak.
 * Gap between ⟦w:⟧ slots must have ≥ MIN_ADJACENT_VERNACULAR_HAN Han chars.
 */
import assert from "node:assert/strict";
import { validateConnectiveWordSlots } from "@/lib/llm/pro/delivery/mark-evidence-call";
import {
  findConnectiveShortJargonOutsideSlots,
  hasAdjacentWordSlotsWithoutVernacular,
  MIN_ADJACENT_VERNACULAR_HAN,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import {
  stripSoftGlossEchoAfterMarkers,
  repairAdjacentWordSlotGaps,
  findTemplateLeakPhrase,
  stripTemplateLeakPhrases,
  gateEncodedSoftEvidence,
  hasAdjacentSoftMarksWithoutVernacular,
  findSoftGluedElement,
  encodeConnectiveEvidenceToTerms,
} from "@/lib/llm/pro/delivery/polish-marked-evidence";

const input = "⟦w:身弱⟧与⟦w:正印⟧与⟦w:天德贵人⟧";

assert.ok(MIN_ADJACENT_VERNACULAR_HAN >= 4);

{
  const stuck = "当前⟦w:身弱⟧⟦w:正印⟧再加⟦w:天德贵人⟧";
  const repaired = repairAdjacentWordSlotGaps(stuck);
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(repaired), false);
  assert.equal(findTemplateLeakPhrase(repaired), null, "new pad must not be template leak");
  assert.ok(!repaired.includes("从结构与节奏上看"));
  assert.ok(!repaired.includes("这两处机制是这样连上的"));
  assert.equal(validateConnectiveWordSlots(input, repaired).ok, true);
}

{
  const thin = "你这种⟦w:身弱⟧的⟦w:正印⟧与⟦w:天德贵人⟧缓一缓。";
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(thin), true, "虚字缝 detected");
  const gate = validateConnectiveWordSlots(input, thin);
  assert.equal(gate.ok, true, "thin 的/与 gap locally padded (no LLM retry)");
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(gate.evidence), false);
  assert.ok(gate.evidence.includes("并进一步关联到"));
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

// --- Batch1 C/D ---
{
  const leaked =
    "你这种⟦w:身弱⟧从结构与节奏上看，这两处机制是这样连上的⟦w:正印⟧再连⟦w:天德贵人⟧。";
  assert.ok(findTemplateLeakPhrase(leaked));
  const cleaned = stripTemplateLeakPhrases(leaked);
  assert.equal(findTemplateLeakPhrase(cleaned), null);
  assert.ok(!cleaned.includes("从结构与节奏上看"));
  const gate = validateConnectiveWordSlots(input, leaked);
  assert.equal(gate.ok, true, "legacy template pad auto-stripped then pass");
  assert.ok(!gate.evidence.includes("这两处机制是这样连上的"));
}

{
  const softStuck = "结构⟦t:weak_self|需养|身弱⟧⟦t:yong_shen|锚元|用神⟧再稳。";
  assert.equal(hasAdjacentSoftMarksWithoutVernacular(softStuck), true);
  const gated = gateEncodedSoftEvidence(softStuck);
  assert.equal(gated.ok, true, "soft adjacent locally padded");
  assert.equal(hasAdjacentSoftMarksWithoutVernacular(gated.text), false);
}

{
  const glued = "形成⟦t:ji_shen|耗元|忌神⟧火土的消耗局面。";
  assert.ok(findSoftGluedElement(glued));
  const gated = gateEncodedSoftEvidence(glued);
  assert.equal(gated.ok, true);
  assert.equal(findSoftGluedElement(gated.text), null);
  assert.ok(gated.text.includes("所对应的火土"));
}

{
  // Encode path: word slots → soft; abutting after encode should be padded
  const src =
    "你这种⟦w:身弱⟧需要补给，同时⟦w:用神⟧是缓冲核心，并且⟦w:天德贵人⟧帮你换环境。";
  const encoded = encodeConnectiveEvidenceToTerms(src, "zh");
  assert.ok(encoded.includes("⟦t:"));
  assert.equal(hasAdjacentSoftMarksWithoutVernacular(encoded), false);
  assert.equal(findTemplateLeakPhrase(encoded), null);
}

console.log("test-delivery-mark-adjacent-gold: ok");
