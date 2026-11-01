/**
 * Lab/macro contract: one Lab `/run` HTTP ⇒ at most one LLM provider call.
 * BookJudgment: ONE-SHOT ONLY (Max lock 2026-11-01). No two-shot / degrade /
 * book_judgment_shot_continue. Timeout, stall, quality → hard fail.
 *
 * Run: pnpm exec tsx scripts/test-book-judgment-one-call-per-run.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  deliveryLabTransportMaxAttempts,
  LAB_MAX_PROVIDER_CALLS_PER_HTTP,
} from "../lib/llm/pro/delivery/lab/provider-call-budget";
import { isV3DispatchContinue } from "../lib/llm/pro/delivery/pipeline-v3/production-run";

const root = path.join(__dirname, "..");

assert.equal(LAB_MAX_PROVIDER_CALLS_PER_HTTP, 1);
assert.equal(deliveryLabTransportMaxAttempts(), 1);

const generateSrc = fs.readFileSync(
  path.join(root, "lib/llm/pro/delivery/book-judgment/generate.ts"),
  "utf8",
);
assert.match(generateSrc, /single_provider_call\??:/);
assert.match(generateSrc, /deliveryLabTransportMaxAttempts\(\)/);
assert.match(generateSrc, /一枪双轨/);
assert.doesNotMatch(generateSrc, /BOOK_JUDGMENT_SHOT_CONTINUE_RULE/);
assert.doesNotMatch(generateSrc, /continueTo\(/);
assert.doesNotMatch(generateSrc, /two_destiny/);
assert.doesNotMatch(generateSrc, /runDestinyShot/);
assert.doesNotMatch(generateSrc, /finishTwoShotStacked/);
assert.doesNotMatch(generateSrc, /isBookJudgmentTimeoutDegradeReason/);
assert.doesNotMatch(generateSrc, /force_two_shot/);
assert.doesNotMatch(generateSrc, /BookJudgmentGenerateContinue/);

const runStepSrc = fs.readFileSync(
  path.join(root, "lib/llm/pro/delivery/lab/run-step-v3.ts"),
  "utf8",
);
assert.match(runStepSrc, /single_provider_call:\s*true/);
assert.doesNotMatch(runStepSrc, /BOOK_JUDGMENT_SHOT_CONTINUE_RULE/);
assert.doesNotMatch(runStepSrc, /isBookJudgmentGenerateContinue/);
assert.doesNotMatch(runStepSrc, /book_judgment_shot_continue/);
assert.doesNotMatch(runStepSrc, /book_judgment_shot/);

{
  const dc = runStepSrc.indexOf("const dispatchContinue =");
  assert.ok(dc > 0, "dispatchContinue in runLabStepV3");
  const dcBlock = runStepSrc.slice(dc, dc + 700);
  assert.doesNotMatch(dcBlock, /BOOK_JUDGMENT_SHOT_CONTINUE/);
  assert.match(dcBlock, /soft_dispatch_continue/);
  assert.match(dcBlock, /fill_dispatch_continue/);
  assert.match(dcBlock, /mark_dispatch_continue/);
}

const pageSrc = fs.readFileSync(
  path.join(root, "app/ops/delivery-lab/[lab_id]/page.tsx"),
  "utf8",
);
assert.doesNotMatch(pageSrc, /book_judgment_shot_continue/);

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

/** openrouter-stream: zombie/chunk stall → stream_stall (hard fail, not soft alias). */
{
  const streamSrc = fs.readFileSync(
    path.join(root, "lib/llm/openrouter-stream.ts"),
    "utf8",
  );
  assert.match(streamSrc, /STREAM_CHUNK_STALL_MS\s*=\s*60_000/);
  assert.match(streamSrc, /abortedForChunkStall/);
  const stallThrows = [
    ...streamSrc.matchAll(
      /if \(abortedForChunkStall\) \{\s*throw new Error\("([^"]+)"\);/g,
    ),
  ].map((m) => m[1]);
  assert.ok(stallThrows.length >= 1, "chunk stall must throw");
  assert.ok(
    stallThrows.every((r) => r === "stream_stall"),
    `chunk stall must throw stream_stall, got ${stallThrows.join(",")}`,
  );
  assert.equal(stallThrows.includes("llm_timeout"), false);
  assert.doesNotMatch(streamSrc, /book_judgment_shot_continue/);
  assert.doesNotMatch(streamSrc, /isBookJudgmentTimeoutDegradeReason/);
}

/** Budget + production: no BookJudgment continue rule. */
{
  const budget = fs.readFileSync(
    path.join(root, "lib/llm/pro/delivery/lab/provider-call-budget.ts"),
    "utf8",
  );
  assert.doesNotMatch(budget, /BOOK_JUDGMENT_SHOT_CONTINUE/);
  assert.doesNotMatch(budget, /two_destiny/);
  assert.match(budget, /LAB_MAX_PROVIDER_CALLS_PER_HTTP\s*=\s*1/);

  const prod = fs.readFileSync(
    path.join(root, "lib/llm/pro/delivery/pipeline-v3/production-run.ts"),
    "utf8",
  );
  assert.doesNotMatch(prod, /BOOK_JUDGMENT_SHOT_CONTINUE/);
  assert.equal(isV3DispatchContinue("book_judgment_shot_continue"), false);
  assert.equal(isV3DispatchContinue("soft_dispatch_continue"), true);
}

/** Pipeline-wide Lab LLM steps: transport=1; soft has no callLLM; companion Lab = high. */
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
}

console.log("PASS test-book-judgment-one-call-per-run");