const fs = require("fs");
for (const f of fs.readdirSync("temp").filter((f) => /^m2-4-r2-real-e2e-\d+\.json$/.test(f)).sort()) {
  const j = JSON.parse(fs.readFileSync("temp/" + f, "utf8"));
  const bad = [];
  for (const t of j.transcript) for (const c of t.openrouter || []) if (c.http_status !== 200) bad.push(`turn${t.n}:${c.http_status}:${String(c.error || "").slice(0, 90)}`);
  console.log(f, bad.length ? bad.join(" | ") : "all 200");
}
