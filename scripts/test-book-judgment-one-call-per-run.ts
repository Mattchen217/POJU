/**
 * Lab/macro contract: one Lab `/run` HTTP ⇒ at most one LLM provider call.
 * BookJudgment: one-shot first; timeout-budget degrade → two-shot across POSTs.
 * Quality/validate fail must NOT schedule book_judgment_shot_continue.
 *
 * Run: pnpm exec tsx scripts/test-book-judgment-one-call-per-run.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOOK_JUDGMENT_SHOT_CONTINUE_RULE,
  deliveryLabTransportMaxAttempts,
  isBookJudgmentShotContinueRule,
  LAB_MAX_PROVIDER_CALLS_PER_HTTP,
} from "../lib/llm/pro/delivery/lab/provider-call-budget";
import {
  isBookJudgmentGenerateContinue,
  isBookJudgmentTimeoutDegradeReason,
  type BookJudgmentGenerateContinue,
} from "../lib/llm/pro/delivery/book-judgment/generate";
import { isV3DispatchContinue } from "../lib/llm/pro/delivery/pipeline-v3/production-run";

const root = path.join(__dirname, "..");

assert.equal(LAB_MAX_PROVIDER_CALLS_PER_HTTP, 1);
assert.equal(deliveryLabTransportMaxAttempts(), 1);
assert.ok(isBookJudgmentShotContinueRule(BOOK_JUDGMENT_SHOT_CONTINUE_RULE));
assert.ok(isV3DispatchContinue(BOOK_JUDGMENT_SHOT_CONTINUE_RULE));

const generateSrc = fs.readFileSync(
  path.join(root, "lib/llm/pro/delivery/book-judgment/generate.ts"),
  "utf8",
);
assert.match(generateSrc, /single_provider_call\??:/);
assert.match(generateSrc, /continueTo\("two_destiny"/);
assert.match(generateSrc, /continueTo\("two_science"/);
assert.match(generateSrc, /deliveryLabTransportMaxAttempts\(\)/);
assert.match(generateSrc, /BOOK_JUDGMENT_SHOT_CONTINUE_RULE/);
/** Lab single path must not fall through into stacked finishTwoShotStacked. */
{
  const singleBlockStart = generateSrc.indexOf("if (single) {");
  assert.ok(singleBlockStart > 0, "single_provider_call branch");
  const legacyStart = generateSrc.indexOf("// --- Legacy stacked path");
  assert.ok(legacyStart > singleBlockStart, "legacy after single");
  const singleBlock = generateSrc.slice(singleBlockStart, legacyStart);
  assert.doesNotMatch(
    singleBlock,
    /finishTwoShotStacked/,
    "Lab single branch must not call stacked two-shot",
  );
  assert.match(singleBlock, /runDestinyShot/);
  assert.match(singleBlock, /runScienceShot/);
}

const runStepSrc = fs.readFileSync(
  path.join(root, "lib/llm/pro/delivery/lab/run-step-v3.ts"),
  "utf8",
);
assert.match(runStepSrc, /single_provider_call:\s*true/);
assert.match(runStepSrc, /BOOK_JUDGMENT_SHOT_CONTINUE_RULE/);
assert.match(runStepSrc, /isBookJudgmentGenerateContinue/);
assert.match(runStepSrc, /book_judgment_shot_continue_schedule/);
/** Wrapper must treat shot continue as dispatch continue (ok:true), else client never POSTs gun 2. */
{
  const dc = runStepSrc.indexOf("const dispatchContinue =");
  assert.ok(dc > 0, "dispatchContinue in runLabStepV3");
  const dcBlock = runStepSrc.slice(dc, dc + 700);
  assert.match(dcBlock, /BOOK_JUDGMENT_SHOT_CONTINUE_RULE/);
  assert.match(dcBlock, /soft_dispatch_continue/);
  assert.match(dcBlock, /fill_dispatch_continue/);
  assert.match(dcBlock, /mark_dispatch_continue/);
}

const pageSrc = fs.readFileSync(
  path.join(root, "app/ops/delivery-lab/[lab_id]/page.tsx"),
  "utf8",
);
assert.match(pageSrc, /book_judgment_shot_continue/);

for (const rel of [
  "lib/llm/pro/delivery/pipeline-v3/content-body.ts",
  "lib/llm/pro/delivery/pipeline-v3/content-judgment.ts",
  "lib/llm/pro/delivery/pipeline-v3/body-polish.ts",
]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  assert.match(
    src,
    /max_attempts:\s*deliveryLabTransportMaxAttempts\(\)/,
    `${rel} must cap Lab transport to 1`,
  );
  assert.doesNotMatch(
    src,
    /max_attempts:\s*deliveryTransportMaxAttempts\(\)/,
    `${rel} must not stack OpenRouter transport under Lab 300s`,
  );
}

