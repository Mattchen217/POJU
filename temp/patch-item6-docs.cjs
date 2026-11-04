const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (!pkg.scripts["test:decision-context-phase3-job"]) {
  pkg.scripts["test:decision-context-phase3-job"] =
    "tsx scripts/test-decision-context-phase3-job-idempotency.ts";
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  console.log("package.json script added");
} else console.log("script exists");

const idx = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
let s = fs.readFileSync(idx, "utf8");
if (!s.includes("| P3-131 |")) {
  const anchor = "| P3-112 |";
  const i = s.indexOf(anchor);
  const lineEnd = s.indexOf("\n", i);
  const extra =
    "\n| P3-131 | Job write OK index missing → Reload recovers | §18.4 / ITEM6 | test-decision-context-phase3-job-idempotency.ts | latest-candidate recover; retry same job_id |\n| P3-132 | Job OK Binding fail → recover binds original | §18.4 / ITEM6 | test-decision-context-phase3-job-idempotency.ts | getByClientTaskId + bind original |\n| P3-133 | Same Session different Generation no mis-bind | §18.4 / ITEM6 | test-decision-context-phase3-job-idempotency.ts | phase-isolated identities |\n| P3-134 | Different Sessions same client_task_id isolated | §18.4 / ITEM6 | test-decision-context-phase3-job-idempotency.ts | no cross-session job |\n| P3-135 | Synthesis/FD/POJU shared store no identity collide | §18.4 / ITEM6 / J4-lite | test-decision-context-phase3-job-idempotency.ts | phase keys isolate callers |\n| P3-96* | Concurrent + response-lost retry one Job | §18.4 / ITEM6 | test-decision-context-phase3-job-idempotency.ts | Promise.all same identity; sequential retry |";
  s = s.slice(0, lineEnd) + extra + s.slice(lineEnd);
  fs.writeFileSync(idx, s);
  console.log("index rows added");
}

const wu = "docs/phase3/PHASE3-S5-WRITEUP.md";
let w = fs.readFileSync(wu, "utf8");
if (!w.includes("ITEM 6") && w.includes("P3-112 remediated")) {
  w = w.replace(
    "- P3-112 remediated: confirmFact/Constraint require real user-message provenance on current Session",
    "- P3-112 remediated: confirmFact/Constraint require real user-message provenance on current Session\n- ITEM 6 remediated: createXhighJob uses SET NX client_task claim; lookup repairs via latest candidate; dangling index → recovery_required",
  );
  fs.writeFileSync(wu, w);
  console.log("writeup note added");
}
