/**
 * Opening near-duplicate response detector (guards identical-bubble failure).
 *
 *   pnpm exec tsx scripts/test-opening-duplicate-response.ts
 */
import {
  isNearDuplicateOpeningResponse,
  normalizeOpeningResponseForDupCheck,
} from "@/lib/llm/phases/opening-phase-v6";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const prev = `你把顺序排对了——不是四面同时救，是先撑住承重墙。凌晨三四点醒、白天脑子像灌水泥，在这种状态下谈婚姻修复或职场反击，等于让一辆没油的车跑高速。你先要的不是「更努力」，是「能正常运转」。

那针对「把精力底盘拉起来」这个方向，你心里有没有一个具体的、你觉得自己能先够到的状态？比如——睡整觉不再三四点醒？白天脑子能清醒地撑完一天？还是先让体检指标别再恶化？`;

const same = prev;
const nearSame = prev.replace(/「更努力」/g, "更努力").replace(/\n\n/g, "\n");
const different = `睡眠这块你已经钉死了——要的是一觉到天亮，而不是再谈「精力」这种空口号。

在这之前，你有没有试过什么办法改善睡眠？哪怕无效的也算。`;

assert("exact copy is duplicate", isNearDuplicateOpeningResponse(prev, same));
assert("near copy is duplicate", isNearDuplicateOpeningResponse(prev, nearSame));
assert("new dig is not duplicate", !isNearDuplicateOpeningResponse(prev, different));
assert("empty not duplicate", !isNearDuplicateOpeningResponse(prev, ""));
assert(
  "normalize strips punctuation",
  normalizeOpeningResponseForDupCheck("A——B？") === normalizeOpeningResponseForDupCheck("A B"),
);

if (failures.length) {
  console.error(`FAILED (${failures.length}):`, failures.join(", "));
  process.exit(1);
}
console.log("\nAll opening duplicate-response checks passed.\n");
