/**
 * S8 鈥?freeze existing unlocked lab DC (if sufficient) + bootstrap 鈫?thesis.
 *
 *   pnpm exec tsx scripts/s8-freeze-and-thesis.ts lab_xxx
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
  console.log(`[s8-ft] wrote ${file}`);
}

async function main() {
  if (!LAB_ID) throw new Error("usage: tsx scripts/s8-freeze-and-thesis.ts <lab_id>");

  const { loadDeliveryLab, saveDeliveryLab } = await import(
    "../lib/llm/pro/delivery/lab/store"
  );
  const { seedLabSourceFromChat } = await import(
    "../lib/llm/pro/delivery/lab/pipeline-jobs"
  );
  const { runLabStepV3, approveLabStepV3 } = await import(
    "../lib/llm/pro/delivery/lab/run-step-v3"
  );
  const { applySufficiencyFreezeToSession } = await import(
    "../lib/poju/decision-context/production-freeze-wire"
  );
  const { prepareFrozenDcForDelivery } = await import(
    "../lib/poju/decision-context/freeze-to-delivery"
  );
  const { evaluateDecisionSufficiency } = await import(
    "../lib/poju/decision-context"
  );

  let lab = await loadDeliveryLab(LAB_ID);
  if (!lab?.chat_session) throw new Error("lab_not_found");

  const suf = lab.chat_session.decision_context
    ? evaluateDecisionSufficiency(lab.chat_session.decision_context)
    : null;
  dump("ft-00-before", {
    dc_status: lab.chat_session.decision_context?.status ?? null,
    sufficiency: suf,
    binding: lab.source.decision_context_binding ?? null,
  });

  if (lab.chat_session.decision_context?.status === "draft") {
    const freeze = await applySufficiencyFreezeToSession(lab.chat_session);
    console.log("[s8-ft] freeze", {
      ok: freeze.ok,
      skipped: freeze.ok ? freeze.skipped : undefined,
      reason: freeze.ok && freeze.skipped ? freeze.reason : !freeze.ok ? freeze.reason : null,
    });
    if (freeze.ok) {
      lab = { ...lab, chat_session: freeze.session };
      if (
        lab.chat_session?.decision_context &&
        (lab.chat_session.decision_context.status === "final" ||
          lab.chat_session.decision_context.status === "superseded")
      ) {
        const prepared = prepareFrozenDcForDelivery({
          decision_context: lab.chat_session.decision_context,
          decision_context_versions: lab.chat_session.decision_context_versions,
        });
        lab = {
          ...lab,
          chat_session: {
            ...lab.chat_session,
            last_delivery_context_binding: prepared.decision_context_binding,
          },
        };
      }
      lab = seedLabSourceFromChat(lab);
      await saveDeliveryLab(lab);
    }
  }

  dump("ft-01-after-freeze", {
    dc_status: lab.chat_session?.decision_context?.status ?? null,
    binding:
      lab.source.decision_context_binding ??
      lab.chat_session?.last_delivery_context_binding ??
      null,
    snapshot: Boolean(lab.source.decision_context_snapshot),
  });

  // bootstrap 鈫?approve 鈫?thesis
  for (const step of ["bootstrap", "thesis.gen"] as const) {
    console.log(`[s8-ft] run ${step}`);
    let result = await runLabStepV3(lab, step);
    lab = result.lab;
    await saveDeliveryLab(lab);
    dump(`ft-run-${step.replace(".", "_")}`, {
      ok: result.ok,
      reason: "reason" in result ? result.reason : null,
      status: lab.steps[step]?.status,
      gate: lab.steps[step]?.attempts?.at(-1)?.gate_verdict ?? null,
      obs: lab.steps[step]?.attempts?.at(-1)?.observation ?? null,
    });
    if (!result.ok) throw new Error(`${step}_failed:${"reason" in result ? result.reason : "?"}`);
    const appr = await approveLabStepV3(lab, step);
    if (!appr.ok) throw new Error(`${step}_approve_failed:${appr.reason}`);
    lab = appr.lab;
    await saveDeliveryLab(lab);
  }

  dump("ft-02-final", {
    dc_status: lab.chat_session?.decision_context?.status ?? null,
    binding: lab.source.decision_context_binding ?? null,
    thesis: lab.steps["thesis.gen"]?.status,
    cursor_index: lab.cursor_index,
  });
  console.log("[s8-ft] done", {
    dc: lab.chat_session?.decision_context?.status,
    binding: Boolean(lab.source.decision_context_binding),
    thesis: lab.steps["thesis.gen"]?.status,
  });
}

main().catch((e) => {
  console.error("[s8-ft] FAILED", e);
  process.exit(1);
});
