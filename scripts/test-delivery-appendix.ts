/**
 * P7 appendix: timing window + path snapshot + gold glossary copy.
 *
 *   pnpm exec tsx scripts/test-delivery-appendix.ts
 */
import assert from "node:assert/strict";

import {
  buildDeliveryAppendixMarkdown,
  formatAppendixTimingYears,
} from "@/lib/llm/pro/delivery/build-delivery-appendix";
import { deliveryAppendixCopy } from "@/lib/llm/pro/delivery/delivery-locale";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { P1Page } from "@/lib/llm/pro/delivery/page-schema/types";

const structured = {
  four_pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "壬子" },
  day_master: "戊",
  strength: "balanced",
  yong_shen: "水",
  xi_shen: ["金"],
  ji_shen: ["火"],
  pattern: "正印格",
  da_yun: [
    { start_age: 8, start_year: 2008, ganzhi: "丁卯" },
    { start_age: 18, start_year: 2018, ganzhi: "丙寅" },
    { start_age: 28, start_year: 2028, ganzhi: "乙丑" },
  ],
  data_availability: { da_yun: true },
} as unknown as ProfileStructured;

const p1 = {
  page: "direct_answer",
  page_title: "直答",
  page_subtitle: "副题",
  core_judgment: "宜走托底授权轨，暂缓亲自长驻海外。",
  primary: {
    role: "primary",
    name: "授权破局轨",
    core_logic: "logic",
    why: "why",
    when: "when",
    dims: { body: "mid", mind: "mid", field: "mid" },
  },
  backup: {
    role: "backup",
    name: "止损守成轨",
    core_logic: "logic",
    why: "why",
    when: "when",
    dims: { body: "low", mind: "low", field: "low" },
  },
  evidence: [],
} as unknown as P1Page;

const years = formatAppendixTimingYears(structured);
assert.equal(years, "2018–2027");

const md = buildDeliveryAppendixMarkdown({
  locale: "zh",
  base_analysis: { structured },
  page_schemas: { direct_answer: p1 },
});

assert.match(md, /时机窗口/);
assert.match(md, /约 2018–2027/);
assert.match(md, /本案路径摘要/);
assert.match(md, /授权破局轨/);
assert.match(md, /止损守成轨/);
assert.match(md, /排盘摘要/);
assert.doesNotMatch(md, /### 术语说明/);

const copy = deliveryAppendixCopy("zh");
assert.equal(copy.goldTerms, "本报告金字表");
assert.match(copy.evidenceGlossaryLead, /不是术语百科/);

const empty = buildDeliveryAppendixMarkdown({ locale: "en", base_analysis: null });
assert.match(empty, /No structured chart attached/);

console.log("ok delivery appendix timing + path + gold copy");
