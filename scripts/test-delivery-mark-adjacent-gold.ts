/**
 * Smoke: adjacent gold / thin-gap reject + soft-gloss echo strip + soft-layer / template leak.
 * Gap between ⟦w:⟧ slots must have ≥ MIN_ADJACENT_VERNACULAR_HAN Han chars.
 */
import assert from "node:assert/strict";
import { validateConnectiveWordSlots } from "@/lib/llm/pro/delivery/mark-evidence-call";
import {
  findConnectiveShortJargonOutsideSlots,
  findMingliChengyuOutsideSlots,
  hasAdjacentWordSlotsWithoutVernacular,
  hasExcessTermStackInClause,
  repairExcessTermStacks,
  repairMarkConnectivePlainJargon,
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
  reinjectDroppedWordSlots,
  countEvidenceWordSlots,
  dedupeSameCardWordSlots,
  thickenShortAdjacentGapsForSoft,
  breakExcessTermStacksForSoft,
  scrubSoftAssemblyArtifacts,
  findEmptyConnectivePadPhrase,
  restoreWordSlotInteriorsFromInput,
  listEvidenceWordSlotInteriors,
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
  assert.ok(!gate.evidence.includes("并进一步关联到"), "legacy glue pad banned");
  assert.ok(!/⟧[、，]\s*/.test(gate.evidence), "must not keep punct before pad");
}

{
  const punctSoup = "⟦w:食神⟧、⟦w:正官⟧、⟦w:正印⟧";
  const repaired = repairAdjacentWordSlotGaps(punctSoup);
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(repaired), false);
  assert.ok(!repaired.includes("并进一步关联到"));
  assert.ok(!repaired.includes("、，"), "顿号不得保留再塞垫");
  assert.equal(findTemplateLeakPhrase(repaired), null);
}

{
  // P6 regression: model keeps 2 of 4 slots → reinject missing, no LLM retry.
  const inputEv = "⟦w:食神⟧托住⟦w:正官⟧再落到⟦w:正印⟧衔接⟦w:大运⟧窗口。";
  const dropped =
    "你这种⟦w:食神⟧输出要稳住，同时⟦w:正官⟧帮你守住秩序。";
  const gate = validateConnectiveWordSlots(inputEv, dropped);
  assert.equal(gate.ok, true, "dropped slots reinjected locally");
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(gate.evidence), false);
  assert.ok(gate.evidence.includes("⟦w:正印⟧"));
  assert.ok(gate.evidence.includes("⟦w:大运⟧"));
  assert.ok(!gate.evidence.includes("并进一步关联到"));
}

