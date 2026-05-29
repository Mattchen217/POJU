/**
 * Step 1 — KV connectivity smoke test.
 * Run: pnpm exec tsx scripts/test-base-analysis-kv-step1.ts
 * Requires KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*).
 */
import { kv } from "../lib/kv/client";
import {
  acquireLock,
  appendChunk,
  createJob,
  failJob,
  finalizeJob,
  findLatestJobForProfile,
  getJob,
  releaseLock,
} from "../lib/base-analysis/job-store";

async function main() {
  const hasEnv =
    Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  if (!hasEnv) {
    console.warn("[step1] Skip live KV test: missing KV_REST_* or UPSTASH_REDIS_REST_* env");
    process.exit(0);
  }

  await kv.set("base-analysis:ping", "hello", { ex: 60 });
  const ping = await kv.get<string>("base-analysis:ping");
  if (ping !== "hello") throw new Error(`KV ping failed: got ${String(ping)}`);
  console.log("[step1] KV ping OK");

  const profileId = `test-profile-${Date.now()}`;
  const job = await createJob({
    profile_id: profileId,
    locale: "zh",
    local_data: {
      four_pillars: { year: "甲子" },
      true_solar_time: { diff_minutes: 12 },
      yong_shen: "木",
      profile_basics: { year: 1990 },
    },
  });
  console.log("[step1] createJob OK", job.job_id);

  const locked = await acquireLock(profileId);
  if (!locked) throw new Error("acquireLock should succeed on first try");
  await releaseLock(profileId);

  await appendChunk(job.job_id, "第一段");
  await appendChunk(job.job_id, "第二段");
  const mid = await getJob(job.job_id);
  if (mid?.accumulated_content !== "第一段第二段") {
    throw new Error(`appendChunk failed: ${mid?.accumulated_content}`);
  }

  await finalizeJob(job.job_id, { day_master_element: "木" });
  const done = await getJob(job.job_id);
  if (done?.status !== "completed") throw new Error("finalizeJob failed");

  const latest = await findLatestJobForProfile(profileId);
  if (latest?.job_id !== job.job_id) throw new Error("findLatestJobForProfile failed");

  const failProfile = `fail-${Date.now()}`;
  const failJobRow = await createJob({
    profile_id: failProfile,
    locale: "en",
    local_data: {
      four_pillars: {},
      true_solar_time: {},
      yong_shen: "",
      profile_basics: {},
    },
  });
  await failJob(failJobRow.job_id, "test_error", "detail");
  const failed = await getJob(failJobRow.job_id);
  if (failed?.status !== "failed") throw new Error("failJob failed");

  console.log("[step1] All job-store checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
