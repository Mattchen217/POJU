// Apply one FU3 mutation by exact string replacement (must match exactly once).
const fs = require("fs");
const API = "lib/poju/decision-intake/decision-report-api.ts";
const LOCK = "lib/poju/decision-intake/decision-report-lock.ts";
const SVC = "lib/poju/decision-intake/decision-report-service.ts";

const M = {
  // FU2 timing: abort pre-check before the lock, none under it.
  M1_precheck_before_lock: [
    [API,
      '  const owner = newReportLockOwner(session_id);\n  await runReportStartHook("before_lock"',
      '  { const p0 = await resumeDecisionReportRefusalAbort(session_id); if (p0.kind === "unreadable") return chargeUnconfirmed(null, "authorization_unreadable"); if (abortOwnsSession(p0)) return abortResumeReply(p0); }\n  const owner = newReportLockOwner(session_id);\n  await runReportStartHook("before_lock"'],
    [API,
      '  await runReportStartHook("precheck", ctx);\n  const pre = await resumeDecisionReportRefusalAbort(session_id);',
      '  await runReportStartHook("precheck", ctx);\n  const pre = { kind: "none" } as Awaited<ReturnType<typeof resumeDecisionReportRefusalAbort>>;'],
  ],
  // Release without the owner check (any owned lock is deleted).
  M2_unchecked_owner_release: [
    [LOCK,
      '    if (cur.kind !== "owned" || !isReportLockOwnedBy(cur.lock, owner)) return "not_owner";\n    if (await casDelete(owner.session_id, cur.raw)) return "released";',
      '    if (cur.kind !== "owned") return "not_owner";\n    if (await casDelete(owner.session_id, cur.raw)) return "released";'],
  ],
  // Resume an abandoned abort without taking the atomic resume right.
  M3_resume_without_right: [
    [SVC,
      '  const right = await claimRefusalAbortResume(rec);',
      '  const right = { kind: "taken", record: rec } as Awaited<ReturnType<typeof claimRefusalAbortResume>>;'],
  ],
  // Job-lifetime release ignores holder / job_id.
  M4_job_release_ignores_binding: [
    [LOCK,
      '    if (cur.kind !== "owned" || cur.lock.holder !== "job" || cur.lock.job_id !== job_id) return "not_owner";',
      '    if (cur.kind !== "owned") return "not_owner";'],
  ],
  // Dispatch although the hand-off CAS was lost.
  M5_dispatch_on_lost_handoff: [
    [API, '  if (!handed) {\n', '  if (!handed && Date.now() < 0) {\n'],
  ],
  // Refusal claims the abort without confirming it still owns the lock.
  M6_claim_without_owner_check: [
    [API,
      '    const stillOwned = await updateOwnedReportLock(owner).catch(() => null);',
      '    const stillOwned = true;'],
  ],
};

const id = process.argv[2];
const edits = M[id];
if (!edits) {
  console.error(`unknown mutation ${id}; known: ${Object.keys(M).join(", ")}`);
  process.exit(2);
}
for (const [file, from, to] of edits) {
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const src = crlf ? raw.replace(/\r\n/g, "\n") : raw;
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.error(`${id}: expected 1 match in ${file}, found ${n}`);
    process.exit(3);
  }
  const out = src.replace(from, to);
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
}
console.log(`applied ${id}`);
