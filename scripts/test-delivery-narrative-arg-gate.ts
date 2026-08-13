/**
 * Smoke: narrative shape gate — duplicate "body" keys + ≥2 args.
 */
import assert from "node:assert/strict";
import {
  narrativeArgumentCountOk,
  rawNarrativeHasDuplicateBodyKeys,
  validateNarrativeShape,
} from "@/lib/llm/pro/delivery/narrative-shape-gate";

{
  // Duplicate keys cannot be written as a TS object literal; use raw JSON text.
  const rawDup =
    '{"foundation":{"arguments":[{"body":"段一","body":"段二","body":"段三"}]}}';
  assert.equal(rawNarrativeHasDuplicateBodyKeys(rawDup), true, "dup body keys detected");
}

{
  const okRaw =
    '{"foundation":{"arguments":[{"body":"段一论证"},{"body":"段二论证"},{"body":"段三收束"}]}}';
  assert.equal(rawNarrativeHasDuplicateBodyKeys(okRaw), false, "3 distinct args ok");
  const shape = validateNarrativeShape({
    raw: okRaw,
    argCounts: { foundation: 3 },
    paths: ["foundation"],
  });
  assert.equal(shape.ok, true, "3 args passes shape gate");
}

{
  const thin =
    '{"science_action":{"arguments":[{"body":"只有一段策略"}]}}';
  assert.equal(rawNarrativeHasDuplicateBodyKeys(thin), false);
  const shape = validateNarrativeShape({
    raw: thin,
    argCounts: { science_action: 1 },
    paths: ["science_action"],
  });
  assert.equal(shape.ok, false, "1 arg rejected");
  if (!shape.ok) assert.match(shape.reason, /narrative_too_few_args:science_action:1/);
}

assert.equal(narrativeArgumentCountOk(2), true);
assert.equal(narrativeArgumentCountOk(1), false);

console.log("test-delivery-narrative-arg-gate: ok");
