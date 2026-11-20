const fs = require("fs");
const path = "lib/poju/decision-intake/adaptive-turn.ts";
let text = fs.readFileSync(path, "utf8");
const marker = 'if (applied.skipped_reason === "turn_already_mapped")';
const idx = text.indexOf(marker);
if (idx < 0) { console.error("replay marker missing"); process.exit(1); }
const start = text.lastIndexOf("\n", idx - 1) + 1;
let i = idx;
let depth = 0;
let foundStart = false;
let end = -1;
for (; i < text.length; i++) {
  const ch = text[i];
  if (ch === "{") { depth++; foundStart = true; }
  else if (ch === "}") {
    depth--;
    if (foundStart && depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) { console.error("could not find end of replay block"); process.exit(1); }
if (text[end] === "\r") end++;
if (text[end] === "\n") end++;
const oldBlock = text.slice(start, end);
if (!oldBlock.includes('outcome: "idempotent_replay"')) {
  console.error("unexpected replay block");
  process.exit(1);
}
const newBlock = [
'      if (applied.skipped_reason === "turn_already_mapped") {',
'        // Idempotent replay: rebuild understanding/plan from existing DC, no dup writes.',
'        // M2.3-R2-FU2: preserve planner_blocked — do not drop nonterminal protection.',
'        current = activateNextBlueprintPriorityBand(current, input.now);',
'        const understanding = buildUnderstandingState({',
'          session: current,',
'          blueprint: current.decision_blueprint!,',
'          now: input.now,',
'          last_answer_event_id: answer_event.event_id,',
'        });',
'        const planned = await planFromState(current, understanding, input.now);',
'        if (planned.planner_block) {',
'          return {',
'            session: planned.session,',
'            outcome: "planner_blocked",',
'            ask_error: `${planned.planner_block.reason_code}:${planned.planner_block.detail}`,',
'            answer_event,',
'            understanding: planned.understanding,',
'            plan: planned.plan,',
'            authorized_question: planned.authorized_question,',
'            persist_error: "turn_already_mapped",',
'          };',
'        }',
'        return {',
'          session: planned.session,',
'          outcome: "idempotent_replay",',
'          answer_event,',
'          understanding: planned.understanding,',
'          plan: planned.plan,',
'          authorized_question: planned.authorized_question,',
'          persist_error: "turn_already_mapped",',
'        };',
'      }',
''
].join("\n");
text = text.slice(0, start) + newBlock + text.slice(end);
fs.writeFileSync(path, text, "utf8");
console.log("replay patched ok");
