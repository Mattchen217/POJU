/**
 * Guards for v2 phased pipeline (no network).
 * Run: pnpm exec tsx scripts/test-v2-phased-guards.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const routes = [
  "app/api/profile/base-analysis-v2/phase/compute/route.ts",
  "app/api/profile/base-analysis-v2/phase/narrative/route.ts",
  "app/api/profile/base-analysis-v2/phase/evidence/route.ts",
  "app/api/profile/base-analysis-v2/phase/finalize/route.ts",
  "app/api/profile/base-analysis-v2/phase/abort/route.ts",
];

for (const r of routes) {
  assert.equal(existsSync(join(root, r)), true, `missing ${r}`);
  const src = read(r);
  assert.match(src, /maxDuration\s*=\s*300|export async function POST/, `${r} should be a POST route`);
}

const client = read("lib/base-analysis/stream-sse-client.ts");
assert.match(client, /phase\/compute/);
assert.match(client, /phase\/narrative/);
assert.match(client, /phase\/evidence/);
assert.match(client, /phase\/finalize/);
assert.match(client, /saveV2Checkpoint|persistCheckpoint/);
assert.match(client, /v2_evidence/);
assert.match(client, /WAIT_SEMANTIC_ARTIFACT_MS/);
assert.match(client, /WAIT_FINAL_AUDIT_MS/);
assert.doesNotMatch(client, /emit\([^)]*"v2_translate",\s*"translate"\)/);

const checkpoint = read("lib/base-analysis/v2-checkpoint-store.ts");
assert.match(checkpoint, /base_analysis_v2_checkpoints/);

const progress = read("lib/base-analysis/progress-stages.ts");
assert.match(progress, /BaseAnalysisArtifactKind/);
assert.match(progress, /artifact\?/);
assert.match(progress, /v2_semantic_text/);
assert.match(progress, /v2_final_audit/);

const zh = read("messages/zh.json");
assert.match(zh, /正在推演证据链与底层依据/);
assert.match(zh, /多维度能量结构分析已完成/);
assert.match(zh, /逻辑与推演依据已标注/);
assert.match(zh, /深度语义构建已完成/);

const en = read("messages/en.json");
assert.match(en, /Deducing evidence chain/);
assert.match(en, /compute_done/);
assert.match(en, /Converting high-dimensional/);
assert.doesNotMatch(en, /Translating into your language/);

console.log("✅ v2 phased guards PASS");
