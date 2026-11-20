from pathlib import Path

# collecting-dc-turn: stamp last_answer_event on session in mapAdaptiveOutcome
p = Path(r"D:\POJU\pojulife\lib\poju\collecting-dc-turn.ts")
text = p.read_text(encoding="utf-8")
old = '''  const common = {
    authorized_question: turn.authorized_question,
    plan: turn.plan,
    understanding: turn.understanding,
    answer_event: turn.answer_event,
    ask_error: turn.ask_error,
    bootstrapped: turn.bootstrapped,
  };
'''
new = '''  const session = {
    ...turn.session,
    last_answer_event: turn.answer_event ?? turn.session.last_answer_event ?? null,
  };
  const common = {
    authorized_question: turn.authorized_question,
    plan: turn.plan,
    understanding: turn.understanding,
    answer_event: turn.answer_event,
    ask_error: turn.ask_error,
    bootstrapped: turn.bootstrapped,
  };
'''
assert old in text
text = text.replace(old, new, 1)
# replace turn.session with session in the return objects of this function only.
# Careful: `session: turn.session` appears multiple times in mapAdaptiveOutcome.
text = text.replace("session: turn.session,", "session,")
# That might have changed too much if there are other occurrences. Check.
p.write_text(text, encoding="utf-8", newline="\n")
print("collecting-dc-turn replacements:", text.count("session,"))
# show remaining turn.session
for i,l in enumerate(text.splitlines(),1):
    if "turn.session" in l or "session: session" in l or l.strip() == "session,":
        print(f"{i}: {l}")

# agent.ts threading
ap = Path(r"D:\POJU\pojulife\lib\poju\agent.ts")
at = ap.read_text(encoding="utf-8")

# 1) early workingSession copy after sessionForLlm adopt
old1 = '''          pending_answer_resolution: sessionForLlm.pending_answer_resolution,
          pending_intake_control: sessionForLlm.pending_intake_control,
        };
'''
new1 = '''          pending_answer_resolution: sessionForLlm.pending_answer_resolution,
          pending_intake_control: sessionForLlm.pending_intake_control,
          last_answer_event:
            sessionForLlm.last_answer_event ??
            m1CollectingTurn.answer_event ??
            workingSession.last_answer_event,
        };
'''
assert old1 in at, "workingSession pending fields not found"
at = at.replace(old1, new1, 1)

# 2) attachAuthorizedAssistantQuestion block
old2 = '''        pending_intake_control:
          m1CollectingTurn.session.pending_intake_control !== undefined
            ? m1CollectingTurn.session.pending_intake_control
            : sessionOut.pending_intake_control,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
      m1CollectingTurn.plan,
'''
new2 = '''        pending_intake_control:
          m1CollectingTurn.session.pending_intake_control !== undefined
            ? m1CollectingTurn.session.pending_intake_control
            : sessionOut.pending_intake_control,
        last_answer_event:
          m1CollectingTurn.session.last_answer_event ??
          m1CollectingTurn.answer_event ??
          sessionOut.last_answer_event,
        messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
      },
      m1CollectingTurn.plan,
'''
assert old2 in at, "attachAuthorizedAssistantQuestion pending fields not found"
at = at.replace(old2, new2, 1)

# 3) readiness stop block
old3 = '''      pending_intake_control:
        m1CollectingTurn.session.pending_intake_control !== undefined
          ? m1CollectingTurn.session.pending_intake_control
          : sessionOut.pending_intake_control,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
  }
'''
new3 = '''      pending_intake_control:
        m1CollectingTurn.session.pending_intake_control !== undefined
          ? m1CollectingTurn.session.pending_intake_control
          : sessionOut.pending_intake_control,
      last_answer_event:
        m1CollectingTurn.session.last_answer_event ??
        m1CollectingTurn.answer_event ??
        sessionOut.last_answer_event,
      messages: [...messagesWithUser, { ...assistantMessage, content: finalContent }],
    };
  }
'''
assert old3 in at, "readiness stop pending fields not found"
at = at.replace(old3, new3, 1)

ap.write_text(at, encoding="utf-8", newline="\n")
print("patched agent.ts")