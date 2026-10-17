const fs = require("fs");
const path = require("path");

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

// ---------- 1) reply-options.ts: export clearDyadGateUi ----------
{
  const p = "lib/poju/reply-options.ts";
  let s = read(p);
  if (!s.includes("export function clearDyadGateUi")) {
    s = s.trimEnd() + `

/** Hide dyad chips + clear dyad_gate_pending so UI cannot stick after skip/collect. */
export function clearDyadGateUi(session: POJUSessionState): POJUSessionState {
  const consumed = consumeReplyOptionsOnSession(session);
  let changed = consumed !== session;
  const messages = consumed.messages.map((m) => {
    if (m.role !== "assistant" || !m.meta?.dyad_gate_pending) return m;
    changed = true;
    return {
      ...m,
      meta: {
        ...m.meta,
        dyad_gate_pending: false,
      },
    };
  });
  return changed ? { ...consumed, messages } : consumed;
}
`;
    write(p, s);
  } else {
    console.log("skip reply-options (already has clearDyadGateUi)");
  }
}

// ---------- 2) pipeline-jobs: use shared clearDyadGateUi ----------
{
  const p = "lib/llm/pro/delivery/lab/pipeline-jobs.ts";
  let s = read(p);
  if (s.includes("function clearDyadGateUi(session: POJUSessionState)")) {
    s = s.replace(
      /import \{ consumeReplyOptionsOnSession \} from "@\/lib\/poju\/reply-options";\r?\n\r?\n\/\*\* Hide dyad chips \+ clear dyad_gate_pending so LAB toolbar cannot stick after resolve\. \*\/\r?\nfunction clearDyadGateUi\(session: POJUSessionState\): POJUSessionState \{\r?\n  const consumed = consumeReplyOptionsOnSession\(session\);\r?\n  const messages = consumed\.messages\.map\(\(m\) => \{\r?\n    if \(m\.role !== "assistant" \|\| !m\.meta\?\.dyad_gate_pending\) return m;\r?\n    return \{\r?\n      \.\.\.m,\r?\n      meta: \{\r?\n        \.\.\.m\.meta,\r?\n        dyad_gate_pending: false,\r?\n      \},\r?\n    \};\r?\n  \}\);\r?\n  return \{ \.\.\.consumed, messages \};\r?\n\}\r?\n/,
      'import { clearDyadGateUi } from "@/lib/poju/reply-options";\n'
    );
    if (s.includes("function clearDyadGateUi(session: POJUSessionState)")) {
      // fallback simpler replace
      s = s.replace(
        'import { consumeReplyOptionsOnSession } from "@/lib/poju/reply-options";',
        'import { clearDyadGateUi } from "@/lib/poju/reply-options";'
      );
      const start = s.indexOf("/** Hide dyad chips + clear dyad_gate_pending");
      const end = s.indexOf("import { buildCoveredAgendaEvidence }");
      if (start >= 0 && end > start) {
        s = s.slice(0, start) + s.slice(end);
      }
    }
    write(p, s);
  } else {
    console.log("skip pipeline-jobs clearDyadGateUi local");
  }
}

console.log("part1 done");
