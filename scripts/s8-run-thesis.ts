/**
 * S8 — run thesis.gen on unlocked lab (triggers DC freeze wire if eligible).
 *
 *   pnpm exec tsx scripts/s8-run-thesis.ts lab_xxx
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "temp/s8-live");
const LAB_ID = process.argv[2]?.trim();

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

function dump(name: string, payload: unknown) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[s8-thesis] wrote ${file}`);
}

async function main() {
  if (!LAB_ID) throw new Error("usage: tsx scripts/s8-run-thesis.ts <lab_id>");
  const { loadDeliveryLab, saveDeliveryLab } = await import(
    "../lib/llm/pro/delivery/lab/store"
  );
  const { runLabStepV3 } = await import("../lib/llm/pro/delivery/lab/run-step-v3");
  const { labUsesV3Executor } = await import("../lib/llm/pro/delivery/lab/pipeline-stamp");

  let lab = await loadDeliveryLab(LAB_ID);
  if (!lab) throw new Error("lab_not_found");
  if (!lab.pipeline_delivery_unlocked) throw new Error("pipeline_delivery_locked");
  if (!labUsesV3Executor(lab.pipeline)) throw new Error("lab_not_v3");

  dump("thesis-00-before", {
    dc_status: lab.chat_session?.decision_context?.status ?? null,
    binding:
      lab.chat_session?.last_delivery_context_binding ??
      lab.source.decision_context_binding ??
      null,
    step: lab.steps["thesis.gen"]?.status ?? null,
  });

  console.log("[s8-thesis] running thesis.gen…");
  const result = await runLabStepV3(lab, "thesis.gen");
  lab = (await loadDeliveryLab(LAB_ID)) ?? result.lab;
  // runLabStepV3 should have saved; reload for authority
  dump("thesis-01-result", {
    ok: result.ok,
    reason: "reason" in result ? result.reason : null,
    step: lab.steps["thesis.gen"]
      ? {
          status: lab.steps["thesis.gen"].status,
          attempts: lab.steps["thesis.gen"].attempts?.length ?? 0,
          last_err: lab.steps["thesis.gen"].attempts?.at(-1)?.error ?? null,
          obs: lab.steps["thesis.gen"].attempts?.at(-1)?.observation ?? null,
          gate: lab.steps["thesis.gen"].attempts?.at(-1)?.gate_verdict ?? null,
        }
      : null,
    dc_status: lab.chat_session?.decision_context?.status ?? null,
    binding:
      lab.chat_session?.last_delivery_context_binding ??
      lab.source.decision_context_binding ??
      null,
    snapshot_present: Boolean(lab.source.decision_context_snapshot),
  });

  // Ensure persisted
  await saveDeliveryLab(lab);
  console.log("[s8-thesis] done", {
    ok: result.ok,
    dc: lab.chat_session?.decision_context?.status,
    binding: Boolean(
      lab.chat_session?.last_delivery_context_binding ?? lab.source.decision_context_binding,
    ),
  });
}

main().catch((e) => {
  console.error("[s8-thesis] FAILED", e);
  process.exit(1);
});
