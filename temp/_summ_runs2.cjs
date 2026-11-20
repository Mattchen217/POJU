const fs = require("fs");
const files = fs.readdirSync("temp").filter((f) => /^m2-4-r2-(openrouter-smoke|real-e2e)-\d+\.json$/.test(f)).sort();
for (const f of files) {
  const j = JSON.parse(fs.readFileSync("temp/" + f, "utf8"));
  console.log("=== " + f);
  console.log("transport:", JSON.stringify(j.transport), "stubbed:", JSON.stringify(j.stubbed), "redaction:", JSON.stringify(j.redaction));
  if (j.kind && String(j.kind).includes("smoke")) {
    const ex = j.expectations || [];
    const arr = Array.isArray(ex) ? ex : Object.values(ex);
    const pass = arr.filter((e) => e.pass === true || e.ok === true).length;
    console.log("expectations:", pass, "/", arr.length);
    for (const e of arr) if (!(e.pass === true || e.ok === true)) console.log("  FAIL", JSON.stringify(e).slice(0, 300));
    console.log("cases:", (j.cases || []).map((c) => `${c.id || c.case_id}:${c.http_status ?? c.status ?? ""}`).join(" "));
  } else {
    console.log("phase5:", JSON.stringify(j.phase5_page_generation), "calls:", JSON.stringify(j.openrouter_calls).slice(0, 300));
    console.log("checks:", JSON.stringify(j.checks, null, 0).slice(0, 2500));
    const t = j.transcript || [];
    console.log("turns:", t.length, "last:", JSON.stringify(t[t.length - 1]).slice(0, 600));
  }
}
