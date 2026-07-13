/**
 * Block 91 — segment 2 async xhigh job architecture
 *
 *   pnpm exec tsx scripts/test-poju-block91-segment2-xhigh-job.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 91 · Segment 2 xhigh async job ==========\n");

  const route = read("app/api/poju/breakthrough-core/route.ts");
  const status = read("app/api/poju/breakthrough-core/status/route.ts");
  const store = read("lib/poju/xhigh-job-store.ts");
  const runner = read("lib/poju/xhigh-job-runner.ts");
  const poll = read("lib/poju/poll-segment2-xhigh-job.ts");
  const client = read("lib/llm/deepseek/breakthrough-core.ts");
  const ui = read("components/poju/Segment2AnalysisPreparing.tsx");

  assert("route uses after() for background job", route.includes("after("));
  assert("route createJob via xhigh store", route.includes("createXhighJob"));
  assert("route schedules runSegment2BreakthroughCoreJob", route.includes("runSegment2BreakthroughCoreJob"));
  assert("route resume_job_id support", route.includes("resume_job_id"));
  assert("route returns job_id on create", route.includes("job_id: job.job_id"));

  assert("status route GET job_id", status.includes('get("job_id")'));
  assert("status returns breakthrough_core when completed", status.includes("job.result.breakthrough_core"));

  assert("job store create/get/complete", store.includes("createXhighJob") && store.includes("completeXhighJob"));
  assert("job store append chunk", store.includes("appendXhighJobChunk"));
  assert("generic phase final_delivery reserved", read("lib/poju/xhigh-job-types.ts").includes("final_delivery"));

  assert("runner xhigh effort", runner.includes('reasoning_effort: "xhigh"'));
  assert("runner max_tokens 22000", runner.includes("SEGMENT2_XHIGH_MAX_TOKENS = 22_000"));
  assert("runner uses openRouterChatCompletionStream", runner.includes("openRouterChatCompletionStream"));
  assert("runner generic runXhighJob export", runner.includes("export async function runXhighJob"));

  assert("client polls job", client.includes("pollBreakthroughCoreJobUntilDone"));
  assert("client no blocking sync LLM in route import", !client.includes("openRouterChatCompletionStream"));
  assert("poll interval 3s", poll.includes("XHIGH_JOB_POLL_INTERVAL_MS = 3000"));

  assert("Segment2AnalysisPreparing component", ui.includes("Segment2AnalysisPreparing"));
  assert("POJUChatUI progress callback", read("components/poju/POJUChatUI.tsx").includes("onSegment2Progress"));

  console.log("\n" + (failures.length === 0 ? "✅ All checks passed." : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
