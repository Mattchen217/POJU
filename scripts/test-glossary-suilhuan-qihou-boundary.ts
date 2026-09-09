/**
 * Smoke: 岁环 dual gloss unified + 气候交织 reuse key does not double-count year.
 */
import assert from "node:assert/strict";
import { pojuTermBySlug } from "@/lib/glossary/pojulife-terms";
import { BARE_GANZHI_MARKER } from "@/lib/glossary/term-closed-set";
import { CLOSED_SET_GLOSSARY_ENTRIES } from "@/lib/glossary/term-glossary-closed";
import {
  normalizePrimaryReuseKey,
  validatePrimaryReuseCap,
} from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";

const year = pojuTermBySlug("year");
assert.ok(year);
assert.equal(year!.term.zh, "岁环");
assert.equal(year!.definition.zh, BARE_GANZHI_MARKER.gloss.zh);
assert.match(year!.definition.zh, /不预测具体事件/);
assert.doesNotMatch(year!.definition.zh, /机遇与波动/);

const liuNian = CLOSED_SET_GLOSSARY_ENTRIES.find((e) => e.id === "流年");
assert.ok(liuNian);
assert.equal(liuNian!.soft.zh, "岁环");
assert.equal(liuNian!.gloss.zh, year!.definition.zh);

assert.equal(normalizePrimaryReuseKey("气候交织"), "year");
assert.equal(normalizePrimaryReuseKey("流年"), "year");
assert.equal(normalizePrimaryReuseKey("岁环"), "year");

// year primary + 气候交织 alias must not count as 2 toward cap=1
{
  const check = validatePrimaryReuseCap(["流年", "气候交织"], { cap: 1 });
  assert.equal(check.ok, false, "two year-keys still 2 uses under cap 1");
}
{
  // Same page showing both faces once each with cap 2 is ok (2 uses of year key)
  const check = validatePrimaryReuseCap(["流年", "气候交织"], { cap: 2 });
  assert.equal(check.ok, true);
}
{
  // Display-only: one year primary counted once even if surface string varies
  const check = validatePrimaryReuseCap(["流年"], { cap: 1 });
  assert.equal(check.ok, true);
}

console.log("test-glossary-suilhuan-qihou-boundary: ok");
