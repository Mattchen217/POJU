/**
 * Cross-page primary Jaccard gate (write quality + assign backstop + fill sanitize).
 * Run: pnpm exec tsx scripts/test-cross-page-primary-reuse.ts
 */
import assert from "node:assert/strict";
import { assessUnitAnchorQuality } from "../lib/llm/pro/delivery/page-schema/anchor-quality";
import {
  CROSS_PAGE_PRIMARY_ANCHOR_JACCARD,
  assessCrossPagePrimaryAnchorReuse,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-quality";

assert.equal(CROSS_PAGE_PRIMARY_ANCHOR_JACCARD, 0.72);

{
  const prior = [
    "日主乙庚相合合化金",
    "比肩",
    "正财",
    "六合",
    "巳寅相刑",
  ];
  const echo = [
    "日主乙庚相合合化金",
    "比肩",
    "正财",
    "六合",
    "伤官",
    "巳寅相刑",
  ];
  const bad = assessCrossPagePrimaryAnchorReuse({
    page_primaries: echo,
    prior_chart_anchors: prior,
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.reason, "deep_evidence_cross_page_anchor_reuse");
    assert.ok(
      bad.notes.some((n) => n.includes("cross_page_primary_jaccard:0.83")),
      String(bad.notes),
    );
    assert.ok(bad.notes.includes("deep_evidence_cross_page_no_new_category"));
  }
}

{
  const prior = ["比肩", "正财", "六合", "巳寅相刑", "日主乙庚相合合化金"];
  const diversified = [
    "伤官",
    "食神",
    "用神水",
    "丁酉",
    "丙午",
    "正官",
  ];
  const ok = assessCrossPagePrimaryAnchorReuse({
    page_primaries: diversified,
    prior_chart_anchors: prior,
  });
  assert.equal(ok.ok, true, String(ok));
}

{
  // Fill sanitize must share write Jaccard SSOT — not "every unit ⊆ prior".
  const priorWide = [
    "日主乙庚相合合化金",
    "比肩",
    "正财",
    "六合",
    "巳寅相刑",
    "食神",
    "伤官",
    "正官",
    "正印",
    "七杀",
    "用神水",
    "丁酉",
    "土",
    "水",
    "劫财",
  ];
  // P6 write#18-like: all unit anchors ⊆ prior, but page Jaccard vs prior ≈ 0.4
  const soft = assessUnitAnchorQuality({
    pageKey: "signals_close",
    units: [
      { path: "identity_shift", anchors: ["土"] },
      { path: "tonight", anchors: ["水"] },
      { path: "day7_micro_actions[0]", anchors: ["劫财"] },
      { path: "day7_micro_actions[1]", anchors: ["比肩"] },
      { path: "day7_micro_actions[2]", anchors: ["正财"] },
      { path: "day7_micro_actions[3]", anchors: ["六合"] },
    ],
    priorAnchors: priorWide,
  });
  assert.ok(
    soft.notes.some((n) => n.includes("unit_anchors_cross_page_echo")),
    "echo notes still recorded",
  );
  assert.equal(
    soft.structuralFail,
    false,
    "must not fail when Jaccard < 0.72 (write already passed)",
  );

  const hard = assessUnitAnchorQuality({
    pageKey: "signals_close",
    units: [
      { path: "a", anchors: ["日主乙庚相合合化金"] },
      { path: "b", anchors: ["比肩"] },
      { path: "c", anchors: ["正财"] },
      { path: "d", anchors: ["六合"] },
      { path: "e", anchors: ["巳寅相刑"] },
      { path: "f", anchors: ["伤官"] },
    ],
    priorAnchors: [
      "日主乙庚相合合化金",
      "比肩",
      "正财",
      "六合",
      "巳寅相刑",
    ],
  });
  assert.equal(hard.structuralFail, true);
  assert.equal(hard.reason, "cross_page_primary_anchor_reuse");
}

console.log("test-cross-page-primary-reuse: ok");
