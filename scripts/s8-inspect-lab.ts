import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const LAB_ID = process.argv[2]?.trim() || "lab_mw0zic7l_f3aa32ec";

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

async function main() {
  const { loadDeliveryLab } = await import("../lib/llm/pro/delivery/lab/store");
  const { derivePipelineCursor } = await import("../lib/llm/pro/delivery/lab/pipeline-cursor");
  const { normalizeAgentPhase } = await import("../lib/poju/agent-state");

  const lab = await loadDeliveryLab(LAB_ID);
  if (!lab) throw new Error("lab_not_found");

  const agenda = lab.chat_session?.agent_v2?.investigation_agenda ?? [];
  const turns = (lab.pipeline_turns ?? []).map((t) => ({
    phase: t.phase,
    kind: t.kind,
    obs_stages: (t.attempts ?? []).map((a) => a.observation?.stage ?? null),
    has_formal_dc: (t.attempts ?? []).map((a) => a.observation?.prompt?.has_formal_dc ?? null),
    validation: (t.attempts ?? []).map((a) => a.observation?.validation?.passed ?? null),
  }));

  const out = {
    lab_id: lab.lab_id,
    pipeline: lab.pipeline,
    cursor: derivePipelineCursor(lab),
    phase: normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase),
    unlocked: Boolean(lab.pipeline_delivery_unlocked),
    dc: lab.chat_session?.decision_context
      ? {
          status: lab.chat_session.decision_context.status,
          version: lab.chat_session.decision_context.version,
          facts: lab.chat_session.decision_context.reality_facts?.length ?? 0,
          constraints: lab.chat_session.decision_context.constraints?.length ?? 0,
          hypotheses: lab.chat_session.decision_context.hypotheses?.length ?? 0,
          dirs: lab.chat_session.decision_context.dirs?.length ?? 0,
          conflicts: lab.chat_session.decision_context.conflicts?.length ?? 0,
        }
      : null,
    binding:
      lab.chat_session?.last_delivery_context_binding ??
      lab.source.decision_context_binding ??
      null,
    agenda: agenda.map((a) => ({ id: a.id, label: a.label, status: a.status, critical: a.critical })),
    steps: Object.values(lab.steps ?? {}).map((s) => ({
      key: s.step_key,
      status: s.status,
    })),
    turn_count: turns.length,
    turns,
    source: {
      has_breakthrough_core: Boolean(lab.source.breakthrough_core),
      covered_agenda: lab.source.covered_agenda?.length ?? 0,
      question: (lab.source.original_question || "").slice(0, 80),
    },
  };

  const dir = resolve(ROOT, "temp/s8-live");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, "inspect-lab.json");
  writeFileSync(file, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
  console.log(`wrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
