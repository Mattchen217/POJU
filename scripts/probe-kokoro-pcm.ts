/**
 * One-shot: does OpenRouter Kokoro return usable PCM?
 * pnpm exec tsx scripts/probe-kokoro-pcm.ts
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("no key");
  const res = await fetch("https://openrouter.ai/api/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "hexgrad/kokoro-82m",
      input: "Hello from PCM probe.",
      voice: "af_heart",
      response_format: "pcm",
    }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  console.log("status", res.status, "ct", res.headers.get("content-type"), "bytes", buf.length);
  if (!res.ok) {
    console.log(buf.toString("utf8").slice(0, 500));
    process.exit(1);
  }
  mkdirSync(resolve(ROOT, "tmp/kokoro-listen"), { recursive: true });
  writeFileSync(resolve(ROOT, "tmp/kokoro-listen/pcm-probe.raw"), buf);
  console.log("ok pcm");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
