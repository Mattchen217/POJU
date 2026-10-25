/**
 * Syncro task-language output locale smoke test.
 * Run: pnpm exec tsx scripts/test-syncro-output-language.ts
 */

import {
  getSyncroLanguageDirective,
  resolveSyncroOutputLocale,
} from "../lib/prompts/language-directive";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(resolveSyncroOutputLocale("zh", "Should I sign the contract tomorrow?") === "en", "en task");
assert(resolveSyncroOutputLocale("en", "明天下午两点签合同") === "zh", "zh task");
assert(
  resolveSyncroOutputLocale("zh", "明天 14:00 sign contract") === "zh",
  "mixed leans zh when han present",
);

const enDir = getSyncroLanguageDirective("zh", "Should I take this job tomorrow afternoon?");
assert(enDir.outputLanguage.includes("English"), "directive english");

const zhDir = getSyncroLanguageDirective("en", "明天下午要不要去签合同？");
assert(zhDir.outputLanguage.includes("Chinese"), "directive chinese");

console.log("test-syncro-output-language: OK");
