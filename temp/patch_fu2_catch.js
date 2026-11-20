const fs = require("fs");
const path = "lib/poju/decision-intake/adaptive-turn.ts";
let text = fs.readFileSync(path, "utf8");
const nl = text.includes("\r\n") ? "\r\n" : "\n";

const marker = "const understanding0 = buildUnderstandingState({";
const idx = text.indexOf(marker);
if (idx < 0) { console.error("understanding0 missing"); process.exit(1); }
// walk back to start of "  try {"
const tryIdx = text.lastIndexOf("try {", idx);
if (tryIdx < 0) { console.error("try missing"); process.exit(1); }
// include leading whitespace on that line
const absTry = text.lastIndexOf(nl, tryIdx - 1) + nl.length;

let i = text.indexOf("{", tryIdx);
let depth = 0, found = false, tryEnd = -1;
for (; i < text.length; i++) {
  if (text[i] === "{") { depth++; found = true; }
  else if (text[i] === "}") {
    depth--;
    if (found && depth === 0) { tryEnd = i + 1; break; }
  }
}
const afterTry = text.slice(tryEnd);
const catchMatch = afterTry.match(/^\s*catch\s*\(\s*e\s*\)\s*\{/);
if (!catchMatch) {
  console.error("no catch", JSON.stringify(afterTry.slice(0, 60)));
  process.exit(1);
}
let j = tryEnd + catchMatch[0].length - 1;
depth = 0; found = false;
let catchEnd = -1;
for (; j < text.length; j++) {
  if (text[j] === "{") { depth++; found = true; }
  else if (text[j] === "}") {
    depth--;
    if (found && depth === 0) { catchEnd = j + 1; break; }
  }
}
while (text[catchEnd] === "\r" || text[catchEnd] === "\n") catchEnd++;

const old = text.slice(absTry, catchEnd);
if (!old.includes("ready_no_question")) {
  console.error("unexpected");
  process.exit(1);
}

const L = (lines) => lines.join(nl) + nl;
const replacement = L([
'  let understanding0: UnderstandingState | null = null;',
'  try {',
'    understanding0 = buildUnderstandingState({',
'      session: current,',
'      blueprint: current.decision_blueprint!,',
'      now: input.now,',
'      last_answer_event_id: answer_event?.event_id ?? null,',
'    });',
'    const planned = await planFromState(current, understanding0, input.now);',
'    return {',
'      session: planned.session,',
'      outcome: outcomeFromPlanResult(planned),',
'      ask_error: planned.planner_block',
'        ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`',
'        : undefined,',
'      answer_event,',
'      understanding: planned.understanding,',
'      plan: planned.plan,',
'      authorized_question: planned.authorized_question,',
'      persist_error,',
'    };',
'  } catch (e) {',
'    // M2.3-R2-FU2: planner/understanding exception must not disguise as investigation complete',
'    // while Blueprint P0/P1 obligations remain and hard budget remains.',
'    const err = errorText(e);',
'    let u = understanding0;',
'    if (!u) {',
'      try {',
'        u = buildUnderstandingState({',
'          session: current,',
'          blueprint: current.decision_blueprint!,',
'          now: input.now,',
'          last_answer_event_id: answer_event?.event_id ?? null,',
'        });',
'      } catch {',
'        u = null;',
'      }',
'    }',
'    if (u) {',
'      const openP0P1 = openBlueprintP0P1Needs(u);',
'      if (openP0P1.length > 0 && u.budget.remaining_hard_budget > 0) {',
'        const blockedU: UnderstandingState = {',
'          ...u,',
'          next_question_plan: null,',
'          readiness: {',
'            ...u.readiness,',
'            verdict: "continue",',
'            can_ask: true,',
'            reasons: [',
'              ...u.readiness.reasons,',
'              "open_blueprint_p0_p1_obligations",',
'              "planner_blocked",',
'              "planner_exception",',
'            ],',
'          },',
'        };',
'        return {',
'          session: withUnderstanding(',
'            current,',
'            blockedU,',
'            null,',
'            current.intake_ask_plan ?? null,',
'          ),',
'          outcome: "planner_blocked",',
'          ask_error: `planner_exception:${err}`,',
'          answer_event,',
'          understanding: blockedU,',
'          plan: null,',
'          authorized_question: null,',
'          persist_error,',
'        };',
'      }',
'    }',
'    return {',
'      session: current,',
'      outcome: "ready_no_question",',
'      answer_event,',
'      understanding: u,',
'      plan: null,',
'      authorized_question: null,',
'      persist_error,',
'      ask_error: err,',
'    };',
'  }',
]);

text = text.slice(0, absTry) + replacement + text.slice(catchEnd);
fs.writeFileSync(path, text, "utf8");
console.log("catch patched ok");
