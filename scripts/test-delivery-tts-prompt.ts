/**
 * Smoke: delivery TTS director prompt locale coverage.
 * Run: pnpm exec tsx scripts/test-delivery-tts-prompt.ts
 */

import {
  buildDeliveryTtsDirectorPrompt,
  buildDeliveryTtsSpeechInput,
  resolveDeliveryTtsLang,
} from "../lib/tts/delivery-tts-prompt";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const locales = ["zh-CN", "en", "fr", "es", "de"] as const;
for (const loc of locales) {
  const dir = buildDeliveryTtsDirectorPrompt(loc);
  assert(dir.length > 40, `${loc} director too short`);
  const input = buildDeliveryTtsSpeechInput("Hello body.\n\nSecond paragraph.", loc);
  assert(input.includes("---REPORT---"), `${loc} missing separator`);
  assert(input.includes("Second paragraph"), `${loc} body missing`);
  assert(resolveDeliveryTtsLang(loc).length === 2, `${loc} lang`);
}

assert(buildDeliveryTtsDirectorPrompt("zh").includes("正式"), "zh formal");
assert(buildDeliveryTtsDirectorPrompt("en").toLowerCase().includes("mentor"), "en mentor");
assert(!buildDeliveryTtsSpeechInput("body only", "en").startsWith("body"), "director prefixes");

console.log("ok · delivery-tts-prompt");
