/**
 * #10 Companion evidence slots -- hard-fail empty/broken (heavier Case B).
 *   pnpm exec tsx scripts/test-companion-evidence-slot.ts
 */
import assert from "node:assert/strict";
import { assessCompanionEvidenceSlot } from "@/lib/companion/companion-evidence-slot";
import { gateCompanionDay } from "@/lib/companion/gate-companion-day";
import { gateCompanionBatch } from "@/lib/companion/batch-gate";
import type { CompanionDayCards } from "@/lib/companion/types";

function faceOk(evidence: string): CompanionDayCards {
  return {
    today_is:
      "Today friction is low; easy to mistake temporary ease for real clarity.",
    suitable:
      "Favor holding the New York production rail as primary while Shanghai stays observational.",
    unsuitable:
      "Do not escalate stakes on warm feelings, and do not treat paperwork as an identity rescue.",
    suggestion:
      "Check whether primary still holds the floor, and whether backup was lifted too early by ease.",
    evidence,
  };
}

/** Case B dyad/marriage-flavored face (collect-path companion). */
function caseBFace(evidence: string): CompanionDayCards {
  return {
    today_is:
      "Partner talk feels smoother; easy to treat that as marriage-ready when the chart boundary is still open.",
    suitable:
      "Favor collecting the partner chart facts you already agreed to gather before any registry push.",
    unsuitable:
      "Do not lock a wedding date on mood alone, and do not skip the dyad collect you named.",
    suggestion:
      "Keep the collect path alive: one clear ask for birth data, then re-check the marriage stake with both rails.",
    evidence,
  };
}

// --- assess: empty / whitespace ---
assert.equal(assessCompanionEvidenceSlot("")?.failed_rule, "companion_evidence_empty");
assert.equal(assessCompanionEvidenceSlot("   \n\t  ")?.failed_rule, "companion_evidence_empty");
assert.equal(assessCompanionEvidenceSlot(null)?.failed_rule, "companion_evidence_empty");
assert.equal(assessCompanionEvidenceSlot(undefined)?.failed_rule, "companion_evidence_empty");

// --- assess: placeholders ---
for (const p of [
  "...",
  "…",
  "TBD",
  "todo",
  "N/A",
  "empty",
  "\u5f85\u586b",
  "\u5360\u4f4d",
  "\u4fe1\u53f7\u5e73\u8861\u89c1\u6458\u8981",
  "\u4fe1\u53f7\u5e73\u8861\u89c1\u6458\u8981\u3002",
  "[evidence]",
  "(empty)",
]) {
  assert.equal(
    assessCompanionEvidenceSlot(p)?.failed_rule,
    "companion_evidence_placeholder",
    `placeholder should fail: ${JSON.stringify(p)}`,
  );
}

// --- assess: mojibake / garbled ---
assert.equal(
  assessCompanionEvidenceSlot("partner chart \uFFFD\uFFFD boundary")?.failed_rule,
  "companion_evidence_garbled",
);
assert.equal(
  assessCompanionEvidenceSlot("\u00ef\u00bf\u00bd\u00ef\u00bf\u00bd marriage stake")?.failed_rule,
  "companion_evidence_garbled",
);
assert.equal(
  assessCompanionEvidenceSlot("!!!!!!!!")?.failed_rule,
  "companion_evidence_garbled",
);
assert.equal(
  assessCompanionEvidenceSlot("aaaaaaaa")?.failed_rule,
  "companion_evidence_garbled",
);

// --- assess: too thin / marker-only ---
assert.equal(
  assessCompanionEvidenceSlot("short")?.failed_rule,
  "companion_evidence_too_thin",
);
assert.equal(
  assessCompanionEvidenceSlot("\u27E6t:zheng_guan|\u27E7")?.failed_rule,
  "companion_evidence_empty",
);

// --- assess: good (solo + Case B) ---
const goodSolo =
  "Outer ease outweighs friction today; consolidate the primary rail instead of sprinting.";
assert.equal(assessCompanionEvidenceSlot(goodSolo), null);

const goodCaseB =
  "Dyad collect still open: partner birth facts must land before any marriage-date push on today's ease.";
assert.equal(assessCompanionEvidenceSlot(goodCaseB), null);

const goodZhClean =
  "\u987a\u5411\u91cd\u4e8e\u523a\u70b9\uff0c\u5b9c\u5de9\u56fa\u4e0d\u5b9c\u5192\u9669\u52a0\u6ce8\u3002";
assert.equal(assessCompanionEvidenceSlot(goodZhClean), null);

// --- day gate hard-fail (Case B heavier) ---
const emptyB = gateCompanionDay({
  dayIndex: 2,
  locale: "en",
  cards: caseBFace(""),
});
assert.equal(emptyB.passed, false);
assert.equal(emptyB.failed_rule, "companion_evidence_empty");

const placeholderB = gateCompanionDay({
  dayIndex: 2,
  locale: "zh",
  cards: caseBFace("\u5f85\u586b"),
});
assert.equal(placeholderB.passed, false);
assert.equal(placeholderB.failed_rule, "companion_evidence_placeholder");

const garbledB = gateCompanionDay({
  dayIndex: 3,
  locale: "en",
  cards: caseBFace("wife chart \uFFFD\uFFFD marry soon"),
});
assert.equal(garbledB.passed, false);
assert.equal(garbledB.failed_rule, "companion_evidence_garbled");

const shellB = gateCompanionDay({
  dayIndex: 4,
  locale: "zh",
  cards: caseBFace("\u4fe1\u53f7\u5e73\u8861\u89c1\u6458\u8981"),
});
assert.equal(shellB.passed, false);
assert.equal(shellB.failed_rule, "companion_evidence_placeholder");

const okB = gateCompanionDay({
  dayIndex: 5,
  locale: "en",
  cards: caseBFace(goodCaseB),
});
assert.equal(okB.passed, true, okB.detail);

const okSolo = gateCompanionDay({
  dayIndex: 0,
  locale: "en",
  cards: faceOk(goodSolo),
});
assert.equal(okSolo.passed, true, okSolo.detail);

// --- batch gate also hard-fails empty evidence (partial window) ---
const batchBad = gateCompanionBatch(
  [
    {
      day_index: 0,
      cards: {
        ...caseBFace(""),
        today_is:
          "Day-0 collect window: partner data still missing while talk feels easy.",
      },
    },
    {
      day_index: 1,
      cards: {
        ...caseBFace(goodCaseB),
        today_is:
          "Day-1 different weather: registry pressure rises but chart facts still incomplete.",
      },
    },
  ],
  { require_full_window: false },
);
assert.equal(batchBad.passed, false);
assert.equal(batchBad.failed_rule, "companion_evidence_empty");

const batchOk = gateCompanionBatch(
  [
    {
      day_index: 0,
      cards: {
        ...caseBFace(goodCaseB),
        today_is:
          "Collect path day: talk is smooth but partner birth facts are still missing.",
      },
    },
    {
      day_index: 1,
      cards: {
        ...caseBFace(
          "Neighbor day still needs partner birth data before treating ease as a registry green light.",
        ),
        today_is:
          "Different pressure day: registry talk heats up while the dyad chart remains incomplete.",
      },
    },
  ],
  { require_full_window: false },
);
assert.equal(batchOk.passed, true, batchOk.detail);

console.log("ok: companion evidence slot hard-gate (#10)");
