const fs = require("fs");

function replaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error("missing " + label + ": " + from.slice(0, 160));
  if (src.indexOf(from, i + 1) >= 0) throw new Error("not unique " + label);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

function patchResume(path, expectedPhaseExpr, label) {
  let s = fs.readFileSync(path, "utf8");
  const from = `    if (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) {
      const job = await getXhighJob(body.resume_job_id.trim());
      if (!job) {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      return jobStatusResponse(job);
    }`;
  const to = `    if (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) {
      const job = await getXhighJob(body.resume_job_id.trim());
      if (!job) {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      // Phase 3 J4 — shared store ≠ shared business identity: refuse cross-phase resume.
      if (job.phase !== ${expectedPhaseExpr}) {
        return NextResponse.json(
          { ok: false, error: "job_phase_mismatch", expected: ${expectedPhaseExpr}, actual: job.phase },
          { status: 409 },
        );
      }
      return jobStatusResponse(job);
    }`;
  if (!s.includes(from)) {
    // already patched?
    if (s.includes("job_phase_mismatch")) {
      console.log("resume already guarded:", label);
      return;
    }
    throw new Error("resume block missing: " + label);
  }
  s = replaceOnce(s, from, to, label);
  fs.writeFileSync(path, s);
  console.log("patched resume", label);
}

// 1) Tighten jobMatchesIdentity + export helper + doc comment
{
  const p = "lib/poju/xhigh-job-store.ts";
  let s = fs.readFileSync(p, "utf8");
  s = replaceOnce(
    s,
    `function jobMatchesIdentity(
  job: PojuXhighJob,
  input: {
    phase: PojuXhighJobPhase;
    session_id: string;
    client_task_id: string;
    generation_type?: PojuXhighJob["generation_type"];
  },
): boolean {
  if (job.phase !== input.phase) return false;
  if (job.session_id !== input.session_id) return false;
  if (job.client_task_id !== input.client_task_id) return false;
  if (
    input.generation_type &&
    job.generation_type &&
    job.generation_type !== input.generation_type
  ) {
    return false;
  }
  return true;
}`,
    `/**
 * Phase 3 J4 — business identity gate for shared Job Store recovery.
 *
 * Identity axes (shared storage ≠ shared business identity):
 * - phase (segment2_breakthrough_core | segment2_agenda_bridge | synthesis | final_delivery)
 * - session_id
 * - client_task_id (when present — Phase 3 Generation / ITEM 6)
 * - generation_type (when caller supplies it — POJU Call A/B only today)
 *
 * Lab / Synthesis / Final Delivery creates omit client_task_id + generation_type;
 * those fields remain optional so existing business semantics are unchanged.
 * When a Generation caller *does* supply generation_type, the job must carry the
 * same value — a Lab/legacy job missing generation_type must not match.
 */
export function jobMatchesIdentity(
  job: PojuXhighJob,
  input: {
    phase: PojuXhighJobPhase;
    session_id: string;
    client_task_id: string;
    generation_type?: PojuXhighJob["generation_type"];
  },
): boolean {
  if (job.phase !== input.phase) return false;
  if (job.session_id !== input.session_id) return false;
  if (job.client_task_id !== input.client_task_id) return false;
  if (input.generation_type) {
    // Strict: Generation recovery must not accept Lab/legacy jobs lacking type.
    if (job.generation_type !== input.generation_type) return false;
  }
  return true;
}`,
    "jobMatchesIdentity",
  );
  fs.writeFileSync(p, s);
  console.log("patched jobMatchesIdentity");
}

patchResume(
  "app/api/poju/breakthrough-core/route.ts",
  '"segment2_breakthrough_core"',
  "breakthrough-core",
);
patchResume(
  "app/api/poju/breakthrough-core/agenda/route.ts",
  "PHASE",
  "agenda",
);
patchResume(
  "app/api/poju/synthesis/route.ts",
  '"synthesis"',
  "synthesis",
);

console.log("core j4 patches done");
