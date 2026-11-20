/**
 * Live OpenRouter evidence for DI2 Production Interaction R1.
 * Proves: opening facts → Understanding model → suggested_replies → model-led candidate.
 * Does NOT declare product PASS.
 *
 * Run: pnpm exec tsx scripts/test-di2-production-interaction-r1-openrouter.ts
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const STATEMENT =
  "我从上一次的创业失败后，已经好几年没有收入了，一直找不到事情做，怎么办？";

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("SKIP: OPENROUTER_API_KEY missing");
    process.exit(2);
  }

  const { bootstrapFreshSessionMainLoop, __setM1rPersistForTests } = await import(
    "../lib/poju/decision-intake/fresh-session-bootstrap"
  );
  const { projectDecisionUnderstandingBox } = await import(
    "../lib/poju/decision-intake/ui-projection"
  );
  const { matchOpeningClaims } = await import(
    "../lib/poju/decision-intake/opening-asserted-facts"
  );

  const now = new Date().toISOString();
  const sessionIn = {
    session_id: `di2_r1_${Date.now()}`,
    original_question: STATEMENT,
    locked_output_locale: "zh",
    messages: [
      {
        role: "user" as const,
        content: STATEMENT,
        timestamp: now,
        client_id: "u1",
      },
    ],
  };

  __setM1rPersistForTests(async (_prev, next) => ({
    session: next,
    committed: true,
  }));

  console.log("Running bootstrapFreshSessionMainLoop (live OpenRouter)…");
  let turn;
  try {
    turn = await bootstrapFreshSessionMainLoop({
      session: sessionIn as never,
      statement: STATEMENT,
      source_turn_id: "turn_r1_open",
      now,
      locale: "zh",
    });
  } finally {
    __setM1rPersistForTests(null);
  }

  console.log("outcome", turn.outcome, "ask_error", turn.ask_error, "bootstrapped", turn.bootstrapped);
  const session = turn.session;
  const opening = matchOpeningClaims(STATEMENT);
  const openFacts = (session.decision_context?.reality_facts ?? []).filter((f) =>
    f.fact_id.startsWith("fact_open_"),
  );
  const box = projectDecisionUnderstandingBox(session);
  const replies = turn.suggested_replies ?? null;
  const selected = turn.plan?.candidate_id ?? null;
  const codeHint = session.intake_ask_plan?.selected_candidate_id ?? null;

  const evidence = {
    ok: true,
    parent_sha: "6427903331a00d2a613f06cba87a14d6552b5bc8",
    statement: STATEMENT,
    outcome: turn.outcome,
    ask_error: turn.ask_error ?? null,
    opening_claim_keys: opening.map((c) => c.claim_key),
    open_fact_ids: openFacts.map((f) => f.fact_id),
    open_fact_statements: openFacts.map((f) => f.statement),
    understood_labels: box.already_understood,
    progress_percent: box.progress_percent,
    current_understanding: box.current_understanding,
    still_need: box.still_need.slice(0, 12),
    personal_pattern: box.personal_pattern_insights,
    show_personal_pattern: box.show_personal_pattern,
    model_response_text: turn.model_response_text ?? null,
    authorized_question: turn.authorized_question ?? null,
    suggested_replies: replies,
    code_rank_hint_candidate: codeHint,
    model_selected_candidate: selected,
    model_chose_differently:
      Boolean(selected && codeHint && selected !== codeHint),
    plan_dir_ids: turn.plan?.dir_ids ?? [],
    scoring_path: turn.plan?.scoring_path ?? null,
    profile_hash: turn.profile_hash ?? null,
  };

  assert.ok(openFacts.length >= 3, `expected >=3 opening facts, got ${openFacts.length}`);
  assert.ok(box.already_understood.length >= 3, "Understood must show opening claims");
  assert.ok(replies && replies.length === 3, "suggested_replies must be 3");
  assert.ok(turn.model_response_text?.trim(), "model_response_text required");
  assert.ok(selected, "model/plan must select a candidate");
  // Reasoning must not leak into user-visible response.
  assert.doesNotMatch(
    turn.model_response_text ?? "",
    /code_selected_plan|legal_candidates|Reasoning|JSON\.stringify/i,
  );

  const outDir = resolve(
    process.cwd(),
    "docs/evidence/di2-production-interaction-r1-2026-11-20",
  );
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "openrouter-first-turn.json");
  writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");
  console.log("WROTE", outPath);
  console.log(JSON.stringify(evidence, null, 2));
  console.log("LIVE R1 first-turn evidence OK (not product PASS)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
