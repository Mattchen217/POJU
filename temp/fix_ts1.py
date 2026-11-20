from pathlib import Path

# 1) collecting-dc-turn duplicate ask_error
p = Path(r"lib/poju/collecting-dc-turn.ts")
t = p.read_text(encoding="utf-8")
old = '''  if (turn.outcome === "planner_blocked") {
    return {
      session: turn.session,
      outcome: "planner_blocked",
      ask_planned: false,
      persist_error: turn.persist_error,
      ask_error: turn.ask_error ?? "planner_blocked",
      ...common,
      authorized_question: null,
      plan: null,
    };
  }'''
new = '''  if (turn.outcome === "planner_blocked") {
    return {
      session: turn.session,
      outcome: "planner_blocked",
      ask_planned: false,
      persist_error: turn.persist_error,
      ...common,
      ask_error: turn.ask_error ?? "planner_blocked",
      authorized_question: null,
      plan: null,
    };
  }'''
if old not in t:
    raise SystemExit("planner_blocked map block not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("fixed collecting-dc-turn ask_error order")

# 2) agent.ts meta + phase typing
p = Path(r"lib/poju/agent.ts")
t = p.read_text(encoding="utf-8")

# Find POJUMessage meta typing for m1_outcome
# Look at persist_failed meta
idx = t.find("m1_fail_closed: true")
print("fail_closed meta context:")
print(t[idx-100:idx+200])

# Search for m1_outcome type definition
