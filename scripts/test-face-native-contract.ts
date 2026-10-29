/**
 * Face-native contract self-check (dev, ≠ batch smoke).
 * Run: pnpm exec tsx scripts/test-face-native-contract.ts
 */
import assert from "node:assert/strict";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import {
  FACE_SEGMENT_FIELDS,
  faceFillShapeSkeleton,
  faceJsonHasLegacyPrimaryBackup,
  facePageSchema,
} from "@/lib/llm/pro/delivery/page-schema/face-types";
import { buildFacePromptPair } from "@/lib/llm/pro/delivery/page-schema/face-prompt";
import { FACE_DELIVERY_PAGE_KEYS } from "@/lib/llm/pro/delivery/segment-key-alias";
import { LAB_STEP_DEFS_V3 } from "@/lib/llm/pro/delivery/lab/types-v3";
import { pageSchemaToArgumentBodies } from "@/lib/llm/pro/delivery/page-schema/render";
import { gateFaceFormat } from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";

for (const id of DECISION_PAGE_IDS) {
  const schema = DECISION_PAGE_SCHEMAS[id];
  assert.ok(schema.segments.length >= 3, `${id} has segments`);
  assert.equal(FACE_SEGMENT_FIELDS[id].length, schema.segments.length, `${id} field count`);
  const shape = faceFillShapeSkeleton(id);
  assert.equal(shape.page, id);
  assert.equal(shape.face, id);
  assert.equal(faceJsonHasLegacyPrimaryBackup(shape), false, `${id} skeleton no primary`);

  const { system, user } = buildFacePromptPair({
    faceId: id,
    locale: "en",
    slice: { pageId: id, dump: { keys: ["demo"] } },
  });
  assert.match(system, /禁止 primary\/backup/);
  assert.match(system, new RegExp(`Face ${id}`));
  assert.match(user, /PageFeedMatrix|切片/);
  assert.match(system, new RegExp(`dualTrack=${schema.dualTrack}`));
}

// Sample filled 01 passes gate + argument bodies
const face01 = {
  page: "01" as const,
  face: "01" as const,
  page_title: "The call",
  page_subtitle: "",
  main_recommendation: "Hold the line remotely this quarter.",
  conditions: "Only if cash runway stays above 6 months.",
  not_choosing: "Do not resign into a cold market.",
  evidence_pointer: "See face 02 for why this holds.",
};
assert.ok(facePageSchema("01").safeParse(face01).success);
assert.ok(gateFaceFormat({ key: "01", page_schema: face01 }).passed);
assert.ok(pageSchemaToArgumentBodies(face01 as never).length >= 4);

const legacy = { ...face01, primary: { name: "x" }, backup: { name: "y" } };
assert.equal(
  gateFaceFormat({ key: "01", page_schema: legacy }).failed_rule,
  "gate_legacy_primary_backup",
);

for (const k of FACE_DELIVERY_PAGE_KEYS) {
  assert.ok(
    LAB_STEP_DEFS_V3.some((d) => d.page === k && d.kind === "content_body"),
    `lab has body step for ${k}`,
  );
}
assert.ok(
  !LAB_STEP_DEFS_V3.some((d) => d.page === "decision_brief"),
  "lab no longer schedules decision_brief",
);

console.log("ok face-native contract self-check");
