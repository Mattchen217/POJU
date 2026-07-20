/**
 * Guard: production client points at v2 stream (job + poll).
 *   pnpm exec tsx scripts/test-v2-client-switch.ts
 */
import fs from "node:fs";
import path from "node:path";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const root = process.cwd();
const client = fs.readFileSync(
  path.join(root, "lib/base-analysis/stream-sse-client.ts"),
  "utf8",
);
const route = fs.readFileSync(
  path.join(root, "app/api/profile/base-analysis-v2/stream/route.ts"),
  "utf8",
);

assert(
  "client BASE_ANALYSIS_STREAM_PATH = v2",
  client.includes('BASE_ANALYSIS_STREAM_PATH = "/api/profile/base-analysis-v2/stream"'),
);
assert("client POST 走 v2 path 常量", client.includes("BASE_ANALYSIS_STREAM_PATH"));
assert("client 不再硬编码 v1 stream", !client.includes('"/api/profile/base-analysis/stream"'));
assert("client 轮询 status", client.includes("/api/profile/base-analysis/status"));
assert("client 轮询上限 ≥300s", /POLL_MAX_MS\s*=\s*320_000/.test(client));
assert("v2 route maxDuration=300 (Hobby)", /export const maxDuration = 300/.test(route));
assert("v2 route after()", route.includes("after("));
assert("v2 route runReportV2", route.includes("runReportV2"));

console.log(failures.length ? "❌ v2 client switch failed" : "✅ v2 client switch ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