{
  const emptyOut = "";
  const inputEv = "⟦w:身弱⟧需要⟦w:正印⟧滋养，并借⟦w:天德贵人⟧换场。";
  const gate = validateConnectiveWordSlots(inputEv, emptyOut);
  assert.equal(gate.ok, true, "empty mark output reinjected from input slots");
  assert.ok(gate.evidence.includes("⟦w:身弱⟧"));
  assert.ok(gate.evidence.includes("⟦w:正印⟧"));
  assert.ok(gate.evidence.includes("⟦w:天德贵人⟧"));
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
  assert.equal(gate.ok, true, "制杀 auto-repaired via SSOT fallback (repair path)");
  if (gate.ok) {
    assert.ok(gate.auto_repaired?.includes("制杀"));
    assert.equal(gate.evidence.includes("制杀"), false);
  }
  const strict = validateConnectiveWordSlots(input, jargon, "zh", { makeup: "fail" });
  assert.equal(strict.ok, false, "v3 A-gate: 槽外短命理残词不得 C 修过闸");
  if (!strict.ok) assert.match(strict.reason, /mark_plain_jargon:制杀/);
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

{
  // Dense short-pad chain (L276-style): 3 markers with <8 Han gaps → stack fail
  const stacked =
    "当前⟦w:身弱⟧由此带动⟦w:正印⟧托住其后⟦w:天德贵人⟧对上这一头。";
  assert.equal(hasExcessTermStackInClause(stacked), true);
  const destacked = repairExcessTermStacks(stacked);
  assert.equal(hasExcessTermStackInClause(destacked), false);
  const stackedGate = validateConnectiveWordSlots(input, stacked);
  assert.equal(stackedGate.ok, true);

  // Real connective (≥8 Han between each) with 3 slots must NOT trip stack
  const okThree =
    "当前⟦w:身弱⟧因为容量偏紧所以⟦w:正印⟧补给不足又叠加⟦w:天德贵人⟧托底。";
  assert.equal(hasExcessTermStackInClause(okThree), false);
  assert.equal(validateConnectiveWordSlots(input, okThree).ok, true);
}

{
  // Root cause of mark_slots_dropped:2/3 with duplicate tokens — set-semantics
  // reinject used to skip the 2nd identical ⟦w:⟧ and still fail the count gate.
  const inputDup =
    "先看⟦w:正印⟧再看⟦w:正印⟧最后⟦w:身弱⟧";
  const droppedOneCopy =
    "先看⟦w:正印⟧最后因为容量偏紧所以⟦w:身弱⟧能托住";
  assert.equal(countEvidenceWordSlots(inputDup), 3);
  assert.equal(countEvidenceWordSlots(droppedOneCopy), 2);
  const oldStylePresenceOnly = droppedOneCopy.includes("⟦w:正印⟧");
  assert.equal(oldStylePresenceOnly, true);
  const fixed = reinjectDroppedWordSlots(inputDup, droppedOneCopy);
  assert.equal(fixed.reinjected.length, 1);
  assert.equal(fixed.reinjected[0], "⟦w:正印⟧");
  assert.equal(countEvidenceWordSlots(fixed.text), 3);
  const gate = validateConnectiveWordSlots(inputDup, droppedOneCopy);
  assert.equal(gate.ok, true, gate.ok ? "" : gate.reason);
  assert.equal(countEvidenceWordSlots(gate.evidence), 3);
}

{
  // 方案 A #4：同卡 ⟦w:同词⟧ + 空垫「同时对应」塌成单槽
  const dupPad = "结构上⟦w:木⟧同时对应⟦w:木⟧所以要慢推";
  const collapsed = dedupeSameCardWordSlots(dupPad);
  assert.equal(countEvidenceWordSlots(collapsed), 1);
  assert.ok(collapsed.includes("⟦w:木⟧"));
  assert.ok(!collapsed.includes("同时对应"));
  assert.ok(!/⟦w:木⟧.*⟦w:木⟧/.test(collapsed));
}

{
  // 厚白话夹缝保留双槽（不去误杀）
  const thick =
    "先看⟦w:正印⟧再结合容量与边界之后⟦w:正印⟧才能托住节奏";
  const kept = dedupeSameCardWordSlots(thick);
  assert.equal(countEvidenceWordSlots(kept), 2);
}

{
  // 全局：软修垫语须 ≥ MIN_ADJACENT_VERNACULAR_HAN，否则 soft_gold 假红空转 LLM
  // Simulate soft-gloss echo strip leaving ⟧⟦ then local repair must clear gate.
  const afterEcho = stripSoftGlossEchoAfterMarkers(
    "结构上⟦t:bi_jian|比肩|时支⟧比肩⟦t:pian_cai|偏财|日支⟧偏财托住缓冲",
  );
  assert.ok(
    hasAdjacentSoftMarksWithoutVernacular(afterEcho) ||
      afterEcho.includes("⟧⟦") ||
      /⟧\s*⟦/.test(afterEcho),
    `expected thin gap after echo strip: ${afterEcho}`,
  );
  const repaired = repairAdjacentWordSlotGaps(afterEcho);
  assert.equal(
    hasAdjacentSoftMarksWithoutVernacular(repaired),
    false,
    `pad still thin: ${repaired}`,
  );
  const gated = gateEncodedSoftEvidence(repaired);
  assert.equal(gated.ok, true, gated.ok ? "" : gated.reason);
}

{
  // Multi-gap: pad pool must never emit <4-Han connective (旧「并落到/再对照」=3)
  let text = "⟦w:身弱⟧⟦w:正印⟧⟦w:七杀⟧⟦w:偏财⟧⟦w:食神⟧";
  for (let i = 0; i < 8; i++) {
    text = repairAdjacentWordSlotGaps(text.replace(/在机制上衔接|由此引动|并落到此处|再对照结构/g, ""));
    // force re-thin then repair cycling pads
    text = text.replace(/⟧[^⟦]*⟦/g, "⟧⟦");
    text = repairAdjacentWordSlotGaps(text);
    assert.equal(
      hasAdjacentWordSlotsWithoutVernacular(text),
      false,
      `cycle ${i}: ${text}`,
    );
  }
}

{
  const makeup = { makeup: "fail" as const };
  const inEv = "⟦w:大运⟧会持续消耗⟦w:用神⟧并让窗口收窄。";
  const mutated = validateConnectiveWordSlots(
    inEv,
    "⟦w:大运运⟧会持续消耗⟦w:用神⟧并让窗口收窄。",
    "zh",
    makeup,
  );
  assert.equal(mutated.ok, false);
  if (!mutated.ok) assert.match(mutated.reason, /mark_slot_mutated/);

  const padded = validateConnectiveWordSlots(
    inEv,
    "⟦w:大运⟧在机制上衔接⟦w:用神⟧并让窗口收窄。",
    "zh",
    makeup,
  );
  assert.equal(padded.ok, false);
  if (!padded.ok) assert.match(padded.reason, /mark_empty_link_pad/);

  const extra = validateConnectiveWordSlots(
    inEv,
    "⟦w:大运⟧会持续消耗⟦w:用神⟧并让窗口收窄。⟦w:大运⟧",
    "zh",
    makeup,
  );
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.match(extra.reason, /mark_slots_invented/);

  const good = validateConnectiveWordSlots(inEv, inEv, "zh", makeup);
  assert.equal(good.ok, true, good.ok ? "" : good.reason);
  const encoded = encodeConnectiveEvidenceToTerms(inEv, "zh", makeup);
  assert.match(encoded, /⟦t:[a-z0-9_|]+⟧/);
  assert.ok(!encoded.includes("在机制上衔接"));
  assert.ok(!/⟦t:[^⟧]+\|[^|⟧]+\|/.test(encoded), `3-slot dump: ${encoded}`);
}

{
  // Non-zh: score Latin letters, not Han (same ruler split as body-polish compactLen).
  const inEn =
    "⟦w:大运戊戌偏印⟧泄⟦w:用神火⟧，⟦w:流年丙午七杀⟧扶⟦w:用神火⟧，两者方向相左。";
  const outEn =
    "⟦w:大运戊戌偏印⟧ drains and weakens the ⟦w:用神火⟧, but at the same time, the ⟦w:流年丙午七杀⟧ supports and strengthens the ⟦w:用神火⟧, creating a push-pull conflict.";
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(outEn), true, "zh ruler still sees 0 Han");
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(outEn, "en"), false);
  assert.equal(hasAdjacentWordSlotsWithoutVernacular("⟦w:用神火⟧, ⟦w:比劫⟧", "en"), true);
  assert.equal(hasAdjacentWordSlotsWithoutVernacular("⟦w:用神火⟧ and ⟦w:比劫⟧", "en"), true);
  const enGate = validateConnectiveWordSlots(inEn, outEn, "en", { makeup: "fail" });
  assert.equal(enGate.ok, true, enGate.ok ? "" : enGate.reason);
}

