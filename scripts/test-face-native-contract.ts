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
  assert.ok(schema.segments.length >= 2, `${id} has segments`);
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

assert.equal(DECISION_PAGE_SCHEMAS["03"].title, "本报告使用的术语");

// Sample filled Face01 v2 passes gate + argument bodies
const face01 = {
  page: "01" as const,
  face: "01" as const,
  schema_version: "face01-v2" as const,
  page_title: "The call",
  page_subtitle: "",
  core_judgment: {
    text: "Hold the line remotely this quarter while cash runway stays stable.",
    claim_ids: ["claim_core"],
  },
  why_this_path: [
    {
      text: "Cash runway supports a staged move.",
      claim_ids: ["claim_core"],
      evidence_ids: ["ev_1"],
      target_page: "02" as const,
      target_evidence_ids: ["ev_1"],
    },
  ],
  recommendation_conditions: [
    {
      condition: "Cash runway stays above 6 months.",
      status: "satisfied" as const,
      source_ids: ["fact_cash"],
    },
    {
      condition: "Partner terms remain unknown.",
      status: "unconfirmed" as const,
      source_ids: ["fact_partner"],
    },
  ],
  not_recommended: [
    {
      option: "Resign into a cold market.",
      reason: "Irreversible cash burn before demand is proven.",
      cost_or_conflict: "High option cost.",
      claim_ids: ["claim_core"],
      evidence_ids: ["ev_1"],
    },
  ],
  applicability_boundary: {
    current_basis: ["Confirmed runway and staged pacing."],
    invalidation_conditions: ["Runway drops below four months."],
    page02_evidence_ids: ["ev_1"],
    page08_review_refs: [],
  },
};
assert.ok(facePageSchema("01").safeParse(face01).success);
assert.ok(gateFaceFormat({ key: "01", page_schema: face01 }).passed);
assert.ok(pageSchemaToArgumentBodies(face01 as never).length >= 4);

const legacy = { ...face01, primary: { name: "x" }, backup: { name: "y" } };
assert.equal(
  gateFaceFormat({ key: "01", page_schema: legacy }).failed_rule,
  "gate_legacy_primary_backup",
);

const face03 = {
  page: "03" as const,
  face: "03" as const,
  kind: "glossary_appendix" as const,
  page_title: "Terms used",
  reading_note: "Soft labels only; meanings follow evidence context.",
  term_ids: ["day_master"],
};
assert.ok(facePageSchema("03").safeParse(face03).success);

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
