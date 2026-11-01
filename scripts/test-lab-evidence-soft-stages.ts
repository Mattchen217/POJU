/**
 * Lab evidence_soft stages — TERMS-PIPELINE-SPEC-v1 code path assertions.
 * Ensures Delivery Lab can dump live bare → mark → locale_polish → soft.
 *
 * Uses closed-set terms already wired in autoMark (bazi 驿马/天德/月德).
 * Ziwei stars (紫微…) may still be incomplete on this branch — not this test's job.
 */
import assert from "node:assert/strict";
import {
  runEvidenceSoftCodePipeline,
  runEvidenceSoftGenerate,
} from "@/lib/llm/pro/delivery/pipeline-v3/evidence-soft";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const plan: DeepEvidencePlan = {
  page: "02",
  units: [
    {
      path: "why_cards[0]",
      chart_anchors: ["日柱"],
      evidence:
        "今天讨论驿马和天德贵人，还有月德，以及团队推进节奏。",
    },
  ],
};

async function main() {
  const zh = runEvidenceSoftCodePipeline({
    key: "02",
    plan,
    locale: "zh",
  });

  assert.ok(zh.stages.bare, "bare stage");
  assert.ok(zh.stages.mark, "mark stage");
  assert.ok(zh.stages.locale_polish, "locale_polish stage");
  assert.ok(zh.stages.soft, "soft stage");

  const bare0 = zh.stages.bare["02"]?.[0]?.evidence ?? "";
  const mark0 = zh.stages.mark["02"]?.[0]?.evidence ?? "";
  const polish0 = zh.stages.locale_polish["02"]?.[0]?.evidence ?? "";
  const soft0 = zh.stages.soft["02"]?.[0]?.evidence ?? "";

  assert.match(bare0, /驿马/, "bare keeps free traditional");
  assert.match(mark0, /⟦t:/, "mark adds glossary markers");
  assert.match(mark0, /yi_ma/, "mark has yi_ma id");
  assert.equal(polish0, mark0, "zh locale_polish is identity of mark");
  assert.ok(soft0.length > 0, "soft non-empty");
  assert.doesNotMatch(soft0, /⟦t:/, "soft is plain (no markers)");
  assert.doesNotMatch(soft0, /驿马/, "soft replaces 驿马");
  assert.match(soft0, /团队/, "soft keeps innocent prose");

  assert.equal(
    zh.marked["02"]?.[0]?.evidence,
    polish0,
    "art.marked stores marked (⟦t:⟧) for GlossaryText",
  );
  assert.ok(
    zh.notes.some((n) => n.includes("terms-pipeline-spec-v1")),
    "notes tag SPEC-v1",
  );

  const en = runEvidenceSoftCodePipeline({
    key: "02",
    plan,
    locale: "en",
  });
  const enMark = en.stages.mark["02"]?.[0]?.evidence ?? "";
  const enSoft = en.stages.soft["02"]?.[0]?.evidence ?? "";
  assert.match(enMark, /⟦t:/, "en mark has markers");
  assert.ok(enSoft.length > 0, "en soft non-empty");
  assert.doesNotMatch(enSoft, /驿马/, "en soft replaces 驿马");
  assert.ok(
    en.notes.some((n) => n.includes("ssot_soft_in_markers")),
    "non-zh notes ssot_soft_in_markers",
  );

  const gen = await runEvidenceSoftGenerate({
    key: "02",
    plan,
    locale: "zh",
  });
  assert.equal(gen.ok, true, "generate ok");
  if (!gen.ok) throw new Error("unreachable");
  assert.ok(gen.stages?.soft, "generate exposes stages");
  assert.equal(
    (gen.call_trace.parsed as { pipeline?: string } | undefined)?.pipeline,
    "terms-pipeline-spec-v1",
  );
  assert.ok(
    (gen.call_trace.parsed as { stages?: unknown } | undefined)?.stages,
    "call_trace.parsed.stages for Lab UI",
  );

  const empty = await runEvidenceSoftGenerate({
    key: "02",
    plan: {
      page: "02",
      units: [{ path: "x", chart_anchors: [], evidence: "  " }],
    },
    locale: "zh",
  });
  assert.equal(empty.ok, false, "empty evidence fails");

  console.log("PASS test-lab-evidence-soft-stages");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