{
  // Non-zh term_stack: ordinary EN prepositions / short causal hops != zh gold wall.
  const inDense =
    "⟦w:偏财甲木⟧透⟦w:时干⟧，⟦w:身强⟧可载财。但⟦w:正官丁火⟧仅藏于⟦w:未戌地支⟧，⟦w:天干⟧不露。⟦w:流年丙午七杀透出⟧，但⟦w:原局官杀⟧根气仍藏。";
  const outDense =
    "⟦w:偏财甲木⟧ appears at ⟦w:时干⟧, and since ⟦w:身强⟧ can carry wealth, the path to resources is visible. However, ⟦w:正官丁火⟧ only hides in ⟦w:未戌地支⟧, not showing on ⟦w:天干⟧, so the balancing force stays hidden. ⟦w:流年丙午七杀透出⟧, but the root of ⟦w:原局官杀⟧ remains buried.";
  assert.equal(
    hasExcessTermStackInClause(outDense, 2, 12, "en"),
    true,
    "old harsh latin stack floor still trips",
  );
  assert.equal(hasExcessTermStackInClause(outDense, 3, 8, "en"), false);
  const denseGate = validateConnectiveWordSlots(inDense, outDense, "en", { makeup: "fail" });
  assert.equal(denseGate.ok, true, denseGate.ok ? "" : denseGate.reason);

  const inChain =
    "⟦w:大运戊戌偏印⟧生⟦w:比劫⟧（⟦w:土⟧生⟦w:金⟧），⟦w:比劫⟧更旺。";
  const outChain =
    "⟦w:大运戊戌偏印⟧ then strengthens the competing side ⟦w:比劫⟧ — because ⟦w:土⟧ backs the cutting edge of ⟦w:金⟧, which means ⟦w:比劫⟧ grows even stronger.";
  const chainGate = validateConnectiveWordSlots(inChain, outChain, "en", { makeup: "fail" });
  assert.equal(chainGate.ok, true, chainGate.ok ? "" : chainGate.reason);

  // Still fail true Latin gold walls (sub-floor glue across 4+ slots).
  const wall = "⟦w:偏财甲木⟧ of ⟦w:时干⟧ and ⟦w:身强⟧ to ⟦w:正官丁火⟧";
  assert.equal(hasExcessTermStackInClause(wall, 3, 8, "en"), true);

  const furnitureIn =
    "⟦w:比劫辛金双透⟧月年，竞争内耗⟦w:格局⟧显性。";
  const furnitureOut =
    "⟦w:比劫辛金双透⟧ in the month and year pillars makes the drain on ⟦w:格局⟧ obvious.";
  const furniture = validateConnectiveWordSlots(furnitureIn, furnitureOut, "en", {
    makeup: "fail",
  });
  assert.equal(furniture.ok, false);
  if (!furniture.ok) assert.match(furniture.reason, /mark_chart_furniture:pillars/);

  const cycle = validateConnectiveWordSlots(
    "⟦w:土⟧生⟦w:金⟧",
    "⟦w:土⟧ produces ⟦w:金⟧",
    "en",
    { makeup: "fail" },
  );
  assert.equal(cycle.ok, false);
  if (!cycle.ok) assert.match(cycle.reason, /mark_cycle_gloss/);

  const producing = validateConnectiveWordSlots(
    "⟦w:土⟧生⟦w:金⟧",
    "⟦w:土⟧ producing ⟦w:金⟧",
    "en",
    { makeup: "fail" },
  );
  assert.equal(producing.ok, false);
  if (!producing.ok) assert.match(producing.reason, /mark_cycle_gloss/);

  const nourishesThe = validateConnectiveWordSlots(
    "⟦w:大运戊戌偏印⟧生⟦w:比劫⟧",
    "⟦w:大运戊戌偏印⟧ nourishes the ⟦w:比劫⟧",
    "en",
    { makeup: "fail" },
  );
  assert.equal(nourishesThe.ok, false);
  if (!nourishesThe.ok) assert.match(nourishesThe.reason, /mark_cycle_gloss/);
}

