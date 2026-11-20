const fs = require("fs");
const path = "D:/POJU/pojulife/scripts/test-m2-2-freeze-report-binding.ts";
let s = fs.readFileSync(path, "utf8");

const old = `    // Simulate assemble write-back failure (incomplete pages) BEFORE formal complete.
    let formalStatus: "running" | "completed" | "failed" = "running";
    const badPages = DECISION_PAGE_IDS.slice(0, 3).map((pageId) => ({
      pageId,
      content: "incomplete",
    }));
    const wb = await completeFreezeBoundReportFromDeliveryPages({
      session: prepared.session,
      snapshot: prepared.snapshot,
      jobId: originalJobId,
      pages: badPages as never,
      deps: persistDeps(),
    });
    assert.equal(wb.ok, false, "incomplete write-back must fail");
    // Production contract: do not mark formal delivery completed when write-back fails.
    if (!wb.ok) {
      formalStatus = "failed";
      await failFreezeBoundReportJob({
        session: prepared.session,
        jobId: originalJobId,
        error: wb.error,
        deps: persistDeps(),
      });
    } else {
      formalStatus = "completed";
    }
    assert.notEqual(formalStatus, "completed");`;

const neu = `    // Simulate assemble write-back failure (incomplete pages) BEFORE formal complete.
    // Production stage-runner: write-back throws/fails ⇒ formal job stays non-completed.
    let formalStatus: "running" | "completed" | "failed" = "running";
    const badPages = DECISION_PAGE_IDS.slice(0, 3).map((pageId) => ({
      pageId,
      content: "incomplete",
    }));
    let wbError = "";
    try {
      const wb = await completeFreezeBoundReportFromDeliveryPages({
        session: prepared.session,
        snapshot: prepared.snapshot,
        jobId: originalJobId,
        pages: badPages as never,
        deps: persistDeps(),
      });
      if (wb.ok) {
        formalStatus = "completed";
      } else {
        wbError = wb.error;
        formalStatus = "failed";
        await failFreezeBoundReportJob({
          session: prepared.session,
          jobId: originalJobId,
          error: wb.error,
          deps: persistDeps(),
        });
      }
    } catch (e) {
      wbError = e instanceof Error ? e.message : String(e);
      formalStatus = "failed";
      await failFreezeBoundReportJob({
        session: prepared.session,
        jobId: originalJobId,
        error: wbError,
        deps: persistDeps(),
      });
    }
    assert.notEqual(formalStatus, "completed");
    assert.ok(wbError, "write-back must surface a failure");`;

if (!s.includes(old)) {
  console.error("C4 block not found exactly");
  const i = s.indexOf("Simulate assemble write-back failure");
  console.log(JSON.stringify(s.slice(i, i+600)));
  process.exit(1);
}
s = s.replace(old, neu);
fs.writeFileSync(path, s, "utf8");
console.log("fixed C4");
