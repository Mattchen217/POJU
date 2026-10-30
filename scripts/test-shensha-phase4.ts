/**
 * Phase 4 — shensha disposition, fail-closed resolve, no zh_src render.
 *
 *   pnpm test:shensha-phase4
 */

import {
  buildShenshaDiffAudit,
  isShenshaInternalRedline,
  resolveShenshaDisposition,
  SHENSHA_JSON_ID_DISPOSITION,
} from "@/lib/glossary/shensha-disposition";
import { CLOSED_SHEN_SHA } from "@/lib/glossary/term-closed-set";
import { stripRedlineShenshaFromStructured } from "@/lib/glossary/strip-redline-shensha";
import {
  resolveShensha,
  resolveShenshaList,
  resolveShenshaSoftLabels,
  stripRedlineShenshaFromText,
  textContainsRedlineShensha,
  toShenshaId,
} from "@/lib/poju/shensha";
import RAW from "@/lib/poju/data/shensha-i18n-map.json";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

function main() {
  console.log("\n========== test-shensha-phase4 ==========\n");

  const meta = (RAW as { meta?: { render_pattern?: string } }).meta;
  assert(
    meta?.render_pattern?.includes("NEVER concatenate zh_src"),
    "render_pattern forbids zh_src concat",
  );

  const audit = buildShenshaDiffAudit();
  assert(audit.length > 50, `diff audit rows (${audit.length})`);
  const jsonIds = Object.keys(SHENSHA_JSON_ID_DISPOSITION);
  assert(jsonIds.length === 51, `51 JSON ids dispositioned (got ${jsonIds.length})`);

  for (const han of CLOSED_SHEN_SHA) {
    const d = resolveShenshaDisposition(han);
    assert(d.status === "public_glossary", `closed ${han} public`);
    const v = resolveShensha(han, "zh");
    assert(!v.blocked && v.label.trim().length > 0, `${han} has soft label`);
    assert(v.zh_src === "", `${han} zh_src empty for UI`);
    assert(v.label !== han, `${han} label !== traditional`);
  }

  // 飞刃 / 羊刃 → same fei_ren
  const fei = resolveShensha("飞刃", "zh");
  const yang = resolveShensha("羊刃", "zh");
  assert(fei.label === yang.label && fei.label === "锋芒", "飞刃/羊刃 → 锋芒");
  assert(
    resolveShenshaDisposition("execution_edge").status === "public_glossary" &&
      resolveShenshaDisposition("tactical_impulse").status === "public_glossary",
    "dual JSON ids both public→fei_ren",
  );

  // 亡神: no death prophecy in gloss
  const wang = resolveShensha("亡神", "zh");
  assert(wang.label === "神散", "亡神 soft 神散");
  assert(!/死|亡故|丧事/.test(wang.gloss), "亡神 gloss no death prophecy");

  // Redline fail-closed
  assert(isShenshaInternalRedline("空亡"), "空亡 redline");
  assert(isShenshaInternalRedline("十恶大败"), "十恶大败 redline");
  const voidV = resolveShensha("空亡", "zh");
  assert(voidV.blocked === true && voidV.label === "", "空亡 blocked empty label");
  assert(voidV.label !== "空亡", "空亡 no raw fallback");
  assert(resolveShenshaSoftLabels("空亡", "zh") === null, "空亡 soft labels null");

  // Unknown: no raw fallback
  const unk = resolveShensha("完全不存在的煞名XYZ", "zh");
  assert(unk.blocked === true && unk.label === "", "unknown empty label");
  assert(unk.id === "unknown", "unknown id");
  assert(!unk.label.includes("XYZ"), "unknown no raw token in label");

  // List omits redline
  const list = resolveShenshaList(["天乙贵人", "空亡", "驿马", "童子煞"], "zh");
  assert(
    list.every((v) => v.label && !v.blocked) &&
      list.length === 2 &&
      !list.some((v) => v.zh_src),
    "list drops redline and zh_src",
  );

  // Structured strip before prompt
  const structured = {
    pillars_detail: {
      year: { shen_sha: ["天乙贵人", "空亡", "驿马"] },
      month: { shen_sha: ["童子煞", "文昌"] },
      day: { shen_sha: [] },
      hour: { shen_sha: ["十恶大败"] },
    },
  } as never;
  const cleaned = stripRedlineShenshaFromStructured(structured);
  assert(
    JSON.stringify(cleaned).includes("天乙贵人") &&
      JSON.stringify(cleaned).includes("驿马") &&
      JSON.stringify(cleaned).includes("文昌"),
    "strip keeps public",
  );
  assert(
    !JSON.stringify(cleaned).includes("空亡") &&
      !JSON.stringify(cleaned).includes("童子煞") &&
      !JSON.stringify(cleaned).includes("十恶大败"),
    "strip removes redline",
  );

  // Final text pass
  const dirty = "今日注意空亡与童子煞，天乙贵人仍可用。";
  const scrubbed = stripRedlineShenshaFromText(dirty);
  assert(!scrubbed.includes("空亡") && !scrubbed.includes("童子煞"), "text strip redline");
  assert(scrubbed.includes("天乙贵人") || scrubbed.includes("仍可用"), "text keeps non-redline context");
  assert(textContainsRedlineShensha(dirty).includes("空亡"), "detect redline in text");
  assert(textContainsRedlineShensha(scrubbed).length === 0, "scrubbed clean");

  // Short aliases still resolve
  assert(toShenshaId("天德") != null, "天德 short → id");
  assert(resolveShensha("天德", "zh").label.length > 0, "天德 soft label");

  console.log("");
  if (failed) {
    console.error(`${failed} failure(s) — test-shensha-phase4 FAILED\n`);
    process.exit(1);
  }
  console.log("All Phase 4 shensha tests passed.\n");
}

main();