{
  // Non-zh encode must NOT rewrite connective "fire" → bare 「火」.
  const marked =
    "The decade ⟦w:大运戊戌偏印⟧ drains the supportive fire ⟦w:用神火⟧, so the window shrinks.";
  const encoded = encodeConnectiveEvidenceToTerms(marked, "en", { makeup: "fail" });
  assert.equal(encoded.includes("火"), false, `bare 火 leaked: ${encoded}`);
  assert.match(encoded, /supportive fire/);
  assert.match(encoded, /⟦t:[a-z0-9_|]+⟧/);
}

{
  // Soft makeup=fail: adjacent thicken (>=4) leaves 4-7 Han seams that still
  // trip mark_term_stack (>=8 break). Local stack-break must clear without empty pads / soup.
  const inDense =
    "\u27e6w:\u5927\u8fd0\u58ec\u5348\u27e7\uff0c\u27e6w:\u58ec\u6c34\u27e7\u6cc4\u27e6w:\u7528\u795e\u91d1\u27e7\uff0c\u27e6w:\u7528\u795e\u27e7\u751f\u27e6w:\u6c34\u27e7\uff1b\u27e6w:\u6d41\u5e74\u4e19\u5348\u27e7\uff0c\u27e6w:\u4e19\u706b\u27e7\u514b\u27e6w:\u7528\u795e\u91d1\u27e7\u3002";
  const outDense =
    "\u27e6w:\u5927\u8fd0\u58ec\u5348\u27e7\u51fa\u73b0\u540e\uff0c\u5176\u4e2d\u7684\u27e6w:\u58ec\u6c34\u27e7\u4f1a\u6d88\u8017\u27e6w:\u7528\u795e\u91d1\u27e7\u7684\u529b\u91cf\uff0c\u27e6w:\u7528\u795e\u27e7\u53bb\u751f\u27e6w:\u6c34\u27e7\u4f1a\u8017\u8d39\u7cbe\u529b\uff1b\u27e6w:\u6d41\u5e74\u4e19\u5348\u27e7\u5230\u6765\uff0c\u5176\u4e2d\u7684\u27e6w:\u4e19\u706b\u27e7\u4f1a\u538b\u5236\u27e6w:\u7528\u795e\u91d1\u27e7\u3002";
  const adjacentOnly = thickenShortAdjacentGapsForSoft(outDense);
  assert.equal(hasAdjacentWordSlotsWithoutVernacular(adjacentOnly), false);
  assert.equal(
    hasExcessTermStackInClause(adjacentOnly),
    true,
    "4-7 Han seams still stack after adjacent thicken",
  );
  const assembled = scrubSoftAssemblyArtifacts(
    breakExcessTermStacksForSoft(adjacentOnly, "zh"),
  );
  assert.equal(hasExcessTermStackInClause(assembled), false);
  assert.equal(findEmptyConnectivePadPhrase(assembled), null);
  assert.ok(!assembled.includes("带来压力会持续加重承压感"));
  const gate = validateConnectiveWordSlots(inDense, assembled, "zh", {
    makeup: "fail",
  });
  assert.equal(gate.ok, true, gate.ok ? "" : gate.reason);
}

