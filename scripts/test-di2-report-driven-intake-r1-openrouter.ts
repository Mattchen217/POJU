/**
 * DI2 Report-Driven Intake R1 — live OpenRouter first-turn evidence (Case pack).
 * Requires OPENROUTER_API_KEY. Skips cleanly when absent.
 *
 * Run: pnpm exec tsx scripts/test-di2-report-driven-intake-r1-openrouter.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrapFreshSessionMainLoop } from "../lib/poju/decision-intake/fresh-session-bootstrap";
import type { POJUSessionState } from "../lib/poju/types";

const CASES = [
  {
    id: "career_stagnation",
    statement:
      "我从上一次的创业失败后，已经好几年没有收入了，一直找不到事情做，怎么办？",
  },
  {
    id: "job_offer_vs_stability",
    statement:
      "我拿到一个新 offer，薪水更高但要搬家，现在工作稳定，不知道要不要跳。",
  },
  {
    id: "relationship_boundary",
    statement:
      "我和伴侣因为要不要要孩子吵起来了，我很迷茫，不知道该怎么决定。",
  },
] as const;

function bareSession(statement: string): POJUSessionState {
  return {
    session_id: `sess_rdi_or_${Date.now()}`,
    messages: [],
    original_question: statement,
    locked_output_locale: "zh",
  } as POJUSessionState;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.log("SKIP: OPENROUTER_API_KEY not set");
    process.exit(0);
  }

  const outDir = join(
    process.cwd(),
    "docs/evidence/di2-report-driven-intake-r1-2026-11-20",
  );
  mkdirSync(outDir, { recursive: true });

  const results: Array<Record<string, unknown>> = [];
  for (const c of CASES) {
    const started = Date.now();
    const boot = await bootstrapFreshSessionMainLoop({
      session: bareSession(c.statement),
      statement: c.statement,
      source_turn_id: `or_${c.id}`,
      now: new Date().toISOString(),
      locale: "zh",
    });
    const layer = boot.session.decision_understanding?.current_intake_layer ?? null;
    const plan = boot.plan;
    const codeHint =
      boot.session.intake_ask_plan?.selected_candidate_id ?? null;
    results.push({
      case_id: c.id,
      statement: c.statement,
      outcome: boot.outcome,
      ask_error: boot.ask_error ?? null,
      latency_ms: Date.now() - started,
      current_intake_layer: layer,
      problem_gate:
        boot.session.decision_understanding?.intake_layer_gates
          ?.problem_understanding.passed ?? null,
      desired_gate:
        boot.session.decision_understanding?.intake_layer_gates?.desired_outcome
          .passed ?? null,
      code_rank_hint_candidate_id: codeHint,
      model_selected_candidate_id: plan?.candidate_id ?? null,
      model_autonomous_divergence:
        Boolean(codeHint) &&
        Boolean(plan?.candidate_id) &&
        codeHint !== plan?.candidate_id,
      question_text: plan?.question_text ?? null,
      model_response_text: boot.model_response_text ?? null,
      suggested_replies: boot.suggested_replies ?? null,
      report_missing_required:
        boot.session.decision_understanding?.report_coverage
          ?.missing_required_count ?? null,
    });
    console.log(
      `CASE ${c.id}: outcome=${boot.outcome} layer=${layer} model=${plan?.candidate_id} hint=${codeHint}`,
    );
  }

  writeFileSync(
    join(outDir, "openrouter-multi-case.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2),
  );
  console.log(`Wrote ${outDir}/openrouter-multi-case.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
