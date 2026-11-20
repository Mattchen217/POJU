const fs = require("fs");
const path = "lib/poju/collecting-dc-turn.ts";
let text = fs.readFileSync(path, "utf8");
const nl = text.includes("\r\n") ? "\r\n" : "\n";

const idemStart = text.indexOf('if (turn.outcome === "idempotent_replay")');
const blockedStart = text.indexOf('if (turn.outcome === "planner_blocked")');
if (idemStart < 0 || blockedStart < 0) {
  console.error("markers missing", idemStart, blockedStart);
  process.exit(1);
}

function blockEnd(startIdx) {
  let i = text.indexOf("{", startIdx);
  let depth = 0, found = false;
  for (; i < text.length; i++) {
    if (text[i] === "{") { depth++; found = true; }
    else if (text[i] === "}") {
      depth--;
      if (found && depth === 0) return i + 1;
    }
  }
  return -1;
}

// Replace both blocks as a contiguous region from the earlier of the two
const first = Math.min(idemStart, blockedStart);
const firstLine = text.lastIndexOf(nl, first - 1) + nl.length;
const end1 = blockEnd(idemStart);
const end2 = blockEnd(blockedStart);
let regionEnd = Math.max(end1, end2);
while (text[regionEnd] === "\r" || text[regionEnd] === "\n") regionEnd++;

const old = text.slice(firstLine, regionEnd);
if (!old.includes("understanding != null") && !old.includes("readinessStop")) {
  // check current ask_planned line
  console.error("unexpected region:\n", old.slice(0, 300));
  process.exit(1);
}
if (old.includes("readinessStop")) {
  console.log("already patched");
  process.exit(0);
}

const L = (lines) => lines.join(nl) + nl;
const replacement = L([
'  // M2.3-R2-FU2: planner_blocked must win over any replay/mapping ambiguity.',
'  if (turn.outcome === "planner_blocked") {',
'    return {',
'      session: turn.session,',
'      outcome: "planner_blocked",',
'      ask_planned: false,',
'      persist_error: turn.persist_error,',
'      ...common,',
'      ask_error: turn.ask_error ?? "planner_blocked",',
'      authorized_question: null,',
'      plan: null,',
'    };',
'  }',
'  if (turn.outcome === "idempotent_replay") {',
'    // Do not treat understanding!=null alone as successful question planning.',
'    // Prefer an actual plan, or an explicit readiness-stop (can_ask=false terminal verdict).',
'    const readinessStop =',
'      turn.understanding != null &&',
'      turn.understanding.readiness.can_ask === false &&',
'      (turn.understanding.readiness.verdict === "ready_for_final_confirm" ||',
'        turn.understanding.readiness.verdict === "hard_budget_exhausted");',
'    return {',
'      session: turn.session,',
'      outcome: "not_applied",',
'      ask_planned: Boolean(turn.plan) || (readinessStop && !turn.ask_error),',
'      persist_error: turn.persist_error ?? "turn_already_mapped",',
'      ...common,',
'    };',
'  }',
]);

text = text.slice(0, firstLine) + replacement + text.slice(regionEnd);
fs.writeFileSync(path, text, "utf8");
console.log("collecting-dc-turn patched ok");
