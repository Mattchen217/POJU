/**
 * Cross-page primary Jaccard gate (write quality + assign backstop).
 * Run: pnpm exec tsx scripts/test-cross-page-primary-reuse.ts
 */
import assert from "node:assert/strict";
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

console.log("test-cross-page-primary-reuse: ok");
