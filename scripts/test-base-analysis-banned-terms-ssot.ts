/**
 * Fix A/B — single banned-terms source + surgical repair (no full-regen-first).
 *
 *   pnpm exec tsx scripts/test-base-analysis-banned-terms-ssot.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  BANNED_TERMS_ZH,
  METAPHOR_BLACKLIST_ZH,
  buildForbiddenTermsPromptBlock,
  buildViolationRepairInstruction,
  isHardBannedTermLabel,
} from "@/lib/llm/compliance/banned-terms";
import { buildBaseAnalysisStreamPrompt } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { auditUserFacingBannedLeaks, auditMetaphorBlacklist } from "@/lib/llm/sanitize/compliance-terms";
import { isBaseAnalysisGateFailure } from "@/lib/base-analysis/delivery-gate";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, cond: unknown, detail?: string): void {
  if (!cond) {
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

function main() {
  console.log("\n========== SSOT banned-terms + surgical repair ==========\n");

  assert("banned-terms file exists", fs.existsSync(path.join(ROOT, "lib/llm/compliance/banned-terms.ts")));
  assert("日主 in BANNED_TERMS", BANNED_TERMS_ZH.includes("日主"));
  assert("引擎 in metaphor blacklist", (METAPHOR_BLACKLIST_ZH as readonly string[]).includes("引擎"));

  const block = buildForbiddenTermsPromptBlock("zh");
  assert("prompt block has 日主", block.includes("日主"));
  assert("prompt block has 引擎", block.includes("引擎"));
  assert("prompt block has soft map 日主", block.includes("核心特质"));

  const promptSrc = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert("prompt injects buildForbiddenTermsPromptBlock", promptSrc.includes("buildForbiddenTermsPromptBlock"));
  assert("prompt no hand-maintained USER_VISIBLE_BANS", !promptSrc.includes("BASE_ANALYSIS_USER_VISIBLE_BANS_ZH"));

  const gateSrc = read("lib/base-analysis/delivery-gate.ts");
  assert("gate uses isHardBannedTermLabel", gateSrc.includes("isHardBannedTermLabel"));
  assert("gate no hardcoded term:身弱 list", !gateSrc.includes('v.label === "term:身弱"'));

  const complianceSrc = read("lib/llm/sanitize/compliance-terms.ts");
  assert("compliance imports metaphor from SSOT", complianceSrc.includes("metaphorBlacklistForLocale"));
  assert("no local METAPHOR_BLACKLIST_ZH const", !complianceSrc.includes("const METAPHOR_BLACKLIST_ZH"));

  const streamSrc = read("lib/base-analysis/stream-llm-with-gate.ts");
  assert("stream uses repairViolationsOnly", streamSrc.includes("repairViolationsOnly"));
  assert("MAX_REPAIRS = 2", streamSrc.includes("MAX_REPAIRS = 2"));
  assert("full regen is last resort", streamSrc.includes("repairs exhausted") || streamSrc.includes("last-resort"));

  const routeSrc = read("app/api/profile/base-analysis/stream/route.ts");
  assert("route has onRepairStart", routeSrc.includes("onRepairStart"));
  assert("route generates core_judgments", routeSrc.includes("generateCoreJudgmentsForProfile"));

  assert("term:日主 is hard ban", isHardBannedTermLabel("term:日主"));
  assert("metaphor_blacklist is hard ban", isHardBannedTermLabel("metaphor_blacklist"));
  assert(
    "gate failure includes 日主",
    isBaseAnalysisGateFailure([{ label: "term:日主", snippet: "日主偏旺" }]),
  );

  const leaks = auditUserFacingBannedLeaks("你的日主是丙火身弱。", "zh");
  assert("audit catches 日主", leaks.some((h) => h.label === "term:日主"));
  assert("audit catches 身弱", leaks.some((h) => h.label === "term:身弱"));

  const metaHits = auditMetaphorBlacklist("你的心智引擎在空转。", "zh");
  assert("audit catches 引擎", metaHits.some((h) => h.label === "metaphor_blacklist"));

  const repairHint = buildViolationRepairInstruction(
    [
      { label: "term:日主", snippet: "日主偏旺" },
      { label: "metaphor_blacklist", snippet: "你的心智引擎" },
    ],
    "zh",
  );
  assert("repair says 只修这几处", repairHint.includes("只修这几处"));
  assert("repair soft-maps 日主", repairHint.includes("核心特质"));
  assert("repair mentions 引擎标签", repairHint.includes("引擎") || repairHint.includes("黑名单"));

  // Live prompt assembly needs plausible structured — read system from file inject check is enough.
  // Smoke that buildBaseAnalysisStreamPrompt still callable via inventory needs full structured;
  // skip if no fixture — file-level asserts already cover inject.

  void buildBaseAnalysisStreamPrompt;

  if (process.exitCode) {
    console.error("\nSSOT checks FAILED");
    process.exit(1);
  }
  console.log("\nAll SSOT / surgical-repair checks passed.");
}

main();
