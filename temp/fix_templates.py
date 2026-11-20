from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
t = p.read_text(encoding="utf-8")
t = t.replace(
    "    const clarifyKey = dc_conflict_clarify::;",
    "    const clarifyKey = `dc_conflict_clarify:${current.session_id}:${input.source_turn_id}`;",
)
t = t.replace(
    """          ask_error: planned.planner_block
            ? ${planned.planner_block.reason_code}:
            : undefined,""",
    """          ask_error: planned.planner_block
            ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
            : undefined,""",
)
if "dc_conflict_clarify:${current.session_id}" not in t:
    raise SystemExit("key template not repaired")
if "${planned.planner_block.reason_code}:${planned.planner_block.detail}" not in t:
    raise SystemExit("ask_error template not repaired")
p.write_text(t, encoding="utf-8", newline="\n")
print("repaired templates")
