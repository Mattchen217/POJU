/**
 * Smoke: 供源/润德 are distinct concepts with readable boundaries.
 */
import assert from "node:assert/strict";
import { VERNACULAR_MAPPING_ROWS } from "@/lib/glossary/vernacular-mapping-ssot";
import { pojuTermBySlug } from "@/lib/glossary/pojulife-terms";

const yin = VERNACULAR_MAPPING_ROWS.find((r) => r.id === "yin_restore");
const yue = VERNACULAR_MAPPING_ROWS.find((r) => r.id === "yue_de_climate");
assert.ok(yin, "yin_restore row");
assert.ok(yue, "yue_de_climate row");
assert.match(yin!.user_facing_zh, /资源补给|能力/);
assert.match(yue!.user_facing_zh, /关系气候|柔和着陆/);
assert.match(yin!.never, /润德|月德/);
assert.match(yue!.never, /供源|正印/);

const zhengYin = pojuTermBySlug("zheng_yin");
const yueDe = pojuTermBySlug("yue_de");
assert.equal(zhengYin?.term.zh, "供源");
assert.equal(yueDe?.term.zh, "润德");
assert.notEqual(zhengYin?.slug, yueDe?.slug);
assert.notEqual(yueDe?.term.en, "Favor", "EN must not collide with polarity favor");
assert.match(zhengYin?.definition.zh ?? "", /润德/);
assert.match(yueDe?.definition.zh ?? "", /供源/);

console.log("test-glossary-gongyuan-runde-boundary: ok");
console.log(
  "E2E reader check (manual): 资源补给 vs 关系气候 — confirm both appear with distinct angles in a live report.",
);
