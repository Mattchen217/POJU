/**
 * Smoke: delivery narration units + speak queue (title → 1s → body → 2s).
 * Run: pnpm exec tsx scripts/test-delivery-narration-units.ts
 */

import {
  buildDeliveryTtsSpeakQueue,
  extractDeliveryNarrationUnits,
  narrationUnitsPlainCorpus,
  packNarrationUtterances,
} from "../lib/poju/delivery-narration-units";
import {
  DELIVERY_TTS_PAUSE_AFTER_BODY_SEC,
  DELIVERY_TTS_PAUSE_AFTER_TITLE_SEC,
} from "../lib/tts/delivery-tts-constants";
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
assert(units.some((u) => u.title.includes("持续力") || u.title.includes("方向")), "title present");

const queue = buildDeliveryTtsSpeakQueue(units);
const firstSpeech = queue.find((p) => p.kind === "speech");
assert(!!firstSpeech && firstSpeech.kind === "speech" && firstSpeech.role === "title", "queue starts with title");

let sawTitlePause = false;
let sawBodyPause = false;
for (let i = 0; i < queue.length - 1; i++) {
  const a = queue[i]!;
  const b = queue[i + 1]!;
  if (a.kind === "speech" && a.role === "title" && b.kind === "silence") {
    assert(b.seconds === DELIVERY_TTS_PAUSE_AFTER_TITLE_SEC, "title pause 1s");
    sawTitlePause = true;
  }
  if (a.kind === "silence" && a.seconds === DELIVERY_TTS_PAUSE_AFTER_BODY_SEC) {
    sawBodyPause = true;
  }
}
assert(sawTitlePause, "missing title→1s pause");
if (units.length > 1) assert(sawBodyPause, "missing body→2s pause between sections");

const packed = packNarrationUtterances("甲".repeat(400), 150);
assert(packed.length >= 2, "long body splits");
assert(packed.every((p) => p.length <= 150), "pack respects max");

const quiet = silencePcmBytes(1, 24_000, 1);
assert(quiet.byteLength === 24_000 * 2, "1s silence bytes");

assert(narrationUnitsPlainCorpus(units).includes(units[0]!.title), "corpus has title");

console.log("ok · delivery-narration-units", {
  units: units.length,
  queue: queue.length,
  corpusChars: narrationUnitsPlainCorpus(units).length,
});
