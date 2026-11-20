const fs = require("fs");
const path = "D:/POJU/pojulife/app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

// Hoist m22 claim vars next to inlineCall so catch can release.
const inlineDecl = "let inlineCall: (() => Promise<NextResponse>) | null = null;";
if (!s.includes(inlineDecl)) {
  console.error("inlineCall decl missing");
  process.exit(1);
}
if (!s.includes("let m22_claim_token_outer")) {
  s = s.replace(
    inlineDecl,
    inlineDecl +
      "\n  // M2.2-R3: hoisted so catch / early-return cleanup can CAS-release.\n" +
      "  let m22_claim_token: string | null = null;\n" +
      "  let m22_claim_key: string | null = null;"
  );
}

// Remove the inner redeclarations (let m22_claim_token / let m22_claim_key)
// Keep m22_report_job_id and m22_reused_completed as inner lets.
const inner = `    let m22_claim_token: string | null = null;
    let m22_claim_key: string | null = null;
    let m22_report_job_id: string | null = null;
    let m22_reused_completed = false;`;

// Handle both \n and \r\n
const innerRe = /let m22_claim_token: string \| null = null;\r?\n\s*let m22_claim_key: string \| null = null;\r?\n\s*let m22_report_job_id/;
if (!innerRe.test(s)) {
  console.error("inner decl pattern missing");
  // show nearby
  const i = s.indexOf("let m22_claim_token");
  console.error(JSON.stringify(s.slice(i, i + 200)));
  process.exit(1);
}
s = s.replace(
  innerRe,
  "let m22_report_job_id"
);
// Wait - that leaves "let m22_report_job_id: string | null = null;" but we consumed through m22_report_job_id without the rest.
// Fix: replace properly
