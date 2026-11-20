const fs = require("fs");
let key = process.env.OPENROUTER_API_KEY;
for (const f of [".env.local", ".env"]) {
  if (key) break;
  if (!fs.existsSync(f)) continue;
  const m = fs.readFileSync(f, "utf8").match(/^\s*OPENROUTER_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  if (m) key = m[1].trim();
}
if (!key) { console.log("NO_KEY"); process.exit(0); }
fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${key}` } })
  .then(async (r) => {
    const j = await r.json().catch(() => ({}));
    const d = j.data || {};
    console.log(JSON.stringify({ status: r.status, total_credits: d.total_credits, total_usage: d.total_usage }));
  })
  .catch((e) => console.log("ERR", e.message));
