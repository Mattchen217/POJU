/**
 * Mark step-1: fanout merge must keep full 批断 on evidence, not drop to unit_claim.
 * Run: pnpm exec tsx scripts/test-mark-passthrough-evidence.ts
 */
import assert from "node:assert/strict";
import {
  mergeEncodeMarkArgPartials,
  asMarkArgumentTree,
} from "@/lib/llm/pro/delivery/mark-evidence-call";
import type { DeliveryArgumentTree } from "@/lib/llm/pro/delivery/delivery-schema";

const raw: DeliveryArgumentTree = {
  foundation: [
    {
      body: "日支与时支，丑未相冲",
      evidence:
        "日支丑与时支未相冲。丑未皆土。日主己土身强。丑中癸水为用神偏财。未中丁火为忌神偏印。克伤丑中辛金喜神食神。泄秀之力被抑。",
    },
    {
      body: "月支与日支，午丑相害",
      evidence:
        "午丑相害。午火生丑土。日主身强更增壅滞。午中丁火偏印克丑中辛金食神。用神癸水失其源头。丑中癸水偏财虽可制午中丁火偏印。",
    },
  ],
};

// Pack shape that Lab mark chunks currently store (pickMarkEvidenceInput → chunk).
const packPartial = {
  foundation: {
    arguments: raw.foundation!.map((a) => ({
      body: a.body,
      evidence: a.evidence,
    })),
  },
};

const fromPack = asMarkArgumentTree(packPartial, ["foundation"]);
assert.equal(fromPack.foundation?.length, 2);
assert.ok((fromPack.foundation?.[0]?.evidence ?? "").length > 40);

const merged = mergeEncodeMarkArgPartials(
  raw,
  ["foundation"],
  [packPartial as unknown as DeliveryArgumentTree],
  "zh",
);
assert.equal(merged.foundation?.length, 2);
assert.equal(merged.foundation?.[0]?.body, "日支与时支，丑未相冲");
assert.match(merged.foundation?.[0]?.evidence ?? "", /丑未皆土/);
assert.match(merged.foundation?.[1]?.evidence ?? "", /午丑相害/);

// Empty / wrong-shape partials must fall back to raw 批断 (never wipe).
const wiped = mergeEncodeMarkArgPartials(raw, ["foundation"], [{} as DeliveryArgumentTree], "zh");
assert.match(wiped.foundation?.[0]?.evidence ?? "", /丑未皆土/);

console.log("ok mark-passthrough-evidence");
