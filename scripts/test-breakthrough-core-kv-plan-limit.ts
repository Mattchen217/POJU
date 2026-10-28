/**
 * Breakthrough-core must not 500 when Upstash rejects commands for fixed-plan limits.
 * The job runs in request-scoped memory and the result is returned on the same response.
 *
 *   pnpm exec tsx scripts/test-breakthrough-core-kv-plan-limit.ts
 */
import fs from "node:fs";
import path from "node:path";

import { isKvStoreOutage, isUpstashPlanLimitError } from "@/lib/kv/upstash-plan-limit";
import type { BreakthroughCore } from "@/lib/poju/agent-state";
import {
  createXhighJob,
  getXhighJob,
  runWithEphemeralXhighKv,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

async function main(): Promise<void> {
  console.log("\n========== breakthrough-core · Upstash plan-limit fallback ==========\n");

  const live =
    'ERR This database has reached current Fixed plan limits. Please upgrade manually or enable auto upgrade on Upstash Console, command was: [["get","poju-xhigh:latest:segment2_breakthrough_core:diag"]]';
  assert("detects live fixed-plan error", isUpstashPlanLimitError(new Error(live)));
  assert(
    "detects request quota",
    isUpstashPlanLimitError(new Error("ERR max requests limit exceeded. Limit: 500000")),
  );
  assert(
    "detects capacity quota",
    isUpstashPlanLimitError(new Error("ReplyError: ERR DB capacity quota exceeded")),
  );
  assert("ignores ordinary failures", !isUpstashPlanLimitError(new Error("Missing session_id")));
  assert("ignores openrouter missing", !isUpstashPlanLimitError(new Error("OPENROUTER_API_KEY")));
  assert("plan limit is a store outage", isKvStoreOutage(new Error(live)));
  assert("redis transport is a store outage", isKvStoreOutage(new Error("fetch failed")));
  assert("ordinary errors are not a store outage", !isKvStoreOutage(new Error("Missing session_id")));

  let jobId = "";
  await runWithEphemeralXhighKv(async () => {
    const job = await createXhighJob({
      phase: "segment2_breakthrough_core",
      session_id: "ephemeral-plan-limit",
      locale: "en",
      job_input: {
        session_id: "ephemeral-plan-limit",
        original_question: "probe",
        locale: "en",
        profile_id: null,
        agent_v2: null,
        base_analysis: { structured: { day_master: "甲" } },
      },
    });
    jobId = job.job_id;
    const got = await getXhighJob(job.job_id);
    assert("ephemeral get sees the job", got?.job_id === job.job_id && got.status === "pending");
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        getXhighJob(job.job_id)
          .then((again) => {
            if (!again) reject(new Error("timer lost ephemeral kv"));
            else resolve();
          })
          .catch(reject);
      }, 15);
    });
    assert("timer callbacks stay on the ephemeral store", true);
    await updateXhighJobStatus(job.job_id, "completed", {
      result: {
        breakthrough_core: { situation_conclusion: "x" } as BreakthroughCore,
        investigation_agenda: [],
      },
    });
    const done = await getXhighJob(job.job_id);
    assert("ephemeral complete sticks", done?.status === "completed");
  });

  const leaked = jobId ? await getXhighJob(jobId) : { leaked: true };
  assert("ephemeral job is invisible to the shared store", leaked == null);

  const route = read("app/api/poju/breakthrough-core/route.ts");
  const agenda = read("app/api/poju/breakthrough-core/agenda/route.ts");
  const control = read("lib/poju/phases/segment2/control.ts");
  const ui = read("components/poju/POJUChatUI.tsx");

  assert("Call A falls back inline", route.includes("isUpstashPlanLimitError") && route.includes("runEphemeralXhighJob"));
  assert("Call A still schedules after() when KV works", route.includes("scheduleSegment2Job"));
  assert("Call B falls back inline", agenda.includes("isUpstashPlanLimitError") && agenda.includes("runEphemeralXhighJob"));
  assert("Call B budget covers inline 270s", agenda.includes("maxDuration = 300"));
  assert(
    "client does not poll a failed inline Call A",
    control.includes('payload.status !== "failed"') && control.includes('payload.status === "failed"'),
  );
  assert("client accepts inline Call B", control.includes("already_complete: true"));
  assert("UI finalizes inline Call B without polling", ui.includes("adoptInlineAgenda"));

  const synthesis = read("app/api/poju/synthesis/route.ts");
  const delivery = read("app/api/poju/final-delivery/route.ts");
  const clientKv = read("lib/kv/client.ts");
  assert("synthesis falls back inline", synthesis.includes("isUpstashPlanLimitError") && synthesis.includes("runEphemeralXhighJob"));
  assert(
    "final-delivery falls back inline",
    delivery.includes("isUpstashPlanLimitError") && delivery.includes("runWithEphemeralXhighKv"),
  );
  assert(
    "KV path charges after the job is stored",
    delivery.lastIndexOf("chargeDeliveryPass({") > delivery.lastIndexOf("await createXhighJob"),
  );
  assert("ephemeral KV is request-scoped on the shared client", clientKv.includes("runWithEphemeralKv"));
  assert(
    "delivery hops stay in-process when KV is ephemeral",
    read("lib/poju/final-delivery-stage-runner.ts").includes("ephemeral continue in-process"),
  );
  const statusRoute = read("app/api/poju/final-delivery/status/route.ts");
  assert(
    "status turns a Redis outage into a terminal payload",
    statusRoute.includes("isKvStoreOutage") && statusRoute.includes('reason: "kv_unavailable"'),
  );
  assert(
    "ephemeral create does not return a pollable job id",
    delivery.includes("ephemeral book not durable") && delivery.includes('reason: "kv_unavailable"'),
  );
  assert(
    "v3 steps run in-process when KV is ephemeral",
    read("lib/poju/final-delivery-stage-runner.ts").includes("v3 steps in-process"),
  );
  assert(
    "poll stops on kv_unavailable",
    read("lib/poju/poll-final-delivery-job.ts").includes('data.reason === "kv_unavailable"'),
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();
