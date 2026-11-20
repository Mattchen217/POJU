const fs = require("fs");
const path = "lib/poju/final-delivery-stage-runner.ts";
let s = fs.readFileSync(path, "utf8");
const bad = `const {
    createFrozenReportSnapshot,
    completeFreezeBoundReportFromDeliveryPages,
    failFreezeBoundReportJob,
    DECISION_PAGE_IDS: _unused,
  } = await import("@/lib/poju/decision-intake/freeze-bound-report");
  void _unused;
  const { DECISION_PAGE_IDS } = await import(
    "@/lib/llm/pro/delivery/page-feed-matrix"
  );`;
const good = `const {
    createFrozenReportSnapshot,
    completeFreezeBoundReportFromDeliveryPages,
    failFreezeBoundReportJob,
  } = await import("@/lib/poju/decision-intake/freeze-bound-report");
  const { DECISION_PAGE_IDS } = await import(
    "@/lib/llm/pro/delivery/page-feed-matrix"
  );`;
if (!s.includes(bad) && !s.includes("DECISION_PAGE_IDS: _unused")) {
  console.log("already clean or different");
} else if (s.includes(bad)) {
  s = s.replace(bad, good);
  fs.writeFileSync(path, s);
  console.log("fixed import");
} else {
  // try CRLF variant
  const badCR = bad.replace(/\n/g, "\r\n");
  const goodCR = good.replace(/\n/g, "\r\n");
  if (s.includes(badCR)) {
    s = s.replace(badCR, goodCR);
    fs.writeFileSync(path, s);
    console.log("fixed import CRLF");
  } else {
    const i = s.indexOf("DECISION_PAGE_IDS: _unused");
    console.log("near", JSON.stringify(s.slice(i - 120, i + 200)));
    throw new Error("pattern not found");
  }
}
