/**
 * Smoke: 生克完整句命中；单字五行点缀不误伤。
 */
import assert from "node:assert/strict";
import {
  ZH_WUXING_CLASH_LEAK_RE,
  ZH_WUXING_SHENGKE_SENTENCE_RE,
  detectPaymentAuditLeakViolations,
} from "@/lib/llm/compliance/audit-output";

// Positive: full 生克 sentences must hit
{
  const samples = [
    "水生木则你更容易在春季起势。",
    "金克木导致表达被压制。",
    "火 生 土 之后资源外泄。",
  ];
  for (const s of samples) {
    ZH_WUXING_SHENGKE_SENTENCE_RE.lastIndex = 0;
    assert.ok(ZH_WUXING_SHENGKE_SENTENCE_RE.test(s), `should hit: ${s}`);
    const v = detectPaymentAuditLeakViolations(s, "zh");
    assert.ok(
      v.some((x) => x.label === "payment_leak_wuxing_shengke_zh"),
      `audit should flag: ${s}`,
    );
  }
}

// Negative: single-char garnish must NOT hit shengke sentence re
{
  const garnish = [
    "耗元所对应的火土过旺让你容易焦躁。",
    "本案喜水，忌火，但只是点缀。",
    "木气稍旺，并不等于生克推演。",
  ];
  for (const s of garnish) {
    ZH_WUXING_SHENGKE_SENTENCE_RE.lastIndex = 0;
    assert.equal(ZH_WUXING_SHENGKE_SENTENCE_RE.test(s), false, `must not hit: ${s}`);
    const v = detectPaymentAuditLeakViolations(s, "zh");
    assert.equal(
      v.some((x) => x.label === "payment_leak_wuxing_shengke_zh"),
      false,
      `audit must not flag garnish: ${s}`,
    );
  }
}

void ZH_WUXING_CLASH_LEAK_RE;
console.log("test-compliance-wuxing-shengke-boundary: ok");
