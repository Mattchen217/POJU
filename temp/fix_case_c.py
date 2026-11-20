from pathlib import Path
root = Path(r"D:/POJU/pojulife")
rel = root / "scripts/test-m2-3-decision-blueprint.ts"
raw = rel.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw.replace("\r\n", "\n")

old_hdr = " *  M2.3-R2-FU2 Preserve planner_blocked across idempotent replay + planner exception\n */"
new_hdr = (
    " *  M2.3-R2-FU2 Preserve planner_blocked across idempotent replay + planner exception\n"
    " *  M2.3-R2-FU3 Fail-closed when Understanding cannot be built; Case C false-pass fixed\n"
    " */"
)
assert old_hdr in s, "header"
s = s.replace(old_hdr, new_hdr, 1)

old_true = "assert.ok(s.decision_understanding?.next_question_plan || s.adaptive_ask_plan || true);"
new_true = (
    "assert.ok(\n"
    "        s.decision_understanding?.next_question_plan || s.adaptive_ask_plan,\n"
    "        \"precondition: session should already have a plan from opening\",\n"
    "      );"
)
assert old_true in s, "true"
s = s.replace(old_true, new_true, 1)

early = (
    "      assert.ok(\n"
    "        first.outcome === \"planned\" ||\n"
    "          first.outcome === \"ready_no_question\" ||\n"
    "          first.outcome === \"planner_blocked\",\n"
    "        `first turn unexpected: ${first.outcome}`,\n"
    "      );\n"
    "      // If first somehow blocked (unlikely with healthy budget), skip strict replay shape.\n"
    "      if (first.outcome === \"planner_blocked\") {\n"
    "        console.log(\"    skip Case C strict replay: first turn unexpectedly blocked\");\n"
    "        return;\n"
    "      }\n"
)
early_repl = (
    "      assert.notEqual(\n"
    "        first.outcome,\n"
    "        \"planner_blocked\",\n"
    "        `Case C first turn must not be planner_blocked, got ${first.outcome} ask_error=${first.ask_error}`,\n"
    "      );\n"
    "      assert.ok(\n"
    "        first.outcome === \"planned\" ||\n"
    "          first.outcome === \"ready_no_question\" ||\n"
    "          first.outcome === \"idempotent_replay\",\n"
    "        `first turn unexpected: ${first.outcome}`,\n"
    "      );\n"
)
assert early in s, "early"
s = s.replace(early, early_repl, 1)

out = s.replace("\n", "\r\n") if nl == "\r\n" else s
rel.write_text(out, encoding="utf-8", newline="")
print("case C fixed")
