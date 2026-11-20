from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\agent.ts")
text = p.read_text(encoding="utf-8")
old = '''            adaptive_ask_plan: null,
            intake_ask_plan:
              m1CollectingTurn.session.intake_ask_plan ??
              blockedSession.intake_ask_plan,
          });
'''
new = '''            adaptive_ask_plan: null,
            intake_ask_plan:
              m1CollectingTurn.session.intake_ask_plan ??
              blockedSession.intake_ask_plan,
            pending_answer_resolution:
              m1CollectingTurn.session.pending_answer_resolution !== undefined
                ? m1CollectingTurn.session.pending_answer_resolution
                : blockedSession.pending_answer_resolution,
          });
'''
assert old in text, "planner_blocked return not found"
text = text.replace(old, new)
p.write_text(text, encoding="utf-8", newline="\n")
print("planner_blocked pending copy added")
