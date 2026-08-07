/**
 * Smoke: delivery narration units + speak queue (title+lead in one clip).
 * Run: pnpm exec tsx scripts/test-delivery-narration-units.ts
 */

import {
  buildDeliveryTtsSpeakQueue,
  extractDeliveryNarrationUnits,
  narrationUnitsPlainCorpus,
  packNarrationUtterances,
} from "../lib/poju/delivery-narration-units";
import { DELIVERY_TTS_PAUSE_AFTER_BODY_SEC } from "../lib/tts/delivery-tts-constants";
import { silencePcmBytes } from "../lib/tts/pcm-wav";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const sample = [
  "# 封面",
  "",
  "## 第一章",
  "",
  "### 你并不缺方向，缺的是把方向跑通的持续力",
  "",
  "这几年你心里其实一直有清晰的方向。真正卡住的是持续力。",
  "",
  "### 第二小标题",
  "",
  "正文第二段内容。",
].join("\n");

const units = extractDeliveryNarrationUnits(sample, "zh-CN");
assert(units.length >= 1, "expected at least one unit");

const queue = buildDeliveryTtsSpeakQueue(units, undefined, { shortFirstClip: true });
const speeches = queue.filter((p) => p.kind === "speech");
assert(speeches.length >= 1, "expected speech clips");
assert(speeches[0]!.kind === "speech", "first is speech");
assert(
  speeches[0]!.kind === "speech" && speeches[0]!.text.includes("你并不缺方向"),
  "first clip includes title",
);
assert(
  speeches[0]!.kind === "speech" && speeches[0]!.text.includes("这几年"),
  "first clip includes lead body (same Kokoro call — natural pause)",
);
assert(
  speeches[0]!.kind === "speech" && !/\n\n/.test(speeches[0]!.text),
  "opener uses 。 join, not blank-line seam",
);

let sawBodyPause = false;
for (const p of queue) {
  if (p.kind === "silence" && p.seconds === DELIVERY_TTS_PAUSE_AFTER_BODY_SEC) {
    sawBodyPause = true;
  }
}
if (units.length > 1) assert(sawBodyPause, "missing pause between sections");

const packed = packNarrationUtterances("甲".repeat(400), 150);
assert(packed.length >= 2, "long body splits");

const quiet = silencePcmBytes(1, 24_000, 1);
assert(quiet.byteLength === 24_000 * 2, "1s silence bytes");

assert(narrationUnitsPlainCorpus(units).includes(units[0]!.title), "corpus has title");

console.log("ok · delivery-narration-units", {
  units: units.length,
  speechClips: speeches.length,
  firstPreview: speeches[0]!.kind === "speech" ? speeches[0]!.text.slice(0, 60) : "?",
});
