const fs = require("fs");
const f = process.argv[2];
const j = JSON.parse(fs.readFileSync(f, "utf8"));
console.log("expectations:", JSON.stringify(j.expectations), "ran_at:", j.ran_at);
const c0 = j.cases[0];
console.log("case keys:", Object.keys(c0).join(","));
for (const c of j.cases) {
  const exp = c.expectations || c.checks || [];
  const fails = (Array.isArray(exp) ? exp : []).filter((e) => !(e.ok === true || e.pass === true));
  const calls = (c.openrouter || c.calls || []).map((x) => `${x.http_status}${x.model ? "/" + x.model : ""}`).join(",");
  console.log(`${c.id || c.case_id} | ${c.title || c.label || ""} | exp ${(Array.isArray(exp) ? exp.length - fails.length : "?")}/${Array.isArray(exp) ? exp.length : "?"} | calls ${calls}`);
  for (const e of fails) console.log("   FAIL:", JSON.stringify(e).slice(0, 260));
}
const s = fs.readFileSync(f, "utf8");
console.log("secret-scan:", /sk-or-v1-(?!invalid)[A-Za-z0-9]{8,}/.test(s) ? "LEAK" : "clean", /Bearer\s+[A-Za-z0-9]/.test(s) ? "BEARER" : "", /OPENROUTER_API_KEY\s*=/.test(s) ? "ENV" : "");