{
  // 抢夺财星 must not become 抢抢资源星 (夺财 is a substring).
  const leaked =
    "\u27e6w:\u6bd4\u52ab\u27e7\u62a2\u593a\u8d22\u661f\u7684\u52bf\u5934\u975e\u5e38\u660e\u663e\u3002";
  const fixed = repairMarkConnectivePlainJargon(leaked).text;
  assert.ok(!fixed.includes("\u62a2\u62a2\u8d44\u6e90"));
  assert.ok(fixed.includes("\u62a2\u8d44\u6e90"));
}

{
  // attempt#21: copy-from-input 四字格 克泄交加 → soft B vernacular.
  const inEv =
    "\u27e6w:\u5fcc\u795e\u706b\u27e7\u7684\u52bf\u529b\u53e0\u52a0\uff0c\u27e6w:\u7528\u795e\u91d1\u27e7\u53d7\u514b\u6cc4\u4ea4\u52a0\uff0c\u627f\u538b\u504f\u9ad8\u3002";
  const leaked =
    "\u27e6w:\u5fcc\u795e\u706b\u27e7\u7684\u52bf\u529b\u53e0\u52a0\u8d77\u6765\uff0c\u5bf9\u27e6w:\u7528\u795e\u91d1\u27e7\u5f62\u6210\u514b\u6cc4\u4ea4\u52a0\u7684\u5c40\u9762\uff0c\u627f\u53d7\u7684\u538b\u529b\u81ea\u7136\u504f\u9ad8\u3002";
  assert.equal(findMingliChengyuOutsideSlots(leaked), "\u514b\u6cc4\u4ea4\u52a0");
  const rewritten = repairMarkConnectivePlainJargon(leaked).text;
  assert.equal(findMingliChengyuOutsideSlots(rewritten), null);
  const gate = validateConnectiveWordSlots(inEv, rewritten, "zh", {
    makeup: "fail",
  });
  assert.equal(gate.ok, true, gate.ok ? "" : gate.reason);
  assert.ok(gate.evidence.includes("\u53c8\u88ab\u538b\u5236\u53c8\u88ab\u6d88\u8017"));
}