const cont: BookJudgmentGenerateContinue = {
  ok: false,
  continue: true,
  reason: BOOK_JUDGMENT_SHOT_CONTINUE_RULE,
  next_shot_phase: "two_destiny",
  tokens_used: 0,
  shot_mode: "one",
  degrade_meta: { reason: "llm_timeout" },
};
assert.ok(isBookJudgmentGenerateContinue(cont));
assert.equal(isBookJudgmentGenerateContinue({ ok: true, pack: {} as never, tokens_used: 0, shot_mode: "one" }), false);

/** Timeout-budget degrade ONLY — quality reasons must not degrade. */
{
  assert.equal(isBookJudgmentTimeoutDegradeReason("llm_timeout"), true);
  assert.equal(isBookJudgmentTimeoutDegradeReason("Request timed out after 300000ms"), true);
  assert.equal(isBookJudgmentTimeoutDegradeReason("AbortError"), true);
  assert.equal(isBookJudgmentTimeoutDegradeReason("aborted due to maxDuration"), true);
  assert.equal(isBookJudgmentTimeoutDegradeReason("function time budget exceeded"), true);
  assert.equal(isBookJudgmentTimeoutDegradeReason("means_prescription"), false);
  assert.equal(isBookJudgmentTimeoutDegradeReason("under_density"), false);
  assert.equal(isBookJudgmentTimeoutDegradeReason("coerce_failed"), false);
  assert.equal(isBookJudgmentTimeoutDegradeReason("schema"), false);
  assert.equal(isBookJudgmentTimeoutDegradeReason("empty_response"), false);
  assert.equal(isBookJudgmentTimeoutDegradeReason("json_parse"), false);
  assert.equal(isBookJudgmentTimeoutDegradeReason("truncated", "length"), false);
  assert.equal(isBookJudgmentTimeoutDegradeReason("quality_drift"), false);
}

/** finishOneShot: validate/coerce hard-fail; only timeout-class returns degrade → continueTo. */
{
  assert.doesNotMatch(
    generateSrc,
    /return \{ degrade: true, reason: "coerce_failed"/,
    "coerce_failed must not degrade",
  );
  assert.doesNotMatch(
    generateSrc,
    /if \(isDegradeReason\(validated\.reason/,
    "validate fail must not call isDegradeReason for degrade",
  );
  assert.match(
    generateSrc,
    /Validate\/quality fail: hard fail/,
    "validate hard-fail comment present",
  );
  assert.match(
    generateSrc,
    /isBookJudgmentTimeoutDegradeReason/,
    "timeout degrade helper exported/used",
  );
  const finishOne = generateSrc.indexOf("const finishOneShot = async");
  const meansInject = generateSrc.indexOf("const meansInjectFor =");
  assert.ok(finishOne > 0 && meansInject > finishOne, "finishOneShot block bounds");
  const finishBlock = generateSrc.slice(finishOne, meansInject);
  assert.match(finishBlock, /if \(isDegradeReason\(shot\.reason/);
  assert.match(finishBlock, /degrade: true/);
  assert.doesNotMatch(
    finishBlock,
    /means_prescription[\s\S]*degrade: true/,
    "means_prescription must not trigger degrade inside finishOneShot",
  );
  assert.match(
    finishBlock,
    /reason: "coerce_failed"[\s\S]*shot_mode: "one"/,
    "coerce_failed returns ok:false one-shot fail",
  );
}

/** Pipeline-wide Lab LLM steps: transport=1; soft has no callLLM; companion Lab = high (no repair stack). */
{
  const soft = fs.readFileSync(
    path.join(root, "lib/llm/pro/delivery/pipeline-v3/evidence-soft.ts"),
    "utf8",
  );
  assert.doesNotMatch(soft, /callLLM\(/, "evidence_soft must not call LLM");
  const companion = fs.readFileSync(
    path.join(root, "lib/companion/companion-daily-service.ts"),
    "utf8",
  );
  assert.match(companion, /const allowRepair = thinking_effort !== "high"/);
  assert.match(runStepSrc, /thinking_effort:\s*"high"/);
  const prod = fs.readFileSync(
    path.join(root, "lib/llm/pro/delivery/pipeline-v3/production-run.ts"),
    "utf8",
  );
  assert.match(prod, /BOOK_JUDGMENT_SHOT_CONTINUE_RULE/);
}

console.log("PASS test-book-judgment-one-call-per-run");
