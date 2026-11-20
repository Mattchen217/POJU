import fs from "node:fs";

function loadEnv(path) {
  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnv(".env.local");
const url = (env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.log(JSON.stringify({ ok: false, reason: "missing_kv" }));
  process.exit(0);
}

const key = `poju:cutover:smoke:${Date.now()}`;
const res = await fetch(`${url}/pipeline`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify([
    ["SET", key, "ok", "EX", 60],
    ["GET", key],
    ["DEL", key],
  ]),
});
const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = { raw: text.slice(0, 80) };
}
const results = Array.isArray(parsed?.result)
  ? parsed.result.map((x) => x?.result ?? x)
  : null;
console.log(
  JSON.stringify({
    ok: res.ok,
    status: res.status,
    url_host: new URL(url).host,
    results,
  }),
);
