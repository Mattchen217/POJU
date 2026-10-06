/**
 * Smoke: foreign mark opaque slots + strip element-cycle parentheticals.
 * Root fix for EN mark_slots_dropped on duplicate 真词 anaphora.
 */
import assert from "node:assert/strict";
import {
  fromOpaqueWordSlots,
  shapeMarkEvidenceForLocale,
  stripElementCycleParentheticalSlots,
  toOpaqueWordSlots,
} from "@/lib/llm/pro/delivery/mark-evidence-opaque";
import { validateConnectiveWordSlots } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { buildMarkEvidencePrompt } from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { countEvidenceWordSlots } from "@/lib/llm/pro/delivery/polish-marked-evidence";

{
  const raw =
    "⟦w:大运戊戌偏印⟧生⟦w:比劫⟧（⟦w:土⟧生⟦w:金⟧），⟦w:比劫⟧更旺。";
  const stripped = stripElementCycleParentheticalSlots(raw);
  assert.equal(countEvidenceWordSlots(stripped), 3, "paren 土生金 dropped");
  assert.ok(!stripped.includes("⟦w:土⟧"));
  assert.ok(!stripped.includes("⟦w:金⟧"));
  assert.ok(stripped.includes("⟦w:比劫⟧"));
}

{
  const ev =
    "⟦w:大运戊戌偏印⟧泄⟦w:用神火⟧，⟦w:流年丙午七杀⟧扶⟦w:用神火⟧，两者方向相左，⟦w:用神⟧难以稳定发力。⟦w:用神火⟧为制⟦w:比劫⟧、暖局的关键，受泄时制衡不足，扶起时又逢⟦w:运干⟧泄气，形成拉锯，导致⟦w:用神⟧窗口收窄。";
  const { text, interiors, legend } = toOpaqueWordSlots(ev);
  assert.equal(interiors.length, 9);
  assert.equal(countEvidenceWordSlots(text), 0, "opaque has no w-slots");
  assert.ok(text.includes("⟦#1⟧") && text.includes("⟦#9⟧"));
  assert.ok(legend.includes("#2=用神火") && legend.includes("#4=用神火"));

  // #21-style fail: vernacular absorbs the 2nd 用神火 (drop #4)
  const dropped =
    "⟦#1⟧ siphons energy away from ⟦#2⟧, while this year's influence ⟦#3⟧ tries to pump it back up. These two forces pull in opposite directions, so ⟦#5⟧ can't settle. That fire ⟦#6⟧ is what keeps ⟦#7⟧ from running wild. When boosted, ⟦#8⟧ bleeds it off again, shrinking the window where ⟦#9⟧ can work.";
  const bad = fromOpaqueWordSlots(dropped, interiors);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.reason.startsWith("mark_opaque_count"));

  // Keep all nine numbers — restore then A-gate
  const kept =
    "⟦#1⟧ siphons energy away from ⟦#2⟧, while this year's influence ⟦#3⟧ tries to pump energy back into ⟦#4⟧. These two forces pull in opposite directions, so ⟦#5⟧ can't settle into a steady push. That fire ⟦#6⟧ is what keeps ⟦#7⟧ from running wild and warms the whole picture. When it's drained, it can't hold them back; when it's boosted, the phase stem ⟦#8⟧ immediately bleeds it off again. The result is a tug-of-war that shrinks the window where ⟦#9⟧ can actually work.";
  const good = fromOpaqueWordSlots(kept, interiors);
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(countEvidenceWordSlots(good.text), 9);
    const gate = validateConnectiveWordSlots(ev, good.text, "en", {
      makeup: "fail",
    });
    assert.equal(gate.ok, true, gate.ok ? "" : gate.reason);
  }
}

{
  const shaped = shapeMarkEvidenceForLocale(
    {
      foundation: {
        arguments: [
          {
            body: "x",
            evidence:
              "⟦w:大运戊戌偏印⟧生⟦w:比劫⟧（⟦w:土⟧生⟦w:金⟧），⟦w:比劫⟧更旺。",
          },
        ],
      },
    },
    "en",
  );
  assert.equal(
    countEvidenceWordSlots(shaped.validateSegments.foundation!.arguments[0]!.evidence),
    3,
  );
  assert.ok(
    shaped.promptSegments.foundation!.arguments[0]!.evidence.includes("⟦#1⟧"),
  );
  assert.ok(shaped.legendBlock.includes("#1=大运戊戌偏印"));
  const prompt = buildMarkEvidencePrompt(
    {
      foundation: {
        arguments: [
          {
            body: "x",
            evidence:
              "⟦w:大运戊戌偏印⟧生⟦w:比劫⟧（⟦w:土⟧生⟦w:金⟧），⟦w:比劫⟧更旺。",
          },
        ],
      },
    },
    "en",
  );
  assert.ok(prompt.system.includes("opaque numbered"));
  assert.ok(prompt.user.includes("⟦#1⟧"));
  assert.ok(!prompt.user.includes("⟦w:土⟧"), "paren cycle not in LLM payload");
}

{
  const zh = shapeMarkEvidenceForLocale(
    {
      foundation: {
        arguments: [{ body: "x", evidence: "⟦w:身弱⟧需要⟦w:正印⟧托住。" }],
      },
    },
    "zh",
  );
  assert.equal(zh.opaqueInteriors, null);
  assert.ok(zh.promptSegments.foundation!.arguments[0]!.evidence.includes("⟦w:身弱⟧"));
}

console.log("test-mark-evidence-opaque: ok");
