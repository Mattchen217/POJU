/**
 * Block 102 — Segment 2 poll treats `completed` as terminal (agenda optional)
 *
 *   pnpm exec tsx scripts/test-poju-block102-segment2-poll-completed-terminal.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean, detail?: string): void {
  if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 102 · poll completed = terminal ==========\n");

  const poll = read("lib/poju/poll-segment2-xhigh-job.ts");
  const status = read("app/api/poju/breakthrough-core/status/route.ts");
  const prepare = read("components/poju/Segment2AnalysisPreparing.tsx");
  const ui = read("components/poju/POJUChatUI.tsx");
  const control = read("lib/poju/phases/segment2/control.ts");

  assert("poll timeout 290s", poll.includes("XHIGH_JOB_POLL_MAX_MS = 290_000"));
  assert("poll completed is terminal", poll.includes('if (status === "completed")'));
  assert(
    "poll does not require both core && agenda",
    !poll.includes("status === \"completed\" && data.breakthrough_core && data.investigation_agenda"),
  );
  assert("poll defaults missing agenda to []", poll.includes("Array.isArray(data.investigation_agenda)"));
  assert("poll completed_without_core", poll.includes("completed_without_core"));
  assert("poll returns poll_timeout", poll.includes('reason: "poll_timeout"'));
  assert("poll logs job_id", poll.includes('[segment2] polling'));

  assert("status completed without result → failed", status.includes("completed_without_result"));
  assert("status always returns agenda array", status.includes("investigation_agenda: agenda"));
  assert("status diagnostic log", status.includes("[xhigh-status]"));

  assert("preparing logs job_id", prepare.includes("[segment2] preparing poll start"));
  assert("preparing restarts on job_id change", prepare.includes("startedForJobRef"));
  assert("UI keys preparing by job_id", ui.includes("key={segment2JobId}"));
  assert("UI clears stale job id before set", ui.includes("setSegment2JobId(null)"));
  assert("UI logs created job_id", ui.includes("[segment2] job created (ui)"));
  assert(
    "create resume doesn't require agenda truthy",
    control.includes("payload.breakthrough_core && payload.job_id") &&
      !control.includes("payload.breakthrough_core && payload.investigation_agenda && payload.job_id"),
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 102 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
