/**
 * Smoke: zh evidence locale maps cover full enums; no EN leftovers.
 */
import assert from "node:assert/strict";
import {
  DAYUN_STANCE_EN_TO_ZH,
  FIVE_ELEMENT_EN_TO_ZH,
  TOPIC_POLARITY_EN_TO_ZH,
  findForbiddenEnglishTokensInZhEvidence,
  localizeChartTokenForZh,
} from "@/lib/llm/pro/delivery/locale-evidence-tokens";
import { encodeConnectiveEvidenceToTerms } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { expandAnchorLookupVariants } from "@/lib/calculations/build-calc-slice-from-plan";

// Full FiveElement
for (const [en, zh] of Object.entries(FIVE_ELEMENT_EN_TO_ZH)) {
  const sample = `锚元·${en}〔favor〕`;
  const loc = localizeChartTokenForZh(sample);
  assert.match(loc, new RegExp(zh));
  assert.doesNotMatch(loc, new RegExp(`\\b${en}\\b`, "i"));
  assert.match(loc, /〔补给〕/);
}

// Full TopicTypedPolarity
for (const [en, zh] of Object.entries(TOPIC_POLARITY_EN_TO_ZH)) {
  const loc = localizeChartTokenForZh(`用神·water〔${en}〕`);
  assert.match(loc, new RegExp(`〔${zh}〕`));
  assert.match(loc, /水/);
}

// DayunStance extras (favor shares key with topic → maps to 补给; test distinct keys)
assert.equal(localizeChartTokenForZh("纪元〔caution〕"), "纪元〔慎行〕");
assert.equal(localizeChartTokenForZh("纪元〔mixed〕"), "纪元〔交织〕");
assert.equal(localizeChartTokenForZh("纪元〔unknown〕"), "纪元〔未知〕");
void DAYUN_STANCE_EN_TO_ZH;

{
  const variants = expandAnchorLookupVariants("用神·water favor");
  assert.ok(variants.some((v) => v.includes("水") || v.includes("补给") || v.includes("用神")));
}

{
  const encoded = encodeConnectiveEvidenceToTerms(
    "本案⟦w:用神·water〔favor〕⟧说明补给方向。",
    "zh",
  );
  const hits = findForbiddenEnglishTokensInZhEvidence(encoded);
  assert.deepEqual(hits, [], `EN leftovers: ${hits.join(",")}`);
  assert.match(encoded, /水/);
  assert.match(encoded, /补给/);
}

// Han + EN glue (锚元water / 耗元fire) — full enum
for (const [en, zh] of Object.entries(FIVE_ELEMENT_EN_TO_ZH)) {
  const glued = localizeChartTokenForZh(`锚元${en}`);
  assert.equal(glued, `锚元${zh}`);
  const afterMark = localizeChartTokenForZh(`⟧${en}缓冲`);
  assert.match(afterMark, new RegExp(zh));
  assert.doesNotMatch(afterMark, new RegExp(en, "i"));
}
assert.equal(localizeChartTokenForZh("耗元fire"), "耗元火");
assert.equal(localizeChartTokenForZh("锚元water"), "锚元水");

{
  const encoded = encodeConnectiveEvidenceToTerms(
    "过旺⟦w:忌神·fire〔drain〕⟧fire需缓冲。",
    "zh",
  );
  const hits = findForbiddenEnglishTokensInZhEvidence(encoded);
  assert.deepEqual(hits, [], `glue EN leftovers: ${hits.join(",")}`);
}

// 气候交织 must encode to closed soft, not 【】
{
  const encoded = encodeConnectiveEvidenceToTerms(
    "当下⟦w:气候交织⟧放大紧迫感。",
    "zh",
  );
  assert.ok(!encoded.includes("【气候交织】"), encoded);
  assert.ok(!encoded.includes("【"), encoded);
  assert.match(encoded, /⟦t:year\|/);
}

{
  const hits = findForbiddenEnglishTokensInZhEvidence("POJU 与 Bazi 可保留");
  assert.deepEqual(hits, []);
}

console.log("test-delivery-zh-evidence-no-en-tokens: ok");
