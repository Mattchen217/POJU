/**
 * PART 2 acceptance — template matrix, locale elements, unified teaser, compliance.
 *
 *   pnpm exec tsx scripts/test-base-analysis-part2.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  applyComplianceSanitize,
  auditMetaphorBlacklist,
  auditSoftReplaceReadability,
  auditUserFacingBannedLeaks,
  protectQuotedSingleChars,
  sanitizePaymentAuditLeaks,
  stripMarkersForPrompt,
} from "@/lib/llm/sanitize/compliance-terms";
import { autoMarkBareTerms } from "@/lib/llm/sanitize/term-marking";
import { elementLabelLocalized } from "@/lib/poju/bazi-matrix-mappings";
import { parseReadingBlocks } from "@/lib/reading/parse-reading-blocks";
import { truncateReadingTeaser } from "@/lib/reading/truncate-reading-teaser";

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
  console.log("\n========== PART 2 · base-analysis / matrix welcome ==========\n");

  const matrixRoute = read("app/api/poju/matrix-narrative/route.ts");
  assert("matrix-narrative returns 410", matrixRoute.includes("410") && matrixRoute.includes("matrix_narrative_removed"));
  assert(
    "resolve-matrix-preview is template-only",
    read("lib/poju/resolve-matrix-preview.ts").includes("template_only") &&
      !read("lib/poju/resolve-matrix-preview.ts").includes("requestMatrixNarrative"),
  );

  assert("zh Earth→土", elementLabelLocalized("Earth", "zh") === "土");
  assert("zh Metal→金", elementLabelLocalized("Metal", "zh") === "金");
  assert("es Earth localized", elementLabelLocalized("Earth", "es") === "Tierra");
  assert("de Metal localized", elementLabelLocalized("Metal", "de") === "Metall");
  assert("fr Water localized", elementLabelLocalized("Water", "fr") === "Eau");

  const md = `开篇身份。

## 你的核心配置（强项）

**驱动:** 一段正文。

## 容易卡住的地方（需注意）

另一段。`;
  const blocks = parseReadingBlocks(md);
  assert("parseReadingBlocks handles ##", blocks.some((b) => b.type === "h2"));
  const teaser = truncateReadingTeaser(md, 3);
  assert("teaser has no char-sliced ## mid-word", !teaser.includes("##容"));
  assert("teaser is block-serialized", teaser.includes("## 你的核心配置") || blocks[0]?.type === "p");
  assert("unlock-report uses truncateReadingTeaser", read("lib/poju/unlock-report-gate.ts").includes("truncateReadingTeaser"));

  const fate = sanitizePaymentAuditLeaks("这不是你的命运判决书。", "zh");
  assert("phrase wholesale avoids 人生轨迹判决书", !fate.includes("人生轨迹判决书"), fate);
  assert("phrase does not re-inject 判决", !fate.includes("判决"), fate);
  assert("phrase → 读数/配置", fate.includes("读数") || fate.includes("配置"), fate);

  const invented = sanitizePaymentAuditLeaks(
    "盘中见阴阳差错、大耗、小耗、五鬼、白虎、天狗、隔角。",
    "zh",
  );
  assert("out-of-set 阴阳差错 stripped", !invented.includes("阴阳差错"), invented);
  assert("out-of-set 大耗 stripped", !invented.includes("大耗"), invented);
  assert("out-of-set 白虎 stripped", !invented.includes("白虎"), invented);

  const quoted = autoMarkBareTerms("这是靠'养'出来的。", "zh");
  const quotedPlain = stripMarkersForPrompt(quoted);
  assert("quoted 养 preserved", quotedPlain.includes("'养'") || quotedPlain.includes("养"), quotedPlain);
  assert("quoted 养 not 滋养培育", !quotedPlain.includes("滋养培育"), quotedPlain);

  const { text: masked, restore } = protectQuotedSingleChars("靠「冲」起势");
  assert("protect masks quoted char", masked.includes("\uE050"));
  assert("restore quoted char", restore(masked).includes("「冲」"));

  const engineHits = auditMetaphorBlacklist("你的引擎在空转。", "zh");
  assert("empty blacklist → engine not metaphor-hit", engineHits.length === 0);

  const bareStrength = auditUserFacingBannedLeaks("你的核心是身弱的配置。", "zh");
  assert("身弱 user-facing banned", bareStrength.some((h) => h.label === "term:身弱"));

  const unreadable = auditSoftReplaceReadability("这不是人生轨迹判决书。", "zh");
  assert("unreadable combo flagged", unreadable.some((h) => h.label === "soft_replace_unreadable"));

  const promptSrc = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert("prompt bans 身弱 bare write", promptSrc.includes("禁止】写出「身弱") || promptSrc.includes("【禁止】写出「身弱"));
  assert("prompt has chart-native metaphor constraint", promptSrc.includes("现定") || promptSrc.includes("主隐喻"));
  assert("prompt closing avoids 不是命定 trap", promptSrc.includes("怎么用它，取决于你自己") || promptSrc.includes("取决于你自己"));
  assert("brevity no longer invites 身弱 write", !promptSrc.includes("允许在五块中点名：**身强/身弱"));

  // buildBaseAnalysisStreamPrompt requires real structured — file-assert above is enough for bans.

  const softLabels = read("lib/glossary/term-glossary-closed.ts");
  assert("身弱 soft has no 身弱", softLabels.includes("燃料容易跟不上") && !/"身弱型"/.test(softLabels));

  const gate = read("lib/base-analysis/delivery-gate.ts");
  assert("gate audits soft-visible / metaphor", gate.includes("auditMetaphorBlacklist") && gate.includes("softVisible"));
  assert("core_judgments save without gate", read("lib/profile/stored-profiles-service.ts").includes("saveCoreJudgmentsForProfile"));

  applyComplianceSanitize("大运压力。", "zh");

  if (process.exitCode) {
    console.error("\nPART 2 checks FAILED");
    process.exit(1);
  }
  console.log("\nAll PART 2 checks passed.");
}

main();
