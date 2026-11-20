const fs = require("fs");
const files = fs.readdirSync("temp").filter((f) => /^m2-4-r2-(openrouter-smoke|real-e2e)-\d+\.json$/.test(f)).sort();
for (const f of files) {
  const j = JSON.parse(fs.readFileSync("temp/" + f, "utf8"));
  const out = { file: f, keys: Object.keys(j) };
  for (const k of ["git_head", "head", "model", "summary", "result", "outcome", "verdict", "final", "freeze", "blocker", "error"]) {
    if (j[k] !== undefined) out[k] = typeof j[k] === "object" ? JSON.stringify(j[k]).slice(0, 900) : j[k];
  }
  console.log(JSON.stringify(out, null, 1));
}
