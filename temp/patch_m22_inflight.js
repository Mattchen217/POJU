const fs = require("fs");
const path = "lib/poju/decision-intake/freeze-bound-report.ts";
let s = fs.readFileSync(path, "utf8");
const old = `  const existingInflight = inFlightByKey.get(key);
  if (existingInflight) return existingInflight;

  const run = (async (): Promise<FreezeBoundReportResult> => {
    let session = input.session;
    // Optional durable reload so concurrent writers see prior jobs.
    if (input.deps?.loadSession) {
      const fresh = await input.deps.loadSession(sessionId);
      if (fresh) session = fresh;
    }

    let created;
    try {
      created = await createOrGetReportJob({
        session,
        snapshot,
        deps: input.deps,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code =
        e instanceof FreezeBoundReportError ? e.code : "JOB_CREATE_FAILED";
      return { ok: false, code, error: msg, session };
    }

    session = created.session;
    const job = created.job;

    if (job.status === "completed") {
      const pages = job.pages
        .filter((p) => p.status === "completed")
        .map((p) => ({ pageId: p.pageId, content: p.content }));
      try {
        assertCompleteEightPageReport(pages);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          ok: false,
          code: "INCOMPLETE_COMPLETED_JOB",
          error: msg,
          job,
          session,
        };
      }
      return {
        ok: true,
        reused: true,
        job,
        report: {
          job_id: job.job_id,
          binding: job.binding,
          pages,
          status: "completed",
          completed_at: job.completed_at ?? job.updated_at,
        },
        snapshot,
        session,
      };
    }

    if (
      created.reused &&
      (job.status === "generating" || job.status === "queued") &&
      job.pages.length === 0
    ) {
      // Join: another worker owns generation; return current job state.
      // If we are the creator path falling through, generate below.
    }

    // Generate (or continue/retry) under the original binding.
    return runGenerationOnJob({
      session,
      job,
      snapshot,
      deps: input.deps,
    });
  })();

  inFlightByKey.set(key, run);
  try {
    return await run;
  } finally {
    inFlightByKey.delete(key);
  }
}`;

const neu = `  const existingInflight = inFlightByKey.get(key);
  if (existingInflight) return existingInflight;

  // Register BEFORE any await so concurrent duplicates coalesce.
  let resolveInflight!: (value: FreezeBoundReportResult) => void;
  const gate = new Promise<FreezeBoundReportResult>((resolve) => {
    resolveInflight = resolve;
  });
  inFlightByKey.set(key, gate);

  const run = (async (): Promise<FreezeBoundReportResult> => {
    let session = input.session;
    // Optional durable reload so concurrent writers see prior jobs.
    if (input.deps?.loadSession) {
      const fresh = await input.deps.loadSession(sessionId);
      if (fresh) session = fresh;
    }

    let created;
    try {
      created = await createOrGetReportJob({
        session,
        snapshot,
        deps: input.deps,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code =
        e instanceof FreezeBoundReportError ? e.code : "JOB_CREATE_FAILED";
      return { ok: false, code, error: msg, session };
    }

    session = created.session;
    const job = created.job;

    if (job.status === "completed") {
      const pages = job.pages
        .filter((p) => p.status === "completed")
        .map((p) => ({ pageId: p.pageId, content: p.content }));
      try {
        assertCompleteEightPageReport(pages);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          ok: false,
          code: "INCOMPLETE_COMPLETED_JOB",
          error: msg,
          job,
          session,
        };
      }
      return {
        ok: true,
        reused: true,
        job,
        report: {
          job_id: job.job_id,
          binding: job.binding,
          pages,
          status: "completed",
          completed_at: job.completed_at ?? job.updated_at,
        },
        snapshot,
        session,
      };
    }

    // Generate (or continue/retry) under the original binding.
    return runGenerationOnJob({
      session,
      job,
      snapshot,
      deps: input.deps,
    });
  })();

  try {
    const result = await run;
    resolveInflight(result);
    return result;
  } catch (e) {
    const fail: FreezeBoundReportResult = {
      ok: false,
      code: "REPORT_GENERATION_FAILED",
      error: e instanceof Error ? e.message : String(e),
      session: input.session,
    };
    resolveInflight(fail);
    return fail;
  } finally {
    inFlightByKey.delete(key);
  }
}`;

if (!s.includes("const existingInflight = inFlightByKey.get(key);")) {
  console.error("anchor missing");
  process.exit(1);
}
if (!s.includes(old)) {
  console.error("old block not found exact");
  // try softer: just show nearby
  const i = s.indexOf("const existingInflight = inFlightByKey.get(key);");
  console.log(s.slice(i, i + 200));
  process.exit(1);
}
s = s.replace(old, neu);
fs.writeFileSync(path, s);
console.log("concurrency fix applied");
