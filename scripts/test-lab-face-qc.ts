/**
 * Lab face QC contract — step table, topic gate, slice feed, companion 01+05.
 *   pnpm exec tsx scripts/test-lab-face-qc.ts
 */
import assert from "node:assert/strict";

import {
  LAB_STEP_DEFS_V3,
  initLabStepsV3,
  labLooksLikeLegacyTenPaper,
} from "../lib/llm/pro/delivery/lab/types-v3";
import {
  buildLabFaceSliceFeed,
  companionFaceBriefReady,
  evaluateTopicGate,
  FACE_QUALITY_CHECK_IDS,
} from "../lib/llm/pro/delivery/lab/lab-face-qc";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";
import { extractCompanionBrief } from "../lib/companion/extract-companion-brief";
import { gateFaceFormat } from "../lib/llm/pro/delivery/pipeline-v3/gate-face-format";
import type { DeliveryPageData } from "../lib/llm/pro/delivery/page-schema/types";

function baseLab(question: string): DeliveryLabSession {
  const now = Date.now();
  return {
    version: 1,
    lab_id: "lab_face_qc",
    created_at: now,
    updated_at: now,
    ops_user: "test",
    source: {
      locale: "zh",
      original_question: question,
      session_id: "lab-face-qc",
      base_analysis: {},
    },
    pipeline: "decision_shelf",
    cursor_index: 0,
    steps: initLabStepsV3(),
    artifacts: {
      by_page: {},
      prealloc: {
        chart_fact_pack: "日主：甲木\n用神：水\n喜神：木\n忌神：土\n当前大运：壬水",
      },
    },
    approved_order: [],
    mode: "delivery_only",
  };
}

/** Step table shape */
assert.ok(LAB_STEP_DEFS_V3.some((d) => d.step_key === "07.gate_topic"));
assert.ok(LAB_STEP_DEFS_V3.some((d) => d.step_key === "03.slice"));
assert.ok(LAB_STEP_DEFS_V3.some((d) => d.kind === "topic_gate"));
assert.ok(LAB_STEP_DEFS_V3.some((d) => d.kind === "face_slice"));
assert.ok(
  !LAB_STEP_DEFS_V3.some((d) => d.step_key === "03.content.judgment"),
  "03 no judgment",
);
assert.ok(
  LAB_STEP_DEFS_V3.filter((d) => d.topic_gated).every((d) =>
    d.step_key.startsWith("07."),
  ),
  "only 07 chain is topic_gated",
);
assert.ok(FACE_QUALITY_CHECK_IDS.includes("collapses_without_slice"));

/** Topic gate */
const reloc = evaluateTopicGate(baseLab("想迁移换城工作"));
assert.equal(reloc.applies, true, reloc.reason);
assert.equal(reloc.unlock_07_chain, true);

const career = evaluateTopicGate(baseLab("今年事业怎么走"));
assert.equal(career.applies, false, career.reason);

/** Slice feed for 03 */
const lab03 = baseLab("附录检视");
const slice03 = buildLabFaceSliceFeed(lab03, "03");
assert.ok(slice03, "03 slice feed");
assert.match(slice03!.user_feed, /sliceForPage\("03"\)|本页切片/);
assert.match(slice03!.user_feed, /sliceStaysInAllowlist/);
assert.equal(typeof slice03!.zfpOmitted, "boolean");

const slice01 = buildLabFaceSliceFeed(lab03, "01");
assert.ok(slice01?.allowlist_ok, "01 allowlist");

/** Legacy ten-paper detect */
assert.equal(labLooksLikeLegacyTenPaper(baseLab("x")), false);
assert.equal(
  labLooksLikeLegacyTenPaper({
    steps: {
      "decision_brief.content.body": {},
      "personal_decision_patterns.content.judgment": {},
    },
  }),
  true,
);

/** Companion Brief from Face 01+05 */
const face01 = {
  page: "01",
  face: "01",
  page_title: "断语",
  page_subtitle: "",
  main_recommendation: "远程守线一季",
  conditions: "现金跑道 ≥ 6 个月",
  not_choosing: "不裸辞冷市场",
  evidence_pointer: "见 02",
} as unknown as DeliveryPageData;
const face05 = {
  page: "05",
  face: "05",
  page_title: "路径",
  page_subtitle: "",
  paths: ["远程续约", "同城转岗", "缓换城"],
  switch_or_stop: "跑道不足则停止扩张",
} as unknown as DeliveryPageData;

const brief = extractCompanionBrief({
  fullText: "",
  locale: "zh",
  originalQuestion: "要不要换城？",
  pageSchemas: { "01": face01, "05": face05 },
});
assert.ok(brief.primary.claim.includes("远程守线"));
assert.ok(brief.backup.claim.length > 0);
assert.doesNotMatch(brief.primary.name, /主辅/);

const sealedLab = baseLab("换城");
sealedLab.artifacts.by_page = {
  "01": { page_schema: face01 },
  "05": { page_schema: face05 },
};
assert.equal(companionFaceBriefReady(sealedLab), true);

assert.ok(gateFaceFormat({ key: "01", page_schema: face01 }).passed);
assert.equal(
  gateFaceFormat({
    key: "01",
    page_schema: { ...face01, primary: { name: "x" } },
  }).failed_rule,
  "gate_legacy_primary_backup",
);

console.log("ok · lab face QC", {
  steps: LAB_STEP_DEFS_V3.length,
  topic_reloc: reloc.topic,
  zfpOmitted: slice03!.zfpOmitted,
  brief_primary: brief.primary.name.slice(0, 24),
});