{
  // Same class as attempt#17 foundation[3]: short jargon left outside slots.
  assert.equal(
    findConnectiveShortJargonOutsideSlots(
      "\u27e6w:\u6bd4\u52ab\u27e7\u593a\u8d22\u7684\u6001\u52bf\u5f88\u660e\u663e\u3002",
    ),
    "\u593a\u8d22",
  );
}

{
  // attempt#19: body 合称 leaked outside slots (财星/官星). Soft B rewrites before A-gate.
  const inEv =
    "\u27e6w:\u5348\u706b\u5fcc\u795e\u27e7\u4f1a\u6301\u7eed\u52a0\u538b\uff0c\u27e6w:\u5fcc\u795e\u27e7\u628a\u56de\u65cb\u4f59\u5730\u6536\u7a84\u3002";
  const leaked =
    "\u27e6w:\u5348\u706b\u5fcc\u795e\u27e7\u4f1a\u6301\u7eed\u52a0\u538b\uff0c\u8d22\u661f\u548c\u5b98\u661f\u90fd\u53d7\u5230\u27e6w:\u5fcc\u795e\u27e7\u7684\u538b\u5236\u3002";
  const raw = validateConnectiveWordSlots(inEv, leaked, "zh", { makeup: "fail" });
  assert.equal(raw.ok, false, "A-gate alone must still catch 官星/财星");
  if (!raw.ok) assert.match(raw.reason, /mark_plain_jargon:(官星|财星)/);
  const rewritten = repairMarkConnectivePlainJargon(leaked);
  assert.ok(rewritten.repaired_terms.includes("\u5b98\u661f") || rewritten.repaired_terms.includes("\u8d22\u661f"));
  const gate = validateConnectiveWordSlots(inEv, rewritten.text, "zh", {
    makeup: "fail",
  });
  assert.equal(gate.ok, true, gate.ok ? "" : gate.reason);
  const connective = gate.evidence.replace(/⟦(?:w|词|t):[^⟧]*⟧/g, "");
  assert.ok(!connective.includes("\u5b98\u661f"));
  assert.ok(!connective.includes("\u8d22\u661f"));
  assert.ok(connective.includes("\u8d44\u6e90\u8fd9\u4e00\u5934"));
  assert.ok(connective.includes("\u5236\u8861\u8fd9\u4e00\u5934"));
}

{
  // attempt#18: CoT doubles a ganzhi tail inside the slot (丙午→丙午午).
  // Soft B stamps input interiors by ordinal when counts match.
  const inEv =
    "\u27e6w:\u6d41\u5e74\u4e19\u5348\u27e7\u5230\u6765\u4e4b\u540e\uff0c\u27e6w:\u4e19\u706b\u27e7\u4f1a\u76f4\u63a5\u538b\u5236\u27e6w:\u7528\u795e\u91d1\u27e7\u3002";
  const mutated =
    "\u27e6w:\u6d41\u5e74\u4e19\u5348\u5348\u27e7\u51fa\u73b0\u4e4b\u540e\uff0c\u27e6w:\u4e19\u706b\u27e7\u4f1a\u76f4\u63a5\u538b\u5236\u27e6w:\u7528\u795e\u91d1\u27e7\u3002";
  const stamped = restoreWordSlotInteriorsFromInput(inEv, mutated);
  assert.equal(stamped.restored, 1);
  assert.equal(
    listEvidenceWordSlotInteriors(stamped.text)[0],
    "\u6d41\u5e74\u4e19\u5348",
  );
  const assembled = breakExcessTermStacksForSoft(
    thickenShortAdjacentGapsForSoft(stamped.text),
    "zh",
  );
  const gate = validateConnectiveWordSlots(inEv, assembled, "zh", {
    makeup: "fail",
  });
  assert.equal(gate.ok, true, gate.ok ? "" : gate.reason);
  const rawGate = validateConnectiveWordSlots(inEv, mutated, "zh", {
    makeup: "fail",
  });
  assert.equal(rawGate.ok, false);
  if (!rawGate.ok) assert.match(rawGate.reason, /mark_slot_mutated/);
}

console.log("test-delivery-mark-adjacent-gold: ok");
