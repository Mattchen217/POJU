const fs = require("fs");

function patchResume(path, expectedPhaseExpr, label) {
  let s = fs.readFileSync(path, "utf8");
  if (s.includes("job_phase_mismatch")) {
    console.log("already guarded:", label);
    return;
  }
  // Match across CRLF/LF
  const re =
    /if \(typeof body\.resume_job_id === "string" && body\.resume_job_id\.trim\(\)\) \{\r?\n\s*const job = await getXhighJob\(body\.resume_job_id\.trim\(\)\);\r?\n\s*if \(!job\) \{\r?\n\s*return NextResponse\.json\(\{ ok: false, error: "job_not_found" \}, \{ status: 404 \}\);\r?\n\s*\}\r?\n\s*return jobStatusResponse\(job\);\r?\n\s*\}/;
  if (!re.test(s)) {
    throw new Error("resume regex miss: " + label);
  }
  const nl = s.includes("\r\n") ? "\r\n" : "\n";
  const to = [
    `if (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) {`,
    `      const job = await getXhighJob(body.resume_job_id.trim());`,
    `      if (!job) {`,
    `        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });`,
    `      }`,
    `      // Phase 3 J4 — shared store ≠ shared business identity: refuse cross-phase resume.`,
    `      if (job.phase !== ${expectedPhaseExpr}) {`,
    `        return NextResponse.json(`,
    `          { ok: false, error: "job_phase_mismatch", expected: ${expectedPhaseExpr}, actual: job.phase },`,
    `          { status: 409 },`,
    `        );`,
    `      }`,
    `      return jobStatusResponse(job);`,
    `    }`,
  ].join(nl);
  s = s.replace(re, to);
  fs.writeFileSync(path, s);
  console.log("patched resume", label);
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
console.log("resume patches ok");
