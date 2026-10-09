/**
 * Peel-adjacent ⟦t:⟧ render as one soft cluster (本元·充沛).
 *
 *   pnpm exec tsx scripts/test-peel-term-cluster.ts
 */
import assert from "node:assert/strict";
import {
  joinPeelSoftLabels,
  PEEL_SOFT_JOIN,
  isPeelClusterGap,
} from "@/lib/poju/peel-term-cluster";
import { renderDeliveryEvidenceMarkedHtml } from "@/lib/poju/delivery-marked-html";
import { termOf } from "@/lib/glossary/pojulife-terms";

{
  assert.equal(isPeelClusterGap(""), true);
  assert.equal(isPeelClusterGap(" "), true);
  assert.equal(isPeelClusterGap("这时"), false);
  assert.equal(isPeelClusterGap("，"), false);
}

{
  const soft = joinPeelSoftLabels([
    termOf("day_master", "zh")!,
    termOf("strong_self", "zh")!,
  ]);
  assert.equal(soft, `本元${PEEL_SOFT_JOIN}充沛`);
}

{
  const src =
    "⟦t:day_master|⟧⟦t:strong_self|⟧这时压力又上来⟦t:class_bi_jie|⟧⟦t:unfavorable_element|⟧这时又多了一层压力";
  const html = renderDeliveryEvidenceMarkedHtml(src, "zh");
  assert.ok(html.includes("本元·充沛"), html);
  assert.ok(
    html.includes("竞合·耗元") || html.includes("·"),
    `expected bi_jie+unfavorable cluster: ${html}`,
  );
  // One term-mark for the first peel pair — not two back-to-back gold spans with empty gap.
  const goldSpans = html.match(/class="term-mark /g) ?? [];
  assert.ok(
    goldSpans.length >= 2,
    `expected ≥2 clustered marks, got ${goldSpans.length}: ${html}`,
  );
  assert.ok(
    !html.includes("</span></span>⟦") && !/term-mark[^>]*>[^<]*<\/span><\/span><span class="term-mark/.test(
      html.replace(/\s+/g, ""),
    ),
    // Adjacent gold with zero prose between first pair must be one span containing ·
    "adjacent peel should not render as two separate gold words without join",
  );
  // Stronger: first soft visible string is joined.
  assert.match(html, /本元·充沛/);
  // Vernacular between clusters stays.
  assert.ok(html.includes("这时压力又上来"), html);
}

{
  // Soft between marks breaks the cluster.
  const src =
    "⟦t:day_master|⟧与⟦t:strong_self|⟧这时";
  const html = renderDeliveryEvidenceMarkedHtml(src, "zh");
  assert.ok(html.includes("本元"), html);
  assert.ok(html.includes("充沛"), html);
  assert.ok(!html.includes("本元·充沛"), html);
}

console.log("test-peel-term-cluster: ok");
